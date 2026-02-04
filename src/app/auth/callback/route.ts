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
      // Check if user is new (created in the last 60 seconds)
      const createdAt = new Date(data.user.created_at || '');
      const now = new Date();
      const isNewUser = (now.getTime() - createdAt.getTime()) < 60000; // 60 seconds
      
      // For new users, ensure profile is created in users table
      if (isNewUser) {
        try {
          // Extract full name from user metadata (Google provides this)
          const fullName = data.user.user_metadata?.full_name || 
                          data.user.user_metadata?.name ||
                          data.user.email?.split('@')[0] || 
                          null;
          
          // Try to create user profile (will fail silently if trigger already created it)
          await supabase
            .from('users')
            .upsert({
              id: data.user.id,
              email: data.user.email!,
              full_name: fullName,
            }, {
              onConflict: 'id'
            });
        } catch (err) {
          // Silently ignore - trigger likely already created it or user exists
          // This is not critical for OAuth flow
        }
        
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


















