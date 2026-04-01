import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GEMINI_IMAGE_MODEL = 'gemini-2.5-flash-image';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    });
  }

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, content-type',
  };

  try {
    // Auth via Supabase JWT
    const authHeader = req.headers.get('authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      return new Response(JSON.stringify({ error: 'Authentification requise' }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Token invalide' }), { status: 401, headers: corsHeaders });
    }

    const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_KEY) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY manquante' }), { status: 500, headers: corsHeaders });
    }

    const body = await req.json() as { imagePrompt?: string; bgR?: number; bgG?: number; bgB?: number };
    const { imagePrompt, bgR = 201, bgG = 184, bgB = 164 } = body;
    if (!imagePrompt) {
      return new Response(JSON.stringify({ error: 'imagePrompt manquant' }), { status: 400, headers: corsHeaders });
    }

    // Call Gemini (150s available, plenty of room)
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: imagePrompt }] }],
          generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
        }),
        signal: AbortSignal.timeout(120_000),
      }
    );

    if (!geminiRes.ok) {
      const err = await geminiRes.text().catch(() => '');
      console.error('[generate-logo-image] Gemini error:', geminiRes.status, err.slice(0, 200));
      return new Response(JSON.stringify({ error: 'IMAGE_GENERATION_FAILED', message: 'Gemini a échoué. Réessaie.' }), { status: 502, headers: corsHeaders });
    }

    const geminiData = await geminiRes.json();
    const parts = geminiData?.candidates?.[0]?.content?.parts ?? [];
    let b64: string | null = null;
    let mime = 'image/png';
    for (const part of parts) {
      if (typeof part?.inlineData?.data === 'string' && part.inlineData.data.length > 100) {
        b64 = part.inlineData.data;
        mime = part.inlineData.mimeType || 'image/png';
        break;
      }
    }

    if (!b64) {
      return new Response(JSON.stringify({ error: 'IMAGE_GENERATION_FAILED', message: 'Pas d\'image dans la réponse Gemini.' }), { status: 502, headers: corsHeaders });
    }

    // Deduct 1 credit via DB RPC
    await supabase.rpc('increment_analysis_count', { p_user_id: user.id, p_count: 1 }).catch((e: unknown) => {
      console.warn('[generate-logo-image] credit deduction failed:', e);
    });

    return new Response(
      JSON.stringify({ success: true, imageDataUrl: `data:${mime};base64,${b64}`, bgR, bgG, bgB }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur serveur';
    console.error('[generate-logo-image]', err);
    return new Response(JSON.stringify({ error: 'GENERATION_ERROR', message }), { status: 500, headers: corsHeaders });
  }
});
