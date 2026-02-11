import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { incrementAnalysisCount, getUserQuotaInfo } from '@/lib/subscription-quota';

/**
 * POST /api/deduct-credits
 * Deducts credits from the authenticated user's account.
 * Used by frontend components (e.g. competitor analysis) that receive data
 * from the Chrome extension and need to deduct credits client-side.
 * 
 * Body: { amount: number, reason: string }
 * Headers: Authorization: Bearer <supabase_access_token>
 */
export async function POST(request: NextRequest) {
  try {
    // 🔒 Authenticate the user
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Authentication required.' },
        { status: 401 }
      );
    }

    const supabase = createSupabaseAdminClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Invalid or expired token.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { amount, reason } = body;

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { error: 'INVALID_AMOUNT', message: 'Amount must be a positive number.' },
        { status: 400 }
      );
    }

    // Check quota first
    const quotaInfo = await getUserQuotaInfo(user.id);

    if (quotaInfo.status !== 'active') {
      return NextResponse.json({
        error: 'SUBSCRIPTION_REQUIRED',
        message: 'An active subscription is required.',
        subscriptionStatus: quotaInfo.status,
      }, { status: 403 });
    }

    if (quotaInfo.remaining < amount) {
      return NextResponse.json({
        error: 'QUOTA_EXCEEDED',
        message: 'Not enough credits remaining.',
        used: quotaInfo.used,
        quota: quotaInfo.quota,
        remaining: quotaInfo.remaining,
      }, { status: 403 });
    }

    // Deduct credits
    console.log(`[deduct-credits] Deducting ${amount} credits for user ${user.id} (reason: ${reason || 'N/A'})`);
    const result = await incrementAnalysisCount(user.id, amount);

    if (!result.success) {
      console.error(`[deduct-credits] ❌ Failed to deduct credits:`, result.error);
      return NextResponse.json({
        error: 'DEDUCTION_FAILED',
        message: result.error || 'Failed to deduct credits.',
      }, { status: 500 });
    }

    console.log(`[deduct-credits] ✅ Successfully deducted ${amount} credits. Used: ${result.used}/${result.quota}`);

    return NextResponse.json({
      success: true,
      used: result.used,
      quota: result.quota,
      remaining: result.remaining,
    });

  } catch (error: any) {
    console.error('[deduct-credits] Error:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

