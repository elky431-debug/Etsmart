/**
 * ⚠️ SERVER-ONLY FILE - Never import this in client components
 * 
 * This file contains the Supabase admin client that uses the service role key.
 * It should ONLY be used in API routes or server-side code.
 * 
 * To use this, import it ONLY in:
 * - src/app/api/[...]/route.ts files (API routes)
 * - Server components (not client components)
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Creates a Supabase admin client with service role key
 * ⚠️ SECURITY: This uses SUPABASE_SERVICE_ROLE_KEY which is NEVER exposed to client
 * Only use this in API routes or server components
 */
export function createSupabaseAdminClient() {
  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured');
  }

  if (!serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not configured. ' +
      'This key should only be set in server-side environment variables (Netlify).'
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}


