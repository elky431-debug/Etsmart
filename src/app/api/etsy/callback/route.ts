import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { exchangeEtsyOAuthCode, getEtsyShop } from '@/lib/etsy/client';

/**
 * Route callback OAuth Etsy
 * GET /api/etsy/callback?code=xxx&state=xxx
 * 
 * Reçoit le code d'autorisation, l'échange contre un access_token,
 * et stocke la connexion dans Supabase
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Si erreur depuis Etsy
    if (error) {
      console.error('[ETSY CALLBACK] OAuth error from Etsy:', error);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3011'}/dashboard/shop/analyze?error=oauth_error`
      );
    }

    if (!code) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3011'}/dashboard/shop/analyze?error=no_code`
      );
    }

    // ⚠️ TODO: Vérifier le state pour la sécurité CSRF
    // Pour l'instant, on fait confiance (à améliorer)

    // Échanger le code contre un access_token
    let tokenData;
    try {
      tokenData = await exchangeEtsyOAuthCode(code);
    } catch (error: any) {
      console.error('[ETSY CALLBACK] Error exchanging code:', error);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3011'}/dashboard/shop/analyze?error=token_exchange_failed`
      );
    }

    const { access_token, refresh_token, expires_in } = tokenData;

    // Récupérer les infos du shop pour obtenir le shop_id
    // ⚠️ Note: Pour obtenir le shop_id, on doit d'abord récupérer le user_id depuis le token
    // L'API Etsy fournit un endpoint pour ça, mais pour simplifier, on va stocker le token
    // et récupérer le shop_id lors de la première utilisation

    // ⚠️ NOTE: On n'a pas l'user_id ici car on n'a pas de session dans le callback OAuth
    // Solution: On redirige vers le frontend avec les tokens dans l'URL (encodés)
    // Le frontend récupère les tokens et appelle /api/etsy/finalize-connection avec l'user_id

    // Encoder les tokens pour les passer dans l'URL (base64)
    const tokensData = {
      access_token,
      refresh_token: refresh_token || null,
      expires_in,
    };
    // Utiliser Buffer de Node.js (disponible dans Next.js API routes)
    const encodedTokens = Buffer.from(JSON.stringify(tokensData)).toString('base64url');

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3011'}/dashboard/shop/analyze?etsy_oauth_success=true&tokens=${encodedTokens}`
    );

  } catch (error: any) {
    console.error('[ETSY CALLBACK] Error:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3011'}/dashboard/shop/analyze?error=callback_error`
    );
  }
}

