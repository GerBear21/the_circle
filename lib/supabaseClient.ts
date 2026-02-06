import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

let _supabase: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!_supabase && supabaseUrl && supabaseAnonKey) {
    _supabase = createClient(supabaseUrl, supabaseAnonKey);
  }
  if (!_supabase) {
    throw new Error('Supabase client not initialized. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.');
  }
  return _supabase;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabaseClient() as any)[prop];
  },
});

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
