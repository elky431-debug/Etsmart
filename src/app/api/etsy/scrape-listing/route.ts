import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import * as cheerio from 'cheerio';
import { scoreListing, ListingData } from '@/lib/etsy/listing-scorer';

/**
 * Route pour scraper un listing Etsy (pour concurrents)
 * POST /api/etsy/scrape-listing
 * 
 * Body: { url: string }
 * 
 * Scrape la page du listing et retourne les données + score
 */
export async function POST(request: NextRequest) {
  try {
    // 🔒 SECURITY: Require authentication
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const supabase = createSupabaseAdminClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { url } = body;

    if (!url || !url.includes('etsy.com/listing/')) {
      return NextResponse.json(
        { error: 'INVALID_URL', message: 'Invalid Etsy listing URL' },
        { status: 400 }
      );
    }

    // Scraper la page
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Extraire les données du listing
      const title = $('h1[data-listing-id], h1[class*="title"]').first().text().trim() ||
                    $('h1').first().text().trim() ||
                    $('meta[property="og:title"]').attr('content') ||
                    '';

      const description = $('[data-listing-description], .listing-description, [class*="description"]').first().text().trim() ||
                          $('meta[property="og:description"]').attr('content') ||
                          '';

      // Extraire les tags (dans les meta tags ou dans le HTML)
      const tags: string[] = [];
      
      // Méthode 1: Meta tags
      $('meta[name="keywords"]').each((_, el) => {
        const keywords = $(el).attr('content') || '';
        tags.push(...keywords.split(',').map(t => t.trim()).filter(t => t));
      });

      // Méthode 2: Data attributes
      $('[data-tags]').each((_, el) => {
        const tagData = $(el).attr('data-tags');
        if (tagData) {
          try {
            const parsed = JSON.parse(tagData);
            if (Array.isArray(parsed)) {
              tags.push(...parsed);
            }
          } catch {
            // Pas du JSON, traiter comme string
            tags.push(...tagData.split(',').map(t => t.trim()));
          }
        }
      });

      // Méthode 3: Chercher dans le HTML (souvent dans un script JSON-LD)
      $('script[type="application/ld+json"]').each((_, el) => {
        try {
          const json = JSON.parse($(el).html() || '{}');
          if (json.keywords) {
            if (Array.isArray(json.keywords)) {
              tags.push(...json.keywords);
            } else if (typeof json.keywords === 'string') {
              tags.push(...json.keywords.split(',').map(t => t.trim()));
            }
          }
        } catch {
          // Ignorer les erreurs de parsing
        }
      });

      // Dédupliquer les tags
      const uniqueTags = Array.from(new Set(tags.map(t => t.toLowerCase().trim()))).slice(0, 13);

      // Extraire les matériaux
      const materials: string[] = [];
      $('[data-materials], [class*="material"]').each((_, el) => {
        const materialText = $(el).text().trim();
        if (materialText) {
          materials.push(...materialText.split(',').map(m => m.trim()).filter(m => m));
        }
      });

      // Extraire les images
      const images: Array<{ url: string }> = [];
      $('img[data-listing-image], img[src*="etsy"]').each((_, el) => {
        const src = $(el).attr('src') || $(el).attr('data-src');
        if (src && !src.includes('placeholder') && !images.find(img => img.url === src)) {
          images.push({ url: src });
        }
      });

      // Extraire le prix
      const priceText = $('[data-buy-box-region] [class*="price"], [class*="price"]').first().text() ||
                        $('meta[property="product:price:amount"]').attr('content') ||
                        '';
      const priceMatch = priceText.match(/[\d,.]+/);
      const price = priceMatch ? parseFloat(priceMatch[0].replace(/,/g, '')) : 0;

      // Vérifier s'il y a une vidéo
      const hasVideo = $('video, [class*="video"]').length > 0;

      // Préparer les données pour le scoring
      const listingData: ListingData = {
        title: title,
        description: description,
        tags: uniqueTags,
        materials: materials,
        images: images.slice(0, 10), // Limiter à 10 images
        hasVideo: hasVideo,
      };

      // Scorer le listing
      const scores = scoreListing(listingData);

      return NextResponse.json({
        success: true,
        listing: {
          title,
          description: description.substring(0, 500) + (description.length > 500 ? '...' : ''),
          tags: uniqueTags,
          materials,
          price,
          images: images.slice(0, 5).map(img => img.url), // Retourner seulement les URLs
          hasVideo,
        },
        scores,
      });

    } catch (scrapeError: any) {
      console.error('[ETSY SCRAPE LISTING] Scraping error:', scrapeError);
      return NextResponse.json(
        { error: 'SCRAPING_ERROR', message: scrapeError.message || 'Failed to scrape listing' },
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error('[ETSY SCRAPE LISTING] Error:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: error.message || 'Failed to scrape listing' },
      { status: 500 }
    );
  }
}

