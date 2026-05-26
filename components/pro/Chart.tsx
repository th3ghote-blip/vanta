import React, { useEffect, useRef, useState } from 'react';
import { Platform, View, Text, ActivityIndicator, TouchableOpacity, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebView } from 'react-native-webview';

import { colors, radius, spacing, typography } from '@/lib/theme';
import { isCrypto } from '@/lib/contracts';
import { usePriceStore } from '@/stores/prices';
import { useChartPrefs, IndicatorKey } from '@/stores/chartPrefs';
import type { Timeframe } from './TimeframeSelector';

interface Props {
  symbol:    string;
  timeframe: Timeframe;
  height?:   number;
}

interface Bar {
  time:    number;
  open:    number;
  high:    number;
  low:     number;
  close:   number;
  volume?: number;
}

interface ChartDrawing {
  id:     string;
  type:   'horizontal' | 'trendline' | 'fib';
  price?: number;
  p1?:    { time: number; price: number };
  p2?:    { time: number; price: number };
  color?: string;
}

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';
const WS_URL  = (process.env.EXPO_PUBLIC_WS_URL ?? 'ws://localhost:4000') + '/ws/quotes';

const TF_SECONDS: Record<Timeframe, number> = {
  '1m':  60,
  '5m':  300,
  '15m': 900,
  '1h':  3600,
  '4h':  14400,
  '1d':  86400,
};

const INDICATOR_LABELS: Record<IndicatorKey, string> = {
  ma20: 'MA20',
  ma50: 'MA50',
  bb:   'BB',
  rsi:  'RSI',
  macd: 'MACD',
};

const INDICATOR_ORDER: IndicatorKey[] = ['ma20', 'ma50', 'bb', 'rsi', 'macd'];

/**
 * Live chart with historical bars + WebSocket tick updates.
 *
 * T.21: lazy-loads older bars when user pans toward the left edge.
 * T.15: indicator overlays (MA20, MA50, BB) and oscillator panes (RSI, MACD).
 *       Toggle pills below the chart; state persists via AsyncStorage.
 */
export function Chart({ symbol, timeframe, height = 360 }: Props) {
  const { indicators, hydrated, hydrate, toggle } = useChartPrefs();

  // Hydrate persisted indicator prefs on first mount
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      hydrate();
    }
  }, [hydrate]);

  // Get a snapshot of the live mid price for fallback purposes
  const seedQuote = usePriceStore.getState().quotes[symbol];
  const fallbackPrice = seedQuote ? (seedQuote.bid + seedQuote.ask) / 2 : 1;

  const [barsState, setBarsState] = useState<{
    bars:    Bar[] | null;
    loading: boolean;
    error:   string | null;
  }>({ bars: null, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    setBarsState({ bars: null, loading: true, error: null });

    fetch(`${API_URL}/api/bars/${encodeURIComponent(symbol)}?tf=${timeframe}&limit=1000`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) {
          setBarsState({ bars: (json.bars ?? []) as Bar[], loading: false, error: null });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setBarsState({ bars: null, loading: false, error: err.message });
        }
      });

    return () => { cancelled = true; };
  }, [symbol, timeframe]);

  const { bars, loading, error } = barsState;

  // ── T.16 Drawing persistence ─────────────────────────────────────────────
  const drawingsRef    = useRef<Record<string, ChartDrawing[]>>({});
  const [drawingsLoaded, setDrawingsLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('vanta:chart-drawings')
      .then((s) => { if (s) { try { drawingsRef.current = JSON.parse(s); } catch {} } })
      .catch(() => {})
      .finally(() => setDrawingsLoaded(true));
  }, []);

  // Web: receive drawing updates postMessage'd from the iframe
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (e: MessageEvent) => {
      try {
        const d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (d?.type === 'drawings_update') {
          drawingsRef.current = { ...drawingsRef.current, [d.symbol ?? symbol]: d.drawings };
          AsyncStorage.setItem('vanta:chart-drawings', JSON.stringify(drawingsRef.current)).catch(() => {});
        }
      } catch {}
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [symbol]);

  // Encode indicator state in the iframe key so it fully remounts on toggle
  const indicatorHash = hydrated
    ? INDICATOR_ORDER.map((k) => (indicators[k] ? '1' : '0')).join('')
    : '00000';

  // Expand container height for oscillator panes (each = 120px)
  const oscCount   = (indicators.rsi ? 1 : 0) + (indicators.macd ? 1 : 0);
  const totalHeight = height + (hydrated ? oscCount * 120 : 0);

  const containerStyle = {
    backgroundColor: colors.bgElevated,
    borderRadius:    radius.lg,
    borderWidth:     1,
    borderColor:     colors.border,
    overflow:        'hidden' as const,
  };

  if (loading || !bars) {
    return (
      <View style={{ ...containerStyle, height: totalHeight, alignItems: 'center', justifyContent: 'center' }}>
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

  const tfSeconds  = TF_SECONDS[timeframe];
  const drawings   = drawingsLoaded ? (drawingsRef.current[symbol] ?? []) : [];
  const html       = buildChartHtml(symbol, timeframe, tfSeconds, bars, fallbackPrice, indicators, drawings);
  const iframeKey  = `${symbol}-${timeframe}-${indicatorHash}-${drawingsLoaded ? '1' : '0'}`;

  return (
    <View>
      {/* Chart area */}
      <View style={{ ...containerStyle, height: totalHeight, ...(Platform.OS !== 'web' && { marginHorizontal: spacing.xs }) }}>
        {Platform.OS === 'web' ? (
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          <iframe
            srcDoc={html}
            style={{ width: '100%', height: '100%', border: 'none' } as any}
            title={`Chart ${symbol}`}
            key={iframeKey}
          />
        ) : (
          <WebView
            key={iframeKey}
            originWhitelist={['*']}
            source={{ html }}
            style={{ backgroundColor: colors.bgElevated }}
            scrollEnabled={false}
            onMessage={(e) => {
              try {
                const d = JSON.parse(e.nativeEvent.data);
                if (d?.type === 'drawings_update') {
                  drawingsRef.current = { ...drawingsRef.current, [d.symbol ?? symbol]: d.drawings };
                  AsyncStorage.setItem('vanta:chart-drawings', JSON.stringify(drawingsRef.current)).catch(() => {});
                }
              } catch {}
            }}
          />
        )}
      </View>

      {/* Indicator toggle pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.sm, paddingTop: spacing.xs, gap: spacing.xs, flexDirection: 'row' }}
        style={{ marginHorizontal: Platform.OS !== 'web' ? spacing.xs : 0 }}
      >
        {INDICATOR_ORDER.map((key) => {
          const active = hydrated && indicators[key];
          return (
            <TouchableOpacity
              key={key}
              onPress={() => toggle(key)}
              style={{
                paddingHorizontal: 8,
                paddingVertical:   3,
                borderRadius:      4,
                borderWidth:       1,
                borderColor:       active ? colors.primary : colors.border,
                backgroundColor:   active ? colors.primary + '22' : 'transparent',
              }}
            >
              <Text
                style={{
                  fontSize:      11,
                  fontWeight:    '600',
                  color:         active ? colors.primary : colors.textMuted,
                  letterSpacing: 0.3,
                }}
              >
                {INDICATOR_LABELS[key]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

function decimalsFor(seed: number): number {
  if (seed >= 1000) return 2;
  if (seed >= 100)  return 3;
  if (seed >= 1)    return 5;
  if (seed >= 0.01) return 6;
  return 8;
}

function buildChartHtml(
  symbol:     string,
  timeframe:  string,
  tfSeconds:  number,
  bars:       Bar[],
  fallback:   number,
  indicators: { ma20: boolean; ma50: boolean; bb: boolean; rsi: boolean; macd: boolean },
  drawings:   ChartDrawing[] = [],
) {
  const sample          = bars.length > 0 ? bars[bars.length - 1].close : fallback;
  const decimals        = decimalsFor(sample);
  const isCryptoSym     = isCrypto(symbol);
  const COINBASE_NATIVE = [60, 300, 900, 3600, 21600, 86400];
  const coinbaseGran    = COINBASE_NATIVE.includes(tfSeconds) ? tfSeconds : null;
  const coinbaseProduct = isCryptoSym ? symbol.slice(0, -3) + '-USD' : '';

  const oscPaneH = 110; // px per oscillator pane

  const rsiDiv  = indicators.rsi  ? '<div class="osc-wrap" id="rsi-wrap"  style="height:' + oscPaneH + 'px"><span class="osc-label">RSI 14</span><div id="chart-rsi"  style="height:100%"></div></div>' : '';
  const macdDiv = indicators.macd ? '<div class="osc-wrap" id="macd-wrap" style="height:' + oscPaneH + 'px"><span class="osc-label">MACD 12,26,9</span><div id="chart-macd" style="height:100%"></div></div>' : '';

  /* eslint-disable @typescript-eslint/no-explicit-any */
  return (
    '<!doctype html>\n' +
    '<html><head><meta charset="utf-8" />\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />\n' +
    '<style>\n' +
    '  html,body{margin:0;padding:0;height:100%;width:100%;background:' + colors.bgElevated + ';}\n' +
    '  #wrap{display:flex;flex-direction:column;height:100%;}\n' +
    '  #chart{flex:1;min-height:0;position:relative;}\n' +
    '  .osc-wrap{position:relative;border-top:1px solid ' + colors.border + ';}\n' +
    '  .osc-label{position:absolute;top:4px;left:8px;color:' + colors.textMuted + ';font:600 10px Inter,sans-serif;letter-spacing:1px;z-index:3;pointer-events:none;}\n' +
    '  .label{position:absolute;top:8px;left:12px;color:' + colors.textSecondary + ';font:600 12px Inter,sans-serif;letter-spacing:1px;z-index:2;pointer-events:none;}\n' +
    '  .label .tf{color:' + colors.textMuted + ';font-weight:500;margin-left:6px;}\n' +
    '  .live{position:absolute;top:8px;right:12px;display:flex;align-items:center;gap:6px;color:' + colors.textSecondary + ';font:500 11px Inter,sans-serif;z-index:2;pointer-events:none;}\n' +
    '  .dot{width:6px;height:6px;border-radius:50%;background:' + colors.profit + ';box-shadow:0 0 8px ' + colors.profit + ';}\n' +
    '  @keyframes pulse{0%,100%{opacity:1;}50%{opacity:.4;}}\n' +
    '  .dot{animation:pulse 1.5s ease-in-out infinite;}\n' +
    '  .loading-left{position:absolute;top:50%;left:12px;transform:translateY(-50%);color:' + colors.textMuted + ';font:500 11px Inter,sans-serif;z-index:2;opacity:0;transition:opacity .15s;background:' + colors.bgElevated + ';padding:4px 8px;border-radius:4px;pointer-events:none;}\n' +
    '  .loading-left.on{opacity:1;}\n' +
    '  #draw-toolbar{position:absolute;top:8px;left:50%;transform:translateX(-50%);display:flex;gap:3px;z-index:10;opacity:.85;}\n' +
    '  #draw-toolbar:hover{opacity:1;}\n' +
    '  .dtool{width:26px;height:26px;border:1px solid ' + colors.border + ';background:' + colors.bgElevated + ';color:' + colors.textSecondary + ';border-radius:4px;cursor:pointer;font:700 13px Inter,monospace;display:flex;align-items:center;justify-content:center;padding:0;line-height:1;}\n' +
    '  .dtool-del{color:' + colors.loss + '!important;border-color:' + colors.loss + '!important;}\n' +
    '  #draw-overlay{position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;overflow:visible;}\n' +
    '</style>\n' +
    '<script src="https://unpkg.com/lightweight-charts@4.2.0/dist/lightweight-charts.standalone.production.js"></script>\n' +
    '</head><body>\n' +
    '<div id="wrap">\n' +
    '  <div id="chart">\n' +
    '    <div class="label">' + symbol + '<span class="tf">&#xB7; ' + timeframe + '</span></div>\n' +
    '    <div class="live"><span class="dot"></span><span id="status">connecting…</span></div>\n' +
    '    <div id="loading-left" class="loading-left">loading history…</div>\n' +
    '  </div>\n' +
    '    <div id="draw-toolbar"></div>\n' +
    '    <svg id="draw-overlay"></svg>\n' +
    rsiDiv + '\n' +
    macdDiv + '\n' +
    '</div>\n' +
    '<script>\n' +
    '  var SYMBOL            = ' + JSON.stringify(symbol) + ';\n' +
    '  var TIMEFRAME         = ' + JSON.stringify(timeframe) + ';\n' +
    '  var TF_SECONDS        = ' + tfSeconds + ';\n' +
    '  var DECIMALS          = ' + decimals + ';\n' +
    '  var API_URL           = ' + JSON.stringify(API_URL) + ';\n' +
    '  var BARS              = ' + JSON.stringify(bars) + ';\n' +
    '  var COINBASE_PRODUCT  = ' + JSON.stringify(coinbaseProduct) + ';\n' +
    '  var COINBASE_GRANULARITY = ' + (coinbaseGran === null ? 'null' : String(coinbaseGran)) + ';\n' +
    '  var SHOW_MA20  = ' + indicators.ma20 + ';\n' +
    '  var SHOW_MA50  = ' + indicators.ma50 + ';\n' +
    '  var SHOW_BB    = ' + indicators.bb   + ';\n' +
    '  var SHOW_RSI   = ' + indicators.rsi  + ';\n' +
    '  var SHOW_MACD  = ' + indicators.macd + ';\n' +
    '  var INITIAL_DRAWINGS = ' + JSON.stringify(drawings) + ';\n' +
    '  var PROFIT_COLOR = ' + JSON.stringify(colors.profit) + ';\n' +
    '  var LOSS_COLOR   = ' + JSON.stringify(colors.loss)   + ';\n' +
    '\n' +
    '  // ── Indicator math helpers ──────────────────────────────────────────\n' +
    '\n' +
    '  function calcSMA(data, period) {\n' +
    '    var result = [];\n' +
    '    for (var i = period - 1; i < data.length; i++) {\n' +
    '      var sum = 0;\n' +
    '      for (var j = i - period + 1; j <= i; j++) sum += data[j].close;\n' +
    '      result.push({ time: data[i].time, value: sum / period });\n' +
    '    }\n' +
    '    return result;\n' +
    '  }\n' +
    '\n' +
    '  function calcBB(data, period, mult) {\n' +
    '    var upper = [], middle = [], lower = [];\n' +
    '    for (var i = period - 1; i < data.length; i++) {\n' +
    '      var sum = 0;\n' +
    '      for (var j = i - period + 1; j <= i; j++) sum += data[j].close;\n' +
    '      var mean = sum / period;\n' +
    '      var variance = 0;\n' +
    '      for (var j = i - period + 1; j <= i; j++) variance += (data[j].close - mean) * (data[j].close - mean);\n' +
    '      var sd = Math.sqrt(variance / period);\n' +
    '      upper.push({ time: data[i].time, value: mean + mult * sd });\n' +
    '      middle.push({ time: data[i].time, value: mean });\n' +
    '      lower.push({ time: data[i].time, value: mean - mult * sd });\n' +
    '    }\n' +
    '    return { upper: upper, middle: middle, lower: lower };\n' +
    '  }\n' +
    '\n' +
    '  // Wilder smoothed RSI\n' +
    '  function calcRSI(data, period) {\n' +
    '    if (data.length < period + 1) return [];\n' +
    '    var gains = 0, losses = 0;\n' +
    '    for (var i = 1; i <= period; i++) {\n' +
    '      var d = data[i].close - data[i - 1].close;\n' +
    '      if (d > 0) gains += d; else losses -= d;\n' +
    '    }\n' +
    '    var avgGain = gains / period;\n' +
    '    var avgLoss = losses / period;\n' +
    '    var result = [];\n' +
    '    for (var i = period; i < data.length; i++) {\n' +
    '      if (i > period) {\n' +
    '        var d = data[i].close - data[i - 1].close;\n' +
    '        var g = d > 0 ? d : 0;\n' +
    '        var l = d < 0 ? -d : 0;\n' +
    '        avgGain = (avgGain * (period - 1) + g) / period;\n' +
    '        avgLoss = (avgLoss * (period - 1) + l) / period;\n' +
    '      }\n' +
    '      var rs = avgLoss === 0 ? 100 : avgGain / avgLoss;\n' +
    '      result.push({ time: data[i].time, value: 100 - 100 / (1 + rs) });\n' +
    '    }\n' +
    '    return result;\n' +
    '  }\n' +
    '\n' +
    '  // EMA of { time, value } series\n' +
    '  function calcEMAofSeries(series, period) {\n' +
    '    if (series.length < period) return [];\n' +
    '    var k = 2 / (period + 1);\n' +
    '    var sum = 0;\n' +
    '    for (var i = 0; i < period; i++) sum += series[i].value;\n' +
    '    var ema = sum / period;\n' +
    '    var result = [{ time: series[period - 1].time, value: ema }];\n' +
    '    for (var i = period; i < series.length; i++) {\n' +
    '      ema = series[i].value * k + ema * (1 - k);\n' +
    '      result.push({ time: series[i].time, value: ema });\n' +
    '    }\n' +
    '    return result;\n' +
    '  }\n' +
    '\n' +
    '  // EMA of bar closes\n' +
    '  function calcEMAofBars(data, period) {\n' +
    '    if (data.length < period) return [];\n' +
    '    var k = 2 / (period + 1);\n' +
    '    var sum = 0;\n' +
    '    for (var i = 0; i < period; i++) sum += data[i].close;\n' +
    '    var ema = sum / period;\n' +
    '    var result = [{ time: data[period - 1].time, value: ema, idx: period - 1 }];\n' +
    '    for (var i = period; i < data.length; i++) {\n' +
    '      ema = data[i].close * k + ema * (1 - k);\n' +
    '      result.push({ time: data[i].time, value: ema, idx: i });\n' +
    '    }\n' +
    '    return result;\n' +
    '  }\n' +
    '\n' +
    '  // MACD (12, 26, 9)\n' +
    '  function calcMACD(data) {\n' +
    '    var ema12arr = calcEMAofBars(data, 12);\n' +
    '    var ema26arr = calcEMAofBars(data, 26);\n' +
    '    var macdLine = [];\n' +
    '    for (var i = 0; i < ema26arr.length; i++) {\n' +
    '      var idx12 = i + 14;\n' +
    '      if (idx12 >= ema12arr.length) break;\n' +
    '      macdLine.push({ time: ema26arr[i].time, value: ema12arr[idx12].value - ema26arr[i].value });\n' +
    '    }\n' +
    '    var signalArr = calcEMAofSeries(macdLine, 9);\n' +
    '    var histogram = [];\n' +
    '    for (var i = 0; i < signalArr.length; i++) {\n' +
    '      var macdVal = macdLine[i + 8].value;\n' +
    '      histogram.push({\n' +
    '        time:  signalArr[i].time,\n' +
    '        value: macdVal - signalArr[i].value,\n' +
    '        color: (macdVal - signalArr[i].value) >= 0 ? PROFIT_COLOR : LOSS_COLOR,\n' +
    '      });\n' +
    '    }\n' +
    '    return { macdLine: macdLine, signalArr: signalArr, histogram: histogram };\n' +
    '  }\n' +
    '\n' +
    '  // ── Main price chart ────────────────────────────────────────────────\n' +
    '\n' +
    '  var mainChart = LightweightCharts.createChart(document.getElementById("chart"), {\n' +
    '    layout: { background: { color: "' + colors.bgElevated + '" }, textColor: "' + colors.textSecondary + '" },\n' +
    '    grid:   { vertLines: { color: "' + colors.border + '" }, horzLines: { color: "' + colors.border + '" } },\n' +
    '    timeScale: {\n' +
    '      borderColor: "' + colors.border + '",\n' +
    '      timeVisible: true,\n' +
    '      secondsVisible: ' + (tfSeconds < 60 ? 'true' : 'false') + ',\n' +
    '    },\n' +
    '    rightPriceScale: { borderColor: "' + colors.border + '" },\n' +
    '    crosshair: { mode: 1 },\n' +
    '    localization: { priceFormatter: function(p) { return Number(p).toFixed(DECIMALS); } },\n' +
    '  });\n' +
    '\n' +
    '  var series = mainChart.addCandlestickSeries({\n' +
    '    upColor:         PROFIT_COLOR,\n' +
    '    downColor:       LOSS_COLOR,\n' +
    '    borderUpColor:   PROFIT_COLOR,\n' +
    '    borderDownColor: LOSS_COLOR,\n' +
    '    wickUpColor:     PROFIT_COLOR,\n' +
    '    wickDownColor:   LOSS_COLOR,\n' +
    '    priceFormat: { type: "price", precision: DECIMALS, minMove: Math.pow(10, -DECIMALS) },\n' +
    '  });\n' +
    '\n' +
    '  var DATA = BARS.slice();\n' +
    '  series.setData(DATA);\n' +
    '  mainChart.timeScale().fitContent();\n' +
    '\n' +
    '  // ── Overlay indicators ──────────────────────────────────────────────\n' +
    '\n' +
    '  var ma20series = null;\n' +
    '  var ma50series = null;\n' +
    '  var bbUpperS = null, bbMiddleS = null, bbLowerS = null;\n' +
    '\n' +
    '  if (SHOW_MA20) {\n' +
    '    ma20series = mainChart.addLineSeries({ color: "#f59e0b", lineWidth: 1,\n' +
    '      priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });\n' +
    '    ma20series.setData(calcSMA(DATA, 20));\n' +
    '  }\n' +
    '  if (SHOW_MA50) {\n' +
    '    ma50series = mainChart.addLineSeries({ color: "#818cf8", lineWidth: 1,\n' +
    '      priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });\n' +
    '    ma50series.setData(calcSMA(DATA, 50));\n' +
    '  }\n' +
    '  if (SHOW_BB) {\n' +
    '    var bbData = calcBB(DATA, 20, 2);\n' +
    '    bbUpperS = mainChart.addLineSeries({ color: "#94a3b8", lineWidth: 1, lineStyle: 2,\n' +
    '      priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });\n' +
    '    bbUpperS.setData(bbData.upper);\n' +
    '    bbMiddleS = mainChart.addLineSeries({ color: "#64748b", lineWidth: 1, lineStyle: 1,\n' +
    '      priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });\n' +
    '    bbMiddleS.setData(bbData.middle);\n' +
    '    bbLowerS = mainChart.addLineSeries({ color: "#94a3b8", lineWidth: 1, lineStyle: 2,\n' +
    '      priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });\n' +
    '    bbLowerS.setData(bbData.lower);\n' +
    '  }\n' +
    '\n' +
    '  // ── Oscillator panes ────────────────────────────────────────────────\n' +
    '\n' +
    '  var oscOpts = {\n' +
    '    layout: { background: { color: "' + colors.bgElevated + '" }, textColor: "' + colors.textMuted + '" },\n' +
    '    grid:   { vertLines: { color: "' + colors.border + '" }, horzLines: { color: "' + colors.border + '" } },\n' +
    '    timeScale: { borderColor: "' + colors.border + '", timeVisible: true, visible: false },\n' +
    '    crosshair: { mode: 1 },\n' +
    '    handleScale: { axisPressedMouseMove: false },\n' +
    '    handleScroll: { pressedMouseMove: false, mouseWheel: false },\n' +
    '  };\n' +
    '\n' +
    '  var rsiChart = null, rsiSeries = null;\n' +
    '  if (SHOW_RSI) {\n' +
    '    rsiChart = LightweightCharts.createChart(document.getElementById("chart-rsi"), oscOpts);\n' +
    '    rsiSeries = rsiChart.addLineSeries({ color: "#a78bfa", lineWidth: 1,\n' +
    '      priceLineVisible: false, lastValueVisible: true, crosshairMarkerVisible: false,\n' +
    '      autoscaleInfoProvider: function() { return { priceRange: { minValue: 0, maxValue: 100 } }; } });\n' +
    '    rsiSeries.setData(calcRSI(DATA, 14));\n' +
    '    rsiSeries.createPriceLine({ price: 70, color: "' + colors.loss   + '", lineWidth: 1, lineStyle: 1, axisLabelVisible: true, title: "70" });\n' +
    '    rsiSeries.createPriceLine({ price: 30, color: "' + colors.profit + '", lineWidth: 1, lineStyle: 1, axisLabelVisible: true, title: "30" });\n' +
    '    rsiChart.timeScale().fitContent();\n' +
    '  }\n' +
    '\n' +
    '  var macdChart = null, macdLineS = null, macdSigS = null, macdHistS = null;\n' +
    '  if (SHOW_MACD) {\n' +
    '    macdChart  = LightweightCharts.createChart(document.getElementById("chart-macd"), oscOpts);\n' +
    '    macdLineS  = macdChart.addLineSeries({ color: "#38bdf8", lineWidth: 1,\n' +
    '      priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });\n' +
    '    macdSigS   = macdChart.addLineSeries({ color: "#fb923c", lineWidth: 1,\n' +
    '      priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });\n' +
    '    macdHistS  = macdChart.addHistogramSeries({ priceLineVisible: false, lastValueVisible: false });\n' +
    '    var macdResult = calcMACD(DATA);\n' +
    '    macdLineS.setData(macdResult.macdLine);\n' +
    '    macdSigS.setData(macdResult.signalArr);\n' +
    '    macdHistS.setData(macdResult.histogram);\n' +
    '    macdChart.timeScale().fitContent();\n' +
    '  }\n' +
    '\n' +
    '  // ── Time scale sync ─────────────────────────────────────────────────\n' +
    '\n' +
    '  var syncing = false;\n' +
    '  function syncOscillators(range) {\n' +
    '    if (!range || syncing) return;\n' +
    '    syncing = true;\n' +
    '    if (rsiChart)  rsiChart.timeScale().setVisibleLogicalRange(range);\n' +
    '    if (macdChart) macdChart.timeScale().setVisibleLogicalRange(range);\n' +
    '    syncing = false;\n' +
    '  }\n' +
    '\n' +
    '  // ── T.21 lazy-load older bars ────────────────────────────────────────\n' +
    '\n' +
    '  var LOAD_THRESHOLD    = 20;\n' +
    '  var MIN_BARS_FOR_MORE = 20;\n' +
    '  var inFlight          = false;\n' +
    '  var hitFloor          = DATA.length === 0;\n' +
    '  var loadingEl         = document.getElementById("loading-left");\n' +
    '\n' +
    '  function rebuildIndicators() {\n' +
    '    if (ma20series)  ma20series.setData(calcSMA(DATA, 20));\n' +
    '    if (ma50series)  ma50series.setData(calcSMA(DATA, 50));\n' +
    '    if (SHOW_BB && bbUpperS) {\n' +
    '      var bbD = calcBB(DATA, 20, 2);\n' +
    '      bbUpperS.setData(bbD.upper);\n' +
    '      bbMiddleS.setData(bbD.middle);\n' +
    '      bbLowerS.setData(bbD.lower);\n' +
    '    }\n' +
    '    if (rsiSeries) rsiSeries.setData(calcRSI(DATA, 14));\n' +
    '    if (macdLineS) {\n' +
    '      var mr = calcMACD(DATA);\n' +
    '      macdLineS.setData(mr.macdLine);\n' +
    '      macdSigS.setData(mr.signalArr);\n' +
    '      macdHistS.setData(mr.histogram);\n' +
    '    }\n' +
    '  }\n' +
    '\n' +
    '  function loadMoreHistory() {\n' +
    '    if (inFlight || hitFloor || DATA.length === 0) return;\n' +
    '    inFlight = true;\n' +
    '    loadingEl.classList.add("on");\n' +
    '    var oldestTime = DATA[0].time;\n' +
    '    var fetchP;\n' +
    '    if (COINBASE_PRODUCT && COINBASE_GRANULARITY) {\n' +
    '      var endTs   = oldestTime - COINBASE_GRANULARITY;\n' +
    '      var startTs = endTs - 300 * COINBASE_GRANULARITY;\n' +
    '      var url = "https://api.exchange.coinbase.com/products/" + COINBASE_PRODUCT +\n' +
    '        "/candles?granularity=" + COINBASE_GRANULARITY +\n' +
    '        "&start=" + encodeURIComponent(new Date(startTs * 1000).toISOString()) +\n' +
    '        "&end="   + encodeURIComponent(new Date(endTs   * 1000).toISOString());\n' +
    '      fetchP = fetch(url).then(function(res) {\n' +
    '        if (!res.ok) throw new Error("Coinbase HTTP " + res.status);\n' +
    '        return res.json().then(function(raw) {\n' +
    '          return (Array.isArray(raw) ? raw : []).map(function(r) {\n' +
    '            return { time: r[0], open: r[3], high: r[2], low: r[1], close: r[4] };\n' +
    '          }).sort(function(a, b) { return a.time - b.time; });\n' +
    '        });\n' +
    '      });\n' +
    '    } else {\n' +
    '      var url = API_URL + "/api/bars/" + encodeURIComponent(SYMBOL) +\n' +
    '        "?tf=" + encodeURIComponent(TIMEFRAME) +\n' +
    '        "&limit=500&before=" + encodeURIComponent(oldestTime);\n' +
    '      fetchP = fetch(url).then(function(res) {\n' +
    '        if (!res.ok) throw new Error("HTTP " + res.status);\n' +
    '        return res.json().then(function(json) { return (json && json.bars) || []; });\n' +
    '      });\n' +
    '    }\n' +
    '    fetchP.then(function(older) {\n' +
    '      if (older.length < MIN_BARS_FOR_MORE) hitFloor = true;\n' +
    '      if (older.length > 0) {\n' +
    '        var visible = mainChart.timeScale().getVisibleLogicalRange();\n' +
    '        var seen = {};\n' +
    '        DATA.forEach(function(b) { seen[b.time] = true; });\n' +
    '        var fresh = older.filter(function(b) { return !seen[b.time]; });\n' +
    '        if (fresh.length > 0) {\n' +
    '          var merged = fresh.concat(DATA);\n' +
    '          merged.sort(function(a, b) { return a.time - b.time; });\n' +
    '          DATA = merged;\n' +
    '          series.setData(DATA);\n' +
    '          rebuildIndicators();\n' +
    '          if (visible) {\n' +
    '            mainChart.timeScale().setVisibleLogicalRange({\n' +
    '              from: visible.from + fresh.length,\n' +
    '              to:   visible.to   + fresh.length,\n' +
    '            });\n' +
    '          }\n' +
    '        }\n' +
    '      }\n' +
    '    }).catch(function(e) {\n' +
    '      if (typeof console !== "undefined") console.warn("chart history fetch failed", e);\n' +
    '    }).finally(function() {\n' +
    '      inFlight = false;\n' +
    '      loadingEl.classList.remove("on");\n' +
    '    });\n' +
    '  }\n' +
    '\n' +
    '  mainChart.timeScale().subscribeVisibleLogicalRangeChange(function(range) {\n' +
    '    if (!range) return;\n' +
    '    syncOscillators(range);\n' +
    '    if (range.from < LOAD_THRESHOLD) loadMoreHistory();\n' +
    '  });\n' +
    '\n' +
    '  // ── WebSocket live ticks ─────────────────────────────────────────────\n' +
    '\n' +
    '  var cur    = DATA.length > 0 ? Object.assign({}, DATA[DATA.length - 1]) : null;\n' +
    '  var status = document.getElementById("status");\n' +
    '  var ws;\n' +
    '\n' +
    '  function connect() {\n' +
    '    try { ws = new WebSocket(' + JSON.stringify(WS_URL) + '); } catch (e) { setTimeout(connect, 2000); return; }\n' +
    '    ws.onopen  = function() { status.textContent = "live"; };\n' +
    '    ws.onclose = function() { status.textContent = "reconnecting"; setTimeout(connect, 2000); };\n' +
    '    ws.onerror = function() { status.textContent = "error"; };\n' +
    '    ws.onmessage = function(e) {\n' +
    '      try {\n' +
    '        var m = JSON.parse(e.data);\n' +
    '        if (!m || (m.type !== "tick" && m.type !== "snapshot")) return;\n' +
    '        var q = (m.quotes || []).find(function(x) { return x.symbol === SYMBOL; });\n' +
    '        if (!q) return;\n' +
    '        var mid   = (q.bid + q.ask) / 2;\n' +
    '        var t     = Math.floor(Date.now() / 1000);\n' +
    '        var start = t - (t % TF_SECONDS);\n' +
    '        if (!cur || start > cur.time) {\n' +
    '          cur = { time: start, open: cur ? cur.close : mid, high: mid, low: mid, close: mid };\n' +
    '          DATA.push(cur);\n' +
    '        } else {\n' +
    '          if (mid > cur.high) cur.high = mid;\n' +
    '          if (mid < cur.low)  cur.low  = mid;\n' +
    '          cur.close = mid;\n' +
    '          if (DATA.length > 0) DATA[DATA.length - 1] = cur;\n' +
    '        }\n' +
    '        series.update(cur);\n' +
    '        // Update MA overlays on tick for the current bar\n' +
    '        if (ma20series && DATA.length >= 20) {\n' +
    '          var s20 = 0;\n' +
    '          for (var i = DATA.length - 20; i < DATA.length; i++) s20 += DATA[i].close;\n' +
    '          ma20series.update({ time: cur.time, value: s20 / 20 });\n' +
    '        }\n' +
    '        if (ma50series && DATA.length >= 50) {\n' +
    '          var s50 = 0;\n' +
    '          for (var i = DATA.length - 50; i < DATA.length; i++) s50 += DATA[i].close;\n' +
    '          ma50series.update({ time: cur.time, value: s50 / 50 });\n' +
    '        }\n' +
    '      } catch(err) {}\n' +
    '    };\n' +
    '  }\n' +
    '  // ── T.16 Drawing tools ──────────────────────────────────────────\n' +
    '  var DRAWINGS=(function(){try{return JSON.parse(JSON.stringify(INITIAL_DRAWINGS));}catch(e){return [];}})();\n' +
    '  var drawMode="select";\n' +
    '  var pending=null;\n' +
    '  var drawSvg=document.getElementById("draw-overlay");\n' +
    '  var drawBar=document.getElementById("draw-toolbar");\n' +
    '  var PRIC="' + colors.primary + '";\n' +
    '  var BORD="' + colors.border + '";\n' +
    '  var BGC="' + colors.bgElevated + '";\n' +
    '  var TEXC="' + colors.textSecondary + '";\n' +
    '  var DTOOLS=[{id:"select",lbl:"\u2196"},{id:"horizontal",lbl:"\u2014"},{id:"trendline",lbl:"\u2571"},{id:"fib",lbl:"F"}];\n' +
    '  DTOOLS.forEach(function(t){var b=document.createElement("button");b.className="dtool";b.dataset.id=t.id;b.textContent=t.lbl;b.title=t.id;b.onclick=function(){setDMode(t.id);};drawBar.appendChild(b);});\n' +
    '  var clrBtn=document.createElement("button");clrBtn.className="dtool dtool-del";clrBtn.title="Clear";clrBtn.textContent="\xd7";clrBtn.onclick=function(){DRAWINGS=[];pending=null;renderSvg();notifyDraw();};drawBar.appendChild(clrBtn);\n' +
    '  function setDMode(m){drawMode=m;pending=null;drawSvg.style.pointerEvents=(m==="select")?"none":"all";drawSvg.style.cursor=(m==="select")?"default":"crosshair";drawBar.querySelectorAll(".dtool[data-id]").forEach(function(b){var on=(b.dataset.id===m);b.style.borderColor=on?PRIC:BORD;b.style.background=on?PRIC+"33":BGC;b.style.color=on?PRIC:TEXC;});}\n' +
    '  setDMode("select");\n' +
    '  function duid(){return Math.random().toString(36).slice(2,9);}\n' +
    '  function getdc(e){var rect=drawSvg.getBoundingClientRect();var cx=e.clientX-rect.left;var cy=e.clientY-rect.top;var t=mainChart.timeScale().coordinateToTime(cx);var p=series.coordinateToPrice(cy);return(t!==null&&p!==null)?{time:Number(t),price:p}:null;}\n' +
    '  drawSvg.addEventListener("click",function(e){var c=getdc(e);if(!c)return;if(drawMode==="horizontal"){DRAWINGS.push({id:duid(),type:"horizontal",price:c.price,color:"#f59e0b"});renderSvg();notifyDraw();}else if(drawMode==="trendline"||drawMode==="fib"){if(!pending){pending={time:c.time,price:c.price};renderSvg();}else{DRAWINGS.push({id:duid(),type:drawMode,p1:pending,p2:{time:c.time,price:c.price},color:drawMode==="trendline"?"#818cf8":"#22d3ee"});pending=null;renderSvg();notifyDraw();}}});\n' +
    '  function renderSvg(){\n' +
    '    while(drawSvg.firstChild)drawSvg.removeChild(drawSvg.firstChild);\n' +
    '    var W=drawSvg.parentElement?drawSvg.parentElement.clientWidth:400;\n' +
    '    var H=drawSvg.parentElement?drawSvg.parentElement.clientHeight:300;\n' +
    '    drawSvg.setAttribute("viewBox","0 0 "+W+" "+H);\n' +
    '    function mkL(x1,y1,x2,y2,col,dash,sw){var el=document.createElementNS("http://www.w3.org/2000/svg","line");el.setAttribute("x1",x1);el.setAttribute("y1",y1);el.setAttribute("x2",x2);el.setAttribute("y2",y2);el.setAttribute("stroke",col||"#f59e0b");el.setAttribute("stroke-width",sw||"1");if(dash&&dash!=="none")el.setAttribute("stroke-dasharray",dash);return el;}\n' +
    '    function mkT(x,y,s,col,a){var el=document.createElementNS("http://www.w3.org/2000/svg","text");el.setAttribute("x",x);el.setAttribute("y",y);el.setAttribute("fill",col||"#f59e0b");el.setAttribute("font-size","9");el.setAttribute("font-family","Inter,sans-serif");if(a)el.setAttribute("text-anchor",a);el.textContent=s;return el;}\n' +
    '    DRAWINGS.forEach(function(d){\n' +
    '      if(d.type==="horizontal"&&d.price!=null){var yh=series.priceToCoordinate(d.price);if(yh===null)return;drawSvg.appendChild(mkL(0,yh,W,yh,d.color,"4 3","1.5"));drawSvg.appendChild(mkT(W-4,yh-3,Number(d.price).toFixed(DECIMALS),d.color,"end"));}\n' +
    '      else if(d.type==="trendline"&&d.p1&&d.p2){var x1t=mainChart.timeScale().timeToCoordinate(d.p1.time);var y1t=series.priceToCoordinate(d.p1.price);var x2t=mainChart.timeScale().timeToCoordinate(d.p2.time);var y2t=series.priceToCoordinate(d.p2.price);if(x1t===null||y1t===null||x2t===null||y2t===null)return;if(x2t!==x1t){var sl=(y2t-y1t)/(x2t-x1t);drawSvg.appendChild(mkL(0,y1t+sl*(0-x1t),W,y1t+sl*(W-x1t),d.color,"none","1.5"));}else{drawSvg.appendChild(mkL(x1t,0,x1t,H,d.color,"none","1.5"));}}\n' +
    '      else if(d.type==="fib"&&d.p1&&d.p2){var FIBS=[0,0.236,0.382,0.5,0.618,0.786,1];var FCLR=["#22d3ee","#34d399","#a78bfa","#f59e0b","#a78bfa","#34d399","#22d3ee"];var hiP=Math.max(d.p1.price,d.p2.price);var loP=Math.min(d.p1.price,d.p2.price);var rng=hiP-loP;FIBS.forEach(function(lvl,i){var p=hiP-lvl*rng;var yf=series.priceToCoordinate(p);if(yf===null||yf<-20||yf>H+20)return;var dash=(lvl===0||lvl===1)?"none":"3 3";drawSvg.appendChild(mkL(0,yf,W,yf,FCLR[i],dash,"1"));drawSvg.appendChild(mkT(6,yf-3,(lvl*100).toFixed(1)+"%  "+Number(p).toFixed(DECIMALS),FCLR[i]));});}\n' +
    '    });\n' +
    '    if(pending){var px=mainChart.timeScale().timeToCoordinate(pending.time);var py=series.priceToCoordinate(pending.price);if(px!==null&&py!==null){var pc=(drawMode==="fib")?"#22d3ee":"#818cf8";drawSvg.appendChild(mkL(px-6,py,px+6,py,pc,"none","2"));drawSvg.appendChild(mkL(px,py-6,px,py+6,pc,"none","2"));}}\n' +
    '  }\n' +
    '  function notifyDraw(){var msg=JSON.stringify({type:"drawings_update",symbol:SYMBOL,drawings:DRAWINGS});try{if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(msg);else window.parent.postMessage(msg,"*");}catch(ex){}}\n' +
    '  mainChart.timeScale().subscribeVisibleTimeRangeChange(function(){renderSvg();});\n' +
    '  renderSvg();\n' +
    '\n' +
    '  connect();\n' +
    '</script>\n' +
    '</body></html>'
  );
  /* eslint-enable @typescript-eslint/no-explicit-any */
}
