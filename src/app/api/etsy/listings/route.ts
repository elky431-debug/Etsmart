import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { getAllEtsyShopListings, getEtsyListingImages } from '@/lib/etsy/client';

/**
 * Route pour récupérer tous les listings du shop Etsy connecté
 * GET /api/etsy/listings
 * 
 * Query params optionnels:
 * - include_images: boolean (inclure les images de chaque listing)
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

    // Récupérer le paramètre include_images
    const searchParams = request.nextUrl.searchParams;
    const includeImages = searchParams.get('include_images') === 'true';

    // Récupérer tous les listings via l'API Etsy
    try {
      const listings = await getAllEtsyShopListings(
        connection.access_token,
        parseInt(connection.shop_id)
      );

      // Optionnellement, enrichir avec les images
      let enrichedListings = listings;
      if (includeImages) {
        enrichedListings = await Promise.all(
          listings.map(async (listing) => {
            try {
              const images = await getEtsyListingImages(
                connection.access_token,
                listing.listing_id
              );
              return {
                ...listing,
                images: images.map(img => ({
                  id: img.listing_image_id,
                  url_75x75: img.url_75x75,
                  url_170x135: img.url_170x135,
                  url_570xN: img.url_570xN,
                  url_fullxfull: img.url_fullxfull,
                  rank: img.rank,
                })),
              };
            } catch (error) {
              console.error(`[ETSY LISTINGS] Error fetching images for listing ${listing.listing_id}:`, error);
              return { ...listing, images: [] };
            }
          })
        );
      }

      return NextResponse.json({
        success: true,
        count: enrichedListings.length,
        listings: enrichedListings.map(listing => ({
          listing_id: listing.listing_id,
          title: listing.title,
          description: listing.description,
          price: parseFloat(listing.price),
          currency_code: listing.currency_code,
          quantity: listing.quantity,
          tags: listing.tags,
          materials: listing.materials,
          state: listing.state,
          url: listing.url,
          views: listing.views,
          num_favorers: listing.num_favorers,
          creation_tsz: listing.creation_tsz,
          last_modified_tsz: listing.last_modified_tsz,
          images: includeImages ? (listing as any).images : undefined,
        })),
      });

    } catch (error: any) {
      console.error('[ETSY LISTINGS] Error fetching listings from Etsy API:', error);
      return NextResponse.json(
        { error: 'ETSY_API_ERROR', message: error.message || 'Failed to fetch listings from Etsy' },
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error('[ETSY LISTINGS] Error:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: error.message || 'Failed to fetch listings' },
      { status: 500 }
    );
  }
}

