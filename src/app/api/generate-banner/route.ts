import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export const maxDuration = 25;
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  try {
    // Auth
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    const supabase = createSupabaseAdminClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    // Body
    let body: any;
    try { body = await request.json(); } catch { return NextResponse.json({ error: 'INVALID_REQUEST' }, { status: 400 }); }
    const { shopName, shopDescription, niche, logo, color = '#3b82f6' } = body;
    
    if (!shopName || !shopDescription || !niche) {
      return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 });
    }

    // Convert hex color to descriptive color scheme
    const hexToColorDescription = (hex: string): string => {
      // Remove # if present
      hex = hex.replace('#', '');
      
      // Convert to RGB
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      
      // Convert to HSL
      const rNorm = r / 255;
      const gNorm = g / 255;
      const bNorm = b / 255;
      const max = Math.max(rNorm, gNorm, bNorm);
      const min = Math.min(rNorm, gNorm, bNorm);
      const delta = max - min;
      
      let h = 0;
      if (delta !== 0) {
        if (max === rNorm) {
          h = ((gNorm - bNorm) / delta) % 6;
        } else if (max === gNorm) {
          h = (bNorm - rNorm) / delta + 2;
        } else {
          h = (rNorm - gNorm) / delta + 4;
        }
      }
      h = Math.round(h * 60);
      if (h < 0) h += 360;
      
      const l = (max + min) / 2;
      const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
      
      // Generate color description based on hue
      const hueNames: Record<number, string> = {
        0: 'vibrant red',
        15: 'warm orange-red',
        30: 'bright orange',
        45: 'golden orange',
        60: 'sunny yellow',
        75: 'lime yellow',
        90: 'fresh green',
        120: 'emerald green',
        150: 'turquoise',
        180: 'ocean cyan',
        210: 'sky blue',
        240: 'deep blue',
        270: 'royal purple',
        300: 'vibrant magenta',
        330: 'pink rose',
      };
      
      const getHueName = (hue: number): string => {
        const keys = Object.keys(hueNames).map(Number).sort((a, b) => a - b);
        for (let i = keys.length - 1; i >= 0; i--) {
          if (hue >= keys[i]) {
            return hueNames[keys[i]];
          }
        }
        return hueNames[0];
      };
      
      const hueName = getHueName(h);
      const lightnessDesc = l > 0.7 ? 'light' : l < 0.3 ? 'deep dark' : l < 0.5 ? 'rich' : 'bright';
      const saturationDesc = s > 0.7 ? 'vibrant' : s > 0.4 ? 'saturated' : 'soft muted';
      
      return `${lightnessDesc} ${saturationDesc} ${hueName} gradient with complementary tones`;
    };
    
    const colorScheme = hexToColorDescription(color);

    // Quota check
    const { getUserQuotaInfo, incrementAnalysisCount } = await import('@/lib/subscription-quota');
    const quotaInfo = await getUserQuotaInfo(user.id);
    if (quotaInfo.status !== 'active') return NextResponse.json({ error: 'SUBSCRIPTION_REQUIRED' }, { status: 403 });
    if (quotaInfo.remaining < 2) return NextResponse.json({ error: 'QUOTA_EXCEEDED' }, { status: 403 });

    const NANO_KEY = process.env.NANONBANANA_API_KEY || '758a24cfaef8c64eed9164858b941ecc';

    // Build premium aesthetic prompt
    const logoInstruction = logo 
      ? `Left side: elegant brand logo integration, clean and professional.` 
      : `Left side: sophisticated typographic treatment for "${shopName}" in bold modern font.`;
    
    let prompt = `Premium luxury Etsy shop banner, 3360x840px wide panoramic format. Color palette: ${colorScheme}, sophisticated and elegant. ${logoInstruction} Center-right: artistic product staging for ${niche} niche, beautifully arranged with depth and dimension. Subtle geometric patterns or abstract elements in background. Professional lighting with soft shadows and highlights. Minimalist design with generous white space. High-end e-commerce aesthetic, magazine-quality composition. Clean typography hierarchy. No clutter, no watermarks. Commercial ready, top 1% Etsy seller quality. Shop name: "${shopName}". Tagline derived from: ${shopDescription.substring(0, 120)}.`;

    // Cap prompt at 1800 chars max (same as working image generation)
    if (prompt.length > 1800) prompt = prompt.substring(0, 1800);

    // Submit to Nanonbanana - Use IMAGETOIAMGE (requires imageUrls)
    // Create a minimal white image as base (1x1 pixel white PNG in base64)
    // This is required because IMAGETOIAMGE always needs imageUrls
    const minimalWhiteImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
    let taskId: string | null = null;
    try {
      const submitBody: any = {
        type: 'IMAGETOIAMGE',
        prompt,
        imageUrls: [minimalWhiteImage], // Always provide a base image (IMAGETOIAMGE requires it)
        image_size: '16:9',
        numImages: 1,
        callBackUrl: 'https://etsmart.app/api/nanonbanana-callback',
      };

      console.log('[Banner] Prompt length:', prompt.length);
      console.log('[Banner] Has logo input:', !!logo, '(using minimal white base image for IMAGETOIAMGE)');
      console.log('[Banner] Request body (truncated):', JSON.stringify({ ...submitBody, imageUrls: ['[BASE64_IMAGE]'] }, null, 2));
      
      const submitRes = await fetch('https://api.nanobananaapi.ai/api/v1/nanobanana/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${NANO_KEY}`,
        },
        body: JSON.stringify(submitBody),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!submitRes.ok) {
        const errorText = await submitRes.text();
        console.error('[Banner] Nanonbanana error:', submitRes.status, errorText);
        throw new Error(`Nanonbanana failed: ${submitRes.status}`);
      }

      const submitData = await submitRes.json();
      console.log('[Banner] Response:', JSON.stringify(submitData));
      
      // Extract task_id from various possible response structures
      taskId = submitData.data?.task_id || 
               submitData.data?.taskId || 
               submitData.data?.id || 
               submitData.task_id || 
               submitData.taskId || 
               submitData.id ||
               submitData.result?.task_id ||
               submitData.result?.taskId ||
               (submitData.data && typeof submitData.data === 'string' ? submitData.data : null) ||
               null;
      
      if (!taskId) {
        console.error('[Banner] No task_id. Full response:', JSON.stringify(submitData));
        throw new Error(submitData.error || submitData.message || 'No task_id from Nanonbanana');
      }

      console.log(`[Banner] Task submitted: ${taskId}`);
    } catch (e: any) {
      clearTimeout(timeout);
      console.error('[Banner] Submit error:', e.message);
      return NextResponse.json({ error: 'GENERATION_FAILED', message: e.message }, { status: 500 });
    }

    // Poll for result (max 15 seconds server-side, then return taskId for client polling)
    let bannerUrl: string | null = null;
    const maxPollTime = 15000;
    const pollStart = Date.now();

    while (Date.now() - pollStart < maxPollTime) {
      await new Promise(r => setTimeout(r, 1500));

      try {
        const statusRes = await fetch(
          `https://api.nanobananaapi.ai/api/v1/nanobanana/record-info?taskId=${encodeURIComponent(taskId)}&task_id=${encodeURIComponent(taskId)}`,
          { headers: { 'Authorization': `Bearer ${NANO_KEY}` } }
        );

        if (!statusRes.ok) continue;

        const d = await statusRes.json();
        const status = d.data?.status || d.status || '';
        
        // Check if completed
        if (['completed', 'done', 'success'].includes(status)) {
          // Extract image URL from various possible locations
          bannerUrl = d.data?.response?.resultImageUrl ||
                     d.data?.response?.originImageUrl ||
                     d.data?.url ||
                     d.data?.image_url ||
                     d.data?.imageUrl ||
                     d.data?.images?.[0]?.url ||
                     d.data?.result?.url ||
                     d.url ||
                     d.image_url ||
                     null;
          
          if (bannerUrl) {
            console.log(`[Banner] Image ready in ${Date.now() - pollStart}ms: ${bannerUrl.substring(0, 80)}...`);
            break;
          }
        }

        if (['failed', 'error'].includes(status)) {
          console.error('[Banner] Generation failed:', JSON.stringify(d));
          break;
        }
      } catch (e: any) {
        // Continue polling
      }
    }

    // Deduct credits
    await incrementAnalysisCount(user.id, 2);

    if (bannerUrl) {
      console.log(`[Banner] Success in ${Date.now() - startTime}ms`);
      return NextResponse.json({ success: true, bannerUrl });
    }

    // Return taskId for client-side polling
    console.log(`[Banner] Returning taskId for client polling after ${Date.now() - startTime}ms`);
    return NextResponse.json({ success: true, taskId });

  } catch (error: any) {
    console.error('[Banner] Error:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
