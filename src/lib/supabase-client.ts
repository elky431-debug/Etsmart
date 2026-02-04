'use client';

import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Create a browser client that uses cookies for PKCE storage
// This is required for OAuth flows in Next.js App Router
export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

