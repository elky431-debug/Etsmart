/**
 * Bundlé vers netlify/functions/generate-images-background.js (script npm run bundle:netlify-image-bg).
 * Netlify Background Function : exécution longue sans timeout gateway ~26 s.
 */
import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { runGenerateImagesPipeline } from '../../src/lib/server/generate-images-pipeline';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }
  const secret = event.headers['x-netlify-image-bg-secret'] || event.headers['X-Netlify-Image-Bg-Secret'];
  if (!secret || secret !== process.env.NETLIFY_IMAGE_BG_SECRET) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  let jobId: string;
  try {
    const parsed = JSON.parse(event.body || '{}');
    jobId = parsed.jobId;
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }
  if (!jobId || typeof jobId !== 'string') {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing jobId' }) };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Supabase env missing' }) };
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: job, error: fetchErr } = await supabase
    .from('image_gen_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (fetchErr || !job) {
    console.error('[IMAGE BG] job fetch', fetchErr?.message);
    return { statusCode: 404, body: JSON.stringify({ error: 'Job not found' }) };
  }

  if (job.status !== 'pending') {
    return { statusCode: 200, body: JSON.stringify({ ok: true, skipped: true }) };
  }

  await supabase
    .from('image_gen_jobs')
    .update({ status: 'processing', updated_at: new Date().toISOString() })
    .eq('id', jobId);

  try {
    const user = { id: job.user_id as string } as import('@supabase/supabase-js').User;
    const result = await runGenerateImagesPipeline({
      body: job.request_body as Record<string, unknown>,
      user,
      supabase,
      startTime: Date.now(),
      netlifyBackgroundWorker: true,
    });

    await supabase
      .from('image_gen_jobs')
      .update({
        status: 'done',
        result_json: result.json as unknown as Record<string, unknown>,
        http_status: result.status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    console.log(`[IMAGE BG] job ${jobId} done http=${result.status}`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[IMAGE BG] job ${jobId} error`, msg);
    await supabase
      .from('image_gen_jobs')
      .update({
        status: 'error',
        error_message: msg,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);
  }

  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};
