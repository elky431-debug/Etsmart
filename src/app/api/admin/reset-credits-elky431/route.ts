import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

/**
 * Route admin spéciale pour remettre les crédits au maximum pour elky431@gmail.com
 * GET /api/admin/reset-credits-elky431
 * 
 * ⚠️ SECURITY: Cette route utilise une clé secrète simple pour la protection
 * À améliorer avec un système d'admin plus robuste en production
 */
export async function GET(request: NextRequest) {
  try {
    // Protection basique avec un secret (à améliorer)
    const secret = request.nextUrl.searchParams.get('secret');
    const expectedSecret = process.env.ADMIN_SECRET || 'reset-credits-2024';

    if (secret !== expectedSecret) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Invalid secret' },
        { status: 401 }
      );
    }

    const email = 'elky431@gmail.com';
    const supabase = createSupabaseAdminClient();

    // Trouver l'utilisateur
    const { data: user, error: findError } = await supabase
      .from('users')
      .select('id, email, subscription_plan, subscription_status, analysis_quota, analysis_used_this_month')
      .eq('email', email)
      .single();

    if (findError || !user) {
      return NextResponse.json(
        { error: 'USER_NOT_FOUND', message: `User with email ${email} not found` },
        { status: 404 }
      );
    }

    // Remettre les crédits utilisés à 0
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({
        analysis_used_this_month: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select('id, email, subscription_plan, subscription_status, analysis_quota, analysis_used_this_month')
      .single();

    if (updateError) {
      console.error('[ADMIN RESET CREDITS] Error updating user:', updateError);
      return NextResponse.json(
        { error: 'UPDATE_ERROR', message: 'Failed to update user credits' },
        { status: 500 }
      );
    }

    const remainingCredits = (updatedUser.analysis_quota || 0) - (updatedUser.analysis_used_this_month || 0);

    return NextResponse.json({
      success: true,
      message: `Credits reset to maximum for ${email}`,
      before: {
        used: user.analysis_used_this_month || 0,
        quota: user.analysis_quota || 0,
        remaining: (user.analysis_quota || 0) - (user.analysis_used_this_month || 0),
      },
      after: {
        used: updatedUser.analysis_used_this_month || 0,
        quota: updatedUser.analysis_quota || 0,
        remaining: remainingCredits,
      },
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        subscription_plan: updatedUser.subscription_plan,
        subscription_status: updatedUser.subscription_status,
      },
    });

  } catch (error: any) {
    console.error('[ADMIN RESET CREDITS] Error:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: error.message || 'Failed to reset credits' },
      { status: 500 }
    );
  }
}

