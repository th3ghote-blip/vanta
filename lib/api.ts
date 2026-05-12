/**
 * Vanta backend client. Wraps fetch with auth header injection from Supabase session.
 */

import { supabase } from './supabase';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

/**
 * Thrown by `request()` for any non-2xx response.
 *
 * `code` is the server's `error` string (e.g. `'insufficient_margin'`, `'no_quote'`,
 * `'forbidden'`, `'invalid_input'`) when the body parses as JSON; otherwise falls
 * back to `'http_<status>'`. `details` carries the rest of the JSON body so callers
 * can surface payload fields like `required` / `available` / `symbol` / `issues`.
 *
 * `message` is set to `code` so legacy `catch (err) { setError(err.message) }`
 * sites keep working -- they'll just see the raw code instead of a friendly string.
 */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: Record<string, any>;

  constructor(code: string, status: number, details: Record<string, any> = {}) {
    super(code);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

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
    let code = `http_${res.status}`;
    let details: Record<string, any> = {};
    try {
      const body = await res.json();
      if (body && typeof body === 'object') {
        const { error: errCode, ...rest } = body as Record<string, any>;
        if (typeof errCode === 'string' && errCode.length > 0) code = errCode;
        details = rest;
      }
    } catch {}
    throw new ApiError(code, res.status, details);
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

  saveRobot: (input: { accountId: string; prompt: string; config: any }) =>
    request<{ robot: any }>('/api/robots/save', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  getRobot: (id: string) =>
    request<{ robot: any }>(`/api/robots/${id}`),

  getRobotRuns: (id: string) =>
    request<{ runs: any[] }>(`/api/robots/${id}/runs`),

  updateRobotStatus: (id: string, status: 'active' | 'paused' | 'stopped') =>
    request<{ robot: any }>(`/api/robots/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  deleteRobot: (id: string) =>
    request<{ ok: boolean }>(`/api/robots/${id}`, { method: 'DELETE' }),

  setRobotVisibility: (id: string, is_public: boolean) =>
    request<{ robot: any }>(`/api/robots/${id}/visibility`, {
      method: 'PATCH',
      body: JSON.stringify({ is_public }),
    }),

  getRobotLeaderboard: (period: '7d' | '30d' | 'all' = '7d') =>
    request<{ leaderboard: LeaderboardEntry[]; period: string }>(
      `/api/robots/leaderboard?period=${period}`,
    ),
  createDeposit: (input: {
    accountId: string;
    amount: number;
    method: 'crypto_btc' | 'crypto_eth' | 'crypto_usdt' | 'wire' | 'card';
    reference?: string;
  }) =>
    request<{ transaction: any }>('/api/transactions/deposit', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  createWithdrawal: (input: {
    accountId: string;
    amount: number;
    method: 'crypto' | 'wire';
    destination: string;
  }) =>
    request<{ transaction: any }>('/api/transactions/withdraw', {
      method: 'POST',
      body: JSON.stringify(input),
    }),


  // Profile
  getProfile: () =>
    request<{ profile: any }>('/api/account/profile'),

  // Admin
  adminGetTransactions: (status: 'pending' | 'completed' | 'rejected' | 'all' = 'pending') =>
    request<{ transactions: any[] }>(`/api/admin/transactions?status=${status}`),

  adminApproveTransaction: (id: string) =>
    request<{ transaction: any; balance_delta: number }>(`/api/admin/transactions/${id}/approve`, {
      method: 'POST',
    }),

  adminRejectTransaction: (id: string, reason?: string) =>
    request<{ transaction: any }>(`/api/admin/transactions/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  // Admin KYC
  adminGetKycSubmissions: (status: 'pending' | 'approved' | 'rejected' | 'all' = 'pending') =>
    request<{ submissions: any[] }>(`/api/admin/kyc?status=${status}`),

  adminApproveKyc: (id: string) =>
    request<{ submission: any }>(`/api/admin/kyc/${id}/approve`, { method: 'POST' }),

  adminRejectKyc: (id: string, reason?: string) =>
    request<{ submission: any }>(`/api/admin/kyc/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  // Price alerts (Phase 6.4)
  getAlerts: (active?: boolean) => {
    const url = active ? '/api/alerts?active=true' : '/api/alerts';
    return request<{ alerts: PriceAlert[] }>(url);
  },

  createAlert: (symbol: string, threshold: number, direction: 'above' | 'below') =>
    request<{ alert: PriceAlert }>('/api/alerts', {
      method: 'POST',
      body: JSON.stringify({ symbol, threshold, direction }),
    }),

  deleteAlert: (id: string) =>
    request<{ ok: boolean }>(`/api/alerts/${id}`, { method: 'DELETE' }),

};

export interface PriceAlert {
  id: string;
  user_id: string;
  symbol: string;
  threshold: number;
  direction: 'above' | 'below';
  triggered_at: string | null;
  created_at: string;
}

export interface LeaderboardEntry {
  rank: number;
  id: string;
  name: string;
  description: string | null;
  total_trades: number;
  winning_trades: number;
  win_rate: number | null;
  total_profit: number;
  last_run_at: string | null;
}
