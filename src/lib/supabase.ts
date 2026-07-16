import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = Constants.expoConfig?.extra?.supabaseUrl as string | undefined;
const anonKey = Constants.expoConfig?.extra?.supabaseAnonKey as string | undefined;

/** True when real Supabase credentials are configured. */
export const hasSupabase =
  !!url && !!anonKey && !url.includes('PLACEHOLDER') && !anonKey.includes('PLACEHOLDER');

/**
 * Lazily-created Supabase client. Returns null when no credentials are present,
 * in which case the app falls back to local mock auth so every flow stays
 * clickable without a backend.
 */
let client: SupabaseClient | null = null;
export function getSupabase(): SupabaseClient | null {
  if (!hasSupabase) return null;
  if (!client) {
    client = createClient(url!, anonKey!, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}
