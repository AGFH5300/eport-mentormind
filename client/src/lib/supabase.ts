import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

console.log('[SUPABASE DEBUG] Environment check:', {
  hasUrl: !!supabaseUrl,
  hasKey: !!supabaseAnonKey,
  urlPrefix: supabaseUrl ? supabaseUrl.substring(0, 20) + '...' : 'undefined',
  keyPrefix: supabaseAnonKey ? supabaseAnonKey.substring(0, 10) + '...' : 'undefined'
});

// Create a dummy client if environment variables are missing
// This prevents the app from crashing and allows development without Supabase configured
const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

console.log('[SUPABASE DEBUG] Configuration status:', { isSupabaseConfigured });

export const supabase = isSupabaseConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

console.log('[SUPABASE DEBUG] Client created:', { clientExists: !!supabase });

export { isSupabaseConfigured };

// Helper function to get auth headers for API requests
export async function getAuthHeaders() {
  if (!supabase) return {};
  const { data: { session } } = await supabase.auth.getSession();
  return session ? { Authorization: `Bearer ${session.access_token}` } : {};
}
