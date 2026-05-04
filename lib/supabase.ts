import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? Constants.expoConfig?.extra?.supabaseUrl;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? Constants.expoConfig?.extra?.supabaseAnonKey;

if (!url || !anonKey) {
  console.warn('Supabase env vars missing. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.');
}

export const supabase = createClient(url ?? '', anonKey ?? '', {
  auth: {
    storage: Platform.OS === 'web' ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});

export type Env = 'live' | 'demo' | 'staging';
export const ENV: Env = (process.env.EXPO_PUBLIC_ENV as Env) ?? 'staging';
