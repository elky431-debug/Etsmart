/**
 * ⚠️ SERVER-ONLY MIDDLEWARES - Subscription & Quota Protection
 * 
 * These middlewares MUST be used in API routes to enforce paywall rules.
 * All checks are done server-side for security.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../supabase-admin';
import { PLAN_QUOTAS, type PlanId } from '@/types/subscription';

export interface SubscriptionCheckResult {
  allowed: boolean;
  subscription: {
    plan: PlanId;
    status: string;
    used: number;
    quota: number;
    remaining: number;
  } | null;
  error?: string;
  requiresUpgrade?: PlanId;
}

/**
 * Get user subscription data from database
 */
async function getUserSubscriptionData(userId: string): Promise<SubscriptionCheckResult['subscription'] | null> {
  const supabase = createSupabaseAdminClient();
  
  // Get user subscription from users table (assuming we add these fields)
  const { data: user, error } = await supabase
    .from('users')
    .select('subscriptionPlan, subscriptionStatus, analysisUsedThisMonth, analysisQuota, currentPeriodStart, currentPeriodEnd')
    .eq('id', userId)
    .single();
  
  if (error || !user) {
    return null;
  }
  
  const quota = user.analysisQuota || PLAN_QUOTAS[user.subscriptionPlan as PlanId] || 0;
  const used = user.analysisUsedThisMonth || 0;
  
  return {
    plan: user.subscriptionPlan as PlanId,
    status: user.subscriptionStatus,
    used,
    quota,
    remaining: Math.max(0, quota - used),
  };
}

/**
 * Middleware: Require active subscription
 * Blocks access if user doesn't have an active subscription
 */
export async function requireActiveSubscription(
  request: NextRequest
): Promise<NextResponse | null> {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Missing or invalid authorization header' },
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
    
    // Get subscription data
    const subscriptionData = await getUserSubscriptionData(user.id);
    
    if (!subscriptionData) {
      return NextResponse.json(
        { 
          error: 'Subscription required',
          message: 'No subscription found. Please subscribe to access this feature.',
          requiresSubscription: true,
        },
        { status: 403 }
      );
    }
    
    // Check if subscription is active
    if (subscriptionData.status !== 'active') {
      return NextResponse.json(
        { 
          error: 'Subscription inactive',
          message: 'Your subscription is not active. Please renew your subscription.',
          requiresSubscription: true,
          subscriptionStatus: subscriptionData.status,
        },
        { status: 403 }
      );
    }
    
    // Check if quota is available
    if (subscriptionData.quota === 0) {
      return NextResponse.json(
        { 
          error: 'No quota available',
          message: 'Your plan has no analysis quota. Please upgrade your subscription.',
          requiresSubscription: true,
        },
        { status: 403 }
      );
    }
    
    // All checks passed - return null to continue
    return null;
  } catch (error: any) {
    console.error('Error in requireActiveSubscription:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * Middleware: Require remaining quota
 * Blocks access if user has reached their monthly quota
 */
export async function requireRemainingQuota(
  request: NextRequest
): Promise<NextResponse | null> {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Missing or invalid authorization header' },
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
    
    // Get subscription data
    const subscriptionData = await getUserSubscriptionData(user.id);
    
    if (!subscriptionData) {
      return NextResponse.json(
        { 
          error: 'Subscription required',
          message: 'No subscription found. Please subscribe to access this feature.',
          requiresSubscription: true,
        },
        { status: 403 }
      );
    }
    
    // Check if subscription is active
    if (subscriptionData.status !== 'active') {
      return NextResponse.json(
        { 
          error: 'Subscription inactive',
          message: 'Your subscription is not active. Please renew your subscription.',
          requiresSubscription: true,
        },
        { status: 403 }
      );
    }
    
    // Check if quota is reached
    if (subscriptionData.used >= subscriptionData.quota) {
      // Determine upgrade suggestion
      let requiresUpgrade: PlanId | undefined;
      if (subscriptionData.plan === 'SMART') requiresUpgrade = 'PRO';
      else if (subscriptionData.plan === 'PRO') requiresUpgrade = 'SCALE';
      
      return NextResponse.json(
        { 
          error: 'Quota exceeded',
          message: `You have reached the limit of your ${subscriptionData.plan} plan (${subscriptionData.quota} analyses/month). ${requiresUpgrade ? `Upgrade to ${requiresUpgrade} to unlock more analyses.` : 'Please wait for the next billing cycle.'}`,
          requiresSubscription: true,
          quotaReached: true,
          used: subscriptionData.used,
          quota: subscriptionData.quota,
          requiresUpgrade,
        },
        { status: 403 }
      );
    }
    
    // All checks passed - return null to continue
    return null;
  } catch (error: any) {
    console.error('Error in requireRemainingQuota:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * Combined middleware: Require active subscription AND remaining quota
 * Use this for analysis endpoints
 */
export async function requireActiveSubscriptionAndQuota(
  request: NextRequest
): Promise<NextResponse | null> {
  // First check active subscription
  const subscriptionCheck = await requireActiveSubscription(request);
  if (subscriptionCheck) return subscriptionCheck;
  
  // Then check remaining quota
  const quotaCheck = await requireRemainingQuota(request);
  if (quotaCheck) return quotaCheck;
  
  // All checks passed
  return null;
}

/**
 * Get user subscription info (for display purposes)
 */
export async function getUserSubscriptionInfo(userId: string): Promise<SubscriptionCheckResult> {
  try {
    const subscriptionData = await getUserSubscriptionData(userId);
    
    if (!subscriptionData) {
      return {
        allowed: false,
        subscription: null,
        error: 'No subscription found',
      };
    }
    
    if (subscriptionData.status !== 'active') {
      return {
        allowed: false,
        subscription: subscriptionData,
        error: 'Subscription is not active',
      };
    }
    
    if (subscriptionData.quota === 0) {
      return {
        allowed: false,
        subscription: subscriptionData,
        error: 'No quota available',
      };
    }
    
    if (subscriptionData.used >= subscriptionData.quota) {
      let requiresUpgrade: PlanId | undefined;
      if (subscriptionData.plan === 'SMART') requiresUpgrade = 'PRO';
      else if (subscriptionData.plan === 'PRO') requiresUpgrade = 'SCALE';
      
      return {
        allowed: false,
        subscription: subscriptionData,
        error: 'Quota exceeded',
        requiresUpgrade,
      };
    }
    
    return {
      allowed: true,
      subscription: subscriptionData,
    };
  } catch (error: any) {
    console.error('Error in getUserSubscriptionInfo:', error);
    return {
      allowed: false,
      subscription: null,
      error: error.message,
    };
  }
}

