import type { FastifyInstance } from 'fastify';

const TD_KEY = process.env.TWELVE_DATA_API_KEY ?? '';

// Map timeframe string → granularity in seconds
const TF_SECONDS: Record<string, number> = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '30m': 1800,
  '1h': 3600,
  '4h': 14400,
  '1d': 86400,
};

const COINBASE_GRANULARITIES = [60, 300, 900, 3600, 21600, 86400];

// Crypto symbols (must match the price feed list)
const CRYPTO_SYMBOLS = new Set([
  'BTCUSD', 'ETHUSD', 'SOLUSD', 'XRPUSD', 'DOGEUSD', 'ADAUSD', 'AVAXUSD',
  'LINKUSD', 'DOTUSD', 'MATICUSD', 'SHIBUSD', 'LTCUSD', 'UNIUSD', 'ATOMUSD',
  'NEARUSD', 'APTUSD', 'ARBUSD', 'OPUSD', 'FILUSD', 'ICPUSD', 'INJUSD',
  'SUIUSD', 'TIAUSD', 'SEIUSD', 'ETCUSD', 'BCHUSD', 'STXUSD', 'RNDRUSD',
  'PEPEUSD', 'WIFUSD', 'BONKUSD', 'JUPUSD', 'PYTHUSD', 'WLDUSD', 'AAVEUSD',
  'MKRUSD', 'SNXUSD', 'CRVUSD', 'COMPUSD', 'LDOUSD', 'PENDLEUSD', 'ENAUSD',
  'SANDUSD', 'AXSUSD', 'MANAUSD', 'APEUSD', 'GALAUSD',
]);

/** Vanta symbol → Twelve Data symbol */
const TD_SYMBOL: Record<string, string> = {
  EURUSD: 'EUR/USD',
  GBPUSD: 'GBP/USD',
  USDJPY: 'USD/JPY',
  AUDUSD: 'AUD/USD',
  USDCAD: 'USD/CAD',
  XAUUSD: 'XAU/USD',
  AAPL: 'AAPL',
  TSLA: 'TSLA',
  AMZN: 'AMZN',
};

/** Vanta tf → Twelve Data interval */
const TD_INTERVAL: Record<string, string> = {
  '1m': '1min',
  '5m': '5min',
  '15m': '15min',
  '30m': '30min',
  '1h': '1h',
  '4h': '4h',
  '1d': '1day',
};

interface Bar {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// In-memory cache to avoid hammering upstreams
interface CacheEntry { bars: Bar[]; ts: number }
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30_000;

export async function barsRoutes(app: FastifyInstance) {
  app.get('/:symbol', async (req, reply) => {
    const { symbol } = req.params as { symbol: string };
    const tf = ((req.query as any)?.tf ?? '1m') as string;
    const limit = Math.min(1000, Math.max(50, Number((req.query as any)?.limit ?? 500)));
    // T.21: optional `before` (unix seconds) for historical pagination.
    // When supplied the route returns the `limit` bars ending at `before`
    // instead of the most recent `limit` bars. Both Coinbase and Twelve Data
    // accept arbitrary end-of-window, so the historical floor is whatever
    // the upstream serves (Coinbase: years of crypto data; TD: 5000 bars
    // on free tier).
    const beforeRaw = (req.query as any)?.before;
    const before = beforeRaw == null || beforeRaw === '' ? null : Number(beforeRaw);
    if (before != null && (!Number.isFinite(before) || before <= 0)) {
      return reply.code(400).send({ error: 'invalid_before', got: beforeRaw });
    }

    const seconds = TF_SECONDS[tf];
    if (!seconds) {
      return reply.code(400).send({ error: 'invalid_tf', accepted: Object.keys(TF_SECONDS) });
    }

    // Cache key includes `before` so historical pages never collide with the
    // live (now-anchored) window.
    const cacheKey = `${symbol}:${tf}:${limit}:${before ?? 'now'}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      return { bars: cached.bars, source: cached.bars.length > 0 && (cached as any).source };
    }

    try {
      const bars = CRYPTO_SYMBOLS.has(symbol)
        ? await fetchCoinbaseBars(symbol, seconds, limit, before)
        : await fetchTwelveDataBars(symbol, tf, limit, before);

      cache.set(cacheKey, { bars, ts: Date.now() });
      return { bars, source: CRYPTO_SYMBOLS.has(symbol) ? 'coinbase' : 'twelvedata' };
    } catch (err) {
      app.log.warn({ err: (err as Error).message, symbol, tf, before }, 'bars: fetch failed');
      return reply.code(502).send({ error: 'fetch_failed', message: (err as Error).message });
    }
  });
}

async function fetchCoinbaseBars(
  vSym: string,
  seconds: number,
  limit: number,
  before: number | null = null,
): Promise<Bar[]> {
  const product = vSym.slice(0, -3) + '-USD';

  // Coinbase only supports 60, 300, 900, 3600, 21600, 86400.
  // For unsupported (4h, 30m, etc.), fetch finer granularity and aggregate.
  let actualGranularity = seconds;
  let aggregateRatio = 1;
  if (!COINBASE_GRANULARITIES.includes(seconds)) {
    if (seconds === 14400) { // 4h → 4 × 1h
      actualGranularity = 3600;
      aggregateRatio = 4;
    } else if (seconds === 1800) { // 30m → 2 × 15m
      actualGranularity = 900;
      aggregateRatio = 2;
    } else {
      actualGranularity = COINBASE_GRANULARITIES.reduce((p, c) =>
        Math.abs(c - seconds) < Math.abs(p - seconds) ? c : p,
      );
    }
  }

  const fineLimit = Math.min(300, limit * aggregateRatio); // Coinbase max 300 per call
  // T.21: when `before` is set, end the window one bar before that timestamp
  // so the historical page doesn't duplicate what the client already has.
  const end = before != null
    ? Math.max(0, Math.floor(before) - actualGranularity)
    : Math.floor(Date.now() / 1000);
  const start = end - fineLimit * actualGranularity;

  const url =
    `https://api.exchange.coinbase.com/products/${encodeURIComponent(product)}/candles` +
    `?granularity=${actualGranularity}` +
    `&start=${new Date(start * 1000).toISOString()}` +
    `&end=${new Date(end * 1000).toISOString()}`;

  const res = await fetch(url, { headers: { 'User-Agent': 'Vanta/0.1' } });
  if (!res.ok) throw new Error(`coinbase HTTP ${res.status}`);
  const raw = (await res.json()) as Array<[number, number, number, number, number, number]>;
  // Coinbase returns [time, low, high, open, close, volume] sorted desc.
  let bars: Bar[] = raw
    .map(([t, low, high, open, close, volume]) => ({
      time: t,
      open: Number(open),
      high: Number(high),
      low: Number(low),
      close: Number(close),
      volume: Number(volume),
    }))
    .sort((a, b) => a.time - b.time);

  if (aggregateRatio > 1) {
    bars = aggregateBars(bars, seconds);
  }

  return bars.slice(-limit);
}

function aggregateBars(bars: Bar[], targetSeconds: number): Bar[] {
  const buckets = new Map<number, Bar>();
  for (const b of bars) {
    const bucket = b.time - (b.time % targetSeconds);
    const existing = buckets.get(bucket);
    if (!existing) {
      buckets.set(bucket, { ...b, time: bucket });
    } else {
      existing.high = Math.max(existing.high, b.high);
      existing.low = Math.min(existing.low, b.low);
      existing.close = b.close;
      existing.volume += b.volume;
    }
  }
  return Array.from(buckets.values()).sort((a, b) => a.time - b.time);
}

async function fetchTwelveDataBars(
  vSym: string,
  tf: string,
  limit: number,
  before: number | null = null,
): Promise<Bar[]> {
  if (!TD_KEY) throw new Error('TWELVE_DATA_API_KEY not set');
  const symbol = TD_SYMBOL[vSym];
  const interval = TD_INTERVAL[tf];
  if (!symbol || !interval) throw new Error(`unsupported symbol/tf: ${vSym}/${tf}`);

  // T.21: when `before` is supplied, pass `end_date` so TD returns the window
  // ending at that timestamp. Subtract one bar so we don't overlap with the
  // client's existing data.
  let endDateParam = '';
  if (before != null) {
    const tfSec = TF_SECONDS[tf] ?? 60;
    const endTs = Math.max(0, Math.floor(before) - tfSec);
    const d = new Date(endTs * 1000);
    const iso = d.toISOString().replace('T', ' ').replace(/\..*/, '');
    endDateParam = `&end_date=${encodeURIComponent(iso)}`;
  }

  const url =
    `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}` +
    `&interval=${encodeURIComponent(interval)}` +
    `&outputsize=${limit}` +
    `&order=asc` +
    endDateParam +
    `&apikey=${TD_KEY}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`twelvedata HTTP ${res.status}`);
  const raw: any = await res.json();
  if (raw.code && Number(raw.code) >= 400) {
    throw new Error(`twelvedata: ${raw.message ?? raw.code}`);
  }

  const values: any[] = raw.values ?? [];
  return values.map((v) => ({
    time: Math.floor(new Date(v.datetime + 'Z').getTime() / 1000),
    open: Number(v.open),
    high: Number(v.high),
    low: Number(v.low),
    close: Number(v.close),
    volume: Number(v.volume ?? 0),
  }));
}
