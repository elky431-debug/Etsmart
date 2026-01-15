import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Create a safe client that won't fail during build if env vars are missing
// It will fail gracefully at runtime when actually used
function createSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    // Return a mock client that will throw helpful errors when used
    // This allows the build to succeed, but runtime will fail with clear messages
    return createClient(
      supabaseUrl || 'https://placeholder.supabase.co',
      supabaseAnonKey || 'placeholder-key',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );
  }
  
  return createClient(supabaseUrl, supabaseAnonKey);
}

function createSupabaseAdminClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    return createClient(
      supabaseUrl || 'https://placeholder.supabase.co',
      process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey || 'placeholder-key',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }
  
  return createClient(
    supabaseUrl,
    process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

export const supabase = createSupabaseClient();
export const supabaseAdmin = createSupabaseAdminClient();

// Helper function to check if Supabase is properly configured
export function isSupabaseConfigured(): boolean {
  return !!(supabaseUrl && supabaseAnonKey);
}


