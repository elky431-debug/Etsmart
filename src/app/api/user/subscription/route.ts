/**
 * API Route: Get user subscription information
 * Returns subscription status, quota usage, and remaining analyses
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserQuotaInfo } from '@/lib/subscription-quota';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
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

    const quotaInfo = await getUserQuotaInfo(user.id);
    
    return NextResponse.json(quotaInfo);
  } catch (error: any) {
    console.error('Error fetching subscription info:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}


