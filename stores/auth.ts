import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { Session, User } from '@supabase/supabase-js';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

interface RegisterResult {
  login: number;
  password: string;
  error?: undefined;
}

interface AuthError {
  error: string;
}

interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  init: () => () => void;
  register: (contactEmail?: string) => Promise<RegisterResult | AuthError>;
  signIn: (login: number, password: string) => Promise<{ error?: string }>;
  changePassword: (newPassword: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}

interface BackendSession {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  user_id: string;
}

async function setSupabaseSession(s: BackendSession) {
  await supabase.auth.setSession({
    access_token: s.access_token,
    refresh_token: s.refresh_token,
  });
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  loading: true,

  init: () => {
    supabase.auth.getSession().then(({ data }) => {
      set({ session: data.session, user: data.session?.user ?? null, loading: false });
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, user: session?.user ?? null, loading: false });
    });

    return () => subscription.subscription.unsubscribe();
  },

  register: async (contactEmail) => {
    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactEmail ? { contactEmail } : {}),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return { error: body.error ?? `HTTP ${res.status}` };
      }
      const data = (await res.json()) as { login: number; password: string; session: BackendSession };
      await setSupabaseSession(data.session);
      return { login: data.login, password: data.password };
    } catch (err: any) {
      return { error: err?.message ?? 'register failed' };
    }
  },

  signIn: async (login, password) => {
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, password }),
      });
      if (!res.ok) {
        if (res.status === 429) return { error: 'Too many attempts. Try again in a minute.' };
        const body = await res.json().catch(() => ({}));
        return { error: body.error === 'invalid_credentials' ? 'Wrong login or password.' : body.error ?? `HTTP ${res.status}` };
      }
      const data = (await res.json()) as { session: BackendSession };
      await setSupabaseSession(data.session);
      return {};
    } catch (err: any) {
      return { error: err?.message ?? 'sign in failed' };
    }
  },

  changePassword: async (newPassword) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return { error: 'Not signed in' };
      const res = await fetch(`${API_URL}/api/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ newPassword }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return { error: body.error ?? `HTTP ${res.status}` };
      }
      return {};
    } catch (err: any) {
      return { error: err?.message ?? 'change failed' };
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
  },
}));
