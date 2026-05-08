/**
 * Profile store — current_streak, best_streak (Phase 2.6 Client).
 *
 * Fetches the authenticated user's profile row on demand and subscribes
 * to Supabase realtime UPDATE events so the streak badge in QuickTradeScreen
 * refreshes automatically after each round settles.
 */

import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface Profile {
  user_id: string;
  current_streak: number;
  best_streak: number;
}

interface ProfileState {
  profile: Profile | null;
  /** Fetch current values from the DB. */
  fetch: () => Promise<void>;
  /**
   * Subscribe to realtime changes on this user's profile row.
   * Returns a cleanup function — call it in your useEffect return.
   */
  subscribe: () => Promise<() => void>;
}

export const useProfileStore = create<ProfileState>((set) => ({
  profile: null,

  fetch: async () => {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, current_streak, best_streak')
      .eq('user_id', userId)
      .maybeSingle();

    if (!error && data) {
      set({ profile: data as Profile });
    }
  },

  subscribe: async () => {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;

    if (!userId) {
      return () => {};
    }

    let channel: RealtimeChannel | null = null;

    channel = supabase
      .channel('profile-streaks')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as Profile;
          set({
            profile: {
              user_id: row.user_id,
              current_streak: row.current_streak,
              best_streak: row.best_streak,
            },
          });
        },
      )
      .subscribe();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  },
}));
