import { NextRequest, NextResponse } from 'next/server';

/**
 * Route pour initier le flux OAuth Etsy
 * GET /api/etsy/auth
 * 
 * Redirige l'utilisateur vers la page d'autorisation Etsy
 */
export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.ETSY_API_KEY;
    const redirectUri = process.env.ETSY_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      return NextResponse.json(
        { error: 'ETSY_API_KEY or ETSY_REDIRECT_URI not configured' },
        { status: 500 }
      );
    }

    // Récupérer le token de l'utilisateur depuis les headers
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Authentication required' },
        { status: 401 }
      );
    }

    // Vérifier que l'utilisateur est authentifié (optionnel ici, mais bon pour la sécurité)
    // On pourrait aussi passer l'user_id en query param pour le récupérer dans le callback

    // Scopes nécessaires pour lire les listings et infos du shop
    const scopes = [
      'listings_r',      // Lire les listings
      'shops_r',         // Lire les infos du shop
      'profile_r',       // Lire le profil
    ].join(' ');

    // State pour la sécurité (CSRF protection) - on pourrait générer un token unique
    const { randomUUID } = await import('crypto');
    const state = randomUUID();

    // URL d'autorisation Etsy
    const authUrl = new URL('https://www.etsy.com/oauth/connect');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', scopes);
    authUrl.searchParams.set('state', state);

    // Rediriger vers Etsy
    return NextResponse.redirect(authUrl.toString());

  } catch (error: any) {
    console.error('[ETSY AUTH] Error:', error);
    return NextResponse.json(
      { error: 'AUTH_ERROR', message: error.message || 'Failed to initiate OAuth' },
      { status: 500 }
    );
  }
}

