/**
 * Stability AI Stable Image (v2beta) — text-to-image ou image-to-image.
 * Optionnel : bannière / logo utilisent désormais Gemini (`@/lib/gemini-image-generate`).
 */

export type StabilityShopAssetEngine = 'pro' | 'flash';

const ULTRA = 'https://api.stability.ai/v2beta/stable-image/generate/ultra';
const CORE = 'https://api.stability.ai/v2beta/stable-image/generate/core';

export async function stabilityStableImage({
  apiKey,
  prompt,
  engine,
  timeoutMs,
  sourceJpeg,
  aspectRatio,
  strengthPro = '0.85',
  strengthFlash = '0.90',
}: {
  apiKey: string;
  prompt: string;
  engine: StabilityShopAssetEngine;
  timeoutMs: number;
  /** Image de référence (JPEG) pour image-to-image */
  sourceJpeg?: Buffer;
  /** Ex: "1:1", "16:9", "21:9" — selon doc Stability */
  aspectRatio?: string;
  strengthPro?: string;
  strengthFlash?: string;
}): Promise<Buffer | null> {
  const useUltra = engine === 'pro';
  const endpoint = useUltra ? ULTRA : CORE;
  const text = prompt.slice(0, 10_000);

  const form = new FormData();
  form.append('prompt', text);
  // Même réglage que /api/generate-images (PNG + aspect_ratio en img2img fait souvent échouer l’API).
  form.append('output_format', 'jpeg');
  // aspect_ratio : text-to-image uniquement. Avec `image`, Stability renvoie souvent 400 si on envoie aussi le ratio.
  if (aspectRatio && (!sourceJpeg || sourceJpeg.length === 0)) {
    form.append('aspect_ratio', aspectRatio);
  }
  if (sourceJpeg && sourceJpeg.length > 0) {
    form.append('image', new Blob([sourceJpeg], { type: 'image/jpeg' }), 'ref.jpg');
    form.append('strength', useUltra ? strengthPro : strengthFlash);
  }

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'image/*',
      },
      body: form,
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn(`[Stability] ${useUltra ? 'ultra' : 'core'} HTTP ${res.status}`, errText.slice(0, 200));
      return null;
    }
    return Buffer.from(await res.arrayBuffer());
  } catch (e: any) {
    console.warn('[Stability] request failed:', e?.message || e);
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Essaie pro puis flash (même prompt / ref / ratio). */
export async function stabilityStableImageWithFallback(params: {
  apiKey: string;
  prompt: string;
  timeoutMsPerTry: number;
  sourceJpeg?: Buffer;
  aspectRatio?: string;
  preferProFirst?: boolean;
}): Promise<{ buffer: Buffer | null; engine: StabilityShopAssetEngine | null }> {
  const { apiKey, prompt, timeoutMsPerTry, sourceJpeg, aspectRatio, preferProFirst = true } = params;
  const order: StabilityShopAssetEngine[] = preferProFirst ? ['pro', 'flash'] : ['flash', 'pro'];
  for (const engine of order) {
    const buf = await stabilityStableImage({
      apiKey,
      prompt,
      engine,
      timeoutMs: timeoutMsPerTry,
      sourceJpeg,
      aspectRatio,
    });
    if (buf && buf.length > 100) return { buffer: buf, engine };
  }
  return { buffer: null, engine: null };
}
