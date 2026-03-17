import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { scoreListing, ListingData } from '@/lib/etsy/listing-scorer';

/**
 * Route pour analyser et scorer un listing Etsy
 * POST /api/etsy/analyze-listing
 * 
 * Body: {
 *   title: string;
 *   description: string;
 *   tags: string[];
 *   materials: string[];
 *   images?: Array<{ url: string }>;
 *   hasVideo?: boolean;
 *   videoLength?: number;
 * }
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
    const {
      title,
      description,
      tags,
      materials,
      images,
      hasVideo,
      videoLength,
    } = body;

    // Validation
    if (!title || !description) {
      return NextResponse.json(
        { error: 'MISSING_FIELDS', message: 'title and description are required' },
        { status: 400 }
      );
    }

    // Préparer les données pour le scoring
    const listingData: ListingData = {
      title: title.trim(),
      description: description.trim(),
      tags: Array.isArray(tags) ? tags : [],
      materials: Array.isArray(materials) ? materials : [],
      images: Array.isArray(images) ? images : undefined,
      hasVideo: hasVideo || false,
      videoLength: videoLength || undefined,
    };

    // Scorer le listing
    const scores = scoreListing(listingData);

    return NextResponse.json({
      success: true,
      scores,
      listing: {
        title: listingData.title,
        description: listingData.description.substring(0, 200) + '...', // Truncate pour la réponse
        tags: listingData.tags,
        materials: listingData.materials,
      },
    });

  } catch (error: any) {
    console.error('[ETSY ANALYZE LISTING] Error:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: error.message || 'Failed to analyze listing' },
      { status: 500 }
    );
  }
}

