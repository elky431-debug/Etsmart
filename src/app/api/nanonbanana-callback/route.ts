import { NextRequest, NextResponse } from 'next/server';

/**
 * Endpoint de callback pour recevoir les résultats de génération d'images de Nanonbanana
 * Nanonbanana envoie les résultats ici quand la génération est terminée
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[NANONBANANA CALLBACK] Received callback from Nanonbanana');
    
    const body = await request.json();
    console.log('[NANONBANANA CALLBACK] Callback data:', JSON.stringify(body, null, 2));
    
    // Format attendu de Nanonbanana selon la documentation
    // { code: 200, msg: "success", data: { taskId: "...", url: "...", ... } }
    
    const taskId = body.taskId || body.data?.taskId || body.data?.task_id;
    const imageUrl = body.url 
      || body.data?.url 
      || body.data?.image_url 
      || body.data?.imageUrl
      || body.data?.images?.[0]?.url
      || body.data?.result?.url;
    
    console.log('[NANONBANANA CALLBACK] Task ID:', taskId);
    console.log('[NANONBANANA CALLBACK] Image URL:', imageUrl);
    
    // TODO: Stocker le résultat dans une base de données ou un cache
    // Pour l'instant, on log juste les résultats
    // Dans une vraie implémentation, on devrait:
    // 1. Stocker taskId -> imageUrl dans une DB/cache
    // 2. Notifier le frontend via WebSocket ou polling côté client
    
    return NextResponse.json({
      success: true,
      message: 'Callback received',
      taskId,
      imageUrl,
    });
  } catch (error: any) {
    console.error('[NANONBANANA CALLBACK] Error processing callback:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// Permettre aussi GET pour tester
export async function GET() {
  return NextResponse.json({
    message: 'Nanonbanana callback endpoint is active',
    endpoint: '/api/nanonbanana-callback',
    method: 'POST',
  });
}


