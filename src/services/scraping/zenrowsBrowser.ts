import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Browser, BrowserContext, chromium, Page } from 'playwright-core';
import { EtsyKeywordListing } from '@/lib/keyword-research/types';
import { detectBlockedPage } from './blockDetection';
import { withRetry } from './retry';
import { isKeywordListingPayloadValid } from './scrapeValidation';

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const NAV_TIMEOUT_MS = 50000;
const WAIT_SELECTORS_TIMEOUT_MS = 12000;
const MAX_LISTINGS_DEFAULT = 12;
const DEBUG_ARTIFACT_DIR = path.join(process.cwd(), '.cursor', 'zenrows-debug');
const DEBUG_ENABLED = process.env.ZENROWS_DEBUG === '1' || process.env.NODE_ENV === 'development';

type ExtractedListing = {
  title: string;
  listingUrl: string;
  imageUrl: string | null;
  price: number | null;
  currency: string | null;
  reviewCount: number | null;
  rating: number | null;
  shopName: string | null;
  isBestSeller: boolean;
  hasFreeShipping: boolean;
};

type ExtractPayload = {
  listings: ExtractedListing[];
  pageText: string;
  marketSizeEstimate: number | null;
  usedSelector: string | null;
};

type ZenRowsFailureCode =
  | 'PAGE_BLOCKED'
  | 'CONSENT_WALL'
  | 'SELECTOR_NOT_FOUND'
  | 'EMPTY_RESULTS'
  | 'TIMEOUT'
  | 'INVALID_HTML'
  | 'NAVIGATION_FAILED'
  | 'CONNECTION_FAILED';

export class ZenRowsScrapeError extends Error {
  code: ZenRowsFailureCode;
  details: Record<string, unknown>;

  constructor(code: ZenRowsFailureCode, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ZenRowsScrapeError';
    this.code = code;
    this.details = details;
  }
}

function parseListingId(url: string, rank: number): string {
  const match = url.match(/\/listing\/(\d+)/);
  return match?.[1] || `rank-${rank}`;
}

function toKeywordListing(raw: ExtractedListing, rank: number): EtsyKeywordListing {
  return {
    id: parseListingId(raw.listingUrl, rank),
    rank,
    title: raw.title.trim(),
    listingUrl: raw.listingUrl,
    imageUrl: raw.imageUrl,
    price: raw.price,
    currency: raw.currency,
    reviewCount: raw.reviewCount,
    rating: raw.rating,
    shopName: raw.shopName,
    isBestSeller: raw.isBestSeller,
    hasFreeShipping: raw.hasFreeShipping,
  };
}

function hasConsentWall(textContent: string): boolean {
  const lower = textContent.toLowerCase();
  return (
    lower.includes('consent') ||
    lower.includes('cookie') ||
    lower.includes('gdpr') ||
    lower.includes('before you continue') ||
    lower.includes('privacy choices')
  );
}

function classifyFailure(params: {
  html: string;
  pageText: string;
  listingsCount: number;
  selectorUsed: string | null;
  errorMessage?: string;
}): ZenRowsFailureCode {
  const errorLower = (params.errorMessage || '').toLowerCase();
  if (errorLower.includes('timeout')) return 'TIMEOUT';
  if (errorLower.includes('navigation') || errorLower.includes('net::')) return 'NAVIGATION_FAILED';
  if (errorLower.includes('connect') || errorLower.includes('cdp')) return 'CONNECTION_FAILED';
  if (!params.html || params.html.length < 1200) return 'INVALID_HTML';
  if (hasConsentWall(params.pageText)) return 'CONSENT_WALL';
  if (detectBlockedPage({ html: params.html, textContent: params.pageText, listingsCount: params.listingsCount })) {
    return 'PAGE_BLOCKED';
  }
  if (!params.selectorUsed) return 'SELECTOR_NOT_FOUND';
  if (params.listingsCount <= 0) return 'EMPTY_RESULTS';
  return 'INVALID_HTML';
}

function safeSnippet(value: string, maxLen: number): string {
  return (value || '').replace(/\s+/g, ' ').slice(0, maxLen);
}

function buildZenRowsWsUrl(baseWsUrl: string, attempt: number): string {
  return baseWsUrl;
}

async function emitRuntimeDebugLog(payload: {
  runId: string;
  hypothesisId: string;
  location: string;
  message: string;
  data?: Record<string, unknown>;
}) {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/0f151a95-065e-4dcd-b345-8bd842db5239',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'139b8b'},body:JSON.stringify({sessionId:'139b8b',runId:payload.runId,hypothesisId:payload.hypothesisId,location:payload.location,message:payload.message,data:payload.data||{},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
}

async function persistArtifacts(params: {
  runId: string;
  attempt: number;
  page: Page | null;
  html: string;
  pageText: string;
  reason: string;
  title: string;
  finalUrl: string;
}): Promise<{ screenshotPath: string | null; htmlPath: string | null; summaryPath: string | null }> {
  await mkdir(DEBUG_ARTIFACT_DIR, { recursive: true });
  const base = `${params.runId}-attempt-${params.attempt}`;
  const screenshotPath = path.join(DEBUG_ARTIFACT_DIR, `${base}.png`);
  const htmlPath = path.join(DEBUG_ARTIFACT_DIR, `${base}.html`);
  const summaryPath = path.join(DEBUG_ARTIFACT_DIR, `${base}.txt`);

  try {
    if (params.page) {
      await params.page.screenshot({ path: screenshotPath, fullPage: true });
    }
  } catch {
    // ignore screenshot errors
  }

  try {
    await writeFile(htmlPath, params.html || '', 'utf8');
  } catch {
    // ignore html write errors
  }

  try {
    const summary = [
      `reason=${params.reason}`,
      `title=${params.title}`,
      `finalUrl=${params.finalUrl}`,
      '',
      safeSnippet(params.pageText, 2000),
    ].join('\n');
    await writeFile(summaryPath, summary, 'utf8');
  } catch {
    // ignore summary write errors
  }

  return {
    screenshotPath: params.page ? screenshotPath : null,
    htmlPath,
    summaryPath,
  };
}

async function waitForListings(page: Page): Promise<{ selectorUsed: string | null }> {
  const selectors = [
    'a[href*="/listing/"]',
    '[data-listing-id]',
    '[data-test-id="listing-card"]',
    'li.wt-list-unstyled [data-test-id="listing-card"]',
    'main [data-listing-id]',
  ];
  for (const selector of selectors) {
    try {
      await page.waitForSelector(selector, { timeout: WAIT_SELECTORS_TIMEOUT_MS });
      return { selectorUsed: selector };
    } catch {
      continue;
    }
  }
  return { selectorUsed: null };
}

async function extractListingsFromPage(page: Page, maxListings: number): Promise<ExtractPayload> {
  return page.evaluate((limit) => {
    const parseNumber = (value: string): number | null => {
      const normalized = (value || '').replace(/\s/g, '').replace(',', '.');
      const match = normalized.match(/(\d+(\.\d+)?)/);
      if (!match) return null;
      const parsed = Number.parseFloat(match[1]);
      return Number.isFinite(parsed) ? parsed : null;
    };
    const parseReviewCount = (value: string): number | null => {
      const cleaned = (value || '').replace(/[, ]/g, '');
      const match = cleaned.match(/(\d+)/);
      if (!match) return null;
      const parsed = Number.parseInt(match[1], 10);
      return Number.isFinite(parsed) ? parsed : null;
    };
    const parseCurrency = (value: string): string | null => {
      if (value.includes('$')) return 'USD';
      if (value.includes('€')) return 'EUR';
      if (value.includes('£')) return 'GBP';
      return null;
    };
    const normalizeUrl = (raw: string): string => {
      if (!raw) return '';
      if (raw.startsWith('http')) return raw.split('?')[0];
      if (raw.startsWith('/')) return `https://www.etsy.com${raw.split('?')[0]}`;
      return '';
    };

    const candidateSelectors = [
      'a[href*="/listing/"]',
      '[data-listing-id] a[href*="/listing/"]',
      '[data-test-id="listing-card"] a[href*="/listing/"]',
      'main a[href*="/listing/"]',
    ];

    const cards = new Set<Element>();
    for (const selector of candidateSelectors) {
      const anchors = Array.from(document.querySelectorAll(selector));
      for (const anchor of anchors) {
        const card = anchor.closest('li, div');
        if (card) cards.add(card);
      }
      if (cards.size >= limit * 2) break;
    }

    const listings: ExtractedListing[] = [];
    for (const card of cards) {
      if (listings.length >= limit) break;
      const link = card.querySelector('a[href*="/listing/"]') as HTMLAnchorElement | null;
      const listingUrl = normalizeUrl(link?.getAttribute('href') || '');
      if (!listingUrl || !listingUrl.includes('/listing/')) continue;

      const title = (card.querySelector('h3')?.textContent || link?.textContent || '').replace(/\s+/g, ' ').trim();
      if (!title) continue;

      const imageNode = card.querySelector('img');
      const imageUrl =
        imageNode?.getAttribute('src') ||
        imageNode?.getAttribute('data-src') ||
        imageNode?.getAttribute('srcset')?.split(' ')[0] ||
        null;
      const cardText = (card.textContent || '').replace(/\s+/g, ' ').trim();
      const priceText =
        (card.querySelector('[class*="price"]')?.textContent || cardText.match(/\$[\d.,]+|€[\d.,]+|£[\d.,]+/)?.[0] || '').trim();
      const reviewText =
        card.querySelector('[class*="rating-count"]')?.textContent ||
        card.querySelector('[aria-label*="reviews"]')?.getAttribute('aria-label') ||
        '';
      const ratingLabel =
        card.querySelector('[aria-label*="out of 5 stars"]')?.getAttribute('aria-label') ||
        card.querySelector('[class*="star"]')?.getAttribute('aria-label') ||
        '';
      const shopName =
        (card.querySelector('[class*="shop-name"]')?.textContent || card.querySelector('[data-shop-name]')?.textContent || '').trim() ||
        null;
      const lowerText = cardText.toLowerCase();

      listings.push({
        title,
        listingUrl,
        imageUrl,
        price: parseNumber(priceText),
        currency: parseCurrency(priceText),
        reviewCount: parseReviewCount(reviewText),
        rating: parseNumber(ratingLabel),
        shopName,
        isBestSeller: lowerText.includes('best seller') || lowerText.includes('bestseller'),
        hasFreeShipping: lowerText.includes('free shipping') || lowerText.includes('livraison gratuite'),
      });
    }

    const bodyText = (document.body?.innerText || '').replace(/\s+/g, ' ');
    const marketMatch = bodyText.match(/(\d[\d,.\s]{1,15})\s+results/i);
    const marketSizeEstimate = marketMatch ? Number((marketMatch[1] || '').replace(/\D/g, '')) || null : null;

    return { listings, pageText: bodyText.slice(0, 12000), marketSizeEstimate, usedSelector: null };
  }, maxListings);
}

export async function scrapeEtsyWithZenRowsBrowser(
  keyword: string,
  maxListings: number = MAX_LISTINGS_DEFAULT
): Promise<{
  sourceUrl: string;
  listings: EtsyKeywordListing[];
  marketSizeEstimate: number | null;
}> {
  const wsUrl = process.env.ZENROWS_BROWSER_WS_URL;
  if (!wsUrl) {
    throw new ZenRowsScrapeError('CONNECTION_FAILED', 'ZENROWS_BROWSER_WS_URL missing');
  }

  const sourceUrl = `https://www.etsy.com/search?q=${encodeURIComponent(keyword.trim())}`;
  const runId = `zen-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  return withRetry(
    async (attempt) => {
      let browser: Browser | null = null;
      let context: BrowserContext | null = null;
      let page: Page | null = null;
      const startedAt = Date.now();

      // #region agent log
      await emitRuntimeDebugLog({
        runId,
        hypothesisId: 'H1_CONNECTION',
        location: 'zenrowsBrowser.ts:scrapeEtsyWithZenRowsBrowser:start',
        message: 'ZenRows tentative started',
        data: { attempt, sourceUrl },
      });
      // #endregion

      try {
        const attemptWsUrl = buildZenRowsWsUrl(wsUrl, attempt);
        // #region agent log
        await emitRuntimeDebugLog({
          runId,
          hypothesisId: 'H6_PROXY_PARAMS',
          location: 'zenrowsBrowser.ts:scrapeEtsyWithZenRowsBrowser:ws-url',
          message: 'ZenRows WS URL prepared',
          data: {
            attempt,
            hasProxyCountry: attemptWsUrl.includes('proxy_country='),
            hasPremiumProxy: attemptWsUrl.includes('proxy_premium='),
            hasSessionId: attemptWsUrl.includes('session_id='),
            wsUrlUnchanged: attemptWsUrl === wsUrl,
          },
        });
        // #endregion
        browser = await chromium.connectOverCDP(attemptWsUrl, { timeout: NAV_TIMEOUT_MS });
        context = await browser.newContext({
          userAgent: DEFAULT_USER_AGENT,
          locale: 'en-US',
          timezoneId: 'America/New_York',
          viewport: { width: 1440, height: 980 },
          extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
        });
        await context.addInitScript(() => {
          Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
          Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
          Object.defineProperty(navigator, 'platform', { get: () => 'MacIntel' });
          Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
        });

        page = await context.newPage();
        page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);
        page.setDefaultTimeout(NAV_TIMEOUT_MS);

        const response = await page.goto(sourceUrl, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });
        const finalUrl = page.url();
        const title = await page.title();
        const responseStatus = response?.status() || null;
        const responseOk = Boolean(response?.ok());

        // #region agent log
        await emitRuntimeDebugLog({
          runId,
          hypothesisId: 'H2_PAGE_KIND',
          location: 'zenrowsBrowser.ts:scrapeEtsyWithZenRowsBrowser:goto-response',
          message: 'Navigation response snapshot',
          data: { attempt, responseStatus, responseOk, finalUrl, title },
        });
        // #endregion

        if (!response || !response.ok()) {
          const html403 = await page.content().catch(() => '');
          const text403 = await page
            .evaluate(() => (document.body?.innerText || '').replace(/\s+/g, ' ').slice(0, 12000))
            .catch(() => '');
          const blockedCode = classifyFailure({
            html: html403,
            pageText: text403,
            listingsCount: 0,
            selectorUsed: null,
            errorMessage: `status-${responseStatus}`,
          });
          const artifacts403 = await persistArtifacts({
            runId,
            attempt,
            page,
            html: html403,
            pageText: text403,
            reason: blockedCode,
            title,
            finalUrl,
          });

          // #region agent log
          await emitRuntimeDebugLog({
            runId,
            hypothesisId: 'H2_PAGE_KIND',
            location: 'zenrowsBrowser.ts:scrapeEtsyWithZenRowsBrowser:goto-non-ok',
            message: 'Navigation returned non-ok response',
            data: {
              attempt,
              responseStatus,
              finalUrl,
              title,
              classifiedAs: blockedCode,
              artifacts: artifacts403,
              bodyPreview: safeSnippet(text403, 600),
            },
          });
          // #endregion

          throw new ZenRowsScrapeError('NAVIGATION_FAILED', 'Navigation response invalid', {
            status: responseStatus,
            finalUrl,
            title,
            classifiedAs: blockedCode,
            artifacts: artifacts403,
          });
        }

        await page.waitForTimeout(1200);
        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
        const selectorData = await waitForListings(page);

        // #region agent log
        await emitRuntimeDebugLog({
          runId,
          hypothesisId: 'H2_PAGE_KIND',
          location: 'zenrowsBrowser.ts:scrapeEtsyWithZenRowsBrowser:post-nav',
          message: 'Navigation completed',
          data: {
            attempt,
            finalUrl,
            title,
            selectorUsed: selectorData.selectorUsed,
            loadMs: Date.now() - startedAt,
          },
        });
        // #endregion

        const html = await page.content();
        const extracted = await extractListingsFromPage(page, Math.min(12, Math.max(3, maxListings)));
        const pageText = extracted.pageText || '';
        const listingsCount = extracted.listings.length;
        const failureCode = classifyFailure({
          html,
          pageText,
          listingsCount,
          selectorUsed: selectorData.selectorUsed,
        });

        // #region agent log
        await emitRuntimeDebugLog({
          runId,
          hypothesisId: 'H3_SELECTORS',
          location: 'zenrowsBrowser.ts:scrapeEtsyWithZenRowsBrowser:extract',
          message: 'Extraction metrics',
          data: {
            attempt,
            listingsCount,
            selectorUsed: selectorData.selectorUsed,
            failureCodeCandidate: failureCode,
          },
        });
        // #endregion

        const blocked = detectBlockedPage({ html, textContent: pageText, listingsCount });
        const consent = hasConsentWall(pageText);
        if (blocked || consent || !selectorData.selectorUsed || !isKeywordListingPayloadValid(extracted.listings.map((x, i) => toKeywordListing(x, i + 1)))) {
          const reason = blocked
            ? 'PAGE_BLOCKED'
            : consent
            ? 'CONSENT_WALL'
            : !selectorData.selectorUsed
            ? 'SELECTOR_NOT_FOUND'
            : listingsCount <= 0
            ? 'EMPTY_RESULTS'
            : 'INVALID_HTML';

          const artifacts = await persistArtifacts({
            runId,
            attempt,
            page,
            html,
            pageText,
            reason,
            title,
            finalUrl,
          });

          // #region agent log
          await emitRuntimeDebugLog({
            runId,
            hypothesisId: 'H4_VALIDATION',
            location: 'zenrowsBrowser.ts:scrapeEtsyWithZenRowsBrowser:failure',
            message: 'Attempt failed with classified reason',
            data: {
              attempt,
              reason,
              finalUrl,
              title,
              listingsCount,
              selectorUsed: selectorData.selectorUsed,
              artifacts,
              bodyPreview: safeSnippet(pageText, 600),
            },
          });
          // #endregion

          throw new ZenRowsScrapeError(reason as ZenRowsFailureCode, `ZenRows attempt failed: ${reason}`, {
            attempt,
            finalUrl,
            title,
            listingsCount,
            selectorUsed: selectorData.selectorUsed,
            artifacts,
          });
        }

        if (DEBUG_ENABLED) {
          await persistArtifacts({
            runId,
            attempt,
            page,
            html,
            pageText,
            reason: 'SUCCESS',
            title,
            finalUrl,
          });
        }

        const listings = extracted.listings.map((listing, index) => toKeywordListing(listing, index + 1));
        return { sourceUrl, listings, marketSizeEstimate: extracted.marketSizeEstimate };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const code =
          error instanceof ZenRowsScrapeError
            ? error.code
            : classifyFailure({
                html: '',
                pageText: '',
                listingsCount: 0,
                selectorUsed: null,
                errorMessage: message,
              });

        // #region agent log
        await emitRuntimeDebugLog({
          runId,
          hypothesisId: 'H1_CONNECTION',
          location: 'zenrowsBrowser.ts:scrapeEtsyWithZenRowsBrowser:catch',
          message: 'Attempt exception',
          data: { attempt, code, error: message },
        });
        // #endregion

        throw error instanceof ZenRowsScrapeError
          ? error
          : new ZenRowsScrapeError(code, message, { attempt });
      } finally {
        let pageClosed = false;
        let contextClosed = false;
        let browserClosed = false;
        try {
          await page?.close();
          pageClosed = true;
        } catch {}
        try {
          await context?.close();
          contextClosed = true;
        } catch {}
        try {
          await browser?.close();
          browserClosed = true;
        } catch {}

        // #region agent log
        await emitRuntimeDebugLog({
          runId,
          hypothesisId: 'H5_RESOURCE_CLOSE',
          location: 'zenrowsBrowser.ts:scrapeEtsyWithZenRowsBrowser:finally',
          message: 'Resources close status',
          data: { attempt, pageClosed, contextClosed, browserClosed },
        });
        // #endregion
      }
    },
    {
      retries: 3,
      delayMs: 1200,
      factor: 1.6,
      shouldRetry: (_attempt, error) => {
        if (!(error instanceof ZenRowsScrapeError)) return true;
        if (error.code === 'CONNECTION_FAILED') return false;
        if (error.code === 'NAVIGATION_FAILED') {
          const status = Number((error.details?.status as number) || 0);
          if (status === 403) return false;
        }
        return true;
      },
      onRetry: (attempt, error) => {
        const msg = error instanceof Error ? error.message : String(error);
        console.warn(`[ZENROWS_BROWSER] Retry after attempt ${attempt}: ${msg}`);
      },
    }
  );
}

export async function scrapeEtsyPageHtmlWithZenRowsBrowser(url: string): Promise<string> {
  const wsUrl = process.env.ZENROWS_BROWSER_WS_URL;
  if (!wsUrl) throw new ZenRowsScrapeError('CONNECTION_FAILED', 'ZENROWS_BROWSER_WS_URL missing');

  return withRetry(
    async () => {
      let browser: Browser | null = null;
      let context: BrowserContext | null = null;
      let page: Page | null = null;
      try {
        const attemptWsUrl = buildZenRowsWsUrl(wsUrl, 1);
        browser = await chromium.connectOverCDP(attemptWsUrl, { timeout: NAV_TIMEOUT_MS });
        context = await browser.newContext({
          userAgent: DEFAULT_USER_AGENT,
          locale: 'en-US',
          timezoneId: 'America/New_York',
          viewport: { width: 1440, height: 980 },
          extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
        });
        await context.addInitScript(() => {
          Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
          Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
        });
        page = await context.newPage();
        const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });
        if (!response || !response.ok()) {
          throw new ZenRowsScrapeError('NAVIGATION_FAILED', `Navigation invalid (${response?.status() || 'unknown'})`);
        }
        await page.waitForTimeout(1000);
        await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => null);
        const html = await page.content();
        if (!html || html.length < 1200) {
          throw new ZenRowsScrapeError('INVALID_HTML', 'ZenRows HTML payload invalid');
        }
        return html;
      } finally {
        try {
          await page?.close();
        } catch {}
        try {
          await context?.close();
        } catch {}
        try {
          await browser?.close();
        } catch {}
      }
    },
    { retries: 2, delayMs: 1000 }
  );
}
