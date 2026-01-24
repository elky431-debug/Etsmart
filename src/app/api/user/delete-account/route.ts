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
    
    // Check if service role key is configured
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('SUPABASE_SERVICE_ROLE_KEY is not configured');
      return NextResponse.json(
        { 
          error: 'Server configuration error',
          message: 'Account deletion is temporarily unavailable. Please contact support.',
        },
        { status: 503 }
      );
    }
    
    let supabase;
    try {
      supabase = createSupabaseAdminClient();
    } catch (error: any) {
      console.error('Error creating Supabase admin client:', error);
      return NextResponse.json(
        { 
          error: 'Server configuration error',
          message: 'Account deletion is temporarily unavailable. Please contact support.',
        },
        { status: 503 }
      );
    }
    
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

    // ═══════════════════════════════════════════════════════════════════════════
    // DELETE USER ACCOUNT (Supabase Auth)
    // ═══════════════════════════════════════════════════════════════════════════

    // Use admin client to delete the user via REST API
    // Note: We use the REST API directly because auth.admin.deleteUser might not work
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      
      if (!supabaseUrl || !serviceRoleKey) {
        throw new Error('Supabase configuration missing');
      }

      // Delete user via Supabase Management API
      const deleteResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey': serviceRoleKey,
          'Content-Type': 'application/json',
        },
      });

      if (!deleteResponse.ok) {
        const errorText = await deleteResponse.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText };
        }

        console.error('Error deleting user account:', {
          status: deleteResponse.status,
          statusText: deleteResponse.statusText,
          error: errorData,
        });

        // Check if user doesn't exist (already deleted)
        if (deleteResponse.status === 404 || errorData.message?.includes('not found')) {
          // User already deleted, but data cleanup was successful
          console.log('User already deleted, but data cleanup completed');
          return NextResponse.json({
            success: true,
            message: 'Account deleted successfully',
          });
        }

        // Check if it's a permission error
        if (deleteResponse.status === 403 || errorData.message?.includes('permission') || errorData.message?.includes('role')) {
          return NextResponse.json(
            { 
              error: 'Permission error',
              message: 'Account deletion requires proper server configuration. Please contact support.',
            },
            { status: 403 }
          );
        }

        return NextResponse.json(
          { 
            error: 'Failed to delete account',
            message: 'Unable to delete user account. Please contact support if this issue persists.',
          },
          { status: 500 }
        );
      }

      console.log(`✅ Account deleted successfully for user ${userId}`);

      return NextResponse.json({
        success: true,
        message: 'Account deleted successfully',
      });
    } catch (deleteError: any) {
      console.error('Exception deleting user account:', deleteError);
      return NextResponse.json(
        { 
          error: 'Failed to delete account',
          message: deleteError.message || 'An unexpected error occurred. Please contact support.',
        },
        { status: 500 }
      );
    }

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

