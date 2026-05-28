import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseAuthConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseAuthConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export function getAuthDisplayName(user) {
  if (!user) {
    return '';
  }

  return user.user_metadata?.full_name
    || user.user_metadata?.name
    || user.user_metadata?.preferred_username
    || user.email
    || user.id;
}
