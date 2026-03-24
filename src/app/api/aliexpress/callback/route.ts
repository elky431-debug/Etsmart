import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { exchangeAliExpressCode } from '@/lib/aliexpress';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code || !state) {
    const redirectUrl = new URL('/dashboard?aliexpress=error_missing_code', request.url);
    return NextResponse.redirect(redirectUrl);
  }

  try {
    const tokens = await exchangeAliExpressCode(code);

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from('users')
      .update({
        aliexpress_access_token: tokens.access_token,
        aliexpress_refresh_token: tokens.refresh_token,
        updated_at: new Date().toISOString(),
      })
      .eq('id', state);

    if (error) {
      const redirectUrl = new URL('/dashboard?aliexpress=error_save_token', request.url);
      return NextResponse.redirect(redirectUrl);
    }

    const redirectUrl = new URL('/dashboard?aliexpress=connected', request.url);
    return NextResponse.redirect(redirectUrl);
  } catch {
    const redirectUrl = new URL('/dashboard?aliexpress=error_oauth', request.url);
    return NextResponse.redirect(redirectUrl);
  }
}
