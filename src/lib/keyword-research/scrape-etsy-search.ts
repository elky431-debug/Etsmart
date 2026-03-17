import * as cheerio from 'cheerio';
import { EtsyKeywordListing } from './types';
import { detectBlockedPage } from '@/services/scraping/blockDetection';
import { isKeywordListingPayloadValid } from '@/services/scraping/scrapeValidation';
import { scrapeEtsyWithZenRowsBrowser, ZenRowsScrapeError } from '@/services/scraping/zenrowsBrowser';

const ETSY_SEARCH_BASE_URL = 'https://www.etsy.com/search?q=';
const FETCH_TIMEOUT_MS = 25000;
const PLAYWRIGHT_TIMEOUT_MS = 45000;
const PROXY_TIMEOUT_MS = 90000;
const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY;
const SCRAPINGBEE_API_KEY = process.env.SCRAPINGBEE_API_KEY;
const ZENROWS_API_KEY = process.env.ZENROWS_API_KEY;
const ZENROWS_BROWSER_WS_URL = process.env.ZENROWS_BROWSER_WS_URL;

export class EtsyScrapeUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EtsyScrapeUnavailableError';
  }
}

const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
  Referer: 'https://www.etsy.com/',
  'Upgrade-Insecure-Requests': '1',
};

function normalizeListingUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  if (url.startsWith('/')) return `https://www.etsy.com${url}`;
  return '';
}

function parsePrice(text: string): number | null {
  if (!text) return null;
  const normalized = text.replace(/\s/g, '').replace(',', '.');
  const match = normalized.match(/(\d+(\.\d+)?)/);
  if (!match) return null;
  const value = Number.parseFloat(match[1]);
  return Number.isFinite(value) ? value : null;
}

function parseReviewCount(text: string): number | null {
  if (!text) return null;
  const cleaned = text.replace(/[, ]/g, '');
  const match = cleaned.match(/(\d+)/);
  if (!match) return null;
  const value = Number.parseInt(match[1], 10);
  return Number.isFinite(value) ? value : null;
}

function parseRating(value: string): number | null {
  if (!value) return null;
  const match = value.match(/(\d+(\.\d+)?)/);
  if (!match) return null;
  const parsed = Number.parseFloat(match[1]);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 5) return null;
  return parsed;
}

function parseCurrency(text: string): string | null {
  if (!text) return null;
  if (text.includes('$')) return 'USD';
  if (text.includes('€')) return 'EUR';
  if (text.includes('£')) return 'GBP';
  return null;
}

function extractListingFromNode(
  $: cheerio.CheerioAPI,
  element: cheerio.Element,
  rank: number
): EtsyKeywordListing | null {
  const $el = $(element);

  const linkNode =
    $el.find('a[href*="/listing/"]').first() ||
    $el.find('a[data-listing-id]').first();
  const listingUrl = normalizeListingUrl(linkNode.attr('href') || '');
  if (!listingUrl || !listingUrl.includes('/listing/')) return null;

  const listingId =
    ($el.attr('data-listing-id') || linkNode.attr('data-listing-id') || '').trim() ||
    `rank-${rank}`;

  const title =
    ($el.find('h3').first().text() ||
      $el.find('[data-listing-title]').first().text() ||
      linkNode.text() ||
      '')
      .replace(/\s+/g, ' ')
      .trim();
  if (!title) return null;

  const imgNode = $el.find('img').first();
  const imageUrl =
    imgNode.attr('src') ||
    imgNode.attr('data-src') ||
    imgNode.attr('srcset')?.split(' ')[0] ||
    null;

  const priceText =
    $el.find('[data-buy-box-region] [class*="currency"]').first().text() ||
    $el.find('[class*="currency-value"]').first().text() ||
    $el.find('[class*="price"]').first().text() ||
    '';

  const reviewText =
    $el.find('[class*="rating-count"]').first().text() ||
    $el.find('[aria-label*="reviews"]').first().attr('aria-label') ||
    $el.find('[class*="review"]').first().text() ||
    '';

  const ratingLabel =
    $el.find('[aria-label*="out of 5 stars"]').first().attr('aria-label') ||
    $el.find('[class*="star"]').first().attr('aria-label') ||
    '';

  const shopName =
    $el.find('[class*="shop-name"]').first().text().trim() ||
    $el.find('[data-shop-name]').first().text().trim() ||
    null;

  const rawText = $el.text().toLowerCase();
  const isBestSeller = rawText.includes('best seller') || rawText.includes('bestseller');
  const hasFreeShipping =
    rawText.includes('free shipping') || rawText.includes('livraison gratuite');

  return {
    id: listingId,
    rank,
    title,
    listingUrl,
    imageUrl,
    price: parsePrice(priceText),
    currency: parseCurrency(priceText),
    reviewCount: parseReviewCount(reviewText),
    rating: parseRating(ratingLabel),
    shopName,
    isBestSeller,
    hasFreeShipping,
  };
}

function listingIdFromUrl(url: string): string {
  const match = url.match(/\/listing\/(\d+)/);
  return match?.[1] || url;
}

function parseListingsFromLdJson($: cheerio.CheerioAPI, maxListings: number): EtsyKeywordListing[] {
  const dedupe = new Set<string>();
  const listings: EtsyKeywordListing[] = [];
  let fallbackRank = 1;

  $('script[type="application/ld+json"]').each((_, script) => {
    if (listings.length >= maxListings) return;
    const raw = $(script).text()?.trim();
    if (!raw) return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }

    const blocks = Array.isArray(parsed) ? parsed : [parsed];
    for (const block of blocks) {
      if (listings.length >= maxListings) break;
      const itemList = (block as any)?.itemListElement;
      if (!Array.isArray(itemList)) continue;

      for (const entry of itemList) {
        if (listings.length >= maxListings) break;
        const item = entry?.item || entry;
        const listingUrl = normalizeListingUrl(item?.url || '');
        if (!listingUrl || !listingUrl.includes('/listing/')) continue;
        if (dedupe.has(listingUrl)) continue;

        const title = String(item?.name || '').replace(/\s+/g, ' ').trim();
        if (!title) continue;

        const imageValue = item?.image;
        const imageUrl = Array.isArray(imageValue)
          ? imageValue[0] || null
          : typeof imageValue === 'string'
          ? imageValue
          : null;

        const offers = item?.offers || {};
        const rating = parseRating(String(item?.aggregateRating?.ratingValue || ''));
        const reviewCount = parseReviewCount(String(item?.aggregateRating?.reviewCount || ''));
        const rankValue = Number.isFinite(Number(entry?.position))
          ? Number(entry?.position)
          : fallbackRank;
        const rawText = JSON.stringify(item).toLowerCase();

        listings.push({
          id: listingIdFromUrl(listingUrl),
          rank: rankValue,
          title,
          listingUrl,
          imageUrl,
          price: Number.isFinite(Number(offers?.price)) ? Number(offers.price) : null,
          currency: typeof offers?.priceCurrency === 'string' ? offers.priceCurrency : null,
          reviewCount,
          rating,
          shopName:
            item?.seller?.name ||
            item?.brand?.name ||
            item?.offers?.seller?.name ||
            item?.brand?.brand ||
            null,
          isBestSeller: rawText.includes('best seller') || rawText.includes('bestseller'),
          hasFreeShipping: rawText.includes('free shipping') || rawText.includes('livraison gratuite'),
        });

        dedupe.add(listingUrl);
        fallbackRank += 1;
      }
    }
  });

  return listings.slice(0, maxListings);
}

function parseListingsFromHtml(html: string, maxListings: number): EtsyKeywordListing[] {
  const $ = cheerio.load(html);
  const candidates = new Set<cheerio.Element>();

  $('[data-listing-id]').each((_, el) => candidates.add(el));
  $('li.wt-list-unstyled [data-test-id="listing-card"]').each((_, el) => candidates.add(el));
  $('div[class*="v2-listing-card"]').each((_, el) => candidates.add(el));
  $('a[href*="/listing/"]').parents('li, div').each((_, el) => candidates.add(el));

  const listings: EtsyKeywordListing[] = [];
  let rank = 1;
  for (const candidate of candidates) {
    if (listings.length >= maxListings) break;
    const parsed = extractListingFromNode($, candidate, rank);
    if (!parsed) continue;

    const alreadySeen = listings.some((l) => l.listingUrl === parsed.listingUrl);
    if (alreadySeen) continue;

    listings.push(parsed);
    rank += 1;
  }

  if (listings.length > 0) {
    return listings;
  }

  return parseListingsFromLdJson($, maxListings);
}

function parseCountToken(value: string): number | null {
  const digits = value.replace(/\D/g, '');
  if (!digits) return null;
  const parsed = Number.parseInt(digits, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function extractMarketSizeEstimate(html: string): number | null {
  const $ = cheerio.load(html);

  // Strategy 1: ld+json numberOfItems on ItemList
  let best: number | null = null;
  $('script[type="application/ld+json"]').each((_, script) => {
    const raw = $(script).text()?.trim();
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      const blocks = Array.isArray(parsed) ? parsed : [parsed];
      for (const block of blocks) {
        const n = (block as any)?.numberOfItems;
        const count = typeof n === 'number' ? n : parseCountToken(String(n || ''));
        if (count && (!best || count > best)) {
          best = count;
        }
      }
    } catch {
      return;
    }
  });

  // Strategy 2: textual "X results"
  const text = $.root().text().replace(/\s+/g, ' ');
  const textualMatches = text.matchAll(/(\d[\d,.\s]{1,15})\s+results/gi);
  for (const match of textualMatches) {
    const count = parseCountToken(match[1]);
    if (count && (!best || count > best)) {
      best = count;
    }
  }

  // Strategy 3: JSON-like keys in page source
  const jsonRegexes = [
    /"numberOfResults"\s*:\s*"?([\d,.\s]+)"?/gi,
    /"resultsCount"\s*:\s*"?([\d,.\s]+)"?/gi,
    /"result_count"\s*:\s*"?([\d,.\s]+)"?/gi,
    /"total_results"\s*:\s*"?([\d,.\s]+)"?/gi,
  ];
  for (const regex of jsonRegexes) {
    for (const match of html.matchAll(regex)) {
      const count = parseCountToken(match[1]);
      if (count && (!best || count > best)) {
        best = count;
      }
    }
  }

  if (!best) return null;
  // Guardrail against noisy parses
  return Math.max(1, Math.min(50_000_000, best));
}

async function fetchEtsyHtmlWithHttp(sourceUrl: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(sourceUrl, {
      method: 'GET',
      headers: DEFAULT_HEADERS,
      redirect: 'follow',
      signal: controller.signal,
    });

    if (!response.ok) {
      const isProtected =
        response.status === 403 && (response.headers.get('x-datadome') || response.headers.get('x-dd-b'));
      const blockedHint = isProtected ? ' (DataDome)' : '';
      throw new Error(`Etsy inaccessible (status ${response.status})${blockedHint}`);
    }

    const html = await response.text();
    if (!html || html.length < 1000) {
      throw new Error('Reponse Etsy invalide');
    }

    return html;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchWithScraperApi(sourceUrl: string): Promise<string | null> {
  if (!SCRAPER_API_KEY) return null;

  const candidates = [
    `https://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(sourceUrl)}&country_code=us`,
    `https://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(sourceUrl)}&render=true&country_code=us`,
  ];

  for (const proxyUrl of candidates) {
    try {
      const response = await fetch(proxyUrl, {
        signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
      });
      if (!response.ok) continue;

      const html = await response.text();
      if (
        html.length > 1000 &&
        html.toLowerCase().includes('<html') &&
        !detectBlockedPage({ html, listingsCount: 0 })
      ) {
        return html;
      }
    } catch {
      continue;
    }
  }

  return null;
}

async function fetchWithScrapingBee(sourceUrl: string): Promise<string | null> {
  if (!SCRAPINGBEE_API_KEY) return null;

  const proxyUrl = `https://app.scrapingbee.com/api/v1/?api_key=${SCRAPINGBEE_API_KEY}&url=${encodeURIComponent(sourceUrl)}&render_js=true&country_code=us`;
  try {
    const response = await fetch(proxyUrl, {
      signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const html = await response.text();
    if (html.length <= 1000 || detectBlockedPage({ html, listingsCount: 0 })) return null;
    return html;
  } catch {
    return null;
  }
}

async function fetchWithZenRows(sourceUrl: string): Promise<string | null> {
  const wsDerivedKey = (() => {
    if (!ZENROWS_BROWSER_WS_URL) return null;
    try {
      const parsed = new URL(ZENROWS_BROWSER_WS_URL);
      return parsed.searchParams.get('apikey');
    } catch {
      return null;
    }
  })();
  const apiKey = ZENROWS_API_KEY || wsDerivedKey;
  if (!apiKey) return null;

  const proxyCandidates = [
    `https://api.zenrows.com/v1/?apikey=${apiKey}&url=${encodeURIComponent(sourceUrl)}&js_render=true&premium_proxy=true&antibot=true`,
    `https://api.zenrows.com/v1/?apikey=${apiKey}&url=${encodeURIComponent(sourceUrl)}&js_render=true&premium_proxy=true`,
    `https://api.zenrows.com/v1/?apikey=${apiKey}&url=${encodeURIComponent(sourceUrl)}&js_render=true`,
  ];
  try {
    for (let index = 0; index < proxyCandidates.length; index += 1) {
      const response = await fetch(proxyCandidates[index], {
        signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
      });

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0f151a95-065e-4dcd-b345-8bd842db5239',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'139b8b'},body:JSON.stringify({sessionId:'139b8b',runId:`zenrows-api-${Date.now()}`,hypothesisId:'H7_ZENROWS_API_FALLBACK',location:'scrape-etsy-search.ts:fetchWithZenRows:response',message:'ZenRows API candidate response',data:{candidate:index+1,status:response.status,ok:response.ok,usedWsDerivedKey:Boolean(wsDerivedKey),hasDirectApiKey:Boolean(ZENROWS_API_KEY)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion

      if (!response.ok) continue;
      const html = await response.text();
      if (html.length <= 1000 || detectBlockedPage({ html, listingsCount: 0 })) continue;
      return html;
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchEtsyHtmlWithPlaywright(sourceUrl: string): Promise<string> {
  const playwright = await import('playwright');
  const browser = await playwright.chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled'],
  });

  try {
    const context = await browser.newContext({
      userAgent: DEFAULT_HEADERS['User-Agent'],
      locale: 'en-US',
      viewport: { width: 1440, height: 1100 },
    });
    const page = await context.newPage();
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
    });

    const response = await page.goto(sourceUrl, {
      waitUntil: 'domcontentloaded',
      timeout: PLAYWRIGHT_TIMEOUT_MS,
    });
    if (!response || !response.ok()) {
      const status = response?.status() || 'unknown';
      throw new Error(`Etsy inaccessible via navigateur (status ${status})`);
    }

    await page.waitForTimeout(1200);
    await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => null);

    const html = await page.content();
    if (!html || html.length < 1000) {
      throw new Error('Reponse Etsy navigateur invalide');
    }

    return html;
  } finally {
    await browser.close();
  }
}

export async function scrapeEtsyKeywordListings(
  keyword: string,
  maxListings: number = 24
): Promise<{ sourceUrl: string; listings: EtsyKeywordListing[]; marketSizeEstimate: number | null }> {
  const cleanedKeyword = keyword.trim();
  if (!cleanedKeyword) {
    throw new Error('Keyword vide');
  }

  const sourceUrl = `${ETSY_SEARCH_BASE_URL}${encodeURIComponent(cleanedKeyword)}`;
  let html = '';
  let firstError: Error | null = null;

  const parseHtmlPayload = (payload: string) => {
    if (!payload) return null;
    if (detectBlockedPage({ html: payload, listingsCount: 0 })) return null;
    const listings = parseListingsFromHtml(payload, maxListings);
    const marketSizeEstimate = extractMarketSizeEstimate(payload);
    if (!isKeywordListingPayloadValid(listings)) return null;
    return { listings, marketSizeEstimate };
  };

  try {
    html = await fetchEtsyHtmlWithHttp(sourceUrl);
    const parsed = parseHtmlPayload(html);
    if (parsed) {
      return { sourceUrl, listings: parsed.listings, marketSizeEstimate: parsed.marketSizeEstimate };
    }
    throw new Error('Reponse HTTP non exploitable');
  } catch (error: any) {
    firstError = error instanceof Error ? error : new Error(String(error));

    const lightweightCandidates = [
      await fetchWithScraperApi(sourceUrl),
      await fetchWithScrapingBee(sourceUrl),
      await fetchWithZenRows(sourceUrl),
    ];

    for (const candidate of lightweightCandidates) {
      const parsed = parseHtmlPayload(candidate || '');
      if (parsed) {
        return { sourceUrl, listings: parsed.listings, marketSizeEstimate: parsed.marketSizeEstimate };
      }
    }

    try {
      const strong = await scrapeEtsyWithZenRowsBrowser(cleanedKeyword, Math.min(maxListings, 12));
      if (isKeywordListingPayloadValid(strong.listings)) {
        return {
          sourceUrl: strong.sourceUrl,
          listings: strong.listings,
          marketSizeEstimate: strong.marketSizeEstimate,
        };
      }
    } catch (zenRowsError: any) {
      if (zenRowsError instanceof ZenRowsScrapeError) {
        console.warn('[KEYWORD_RESEARCH] ZenRows browser failed:', {
          code: zenRowsError.code,
          details: zenRowsError.details,
          message: zenRowsError.message,
        });
      } else {
        console.warn('[KEYWORD_RESEARCH] ZenRows browser failed:', zenRowsError?.message || zenRowsError);
      }
    }

    try {
      html = await fetchEtsyHtmlWithPlaywright(sourceUrl);
      const parsed = parseHtmlPayload(html);
      if (parsed) {
        return { sourceUrl, listings: parsed.listings, marketSizeEstimate: parsed.marketSizeEstimate };
      }
    } catch (playwrightError: any) {
      console.warn(
        '[KEYWORD_RESEARCH] Local Playwright failed:',
        playwrightError?.message || String(playwrightError)
      );
    }
  }

  console.error('[KEYWORD_RESEARCH] scrape failed', {
    keyword: cleanedKeyword,
    initialError: firstError?.message,
  });
  throw new EtsyScrapeUnavailableError(
    "Impossible de récupérer les données Etsy pour le moment. Réessaie dans 1 à 2 minutes."
  );
}
