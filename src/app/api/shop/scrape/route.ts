import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { scrapeEtsyPageHtmlWithZenRowsBrowser } from '@/services/scraping/zenrowsBrowser';

export const maxDuration = 120;

interface ScrapedListing {
  title: string;
  url: string;
  price: number;
  sales?: number;
  reviews?: number;
  rating?: number;
  images?: string[];
  tags?: string[];
  materials?: string[];
  description?: string;
  hasVideo?: boolean;
  createdAt?: string;
  updatedAt?: string;
  isPartialData?: boolean;
}

async function fetchEtsyHtmlWithFallback(url: string, language: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': language,
      },
      cache: 'no-store',
    });
    if (res.ok) {
      const html = await res.text();
      if (html && html.length > 1000) return html;
    }
  } catch {
    // fallback below
  }

  try {
    return await scrapeEtsyPageHtmlWithZenRowsBrowser(url);
  } catch (error: any) {
    console.warn('[SHOP_SCRAPE] ZenRows fallback failed:', error?.message || error);
    return null;
  }
}

function parseCompactNumber(value: string): number {
  const raw = value
    .trim()
    .toLowerCase()
    .replace(/[ \u00A0\u202F]/g, '')
    .replace(/,/g, '.');
  const match = raw.match(/(\d+(?:\.\d+)?)(k|m)?/);
  if (!match) return 0;
  const n = parseFloat(match[1]);
  if (!Number.isFinite(n)) return 0;
  if (match[2] === 'k') return Math.round(n * 1000);
  if (match[2] === 'm') return Math.round(n * 1000000);
  return Math.round(n);
}

function parsePriceValue(value: string): number {
  const cleaned = value
    .replace(/[^\d,.\s\u00A0\u202F]/g, '')
    .replace(/[\u00A0\u202F]/g, ' ')
    .trim();
  if (!cleaned) return 0;

  const token = cleaned.match(/(\d{1,3}(?:[ .]\d{3})*(?:[.,]\d+)?|\d+(?:[.,]\d+)?)/);
  if (!token?.[1]) return 0;
  let n = token[1].replace(/ /g, '');

  if (n.includes(',') && n.includes('.')) {
    // format 1,234.56
    n = n.replace(/,/g, '');
  } else if (n.includes(',')) {
    // format 1 234,56
    n = n.replace(/\./g, '').replace(',', '.');
  } else {
    // format 1234.56 or 1.234
    const parts = n.split('.');
    if (parts.length > 1 && parts[parts.length - 1].length === 3) {
      n = n.replace(/\./g, '');
    }
  }
  const parsed = Number.parseFloat(n);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeShopUrl(input: string): string {
  const raw = input.trim();
  if (!raw) return '';

  if (/^https?:\/\//i.test(raw)) return raw.split('?')[0];
  if (/etsy\.com\/shop\//i.test(raw)) return `https://${raw.replace(/^\/+/, '')}`.split('?')[0];

  const slug = raw
    .replace(/^@/, '')
    .replace(/\s+/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '');
  return `https://www.etsy.com/shop/${slug}`;
}

function extractListingsFromLdJson($: cheerio.CheerioAPI): ScrapedListing[] {
  const listings: ScrapedListing[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const content = $(el).html();
    if (!content) return;
    try {
      const parsed = JSON.parse(content);
      const candidates = Array.isArray(parsed) ? parsed : [parsed];
      for (const node of candidates) {
        const itemList = node?.itemListElement;
        if (!Array.isArray(itemList)) continue;
        for (const entry of itemList) {
          const item = entry?.item || entry;
          if (!item) continue;
          const title = String(item.name || '').trim();
          const url = String(item.url || '').trim();
          if (!title || !url || !url.includes('/listing/')) continue;
          const images = Array.isArray(item.image)
            ? item.image.filter(Boolean).map(String)
            : item.image
            ? [String(item.image)]
            : [];
          const price = Number(item.offers?.price || 0);
          listings.push({
            title,
            url,
            price: Number.isFinite(price) ? price : 0,
            images,
          });
        }
      }
    } catch {
      // ignore parsing errors
    }
  });
  return listings.slice(0, 20);
}

function extractShopMetrics($: cheerio.CheerioAPI, pageText: string) {
  const text = pageText.replace(/[ \u00A0\u202F]+/g, ' ');
  let salesCount = 0;
  let reviewCount = 0;
  let rating = 0;
  let shopAge = '';

  const patternsSales = [
    /([\d.,\s\u00A0\u202F]+(?:k|m)?)\s+sales?/i,
    /([\d.,\s\u00A0\u202F]+(?:k|m)?)\s+ventes?/i,
    /([\d.,\s\u00A0\u202F]+(?:k|m)?)\s+items?\s+sold/i,
  ];
  for (const re of patternsSales) {
    const m = text.match(re);
    if (m?.[1]) {
      salesCount = parseCompactNumber(m[1]);
      if (salesCount > 0) break;
    }
  }

  const patternsReviews = [/([\d.,\s\u00A0\u202F]+)\s+reviews?/i, /([\d.,\s\u00A0\u202F]+)\s+avis/i];
  for (const re of patternsReviews) {
    const m = text.match(re);
    if (m?.[1]) {
      reviewCount = parseCompactNumber(m[1]);
      if (reviewCount > 0) break;
    }
  }

  const ratingMatch =
    text.match(/(\d(?:[.,]\d)?)\s+(?:out of|sur)\s+5/i) || text.match(/(\d(?:[.,]\d)?)\s*\/\s*5/i);
  if (ratingMatch?.[1]) {
    rating = parseFloat(ratingMatch[1].replace(',', '.'));
  }

  const ageMatch = text.match(/(?:On Etsy since|Depuis)\s+(\d{4})/i);
  if (ageMatch?.[1]) shopAge = ageMatch[1];

  $('script[type="application/ld+json"]').each((_, el) => {
    if (salesCount > 0 && reviewCount > 0 && rating > 0) return;
    const content = $(el).html();
    if (!content) return;
    try {
      const data = JSON.parse(content);
      const nodes = Array.isArray(data) ? data : [data];
      for (const node of nodes) {
        const aggregate = node?.aggregateRating || node?.mainEntity?.aggregateRating;
        if (!rating && aggregate?.ratingValue) rating = Number(aggregate.ratingValue) || 0;
        if (!reviewCount && aggregate?.reviewCount) reviewCount = Number(aggregate.reviewCount) || 0;
        if (!salesCount && (node?.transaction_sold_count || node?.salesCount)) {
          salesCount = Number(node.transaction_sold_count || node.salesCount) || 0;
        }
      }
    } catch {
      // ignore
    }
  });

  return { salesCount, reviewCount, rating, shopAge };
}

async function enrichListing(url: string): Promise<Partial<ScrapedListing>> {
  try {
    const html = await fetchEtsyHtmlWithFallback(url, 'fr-FR,fr;q=0.9,en;q=0.8');
    if (!html) return { isPartialData: true };
    const $ = cheerio.load(html);
    const bodyText = $('body').text();

    let tags: string[] = [];
    let materials: string[] = [];
    let description = '';
    let title = '';
    let hasVideo = false;
    let createdAt: string | undefined;
    let updatedAt: string | undefined;
    let reviews = 0;
    let rating = 0;
    let sales = 0;
    let price = 0;
    let images: string[] = [];

    $('script[type="application/ld+json"]').each((_, el) => {
      const content = $(el).html();
      if (!content) return;
      try {
        const data = JSON.parse(content);
        const nodes = Array.isArray(data) ? data : [data];
        for (const node of nodes) {
          const product = node?.['@type'] === 'Product' ? node : node?.mainEntity?.['@type'] === 'Product' ? node.mainEntity : null;
          if (!product) continue;
          if (!title && product.name) title = String(product.name);
          if (!description && product.description) description = String(product.description);
          if (!price && product.offers?.price) price = Number(product.offers.price) || 0;
          if (!rating && product.aggregateRating?.ratingValue) rating = Number(product.aggregateRating.ratingValue) || 0;
          if (!reviews && product.aggregateRating?.reviewCount) reviews = Number(product.aggregateRating.reviewCount) || 0;
          if (!createdAt && product.datePublished) createdAt = String(product.datePublished);
          if (!updatedAt && product.dateModified) updatedAt = String(product.dateModified);
          if (!images.length && product.image) {
            images = Array.isArray(product.image)
              ? product.image.map(String).filter(Boolean)
              : [String(product.image)];
          }
          if (Array.isArray(product.keywords)) tags = product.keywords.map(String).filter(Boolean);
          if (!tags.length && typeof product.keywords === 'string') {
            tags = product.keywords
              .split(',')
              .map((t: string) => t.trim())
              .filter(Boolean);
          }
          if (Array.isArray(product.material)) materials = product.material.map(String).filter(Boolean);
        }
      } catch {
        // ignore
      }
    });

    if (!hasVideo) {
      hasVideo =
        $('video').length > 0 ||
        $('[data-video-id]').length > 0 ||
        $('[aria-label*="video" i]').length > 0 ||
        $('[class*="video"]').length > 0 ||
        $('button:contains("Video")').length > 0 ||
        bodyText.toLowerCase().includes('listing video');
    }

    if (!title) {
      title =
        $('h1').first().text().trim() ||
        $('meta[property="og:title"]').attr('content')?.trim() ||
        $('title').text().replace(/\s*\|\s*Etsy.*$/i, '').trim() ||
        '';
    }

    if (!images.length) {
      const gallery = $(
        '[data-carousel-panel] img, [data-listing-image] img, img[src*="etsyimg.com"], img[src*="etsystatic.com"]'
      )
        .toArray()
        .map((el) => $(el).attr('src') || $(el).attr('data-src') || '')
        .filter(Boolean)
        .map((src) => src.split('?')[0]);
      images = Array.from(new Set(gallery)).slice(0, 12);
    }

    if (!sales) {
      const salesMatch =
        bodyText.match(/([\d.,\s\u00A0\u202F]+(?:k|m)?)\s+sales?/i) ||
        bodyText.match(/([\d.,\s\u00A0\u202F]+(?:k|m)?)\s+ventes?/i);
      if (salesMatch?.[1]) sales = parseCompactNumber(salesMatch[1]);
    }

    if (!tags.length) {
      const chips = $('[data-tag], a[href*="search?q="], [class*="tag"]')
        .toArray()
        .map((el) => $(el).text().trim())
        .filter((t) => t.length >= 2 && t.length <= 40);
      tags = Array.from(new Set(chips)).slice(0, 13);
    }

    if (!materials.length) {
      const matMatch = bodyText.match(/materials?\s*[:\-]\s*([^\n\r]+)/i);
      if (matMatch?.[1]) {
        materials = matMatch[1]
          .split(',')
          .map((m) => m.trim())
          .filter(Boolean)
          .slice(0, 13);
      }
    }

    return {
      title: title || undefined,
      tags,
      materials,
      description: description?.trim(),
      hasVideo,
      createdAt,
      updatedAt,
      reviews,
      rating,
      sales,
      price,
      images: images.length ? images : undefined,
      isPartialData:
        !title ||
        title.endsWith('...') ||
        (!description && !tags.length && !materials.length && !hasVideo) ||
        (images.length <= 1 && !hasVideo),
    };
  } catch {
    return { isPartialData: true };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const shopInput = String(body?.shopInput || body?.shopUrl || '').trim();
    const shopUrl = normalizeShopUrl(shopInput);

    if (!shopUrl) {
      return NextResponse.json(
        { error: 'INVALID_INPUT', message: 'Nom ou lien boutique invalide.' },
        { status: 400 }
      );
    }

    const html = await fetchEtsyHtmlWithFallback(shopUrl, 'fr-FR,fr;q=0.9,en;q=0.8');
    if (!html) {
      return NextResponse.json(
        {
          error: 'SCRAPE_FAILED',
          message: "Impossible de charger la boutique Etsy pour le moment. Réessaie dans quelques minutes.",
        },
        { status: 503 }
      );
    }
    const $ = cheerio.load(html);
    const pageText = $('body').text();

    const h1 = $('h1').first().text().trim();
    const title = $('title').text().replace(/\s*\|\s*Etsy.*$/i, '').trim();
    const shopName = h1 || title || shopInput;

    const metrics = extractShopMetrics($, pageText);

    const listingsFromLd = extractListingsFromLdJson($);
    const listings: ScrapedListing[] = listingsFromLd.length
      ? listingsFromLd
      : $('a[href*="/listing/"]')
          .toArray()
          .slice(0, 20)
          .map((el) => {
            const anchor = $(el);
            const href = anchor.attr('href') || '';
            const url = href.startsWith('http') ? href.split('?')[0] : `https://www.etsy.com${href}`.split('?')[0];
            const card = anchor.closest('li, div');
            const titleText =
              anchor.attr('title') ||
              anchor.find('h3').first().text().trim() ||
              card.find('h3').first().text().trim() ||
              '';
            const priceText =
              card.find('[class*="price"]').first().text() || anchor.parent().find('[class*="price"]').first().text();
            const price = parsePriceValue(priceText);
            const image =
              card.find('img').first().attr('src') ||
              card.find('img').first().attr('data-src') ||
              '';
            return {
              title: titleText || 'Listing Etsy',
              url,
              price: Number.isFinite(price) ? price : 0,
              images: image ? [image] : [],
            };
          })
          .filter((l) => l.url.includes('/listing/'));

    const targetListings = listings.slice(0, 12);
    const detailedListings: ScrapedListing[] = [];
    const concurrency = 3;
    for (let i = 0; i < targetListings.length; i += concurrency) {
      const batch = targetListings.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map(async (l) => {
          const details = await enrichListing(l.url);
          const detailsMissing =
            Object.keys(details).length === 0 ||
            (!details.images?.length &&
              !details.tags?.length &&
              !details.materials?.length &&
              !details.description &&
              !details.hasVideo);
          return {
            ...l,
            ...details,
            title: details.title && details.title.length > l.title.length ? details.title : l.title,
            price: details.price && details.price > 0 ? details.price : l.price,
            images: details.images && details.images.length ? details.images : l.images,
            tags: details.tags && details.tags.length ? details.tags : l.tags,
            isPartialData: Boolean(details.isPartialData || detailsMissing),
          } as ScrapedListing;
        })
      );
      detailedListings.push(...batchResults);
    }

    const payload = {
      shopName,
      shopUrl,
      salesCount: metrics.salesCount,
      rating: metrics.rating,
      reviewCount: metrics.reviewCount,
      shopAge: metrics.shopAge,
      location: '',
      listings: detailedListings,
    };

    return NextResponse.json({ success: true, shop: payload });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur scraping boutique.';
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message },
      { status: 500 }
    );
  }
}

