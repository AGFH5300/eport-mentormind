import { createClient } from '@supabase/supabase-js';
import { jwtVerify } from 'jose';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const jwtSecret = process.env.SUPABASE_JWT_SECRET || '';

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

if (!jwtSecret) {
  console.warn('[AUTH WARNING] SUPABASE_JWT_SECRET not set, falling back to slower auth method');
}

// Server-side Supabase client with service role key
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Helper function to get user from session with fast JWT verification
export async function getUserFromSession(authHeader?: string) {
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.substring(7);

  // If JWT secret is available, use fast local verification
  if (jwtSecret) {
    try {
      const secret = new TextEncoder().encode(jwtSecret);
      const { payload } = await jwtVerify(token, secret);
      
      if (payload.sub && payload.email) {
        return {
          id: payload.sub,
          email: payload.email as string,
          aud: payload.aud,
          role: payload.role
        };
      }
      return null;
    } catch (error) {
      console.error('[JWT AUTH] Token verification failed:', error instanceof Error ? error.message : 'Unknown error');
      return null;
    }
  }

  // Fallback to Supabase auth (slower)
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return null;
    }
    
    return user;
  } catch (exception) {
    console.error('[SESSION DEBUG] Exception in getUserFromSession:', exception);
    return null;
  }
}

// Helper function to verify user ownership
export async function verifyUserOwnership(userId: string, authHeader?: string) {
  const user = await getUserFromSession(authHeader);
  return user?.id === userId;
}
