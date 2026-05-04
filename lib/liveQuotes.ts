/**
 * Live quote WebSocket client. Connects to the Vanta backend at
 * EXPO_PUBLIC_WS_URL/ws/quotes and pumps ticks into the Zustand prices store.
 *
 * Auto-reconnects with backoff. Safe to mount in a React effect on the root layout.
 */

import { usePriceStore, type Quote } from '@/stores/prices';

let ws: WebSocket | null = null;
let reconnectAttempts = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let isShuttingDown = false;

const WS_URL =
  (process.env.EXPO_PUBLIC_WS_URL ?? 'ws://localhost:4000') + '/ws/quotes';

export function connectLiveQuotes() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }
  isShuttingDown = false;
  open();
}

export function disconnectLiveQuotes() {
  isShuttingDown = true;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (ws) {
    try {
      ws.close();
    } catch {}
    ws = null;
  }
}

function open() {
  try {
    ws = new WebSocket(WS_URL);
  } catch (err) {
    scheduleReconnect();
    return;
  }

  ws.onopen = () => {
    reconnectAttempts = 0;
    if (__DEV__) console.log('[liveQuotes] connected');
  };

  ws.onmessage = (ev) => {
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

function scheduleReconnect() {
  if (isShuttingDown) return;
  reconnectAttempts++;
  const delay = Math.min(15_000, 500 * 2 ** Math.min(reconnectAttempts, 5));
  if (__DEV__) console.log(`[liveQuotes] reconnecting in ${delay}ms`);
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(open, delay);
}
