/**
 * API Route: Delete User Account
 * 
 * This endpoint deletes all user data and the user account:
 * - Product analyses
 * - Products
 * - User settings
 * - Subscription data
 * - User account (Supabase Auth)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export async function DELETE(request: NextRequest) {
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
    
    // Verify token and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    const userId = user.id;

    // ═══════════════════════════════════════════════════════════════════════════
    // DELETE ALL USER DATA (in order to respect foreign key constraints)
    // ═══════════════════════════════════════════════════════════════════════════

    // 1. Delete product analyses (references products)
    const { error: analysesError } = await supabase
      .from('product_analyses')
      .delete()
      .eq('user_id', userId);

    if (analysesError) {
      console.error('Error deleting product analyses:', analysesError);
      // Continue anyway - might not exist
    }

    // 2. Delete products (references users)
    const { error: productsError } = await supabase
      .from('products')
      .delete()
      .eq('user_id', userId);

    if (productsError) {
      console.error('Error deleting products:', productsError);
      // Continue anyway - might not exist
    }

    // 3. Delete product variants (references products - should be cascade, but delete explicitly)
    // Note: This might be handled by cascade delete, but we do it explicitly to be safe
    const { data: userProducts } = await supabase
      .from('products')
      .select('id')
      .eq('user_id', userId);

    if (userProducts && userProducts.length > 0) {
      const productIds = userProducts.map(p => p.id);
      const { error: variantsError } = await supabase
        .from('product_variants')
        .delete()
        .in('product_id', productIds);

      if (variantsError) {
        console.error('Error deleting product variants:', variantsError);
        // Continue anyway
      }
    }

    // 4. Delete boutique analyses
    const { error: boutiqueError } = await supabase
      .from('boutique_analyses')
      .delete()
      .eq('user_id', userId);

    if (boutiqueError) {
      console.error('Error deleting boutique analyses:', boutiqueError);
      // Continue anyway - might not exist
    }

    // 5. Delete user settings
    const { error: settingsError } = await supabase
      .from('user_settings')
      .delete()
      .eq('user_id', userId);

    if (settingsError) {
      console.error('Error deleting user settings:', settingsError);
      // Continue anyway - might not exist
    }

    // 6. Delete subscription data (if exists in users table)
    // Note: We update the users table to clear subscription data
    const { error: subscriptionError } = await supabase
      .from('users')
      .update({
        subscriptionPlan: 'FREE',
        subscriptionStatus: 'inactive',
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        analysisUsedThisMonth: 0,
        analysisQuota: 0,
        currentPeriodStart: null,
        currentPeriodEnd: null,
      })
      .eq('id', userId);

    if (subscriptionError) {
      console.error('Error clearing subscription data:', subscriptionError);
      // Continue anyway
    }

    // 7. Delete subscriptions table entry (if separate table exists)
    const { error: subscriptionsTableError } = await supabase
      .from('subscriptions')
      .delete()
      .eq('user_id', userId);

    if (subscriptionsTableError) {
      // Table might not exist or entry might not exist - that's fine
      console.log('Note: subscriptions table might not exist or entry not found');
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // DELETE USER ACCOUNT (Supabase Auth)
    // ═══════════════════════════════════════════════════════════════════════════

    // Use admin client to delete the user
    const { error: deleteUserError } = await supabase.auth.admin.deleteUser(userId);

    if (deleteUserError) {
      console.error('Error deleting user account:', deleteUserError);
      return NextResponse.json(
        { 
          error: 'Failed to delete account',
          message: deleteUserError.message,
        },
        { status: 500 }
      );
    }

    console.log(`✅ Account deleted successfully for user ${userId}`);

    return NextResponse.json({
      success: true,
      message: 'Account deleted successfully',
    });

  } catch (error: any) {
    console.error('Error in delete account:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

