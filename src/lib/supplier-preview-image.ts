/**
 * Extraction d'une image d'aperçu depuis une fiche AliExpress (meta og:image).
 * Utilisé par le gestionnaire de boutique (localStorage) — pas de garantie si AliExpress bloque le fetch.
 */

export function extractAliExpressProductId(url: string): string | null {
  const cleanUrl = decodeURIComponent(url);
  const patterns = [
    /\/item\/(\d+)\.html/i,
    /\/item\/(\d+)/i,
    /\/(\d{10,})\.html/i,
    /\/i\/(\d+)\.html/i,
    /productId[=:](\d+)/i,
    /item\/(\d+)/i,
    /-(\d{10,})\.html/i,
    /(\d{12,})/,
  ];
  for (const pattern of patterns) {
    const match = cleanUrl.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

export function extractOgImageFromHtml(html: string): string | null {
  const m =
    html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i) ||
    html.match(/<meta\s+content="([^"]+)"\s+property="og:image"/i);
  if (!m?.[1]) return null;
  let imgUrl = m[1]
    .trim()
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  if (imgUrl.startsWith('//')) imgUrl = `https:${imgUrl}`;
  if (!/^https?:\/\//i.test(imgUrl)) return null;
  // Éviter les logos génériques trop petits / non produit
  if (/aliexpress\.com\/.*logo/i.test(imgUrl)) return null;
  return imgUrl;
}

function isAliExpressUrl(url: string): boolean {
  const u = url.toLowerCase();
  return u.includes('aliexpress.com') || u.includes('aliexpress.us');
}

const DEFAULT_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

async function fetchHtml(url: string, timeoutMs: number): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': DEFAULT_UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
        Referer: 'https://www.aliexpress.com/',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function fetchHtmlViaScraperApi(targetUrl: string, apiKey: string, timeoutMs: number): Promise<string | null> {
  try {
    const scraperUrl = `http://api.scraperapi.com?api_key=${apiKey}&url=${encodeURIComponent(targetUrl)}&render=false&country_code=us`;
    const res = await fetch(scraperUrl, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/**
 * Tente de récupérer l'URL de l'image principale (og:image) pour un lien AliExpress.
 */
export async function fetchAliExpressPreviewImage(
  supplierUrl: string,
  options?: { scraperApiKey?: string }
): Promise<string | null> {
  const trimmed = supplierUrl.trim();
  if (!trimmed || !isAliExpressUrl(trimmed)) return null;

  let normalized = trimmed;
  if (!/^https?:\/\//i.test(normalized)) normalized = `https://${normalized}`;

  const productId = extractAliExpressProductId(normalized);
  const tryUrls = productId
    ? [
        `https://www.aliexpress.com/item/${productId}.html`,
        `https://fr.aliexpress.com/item/${productId}.html`,
        `https://m.aliexpress.com/item/${productId}.html`,
        normalized,
      ]
    : [normalized];

  const timeout = 14_000;

  for (const pageUrl of tryUrls) {
    const html = await fetchHtml(pageUrl, timeout);
    if (html) {
      const img = extractOgImageFromHtml(html);
      if (img) return img;
    }
  }

  const key = options?.scraperApiKey || process.env.SCRAPER_API_KEY;
  if (key) {
    for (const pageUrl of tryUrls) {
      const html = await fetchHtmlViaScraperApi(pageUrl, key, 28_000);
      if (html) {
        const img = extractOgImageFromHtml(html);
        if (img) return img;
      }
    }
  }

  return null;
}
