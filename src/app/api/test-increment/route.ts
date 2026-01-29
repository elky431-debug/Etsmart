/**
 * TEST ENDPOINT - Manually test incrementing the analysis count
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { PLAN_QUOTAS, type PlanId } from '@/types/subscription';

export async function POST(request: NextRequest) {
  try {
    // Get auth token
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createSupabaseAdminClient();

    // Get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    console.log(`[Test Increment] User: ${user.id}`);

    // Step 1: Get current state
    const { data: before, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    console.log('[Test Increment] Before:', before);
    console.log('[Test Increment] Fetch error:', fetchError);

    if (fetchError) {
      return NextResponse.json({
        success: false,
        error: 'User not found in users table',
        fetchError: fetchError.message,
        userId: user.id,
      });
    }

    // Check column names - might be camelCase or snake_case
    const currentUsed = before.analysisUsedThisMonth ?? before.analysis_used_this_month ?? 0;
    const quota = before.analysisQuota ?? before.analysis_quota ?? PLAN_QUOTAS[before.subscriptionPlan as PlanId] ?? 100;

    console.log(`[Test Increment] Current used: ${currentUsed}, quota: ${quota}`);

    // Step 2: Increment - try both column name formats
    const newUsed = currentUsed + 1;
    
    // Try camelCase first
    let updateResult = await supabase
      .from('users')
      .update({ analysisUsedThisMonth: newUsed })
      .eq('id', user.id);

    console.log('[Test Increment] Update with camelCase:', updateResult);

    // If that fails, try snake_case
    if (updateResult.error) {
      console.log('[Test Increment] CamelCase failed, trying snake_case');
      updateResult = await supabase
        .from('users')
        .update({ analysis_used_this_month: newUsed })
        .eq('id', user.id);
      console.log('[Test Increment] Update with snake_case:', updateResult);
    }

    // Step 3: Verify update
    const { data: after, error: afterError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    console.log('[Test Increment] After:', after);

    const afterUsed = after?.analysisUsedThisMonth ?? after?.analysis_used_this_month ?? 0;

    return NextResponse.json({
      success: !updateResult.error,
      before: {
        used: currentUsed,
        quota,
        allFields: before,
      },
      after: {
        used: afterUsed,
        allFields: after,
      },
      updateError: updateResult.error?.message || null,
      incrementedFrom: currentUsed,
      incrementedTo: newUsed,
      actualAfter: afterUsed,
    });
  } catch (error: any) {
    console.error('[Test Increment] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

