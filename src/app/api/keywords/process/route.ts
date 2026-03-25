import { NextRequest, NextResponse } from 'next/server';
import { executeKeywordAnalysisJob } from '@/lib/keywords-analysis-job';

export const runtime = 'nodejs';
/**
 * Durée max du job (1 run Apify principal + runs tags en parallèle + GPT).
 * 26s coupait l’analyse en prod ; aligner avec le plan hébergeur (Netlify / Vercel).
 */
export const maxDuration = 600;

function verifySecret(request: NextRequest): boolean {
  const a = process.env.KEYWORDS_INTERNAL_SECRET;
  const b = process.env.CRON_SECRET;
  const got = request.headers.get('x-keywords-secret')?.trim();
  if (!got) return false;
  if (a && got === a) return true;
  if (b && got === b) return true;
  return false;
}

export async function POST(request: NextRequest) {
  if (!verifySecret(request)) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  let body: { jobId?: string; userId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  const jobId = String(body?.jobId || '').trim();
  const userId = String(body?.userId || '').trim();
  if (!jobId || !userId) {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 });
  }

  try {
    await executeKeywordAnalysisJob(jobId, userId);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: 'JOB_FAILED', message }, { status: 500 });
  }
}
