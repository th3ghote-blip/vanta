/**
 * Current account state — holds the user's active account row plus the full
 * list of their accounts for the T.10 account switcher.
 * Fetched after auth and re-fetched after trades.
 */

import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { api } from '@/lib/api';

export interface Account {
  id: string;
  user_id: string;
  /** MT4-style numeric login, e.g. 80000001 (from migration 003). */
  login: number;
  type: 'demo' | 'live';
  status: 'pending_kyc' | 'active' | 'suspended' | 'closed';
  currency: string;
  balance: number;
  equity: number;
  margin_used: number;
  free_margin: number;
  leverage: number;
  /** T.9 — when true, opposing positions on the same symbol coexist. */
  hedging_enabled: boolean;
  /** T.10 — marks which account is the user's currently-selected primary. */
  is_primary: boolean;
}

interface AccountState {
  /** The currently-active account (used everywhere downstream). */
  account: Account | null;
  /** All accounts belonging to this user; populated alongside account. */
  allAccounts: Account[];
  loading: boolean;
  error: string | null;
  fetch: () => Promise<void>;
  /**
   * Switch the active account locally (optimistic) and persist the selection
   * server-side via PATCH /api/account/set-primary.
   */
  switchAccount: (accountId: string) => Promise<void>;
  /**
   * Append a freshly-created account to allAccounts and switch to it.
   * Called after a successful POST /api/account/open.
   */
  addAndSwitch: (newAccount: Account) => void;
  clear: () => void;
}

export const useAccountStore = create<AccountState>((set, get) => ({
  account: null,
  allAccounts: [],
  loading: false,
  error: null,

  fetch: async () => {
    set({ loading: true, error: null });
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      set({ account: null, allAccounts: [], loading: false });
      return;
    }

    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      set({ error: error.message, loading: false });
      return;
    }

    const accounts = (data ?? []) as Account[];

    // No account row? Bootstrap one server-side (fallback if signup trigger
    // isn't installed). Idempotent — server returns existing if present.
    if (accounts.length === 0) {
      try {
        const res = await api.request<{ account: Account; created: boolean }>(
          '/api/account/init',
          { method: 'POST' },
        );
        set({ account: res.account, allAccounts: [res.account], loading: false });
        return;
      } catch (err: any) {
        set({ error: err?.message ?? 'account init failed', loading: false });
        return;
      }
    }

    // Prefer the account flagged is_primary; fall back to the oldest one.
    const primary = accounts.find((a) => a.is_primary) ?? accounts[0];
    set({ account: primary, allAccounts: accounts, loading: false });
  },

  switchAccount: async (accountId: string) => {
    const { allAccounts, account: prev } = get();
    const target = allAccounts.find((a) => a.id === accountId);
    if (!target || target.id === prev?.id) return;

    // Optimistic switch — UI responds immediately.
    set({
      account: target,
      allAccounts: allAccounts.map((a) => ({ ...a, is_primary: a.id === accountId })),
    });

    // Persist to server (best-effort; revert on failure).
    try {
      await api.setAccountPrimary(accountId);
    } catch {
      // Revert local state on server error.
      set({
        account: prev,
        allAccounts: allAccounts.map((a) => ({ ...a, is_primary: a.id === prev?.id })),
      });
    }
  },

  addAndSwitch: (newAccount: Account) => {
    const { allAccounts } = get();
    const updated = [
      ...allAccounts.map((a) => ({ ...a, is_primary: false })),
      { ...newAccount, is_primary: true },
    ];
    set({ account: { ...newAccount, is_primary: true }, allAccounts: updated });
  },

  clear: () => set({ account: null, allAccounts: [] }),
}));
