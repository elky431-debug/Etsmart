/**
 * ⚠️ CRON JOB: Reset Monthly Quotas
 * 
 * This endpoint should be called daily by a cron job (e.g., Netlify Scheduled Functions)
 * to reset monthly analysis quotas for all users with expired periods.
 * 
 * Security: Protected by a secret token to prevent unauthorized access
 */

import { NextRequest, NextResponse } from 'next/server';
import { resetMonthlyQuotas } from '@/lib/subscription-quota';

const CRON_SECRET = process.env.CRON_SECRET || 'your-secret-token-here';

export async function GET(request: NextRequest) {
  // Verify secret token
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '') || request.nextUrl.searchParams.get('token');

  if (token !== CRON_SECRET) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const result = await resetMonthlyQuotas();
    
    return NextResponse.json({
      success: true,
      reset: result.reset,
      errors: result.errors,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error in reset quotas cron job:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// Also support POST for cron services that use POST
export async function POST(request: NextRequest) {
  return GET(request);
}


