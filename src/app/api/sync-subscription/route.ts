/**
 * API Route: Force sync subscription from Stripe
 * This endpoint forces a sync with Stripe to update subscription status
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserQuotaInfo } from '@/lib/subscription-quota';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createSupabaseAdminClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Force sync by calling getUserQuotaInfo which always checks Stripe
    const quotaInfo = await getUserQuotaInfo(user.id);
    
    return NextResponse.json({ 
      success: true,
      subscription: quotaInfo 
    });
  } catch (error: any) {
    console.error('Error syncing subscription:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

