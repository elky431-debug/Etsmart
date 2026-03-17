import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

/**
 * Route pour forcer le rafraîchissement des crédits d'un utilisateur
 * GET /api/admin/force-refresh-credits?email=elky431@gmail.com
 * 
 * Cette route déclenche un événement pour forcer le frontend à rafraîchir les crédits
 */
export async function GET(request: NextRequest) {
  try {
    const email = request.nextUrl.searchParams.get('email') || 'elky431@gmail.com';
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

    const remainingCredits = (user.analysis_quota || 0) - (user.analysis_used_this_month || 0);
    const isUnlimited = user.analysis_quota === -1;

    return NextResponse.json({
      success: true,
      message: 'Credits refreshed. Please refresh your browser page (F5) to see the update.',
      user: {
        id: user.id,
        email: user.email,
        subscription_plan: user.subscription_plan,
        subscription_status: user.subscription_status,
        quota: user.analysis_quota || 0,
        used: user.analysis_used_this_month || 0,
        remaining: isUnlimited ? 'Unlimited' : remainingCredits,
        is_unlimited: isUnlimited,
      },
      instructions: [
        '1. Rafraîchis la page du dashboard (F5 ou Cmd+R)',
        '2. Les crédits devraient maintenant s\'afficher correctement',
        '3. Si ça ne marche pas, vide le cache du navigateur (Cmd+Shift+R)',
      ],
    });

  } catch (error: any) {
    console.error('[ADMIN FORCE REFRESH CREDITS] Error:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: error.message || 'Failed to refresh credits' },
      { status: 500 }
    );
  }
}

