import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

export function isAuthConfigured() {
  return Boolean(supabase);
}

export async function authenticateRequest(req, _res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';

  if (!token || !supabase) {
    next();
    return;
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (!error && data?.user) {
      req.user = {
        id: data.user.id,
        email: data.user.email || '',
        appMetadata: data.user.app_metadata || {},
        userMetadata: data.user.user_metadata || {}
      };
    }
  } catch (error) {
    console.warn('[auth] failed to verify Supabase token:', error.message);
  }

  next();
}
