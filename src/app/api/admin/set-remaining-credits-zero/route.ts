import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { PLAN_QUOTAS, isUnlimitedPlan, type PlanId } from '@/types/subscription';

/**
 * Force les crédits restants à 0 pour un email ou un user id.
 * Doit utiliser la même règle de quota que getUserQuotaInfo / check-stripe-subscription :
 * quota = max(PLAN_QUOTAS[plan], analysis_quota en base).
 *
 * GET /api/admin/set-remaining-credits-zero?email=...&secret=...
 * GET /api/admin/set-remaining-credits-zero?userId=uuid&secret=...
 */
function effectiveQuotaForRow(row: {
  subscription_plan: string | null;
  analysis_quota: number | null;
}): number | 'unlimited' {
  const planId = (row.subscription_plan as PlanId) || 'FREE';
  if (isUnlimitedPlan(planId)) {
    return 'unlimited';
  }
  const planQuota = PLAN_QUOTAS[planId] ?? 0;
  const dbQuota = Number(row.analysis_quota ?? 0);
  if (dbQuota === -1) {
    return 'unlimited';
  }
  return Math.max(planQuota, dbQuota) || 100;
}

export async function GET(request: NextRequest) {
  try {
    const emailRaw = (request.nextUrl.searchParams.get('email') || '').trim();
    const email = emailRaw.toLowerCase();
    const userIdParam = (request.nextUrl.searchParams.get('userId') || '').trim();
    const secret = request.nextUrl.searchParams.get('secret');
    const expectedSecret = process.env.ADMIN_SECRET || 'reset-credits-2024';

    if (!email && !userIdParam) {
      return NextResponse.json(
        { error: 'MISSING_EMAIL_OR_USER_ID', message: 'email or userId is required' },
        { status: 400 }
      );
    }
    if (secret !== expectedSecret) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Invalid secret' },
        { status: 401 }
      );
    }

    const supabase = createSupabaseAdminClient();
    const selectCols =
      'id, email, subscription_plan, subscription_status, analysis_quota, analysis_used_this_month';

    let user: {
      id: string;
      email: string | null;
      subscription_plan: string | null;
      subscription_status: string | null;
      analysis_quota: number | null;
      analysis_used_this_month: number | null;
    } | null = null;

    if (userIdParam) {
      const { data, error: findError } = await supabase
        .from('users')
        .select(selectCols)
        .eq('id', userIdParam)
        .single();
      if (findError || !data) {
        return NextResponse.json(
          { error: 'USER_NOT_FOUND', message: `User with id ${userIdParam} not found` },
          { status: 404 }
        );
      }
      user = data;
    } else {
      const { data: rows, error: findError } = await supabase
        .from('users')
        .select(selectCols)
        .ilike('email', emailRaw)
        .limit(2);

      if (findError || !rows?.length) {
        return NextResponse.json(
          { error: 'USER_NOT_FOUND', message: `User with email ${email} not found` },
          { status: 404 }
        );
      }
      if (rows.length > 1) {
        return NextResponse.json(
          {
            error: 'AMBIGUOUS_EMAIL',
            message: 'Multiple users match this email; use userId instead',
          },
          { status: 400 }
        );
      }
      user = rows[0];
    }

    const effectiveQuota = effectiveQuotaForRow(user);
    if (effectiveQuota === 'unlimited') {
      return NextResponse.json(
        {
          error: 'UNLIMITED_PLAN_NOT_SUPPORTED',
          message: 'User has unlimited quota. Refusing to force remaining credits to 0 automatically.',
        },
        { status: 409 }
      );
    }

    const usedTarget = Math.max(0, effectiveQuota);
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({
        analysis_used_this_month: usedTarget,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select('id, email, subscription_plan, subscription_status, analysis_quota, analysis_used_this_month')
      .single();

    if (updateError || !updatedUser) {
      return NextResponse.json(
        { error: 'UPDATE_ERROR', message: updateError?.message || 'Failed to update credits' },
        { status: 500 }
      );
    }

    const beforeUsed = Number(user.analysis_used_this_month ?? 0);
    const afterUsed = Number(updatedUser.analysis_used_this_month ?? 0);
    const beforeRemainingUi = Math.max(0, effectiveQuota - beforeUsed);
    const afterRemainingUi = Math.max(0, effectiveQuota - afterUsed);

    const label = user.email || email || userIdParam;

    return NextResponse.json({
      success: true,
      message: `Remaining credits set to 0 for ${label} (effective quota ${effectiveQuota}, same rule as dashboard)`,
      effectiveQuota,
      before: {
        quotaDb: Number(user.analysis_quota ?? 0),
        effectiveQuota,
        used: beforeUsed,
        remaining: beforeRemainingUi,
      },
      after: {
        quotaDb: Number(updatedUser.analysis_quota ?? 0),
        effectiveQuota,
        used: afterUsed,
        remaining: afterRemainingUi,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message },
      { status: 500 }
    );
  }
}
