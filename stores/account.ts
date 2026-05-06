/**
 * Current account state — holds the user's primary account row.
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
}

interface AccountState {
  account: Account | null;
  loading: boolean;
  error: string | null;
  fetch: () => Promise<void>;
  clear: () => void;
}

export const useAccountStore = create<AccountState>((set) => ({
  account: null,
  loading: false,
  error: null,

  fetch: async () => {
    set({ loading: true, error: null });
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      set({ account: null, loading: false });
      return;
    }
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      set({ error: error.message, loading: false });
      return;
    }

    // No account row? Bootstrap one server-side (fallback if signup trigger
    // isn't installed). Idempotent — server returns existing if present.
    if (!data) {
      try {
        const res = await api.request<{ account: Account; created: boolean }>('/api/account/init', {
          method: 'POST',
        });
        set({ account: res.account, loading: false });
        return;
      } catch (err: any) {
        set({ error: err?.message ?? 'account init failed', loading: false });
        return;
      }
    }

    set({ account: data as Account | null, loading: false });
  },

  clear: () => set({ account: null }),
}));
