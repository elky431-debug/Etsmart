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

  console.log('🔍 OAuth Callback - Start');
  console.log('URL:', request.url);
  console.log('Code:', code ? 'present' : 'missing');
  console.log('Error:', error);
  console.log('Base URL:', baseUrl);

  // Handle OAuth errors
  if (error) {
    console.error('❌ OAuth error:', error, errorDescription);
    return NextResponse.redirect(
      new URL(`/register?error=${encodeURIComponent(errorDescription || error)}`, baseUrl)
    );
  }

  if (!code) {
    console.error('❌ No code parameter in OAuth callback');
    console.log('All params:', Object.fromEntries(requestUrl.searchParams));
    return NextResponse.redirect(
      new URL('/register?error=no_code', baseUrl)
    );
  }

  try {
    console.log('🔄 Exchanging code for session...');
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { error: exchangeError, data } = await supabase.auth.exchangeCodeForSession(code);
    
    if (exchangeError) {
      console.error('❌ Error exchanging code for session:', exchangeError);
      console.error('Error details:', JSON.stringify(exchangeError, null, 2));
      return NextResponse.redirect(
        new URL(`/register?error=${encodeURIComponent(exchangeError.message || 'exchange_error')}`, baseUrl)
      );
    }
    
    if (!data.user) {
      console.error('❌ No user data after exchange');
      console.log('Data:', JSON.stringify(data, null, 2));
      return NextResponse.redirect(
        new URL('/register?error=no_user', baseUrl)
      );
    }

    console.log('✅ User authenticated:', data.user.id);
    console.log('User email:', data.user.email);
    console.log('User created at:', data.user.created_at);

    // Check if user is new (created in the last 60 seconds)
    const createdAt = new Date(data.user.created_at || '');
    const now = new Date();
    const isNewUser = (now.getTime() - createdAt.getTime()) < 60000; // 60 seconds
    
    console.log('Is new user:', isNewUser);
    
    // For new users, ensure profile is created in users table
    if (isNewUser) {
      console.log('👤 Creating user profile...');
      try {
        // Extract full name from user metadata (Google provides this)
        const fullName = data.user.user_metadata?.full_name || 
                        data.user.user_metadata?.name ||
                        data.user.email?.split('@')[0] || 
                        null;
        
        console.log('Full name extracted:', fullName);
        
        // Try to create user profile (will fail silently if trigger already created it)
        const { error: upsertError, data: upsertData } = await supabase
          .from('users')
          .upsert({
            id: data.user.id,
            email: data.user.email!,
            full_name: fullName,
          }, {
            onConflict: 'id'
          });
        
        if (upsertError) {
          console.warn('⚠️ Error upserting user profile (may already exist):', upsertError);
        } else {
          console.log('✅ User profile created/updated:', upsertData);
        }
      } catch (err) {
        // Silently ignore - trigger likely already created it or user exists
        // This is not critical for OAuth flow
        console.warn('⚠️ Error creating user profile:', err);
      }
      
      console.log('🔄 Redirecting new user to /pricing');
      // New user → redirect to pricing/paywall
      return NextResponse.redirect(new URL('/pricing', baseUrl));
    } else {
      console.log('🔄 Redirecting existing user to /dashboard');
      // Returning user → redirect to dashboard
      return NextResponse.redirect(new URL('/dashboard?section=analyze', baseUrl));
    }
  } catch (err: any) {
    console.error('❌ Unexpected error in OAuth callback:', err);
    console.error('Error stack:', err.stack);
    return NextResponse.redirect(
      new URL(`/register?error=${encodeURIComponent(err.message || 'oauth_error')}`, baseUrl)
    );
  }
}


















