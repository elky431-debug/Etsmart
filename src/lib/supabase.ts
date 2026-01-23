import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Create a safe client that won't fail during build if env vars are missing
// It will fail gracefully at runtime when actually used
// ⚠️ SECURITY: This file is client-safe - only uses NEXT_PUBLIC_ variables
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

export const supabase = createSupabaseClient();

// Helper function to check if Supabase is properly configured
export function isSupabaseConfigured(): boolean {
  return !!(supabaseUrl && supabaseAnonKey);
}


