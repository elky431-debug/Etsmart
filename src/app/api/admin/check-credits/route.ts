import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

/**
 * Route pour vérifier les crédits d'un utilisateur
 * GET /api/admin/check-credits?email=elky431@gmail.com
 */
export async function GET(request: NextRequest) {
  try {
    const email = request.nextUrl.searchParams.get('email') || 'elky431@gmail.com';
    const supabase = createSupabaseAdminClient();

    const { data: user, error: findError } = await supabase
      .from('users')
      .select('id, email, subscription_plan, subscription_status, analysis_quota, analysis_used_this_month, current_period_start, current_period_end')
      .eq('email', email)
      .single();

    if (findError || !user) {
      return NextResponse.json(
        { error: 'USER_NOT_FOUND', message: `User with email ${email} not found` },
        { status: 404 }
      );
    }

    const remainingCredits = (user.analysis_quota || 0) - (user.analysis_used_this_month || 0);
    const isUnlimited = user.analysis_quota === -1;

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        subscription_plan: user.subscription_plan,
        subscription_status: user.subscription_status,
        quota: user.analysis_quota || 0,
        used: user.analysis_used_this_month || 0,
        remaining: isUnlimited ? 'Unlimited' : remainingCredits,
        is_unlimited: isUnlimited,
        period_start: user.current_period_start,
        period_end: user.current_period_end,
      },
      status: user.analysis_used_this_month === 0 
        ? '✅ Credits reset to maximum!' 
        : `⚠️ Credits used: ${user.analysis_used_this_month}`,
    });

  } catch (error: any) {
    console.error('[ADMIN CHECK CREDITS] Error:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: error.message || 'Failed to check credits' },
      { status: 500 }
    );
  }
}

