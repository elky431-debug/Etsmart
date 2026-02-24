import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 15;
export const runtime = 'nodejs';

/**
 * API ROUTE - CHECK IMAGE GENERATION STATUS
 * 
 * Lightweight endpoint that checks a single Nanonbanana task status.
 * Called by the frontend every 3 seconds after image submission.
 * Each call takes ~1-2 seconds — well within Netlify's timeout.
 * 
 * Returns:
 * - { status: 'pending' } — still processing
 * - { status: 'ready', url: '...' } — image ready
 * - { status: 'error', message: '...' } — failed
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');

    if (!taskId) {
      return NextResponse.json({ error: 'taskId required' }, { status: 400 });
    }

    const NANONBANANA_API_KEY = process.env.NANONBANANA_API_KEY || '758a24cfaef8c64eed9164858b941ecc';

    // Check both parameter formats
    const urls = [
      `https://api.nanobananaapi.ai/api/v1/nanobanana/record-info?taskId=${taskId}`,
      `https://api.nanobananaapi.ai/api/v1/nanobanana/record-info?task_id=${taskId}`,
    ];

    for (const url of urls) {
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${NANONBANANA_API_KEY}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) continue;

        const data = await response.json();

        // Check for success
        if (data.code === 200 || data.code === 0 || data.msg === 'success') {
          // Look for image URL in all possible locations
          const imageUrl = data.data?.response?.resultImageUrl
            || data.data?.response?.originImageUrl
            || data.data?.url
            || data.data?.image_url
            || data.data?.imageUrl
            || data.data?.images?.[0]?.url
            || data.url
            || data.image_url;

          if (imageUrl) {
            return NextResponse.json({ status: 'ready', url: imageUrl });
          }

          // Check task status
          const taskStatus = data.data?.status || data.data?.state || data.status;
          if (taskStatus === 'completed' || taskStatus === 'done' || taskStatus === 'success') {
            // Completed but no URL — maybe a failure
            return NextResponse.json({ status: 'error', message: 'Task completed but no image URL found' });
          }
          if (taskStatus === 'failed' || taskStatus === 'error') {
            return NextResponse.json({ status: 'error', message: data.data?.error || 'Image generation failed' });
          }
        }

        // If we got a response but no image yet, it's still pending
        return NextResponse.json({ status: 'pending' });
      } catch {
        continue;
      }
    }

    // If all attempts failed, assume still pending
    return NextResponse.json({ status: 'pending' });
  } catch (error: any) {
    console.error('[CHECK STATUS] Error:', error.message);
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}

