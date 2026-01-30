import { NextRequest, NextResponse } from 'next/server';
import { estimateCompetition, type CompetitionEstimateInput } from '@/lib/competitionEstimator';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  try {
    // 🔒 SECURITY: Require authentication
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const supabase = createSupabaseAdminClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { productTitle, productType, category, keywords, market } = body;

    // Validation des champs requis
    if (!productTitle || !productType || !category) {
      return NextResponse.json(
        { 
          error: 'Missing required fields: productTitle, productType, and category are required' 
        },
        { status: 400 }
      );
    }

    // Préparer l'input
    const input: CompetitionEstimateInput = {
      productTitle: String(productTitle),
      productType: String(productType),
      category: String(category),
      keywords: keywords ? (Array.isArray(keywords) ? keywords : [keywords]) : undefined,
      market: market || 'EN',
    };

    console.log('🔍 Estimating competition for:', {
      productTitle: input.productTitle,
      productType: input.productType,
      category: input.category,
    });

    // Estimer la concurrence
    const result = await estimateCompetition(input);

    console.log('✅ Competition estimate completed:', {
      score: result.competitionScore,
      level: result.saturationLevel,
      decision: result.decision,
      queriesUsed: result.queriesUsed,
    });

    return NextResponse.json({
      success: true,
      estimate: result,
    });

  } catch (error) {
    console.error('❌ Competition estimation error:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error',
        success: false,
      },
      { status: 500 }
    );
  }
}

// Endpoint GET pour tester
export async function GET() {
  return NextResponse.json({
    message: 'Competition Estimator API',
    usage: 'POST with { productTitle, productType, category, keywords?, market? }',
  });
}





















