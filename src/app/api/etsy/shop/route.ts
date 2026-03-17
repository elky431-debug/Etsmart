import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { getEtsyShop } from '@/lib/etsy/client';

/**
 * Route pour récupérer les infos du shop Etsy connecté
 * GET /api/etsy/shop
 */
export async function GET(request: NextRequest) {
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

    // Récupérer la connexion Etsy de l'utilisateur
    const { data: connection, error: connectionError } = await supabase
      .from('etsy_connections')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (connectionError || !connection) {
      return NextResponse.json(
        { error: 'NO_CONNECTION', message: 'No Etsy shop connected. Please connect your shop first.' },
        { status: 404 }
      );
    }

    // Vérifier si le token est expiré
    if (connection.token_expires_at && new Date(connection.token_expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'TOKEN_EXPIRED', message: 'Etsy token expired. Please reconnect your shop.' },
        { status: 401 }
      );
    }

    // Récupérer les infos du shop via l'API Etsy
    try {
      const shop = await getEtsyShop(connection.access_token, parseInt(connection.shop_id));

      return NextResponse.json({
        success: true,
        shop: {
          shop_id: shop.shop_id,
          shop_name: shop.shop_name,
          title: shop.title,
          url: shop.url,
          currency_code: shop.currency_code,
          listing_active_count: shop.listing_active_count,
          num_favorers: shop.num_favorers,
          review_count: shop.review_count,
          review_average: shop.review_average,
          transaction_sold_count: shop.transaction_sold_count,
          creation_tsz: shop.creation_tsz,
          last_updated_tsz: shop.last_updated_tsz,
          is_vacation: shop.is_vacation,
          vacation_message: shop.vacation_message,
          image_url_760x100: shop.image_url_760x100,
          icon_url_fullxfull: shop.icon_url_fullxfull,
        },
      });

    } catch (error: any) {
      console.error('[ETSY SHOP] Error fetching shop from Etsy API:', error);
      return NextResponse.json(
        { error: 'ETSY_API_ERROR', message: error.message || 'Failed to fetch shop from Etsy' },
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error('[ETSY SHOP] Error:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: error.message || 'Failed to fetch shop' },
      { status: 500 }
    );
  }
}

