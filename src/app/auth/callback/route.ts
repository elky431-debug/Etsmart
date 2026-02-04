import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Get the base URL for redirects
function getBaseUrl(request: NextRequest): string {
  const host = request.headers.get('host');
  const protocol = request.headers.get('x-forwarded-proto') || 'https';
  return `${protocol}://${host}`;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const error = requestUrl.searchParams.get('error');
  const errorDescription = requestUrl.searchParams.get('error_description');
  
  const baseUrl = getBaseUrl(request);

  // Handle OAuth errors
  if (error) {
    console.error('OAuth error:', error, errorDescription);
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(errorDescription || error)}`, baseUrl)
    );
  }

  if (!code) {
    console.error('No code parameter in OAuth callback');
    return NextResponse.redirect(
      new URL('/login?error=no_code', baseUrl)
    );
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { error: exchangeError, data } = await supabase.auth.exchangeCodeForSession(code);
    
    if (exchangeError) {
      console.error('Error exchanging code for session:', exchangeError);
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(exchangeError.message)}`, baseUrl)
      );
    }
    
    if (!data.user) {
      console.error('No user data after exchange');
      return NextResponse.redirect(
        new URL('/login?error=no_user', baseUrl)
      );
    }

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
        const { error: upsertError } = await supabase
          .from('users')
          .upsert({
            id: data.user.id,
            email: data.user.email!,
            full_name: fullName,
          }, {
            onConflict: 'id'
          });
        
        if (upsertError) {
          console.warn('Error upserting user profile (may already exist):', upsertError);
        }
      } catch (err) {
        // Silently ignore - trigger likely already created it or user exists
        // This is not critical for OAuth flow
        console.warn('Error creating user profile:', err);
      }
      
      // New user → redirect to pricing/paywall
      return NextResponse.redirect(new URL('/pricing', baseUrl));
    } else {
      // Returning user → redirect to dashboard
      return NextResponse.redirect(new URL('/dashboard?section=analyze', baseUrl));
    }
  } catch (err: any) {
    console.error('Unexpected error in OAuth callback:', err);
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(err.message || 'oauth_error')}`, baseUrl)
    );
  }
}


















