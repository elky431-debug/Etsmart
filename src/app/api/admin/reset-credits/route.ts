import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

/**
 * Route admin pour remettre les crédits au maximum d'un utilisateur
 * POST /api/admin/reset-credits
 * 
 * Body: { email: string }
 * 
 * ⚠️ SECURITY: Cette route devrait être protégée par un système d'admin
 * Pour l'instant, elle est accessible à tous les utilisateurs authentifiés
 * (à améliorer avec un système de rôles admin)
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

    // ⚠️ TODO: Vérifier que l'utilisateur est admin
    // Pour l'instant, on autorise tous les utilisateurs authentifiés

    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'MISSING_EMAIL', message: 'email is required' },
        { status: 400 }
      );
    }

    // Trouver l'utilisateur par email
    const { data: targetUser, error: findError } = await supabase
      .from('users')
      .select('id, email, subscription_plan, analysis_quota, analysis_used_this_month')
      .eq('email', email)
      .single();

    if (findError || !targetUser) {
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
      .eq('id', targetUser.id)
      .select('id, email, subscription_plan, analysis_quota, analysis_used_this_month')
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
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        subscription_plan: updatedUser.subscription_plan,
        quota: updatedUser.analysis_quota || 0,
        used: updatedUser.analysis_used_this_month || 0,
        remaining: remainingCredits,
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

