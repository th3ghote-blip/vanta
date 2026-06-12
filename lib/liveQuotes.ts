/**
 * Live quote WebSocket client. Connects to the Vanta backend at
 * EXPO_PUBLIC_WS_URL/ws/quotes and pumps ticks into the Zustand prices store.
 *
 * Resilience:
 *  - Auto-reconnects with backoff on a clean close.
 *  - Staleness watchdog: the server broadcasts every 200ms, so if we receive
 *    nothing for STALE_MS the socket has gone half-open (network sleep / wifi
 *    blip / proxy idle-kill where `onclose` never fires) — we force a reconnect.
 *    Without this the chart silently freezes on the last tick indefinitely.
 *  - Reconnects when the app/tab returns to the foreground.
 */

import { AppState, type AppStateStatus } from 'react-native';
import { usePriceStore, type Quote } from '@/stores/prices';

let ws: WebSocket | null = null;
let reconnectAttempts = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let watchdogTimer: ReturnType<typeof setInterval> | null = null;
let appStateSub: { remove: () => void } | null = null;
let lastMessageMs = 0;
let isShuttingDown = false;

// Server pushes every 200ms; 12s of silence means the connection is dead.
const STALE_MS = 12_000;
const WATCHDOG_INTERVAL_MS = 5_000;

const WS_URL =
  (process.env.EXPO_PUBLIC_WS_URL ?? 'ws://localhost:4000') + '/ws/quotes';

export function connectLiveQuotes() {
  isShuttingDown = false;
  if (!ws || (ws.readyState !== WebSocket.OPEN && ws.readyState !== WebSocket.CONNECTING)) {
    open();
  }
  startWatchdog();
  if (!appStateSub) {
    appStateSub = AppState.addEventListener('change', onAppStateChange);
  }
}

export function disconnectLiveQuotes() {
  isShuttingDown = true;
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (watchdogTimer) { clearInterval(watchdogTimer); watchdogTimer = null; }
  if (appStateSub) { appStateSub.remove(); appStateSub = null; }
  if (ws) {
    try { ws.onclose = null; ws.close(); } catch {}
    ws = null;
  }
}

function open() {
  try {
    ws = new WebSocket(WS_URL);
  } catch {
    scheduleReconnect();
    return;
  }
  lastMessageMs = Date.now();

  ws.onopen = () => {
    reconnectAttempts = 0;
    lastMessageMs = Date.now();
    if (__DEV__) console.log('[liveQuotes] connected');
  };

  ws.onmessage = (ev) => {
    lastMessageMs = Date.now();
    try {
      const msg = JSON.parse(typeof ev.data === 'string' ? ev.data : '');
      if (!msg || !msg.type) return;
      if (msg.type === 'snapshot' || msg.type === 'tick') {
        const quotes: Quote[] = msg.quotes ?? [];
        usePriceStore.getState().setQuotes(quotes);
      }
    } catch {}
  };

  ws.onerror = () => {
    if (__DEV__) console.warn('[liveQuotes] error');
  };

  ws.onclose = () => {
    ws = null;
    if (!isShuttingDown) scheduleReconnect();
  };
}

/** Tear down the current socket (even a zombie) and open a fresh one immediately. */
function forceReconnect() {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (ws) {
    try { ws.onclose = null; ws.close(); } catch {}
    ws = null;
  }
  open();
}

function startWatchdog() {
  if (watchdogTimer) return;
  watchdogTimer = setInterval(() => {
    if (isShuttingDown) return;
    const silentFor = Date.now() - lastMessageMs;
    const isOpen = ws && ws.readyState === WebSocket.OPEN;
    // Open-but-silent → half-dead socket. Or no socket at all → reconnect.
    if ((isOpen && silentFor > STALE_MS) || !ws) {
      if (__DEV__) console.warn(`[liveQuotes] stale ${silentFor}ms — forcing reconnect`);
      forceReconnect();
    }
  }, WATCHDOG_INTERVAL_MS);
}

function onAppStateChange(state: AppStateStatus) {
  if (isShuttingDown) return;
  if (state === 'active') {
    // Returning to foreground — the socket may have been frozen while backgrounded.
    const silentFor = Date.now() - lastMessageMs;
    const isOpen = ws && ws.readyState === WebSocket.OPEN;
    if (!isOpen || silentFor > STALE_MS) forceReconnect();
  }
}

function scheduleReconnect() {
  if (isShuttingDown) return;
  reconnectAttempts++;
  const delay = Math.min(15_000, 500 * 2 ** Math.min(reconnectAttempts, 5));
  if (__DEV__) console.log(`[liveQuotes] reconnecting in ${delay}ms`);
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(open, delay);
}
