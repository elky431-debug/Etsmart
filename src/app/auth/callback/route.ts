import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { error, data } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error && data.user) {
      // Check if user is new (created in the last 60 seconds) → redirect to pricing
      const createdAt = new Date(data.user.created_at || '');
      const now = new Date();
      const isNewUser = (now.getTime() - createdAt.getTime()) < 60000; // 60 seconds
      
      if (isNewUser) {
        // New user → redirect to pricing/paywall
        return NextResponse.redirect(new URL('/pricing', request.url));
      } else {
        // Returning user → redirect to dashboard
        return NextResponse.redirect(new URL('/dashboard?section=analyze', request.url));
      }
    }
  }

  // If there's an error or no code, redirect to login
  return NextResponse.redirect(new URL('/login?error=oauth_error', request.url));
}


















