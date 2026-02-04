import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxy endpoint pour télécharger des images depuis des URLs externes
 * Permet de contourner les problèmes CORS
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageUrl } = body;

    if (!imageUrl || typeof imageUrl !== 'string') {
      return NextResponse.json(
        { error: 'URL d\'image requise' },
        { status: 400 }
      );
    }

    // Télécharger l'image depuis l'URL externe
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Erreur HTTP: ${response.status}` },
        { status: response.status }
      );
    }

    // Récupérer le blob de l'image
    const blob = await response.blob();

    // Retourner l'image avec les bons headers
    return new NextResponse(blob, {
      headers: {
        'Content-Type': blob.type || 'image/png',
        'Content-Disposition': `attachment; filename="etsmart-image.png"`,
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error: any) {
    console.error('[DOWNLOAD IMAGE] Error:', error);
    return NextResponse.json(
      { error: 'Erreur lors du téléchargement de l\'image', details: error.message },
      { status: 500 }
    );
  }
}


