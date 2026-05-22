import { useEffect, useState } from 'react';
import { Platform, View, Text, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';

import { colors, radius, spacing, typography } from '@/lib/theme';
import { usePriceStore } from '@/stores/prices';
import type { Timeframe } from './TimeframeSelector';

interface Props {
  symbol: string;
  timeframe: Timeframe;
  height?: number;
}

interface Bar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';
const WS_URL = (process.env.EXPO_PUBLIC_WS_URL ?? 'ws://localhost:4000') + '/ws/quotes';

const TF_SECONDS: Record<Timeframe, number> = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '1h': 3600,
  '4h': 14400,
  '1d': 86400,
};

/**
 * Live chart with real historical bars + WebSocket tick updates.
 *
 * 1. Fetches initial 500 historical OHLC bars from /api/bars/:symbol?tf=...
 * 2. Renders with TradingView Lightweight Charts inside an iframe/WebView
 * 3. Subscribes to /ws/quotes for live ticks → updates the active candle
 * 4. Rolls a new candle when the timeframe boundary is crossed
 * 5. T.21: lazy-loads older bars as the user pans/scrolls toward the left edge
 */
export function Chart({ symbol, timeframe, height = 360 }: Props) {
  const [bars, setBars] = useState<Bar[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Get a snapshot of the live mid price for fallback purposes
  const seedQuote = usePriceStore.getState().quotes[symbol];
  const fallbackPrice = seedQuote ? (seedQuote.bid + seedQuote.ask) / 2 : 1;

  // Fetch historical bars whenever symbol or timeframe changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setBars(null);

    fetch(`${API_URL}/api/bars/${encodeURIComponent(symbol)}?tf=${timeframe}&limit=500`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) {
          setBars((json.bars ?? []) as Bar[]);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [symbol, timeframe]);

  if (loading || !bars) {
    return (
      <View
        style={{
          height,
          backgroundColor: colors.bgElevated,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {error ? (
          <Text style={{ ...typography.body, color: colors.loss, fontSize: 12 }}>
            Failed to load chart: {error}
          </Text>
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
      </View>
    );
  }

  const tfSeconds = TF_SECONDS[timeframe];
  const html = buildChartHtml(symbol, timeframe, tfSeconds, bars, fallbackPrice);

  if (Platform.OS === 'web') {
    return (
      <View
        style={{
          height,
          backgroundColor: colors.bgElevated,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: 'hidden',
        }}
      >
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <iframe
          srcDoc={html}
          style={{ width: '100%', height: '100%', border: 'none' } as any}
          title={`Chart ${symbol}`}
          // re-render iframe when symbol or timeframe changes by keying
          key={`${symbol}-${timeframe}`}
        />
      </View>
    );
  }

  return (
    <View
      style={{
        height,
        backgroundColor: colors.bgElevated,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
        marginHorizontal: spacing.xs,
      }}
    >
      <WebView
        key={`${symbol}-${timeframe}`}
        originWhitelist={['*']}
        source={{ html }}
        style={{ backgroundColor: colors.bgElevated }}
        scrollEnabled={false}
      />
    </View>
  );
}

function decimalsFor(seed: number): number {
  if (seed >= 1000) return 2;
  if (seed >= 100) return 3;
  if (seed >= 1) return 5;
  if (seed >= 0.01) return 6;
  return 8;
}

function buildChartHtml(
  symbol: string,
  timeframe: string,
  tfSeconds: number,
  bars: Bar[],
  fallback: number,
) {
  const sample = bars.length > 0 ? bars[bars.length - 1].close : fallback;
  const decimals = decimalsFor(sample);

  return `<!doctype html>
<html><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
<style>
  html,body,#chart{margin:0;padding:0;height:100%;width:100%;background:${colors.bgElevated};}
  .label{position:absolute;top:8px;left:12px;color:${colors.textSecondary};font:600 12px Inter,sans-serif;letter-spacing:1px;z-index:2;}
  .label .tf{color:${colors.textMuted};font-weight:500;margin-left:6px;}
  .live{position:absolute;top:8px;right:12px;display:flex;align-items:center;gap:6px;color:${colors.textSecondary};font:500 11px Inter,sans-serif;z-index:2;}
  .dot{width:6px;height:6px;border-radius:50%;background:${colors.profit};box-shadow:0 0 8px ${colors.profit};}
  @keyframes pulse{0%,100%{opacity:1;}50%{opacity:.4;}}
  .dot{animation:pulse 1.5s ease-in-out infinite;}
  .loading-left{position:absolute;top:50%;left:12px;transform:translateY(-50%);color:${colors.textMuted};font:500 11px Inter,sans-serif;z-index:2;opacity:0;transition:opacity .15s;background:${colors.bgElevated};padding:4px 8px;border-radius:4px;}
  .loading-left.on{opacity:1;}
</style>
<script src="https://unpkg.com/lightweight-charts@4.2.0/dist/lightweight-charts.standalone.production.js"></script>
</head><body>
<div class="label">${symbol}<span class="tf">· ${timeframe}</span></div>
<div class="live"><span class="dot"></span><span id="status">connecting…</span></div>
<div id="loading-left" class="loading-left">loading history…</div>
<div id="chart"></div>
<script>
  const SYMBOL = ${JSON.stringify(symbol)};
  const TIMEFRAME = ${JSON.stringify(timeframe)};
  const TF_SECONDS = ${tfSeconds};
  const DECIMALS = ${decimals};
  const API_URL = ${JSON.stringify(API_URL)};
  const BARS = ${JSON.stringify(bars)};

  const chart = LightweightCharts.createChart(document.getElementById('chart'), {
    layout:{ background:{ color:'${colors.bgElevated}' }, textColor:'${colors.textSecondary}' },
    grid:{ vertLines:{ color:'${colors.border}' }, horzLines:{ color:'${colors.border}' } },
    timeScale:{ borderColor:'${colors.border}', timeVisible: true, secondsVisible: ${tfSeconds < 60 ? 'true' : 'false'} },
    rightPriceScale:{ borderColor:'${colors.border}' },
    crosshair:{ mode: 1 },
    localization:{ priceFormatter: (p) => Number(p).toFixed(DECIMALS) },
  });
  const series = chart.addCandlestickSeries({
    upColor:'${colors.profit}', downColor:'${colors.loss}',
    borderUpColor:'${colors.profit}', borderDownColor:'${colors.loss}',
    wickUpColor:'${colors.profit}', wickDownColor:'${colors.loss}',
    priceFormat:{ type: 'price', precision: DECIMALS, minMove: Math.pow(10, -DECIMALS) },
  });

  // T.21: keep a mutable, time-sorted data array so we can prepend older
  // bars when the user pans toward the left edge. We dedupe by &#96;time&#96; on
  // every merge (Lightweight Charts requires strictly-ascending times).
  let DATA = BARS.slice();
  series.setData(DATA);
  chart.timeScale().fitContent();

  // Lazy-load older history when leftmost visible index is within
  // LOAD_THRESHOLD bars of index 0. Single in-flight guard prevents
  // queue pile-up during fast panning. hitFloor latches true once the
  // server returns < MIN_BARS_FOR_MORE — we stop asking from there.
  const LOAD_THRESHOLD = 20;
  const MIN_BARS_FOR_MORE = 20;
  let inFlight = false;
  let hitFloor = DATA.length === 0;
  const loadingEl = document.getElementById('loading-left');

  async function loadMoreHistory() {
    if (inFlight || hitFloor || DATA.length === 0) return;
    inFlight = true;
    loadingEl.classList.add('on');
    const oldestTime = DATA[0].time;
    try {
      const url = API_URL + '/api/bars/' + encodeURIComponent(SYMBOL) +
        '?tf=' + encodeURIComponent(TIMEFRAME) +
        '&limit=500&before=' + encodeURIComponent(oldestTime);
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      const older = (json && json.bars) || [];
      if (older.length < MIN_BARS_FOR_MORE) {
        hitFloor = true;
      }
      if (older.length > 0) {
        // Capture the user's visible range BEFORE we rebuild the data array,
        // so we can shift it forward by the count of bars we're prepending
        // and keep the same chart window in view.
        const visible = chart.timeScale().getVisibleLogicalRange();
        const seen = new Set(DATA.map(function (b) { return b.time; }));
        const fresh = older.filter(function (b) { return !seen.has(b.time); });
        if (fresh.length > 0) {
          const merged = fresh.concat(DATA);
          merged.sort(function (a, b) { return a.time - b.time; });
          DATA = merged;
          series.setData(DATA);
          if (visible) {
            chart.timeScale().setVisibleLogicalRange({
              from: visible.from + fresh.length,
              to: visible.to + fresh.length,
            });
          }
        }
      }
    } catch (e) {
      // Non-fatal — let the next pan retry unless we hit the floor.
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('chart history fetch failed', e);
      }
    } finally {
      inFlight = false;
      loadingEl.classList.remove('on');
    }
  }

  chart.timeScale().subscribeVisibleLogicalRangeChange(function (range) {
    if (!range) return;
    if (range.from < LOAD_THRESHOLD) {
      loadMoreHistory();
    }
  });

  // Active candle = latest bar (we extend it on each tick)
  let cur = DATA.length > 0 ? Object.assign({}, DATA[DATA.length - 1]) : null;

  const status = document.getElementById('status');
  let ws;
  function connect() {
    try { ws = new WebSocket(${JSON.stringify(WS_URL)}); } catch (e) { setTimeout(connect, 2000); return; }
    ws.onopen = () => { status.textContent = 'live'; };
    ws.onclose = () => { status.textContent = 'reconnecting'; setTimeout(connect, 2000); };
    ws.onerror = () => { status.textContent = 'error'; };
    ws.onmessage = (e) => {
      try {
        const m = JSON.parse(e.data);
        if (!m || (m.type !== 'tick' && m.type !== 'snapshot')) return;
        const q = (m.quotes || []).find((x) => x.symbol === SYMBOL);
        if (!q) return;
        const mid = (q.bid + q.ask) / 2;
        const t = Math.floor(Date.now()/1000);
        const start = t - (t % TF_SECONDS);

        if (!cur || start > cur.time) {
          // Roll a new candle. Append to DATA so future history merges
          // see the right newest bar.
          cur = { time: start, open: cur ? cur.close : mid, high: mid, low: mid, close: mid };
          DATA.push(cur);
        } else {
          if (mid > cur.high) cur.high = mid;
          if (mid < cur.low)  cur.low  = mid;
          cur.close = mid;
          if (DATA.length > 0) DATA[DATA.length - 1] = cur;
        }
        series.update(cur);
      } catch {}
    };
  }
  connect();
</script>
</body></html>`;
}
