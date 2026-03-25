import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { runFullKeywordAnalysisPipeline } from '@/lib/etsy-keyword-analytics';
import { isApifyConfigured } from '@/lib/apify-scraper';
import { resolveOpenAiApiKey } from '@/lib/keywords-env';

export async function executeKeywordAnalysisJob(jobId: string, userId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { data: row, error } = await supabase
    .from('keyword_analyses')
    .select('id, keyword, user_id, status')
    .eq('id', jobId)
    .maybeSingle();

  if (error || !row || row.user_id !== userId || row.status !== 'pending') {
    return;
  }

  const apifyReady = isApifyConfigured('listing');
  if (!apifyReady) {
    const parts: string[] = [];
    if (!apifyReady) {
      parts.push(
        'Apify non configuré : définis APIFY_API_TOKEN et assure-toi que l’acteur epctex~etsy-scraper est disponible.'
      );
    }
    await supabase
      .from('keyword_analyses')
      .update({
        status: 'error',
        result: { message: parts.join(' ') },
      })
      .eq('id', jobId);
    return;
  }

  try {
    // Anti “Finalisation infinie” : quoi qu’il arrive, on termine par done/error dans un délai borné.
    const HARD_TIMEOUT_MS = 8 * 60 * 1000;
    const openaiApiKey = resolveOpenAiApiKey();
    const payload = await Promise.race([
      runFullKeywordAnalysisPipeline(row.keyword, {
        // Mode “Alura-like”: plus de données + similar keywords (light) + GPT optionnel.
        openaiApiKey,
        mainMaxItems: 50,
        relatedMaxItems: 5,
        maxRelatedTags: 0,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`JOB_TIMEOUT: analyse > ${Math.round(HARD_TIMEOUT_MS / 60000)} min`)), HARD_TIMEOUT_MS)
      ),
    ]);

    await supabase
      .from('keyword_analyses')
      .update({
        status: 'done',
        result: payload as unknown as Record<string, unknown>,
      })
      .eq('id', jobId);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    await supabase
      .from('keyword_analyses')
      .update({
        status: 'error',
        result: { message },
      })
      .eq('id', jobId);
  }
}
