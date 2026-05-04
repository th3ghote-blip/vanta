/**
 * Vanta backend client. Wraps fetch with auth header injection from Supabase session.
 */

import { supabase } from './supabase';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = {
    'Content-Type': 'application/json',
    ...(await authHeaders()),
    ...(init?.headers ?? {}),
  };
  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      msg = body.error ?? msg;
    } catch {}
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

export const api = {
  request,
  health: () => request<{ ok: boolean }>('/health'),

  openOrder: (input: {
    accountId: string;
    symbol: string;
    side: 'buy' | 'sell';
    volume: number;
    stopLoss?: number;
    takeProfit?: number;
    reason?: 'mobile' | 'web' | 'desktop' | 'robot';
  }) => request<{ trade: any }>('/api/orders/open', { method: 'POST', body: JSON.stringify(input) }),

  closeOrder: (tradeId: number) =>
    request<{ tradeId: number; profit: number; closePrice: number }>(
      '/api/orders/close',
      { method: 'POST', body: JSON.stringify({ tradeId }) },
    ),

  openRound: (input: {
    accountId: string;
    symbol: string;
    direction: 'buy' | 'sell';
    stake: number;
    durationSeconds: number;
  }) => request<{ round: any }>('/api/rounds/open', { method: 'POST', body: JSON.stringify(input) }),

  compileRobot: (prompt: string) =>
    request<{ config: any; raw: string }>('/api/robots/compile', {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    }),
};
