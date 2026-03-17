import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { getEtsyShop } from '@/lib/etsy/client';

/**
 * Route pour finaliser la connexion Etsy après OAuth
 * POST /api/etsy/finalize-connection
 * 
 * Body: { connection_code: string, access_token: string, refresh_token: string, expires_in: number }
 * 
 * ⚠️ Note: Pour simplifier, on passe directement les tokens depuis le frontend
 * (le frontend les récupère depuis l'URL du callback)
 */
export async function POST(request: NextRequest) {
  try {
    // 🔒 SECURITY: Require authentication
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const supabase = createSupabaseAdminClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { access_token, refresh_token, expires_in } = body;

    if (!access_token) {
      return NextResponse.json(
        { error: 'MISSING_TOKEN', message: 'access_token is required' },
        { status: 400 }
      );
    }

    // Récupérer les infos du shop pour obtenir le shop_id
    // ⚠️ Note: Pour obtenir le shop_id, on doit d'abord récupérer le user_id depuis le token Etsy
    // L'API Etsy fournit un endpoint pour ça: GET /application/users/me
    // Mais pour simplifier, on va utiliser un endpoint qui retourne le shop de l'utilisateur

    let shopId: number;
    let shopName: string;

    try {
      // Récupérer le shop de l'utilisateur
      // ⚠️ Note: L'API Etsy v3 nécessite d'abord de récupérer le user_id, puis le shop_id
      // Pour simplifier, on va utiliser l'endpoint /application/users/me/shops
      const shopsResponse = await fetch('https://api.etsy.com/v3/application/users/me/shops', {
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'x-api-key': process.env.ETSY_API_KEY || '',
        },
      });

      if (!shopsResponse.ok) {
        const error = await shopsResponse.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(`Failed to fetch shops: ${shopsResponse.status} - ${JSON.stringify(error)}`);
      }

      const shopsData = await shopsResponse.json();
      const shops = shopsData.results || [];

      if (shops.length === 0) {
        return NextResponse.json(
          { error: 'NO_SHOP', message: 'No shop found for this Etsy account' },
          { status: 400 }
        );
      }

      // Prendre le premier shop (la plupart des users n'ont qu'un shop)
      const shop = shops[0];
      shopId = shop.shop_id;
      shopName = shop.shop_name;

    } catch (error: any) {
      console.error('[ETSY FINALIZE] Error fetching shop:', error);
      return NextResponse.json(
        { error: 'SHOP_FETCH_ERROR', message: error.message || 'Failed to fetch shop information' },
        { status: 500 }
      );
    }

    // Calculer la date d'expiration du token
    const tokenExpiresAt = expires_in
      ? new Date(Date.now() + expires_in * 1000).toISOString()
      : null;

    // Stocker ou mettre à jour la connexion dans Supabase
    const { data: existingConnection, error: fetchError } = await supabase
      .from('etsy_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('shop_id', shopId.toString())
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('[ETSY FINALIZE] Error fetching existing connection:', fetchError);
      return NextResponse.json(
        { error: 'DB_ERROR', message: 'Failed to check existing connection' },
        { status: 500 }
      );
    }

    if (existingConnection) {
      // Mettre à jour la connexion existante
      const { error: updateError } = await supabase
        .from('etsy_connections')
        .update({
          access_token,
          refresh_token: refresh_token || existingConnection.refresh_token,
          token_expires_at: tokenExpiresAt,
          shop_name: shopName,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingConnection.id);

      if (updateError) {
        console.error('[ETSY FINALIZE] Error updating connection:', updateError);
        return NextResponse.json(
          { error: 'DB_ERROR', message: 'Failed to update connection' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Etsy connection updated successfully',
        shop: {
          shop_id: shopId,
          shop_name: shopName,
        },
      });

    } else {
      // Créer une nouvelle connexion
      const { error: insertError } = await supabase
        .from('etsy_connections')
        .insert({
          user_id: user.id,
          shop_id: shopId.toString(),
          shop_name: shopName,
          access_token,
          refresh_token: refresh_token || null,
          token_expires_at: tokenExpiresAt,
        });

      if (insertError) {
        console.error('[ETSY FINALIZE] Error inserting connection:', insertError);
        return NextResponse.json(
          { error: 'DB_ERROR', message: 'Failed to save connection' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Etsy connection created successfully',
        shop: {
          shop_id: shopId,
          shop_name: shopName,
        },
      });
    }

  } catch (error: any) {
    console.error('[ETSY FINALIZE] Error:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: error.message || 'Failed to finalize connection' },
      { status: 500 }
    );
  }
}

