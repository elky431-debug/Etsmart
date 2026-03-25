/**
 * Génération d’image via Gemini (même modèle que /api/generate-images).
 * Utilisé pour bannière boutique, logo Etsy, etc.
 */

export const GEMINI_IMAGE_MODEL = 'gemini-3.1-flash-image-preview';

function geminiFetchSignal(timeoutMs: number): AbortSignal {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs);
  }
  const c = new AbortController();
  setTimeout(() => c.abort(), timeoutMs);
  return c.signal;
}

function dataUrlToBuffer(dataUrl: string): Buffer | null {
  const m = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!m) return null;
  return Buffer.from(m[2], 'base64');
}

/**
 * Appelle Gemini image et renvoie une data URL `data:image/...;base64,...` ou null.
 */
export async function geminiGenerateImageDataUrl(params: {
  apiKey: string;
  prompt: string;
  /** Images de référence (base64 brut, sans préfixe data:) */
  referenceInlineImages?: { mimeType: string; data: string }[];
  model?: string;
  timeoutMs?: number;
}): Promise<string | null> {
  const {
    apiKey,
    prompt,
    referenceInlineImages = [],
    model = GEMINI_IMAGE_MODEL,
    timeoutMs = 120_000,
  } = params;

  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    { text: prompt },
  ];
  for (const ref of referenceInlineImages) {
    parts.push({ inlineData: { mimeType: ref.mimeType, data: ref.data } });
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: {
            responseModalities: ['TEXT', 'IMAGE'],
          },
        }),
        signal: geminiFetchSignal(timeoutMs),
      }
    );

    if (!res.ok) {
      const t = await res.text().catch(() => '');
      console.warn(`[Gemini image] ${model} non-ok:`, res.status, t.substring(0, 200));
      return null;
    }

    const data = await res.json();
    const cand0 = data?.candidates?.[0];
    const contentParts = cand0?.content?.parts || [];
    for (const part of contentParts) {
      const b64 = part?.inlineData?.data;
      const mime = part?.inlineData?.mimeType || 'image/png';
      if (typeof b64 === 'string' && b64.length > 100) {
        return `data:${mime};base64,${b64}`;
      }
    }
    console.warn(`[Gemini image] ${model} réponse sans image`, {
      finishReason: cand0?.finishReason,
      blockReason: data?.promptFeedback?.blockReason ?? cand0?.promptFeedback?.blockReason,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[Gemini image] ${model} error:`, msg);
  }
  return null;
}

/** Variante pratique pour post-traitement sharp (PNG/JPEG). */
export async function geminiGenerateImageBuffer(params: {
  apiKey: string;
  prompt: string;
  referenceInlineImages?: { mimeType: string; data: string }[];
  model?: string;
  timeoutMs?: number;
}): Promise<Buffer | null> {
  const dataUrl = await geminiGenerateImageDataUrl(params);
  if (!dataUrl) return null;
  return dataUrlToBuffer(dataUrl);
}
