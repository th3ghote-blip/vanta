import type { FastifyInstance } from 'fastify';
import WebSocket from 'ws';
import { setQuote, getAllQuotes, getQuote, type Quote } from '../lib/quoteCache.js';

const TD_KEY = process.env.TWELVE_DATA_API_KEY ?? '';

// =================================================================
// CRYPTO — Coinbase Advanced Trade WebSocket (real-time, no key)
// Binance returns HTTP 451 from US data centers (geo-blocked).
// Bybit's V5 spot orderbook subscribe was silently failing on Railway.
// Coinbase Advanced Trade WS is unblocked, simple ticker channel.
// =================================================================
const CRYPTO_SYMBOLS = [
  'BTCUSD', 'ETHUSD', 'SOLUSD', 'XRPUSD', 'DOGEUSD', 'ADAUSD', 'AVAXUSD',
  'LINKUSD', 'DOTUSD', 'MATICUSD', 'SHIBUSD', 'LTCUSD', 'UNIUSD', 'ATOMUSD',
  'NEARUSD', 'APTUSD', 'ARBUSD', 'OPUSD', 'FILUSD', 'ICPUSD', 'INJUSD',
  'SUIUSD', 'TIAUSD', 'SEIUSD', 'ETCUSD', 'BCHUSD', 'STXUSD', 'RNDRUSD',
  'PEPEUSD', 'WIFUSD', 'BONKUSD', 'JUPUSD', 'PYTHUSD', 'WLDUSD', 'AAVEUSD',
  'MKRUSD', 'SNXUSD', 'CRVUSD', 'COMPUSD', 'LDOUSD', 'PENDLEUSD', 'ENAUSD',
  'SANDUSD', 'AXSUSD', 'MANAUSD', 'APEUSD', 'GALAUSD',
];

/** Vanta crypto symbol → Coinbase product_id */
const COINBASE_PRODUCT = (vSym: string) => vSym.slice(0, -3) + '-USD';

// =================================================================
// FOREX / STOCKS / GOLD — Yahoo Finance (no key, ~10s polling)
// =================================================================
const NON_CRYPTO_SYMBOLS = ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'XAUUSD', 'AAPL', 'TSLA', 'AMZN'];

/** Vanta symbol → Twelve Data ticker */
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

// Twelve Data free tier: 800 credits/day, 8 req/min.
// 9 symbols × 1 credit per call. Polling every 5 minutes = 12/hour × 24 = 288
// requests/day × 9 symbols = 2,592 credits — over limit. Polling every 15 min
// = 4/hour × 24 = 96 requests × 9 = 864 credits — just over. Polling every
// 20 min = 648 credits/day — safe. Random walk fills the gaps for chart feel.
const TD_POLL_MS = 20 * 60_000;

const SEED_FALLBACK: Record<string, number> = {
  EURUSD: 1.0851, GBPUSD: 1.2632, USDJPY: 156.42, AUDUSD: 0.6584,
  USDCAD: 1.3712, XAUUSD: 2348.5, AAPL: 224.8, TSLA: 252.3, AMZN: 184.2,
  BTCUSD: 71240, ETHUSD: 3500, SOLUSD: 180, XRPUSD: 0.55, DOGEUSD: 0.15,
  ADAUSD: 0.45, AVAXUSD: 35, LINKUSD: 14, DOTUSD: 7.2, MATICUSD: 0.65,
  SHIBUSD: 0.000025, LTCUSD: 80, UNIUSD: 9, ATOMUSD: 8, NEARUSD: 5.5,
  APTUSD: 9, ARBUSD: 0.85, OPUSD: 1.7, FILUSD: 4.5, ICPUSD: 11, INJUSD: 25,
  SUIUSD: 1.4, TIAUSD: 7, SEIUSD: 0.5, ETCUSD: 23, BCHUSD: 380, STXUSD: 2.1,
  RNDRUSD: 6.5, PEPEUSD: 0.0000095, WIFUSD: 2.4, BONKUSD: 0.000018,
  JUPUSD: 0.85, PYTHUSD: 0.4, WLDUSD: 4.8, AAVEUSD: 105, MKRUSD: 2700,
  SNXUSD: 2.1, CRVUSD: 0.3, COMPUSD: 50, LDOUSD: 1.7, PENDLEUSD: 4.5,
  ENAUSD: 0.8, SANDUSD: 0.35, AXSUSD: 6, MANAUSD: 0.4, APEUSD: 0.95, GALAUSD: 0.025,
};

const ALL_SYMBOLS = [...NON_CRYPTO_SYMBOLS, ...CRYPTO_SYMBOLS];

export function startPriceFeed(app: FastifyInstance) {
  // Seed quotes immediately so /api/quotes always has data.
  for (const s of ALL_SYMBOLS) {
    const px = SEED_FALLBACK[s] ?? 1;
    const spread = px * 0.0002;
    setQuote({ symbol: s, bid: px - spread / 2, ask: px + spread / 2, ts: Date.now() });
  }

  startCoinbase(app);
  pollTwelveData(app).catch((err) => app.log.warn({ err }, 'twelvedata: initial fetch failed'));
  setInterval(() => {
    pollTwelveData(app).catch((err) => app.log.warn({ err }, 'twelvedata: poll failed'));
  }, TD_POLL_MS);

  // Smooth random-walk on non-crypto so charts feel continuous between Yahoo polls.
  setInterval(() => {
    const now = Date.now();
    for (const s of NON_CRYPTO_SYMBOLS) {
      const cur = getQuote(s);
      if (!cur) continue;
      const mid = (cur.bid + cur.ask) / 2;
      const drift = (Math.random() - 0.5) * mid * 0.0002;
      const next = +(mid + drift).toFixed(decimalsFor(s));
      const spread = next * 0.0001;
      setQuote({
        symbol: s,
        bid: +(next - spread / 2).toFixed(decimalsFor(s)),
        ask: +(next + spread / 2).toFixed(decimalsFor(s)),
        ts: now,
      });
    }
    broadcast(getAllQuotes());
  }, 1000);

  // Throttled broadcast for crypto (Bybit pushes many ticks/second)
  setInterval(() => {
    if (sockets.size > 0) broadcast(getAllQuotes());
  }, 200);

  // WebSocket endpoint at /ws/quotes for the Expo app
  app.register(async (instance) => {
    instance.get('/ws/quotes', { websocket: true }, (socket, _req) => {
      sockets.add(socket as unknown as WebSocket);
      socket.send(JSON.stringify({ type: 'snapshot', quotes: getAllQuotes() }));
      socket.on('close', () => sockets.delete(socket as unknown as WebSocket));
    });
  });

  app.log.info(`Price feed: Coinbase live for ${CRYPTO_SYMBOLS.length} crypto + Twelve Data every ${TD_POLL_MS / 60_000}min for ${NON_CRYPTO_SYMBOLS.length} non-crypto.`);
}

// ─── Coinbase Advanced Trade ────────────────────────────────────────────
function startCoinbase(app: FastifyInstance) {
  const url = 'wss://advanced-trade-ws.coinbase.com';
  let ws: WebSocket;
  let firstMessageLogged = false;
  let updates = 0;

  const connect = () => {
    ws = new WebSocket(url);
    ws.on('open', () => {
      app.log.info(`coinbase: connected, subscribing to ${CRYPTO_SYMBOLS.length} products`);
      const product_ids = CRYPTO_SYMBOLS.map((s) => COINBASE_PRODUCT(s));
      ws.send(
        JSON.stringify({
          type: 'subscribe',
          product_ids,
          channel: 'ticker',
        }),
      );
    });

    ws.on('message', (raw) => {
      try {
        const m = JSON.parse(raw.toString());

        // Log the first message for sanity check
        if (!firstMessageLogged) {
          app.log.info({ channel: m.channel, eventCount: m.events?.length }, 'coinbase: first message');
          firstMessageLogged = true;
        }

        // Errors / subscription issues
        if (m.channel === 'subscriptions') return;
        if (m.type === 'error' || m.error) {
          app.log.warn({ msg: m }, 'coinbase: error message');
          return;
        }

        if (m.channel !== 'ticker') return;
        for (const evt of m.events ?? []) {
          for (const t of evt.tickers ?? []) {
            const product: string = t.product_id;
            const vSym = product.endsWith('-USD')
              ? product.slice(0, -4) + 'USD'
              : null;
            if (!vSym || !CRYPTO_SYMBOLS.includes(vSym)) continue;

            const bid = Number(t.best_bid);
            const ask = Number(t.best_ask);
            if (!Number.isFinite(bid) || !Number.isFinite(ask)) continue;

            const dec = decimalsForCrypto(bid);
            setQuote({
              symbol: vSym,
              bid: +bid.toFixed(dec),
              ask: +ask.toFixed(dec),
              ts: Date.now(),
            });
            updates++;
          }
        }
      } catch (err) {
        app.log.warn({ err: (err as Error).message }, 'coinbase: parse error');
      }
    });

    ws.on('close', () => {
      app.log.warn(`coinbase: closed (${updates} ticks received), reconnecting in 3s`);
      updates = 0;
      firstMessageLogged = false;
      setTimeout(connect, 3000);
    });

    ws.on('error', (err) => app.log.warn({ err: err.message }, 'coinbase: error'));
  };

  connect();
}

// ─── Twelve Data ────────────────────────────────────────────────────────
// Free-tier limit is 8 credits per rolling 60s window. One /price call with
// 9 symbols costs 9 credits, so every batched poll fails. Split into chunks
// of <=5 with a 65s gap so each chunk lands in a fresh window. Total cycle
// takes ~65s but the poll only fires every 20 min anyway.
const TD_CHUNK_SIZE = 5;
const TD_CHUNK_DELAY_MS = 65_000;

async function pollTwelveData(app: FastifyInstance) {
  if (!TD_KEY) {
    app.log.warn('TWELVE_DATA_API_KEY not set — non-crypto prices will stay at seed.');
    return;
  }
  const chunks: string[][] = [];
  for (let i = 0; i < NON_CRYPTO_SYMBOLS.length; i += TD_CHUNK_SIZE) {
    chunks.push(NON_CRYPTO_SYMBOLS.slice(i, i + TD_CHUNK_SIZE));
  }
  let total = 0;
  for (let i = 0; i < chunks.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, TD_CHUNK_DELAY_MS));
    total += await fetchTdChunk(chunks[i], app);
  }
  if (total > 0) app.log.info(`twelvedata: refreshed ${total}/${NON_CRYPTO_SYMBOLS.length} symbols.`);
}

async function fetchTdChunk(symbols: string[], app: FastifyInstance): Promise<number> {
  const tdSymbols = symbols.map((s) => TD_SYMBOL[s]).join(',');
  const url = `https://api.twelvedata.com/price?symbol=${encodeURIComponent(tdSymbols)}&apikey=${TD_KEY}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      app.log.warn(`twelvedata HTTP ${res.status} for chunk ${symbols.join(',')}`);
      return 0;
    }
    const raw: any = await res.json();
    if (raw.code && Number(raw.code) >= 400) {
      app.log.warn(`twelvedata error: ${raw.message ?? raw.code}`);
      return 0;
    }
    // Single-symbol responses are unkeyed { price: "..." }; multi are keyed.
    const data: Record<string, { price?: string }> =
      'price' in raw && symbols.length === 1 ? { [TD_SYMBOL[symbols[0]]]: raw } : raw;
    let updated = 0;
    for (const [tdSym, payload] of Object.entries(data)) {
      const ourSym = invertTd(tdSym);
      if (!ourSym || !payload?.price) continue;
      const px = Number(payload.price);
      if (!Number.isFinite(px)) continue;
      const spread = px * 0.0001;
      setQuote({
        symbol: ourSym,
        bid: +(px - spread / 2).toFixed(decimalsFor(ourSym)),
        ask: +(px + spread / 2).toFixed(decimalsFor(ourSym)),
        ts: Date.now(),
      });
      updated++;
    }
    return updated;
  } catch (err) {
    app.log.warn({ err: (err as Error).message }, 'twelvedata chunk error');
    return 0;
  }
}

function invertTd(tdSym: string): string | undefined {
  for (const [our, t] of Object.entries(TD_SYMBOL)) if (t === tdSym) return our;
  return undefined;
}

// ─── Helpers ────────────────────────────────────────────────────────────
function decimalsFor(symbol: string): number {
  if (symbol === 'XAUUSD') return 2;
  if (symbol === 'USDJPY') return 3;
  if (['AAPL', 'TSLA', 'AMZN'].includes(symbol)) return 2;
  return 5;
}

function decimalsForCrypto(price: number): number {
  if (price >= 1000) return 2;
  if (price >= 1) return 4;
  if (price >= 0.01) return 5;
  if (price >= 0.0001) return 7;
  return 9;
}

const sockets = new Set<WebSocket>();

function broadcast(quotes: Quote[]) {
  if (sockets.size === 0) return;
  const msg = JSON.stringify({ type: 'tick', quotes });
  for (const s of sockets) {
    if (s.readyState === WebSocket.OPEN) s.send(msg);
  }
}
