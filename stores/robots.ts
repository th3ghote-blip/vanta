/**
 * Robots store — list of AI robots for the current account (Phase 3.1).
 *
 * Fetches from the `robots` table via Supabase and exposes an `add` helper
 * so RobotPromptBuilder can prepend a freshly-saved robot without a round-trip.
 */

import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

export interface Robot {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'active' | 'paused' | 'stopped' | 'error';
  totalTrades: number;
  winningTrades: number;
  totalProfit: number;
  prompt?: string;
  config?: any;
}

interface RobotsState {
  robots: Robot[];
  loading: boolean;
  accountId: string | null;
  /** Load robots for a given account. Safe to call multiple times. */
  fetch: (accountId: string) => Promise<void>;
  /** Prepend a newly-created robot to the list without a network round-trip. */
  add: (robot: Robot) => void;
  /** Update a robot in the list (e.g. after status change). */
  update: (id: string, patch: Partial<Robot>) => void;
  /** Remove a robot from the list by id. */
  remove: (id: string) => void;
  clear: () => void;
}

function rowToRobot(row: any): Robot {
  return {
    id: row.id,
    name: row.name ?? 'Unnamed Robot',
    description: row.description ?? '',
    status: (row.status as Robot['status']) ?? 'draft',
    totalTrades: row.total_trades ?? 0,
    winningTrades: row.winning_trades ?? 0,
    totalProfit: row.total_profit ?? 0,
    prompt: row.prompt,
    config: row.config,
  };
}

export const useRobotsStore = create<RobotsState>((set, get) => ({
  robots: [],
  loading: false,
  accountId: null,

  fetch: async (accountId: string) => {
    if (get().accountId === accountId && get().robots.length > 0) return; // already loaded
    set({ loading: true, accountId });

    const { data, error } = await supabase
      .from('robots')
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      set({ robots: data.map(rowToRobot), loading: false });
    } else {
      set({ loading: false });
    }
  },

  add: (robot: Robot) => {
    set((state) => ({ robots: [robot, ...state.robots] }));
  },

  update: (id: string, patch: Partial<Robot>) => {
    set((state) => ({ robots: state.robots.map((r) => r.id === id ? { ...r, ...patch } : r) }));
  },

  remove: (id: string) => {
    set((state) => ({ robots: state.robots.filter((r) => r.id !== id) }));
  },

  clear: () => set({ robots: [], loading: false, accountId: null }),
}));
