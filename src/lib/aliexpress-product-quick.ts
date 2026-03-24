/**
 * Récupération rapide des infos produit AliExpress.
 * 1) API JSON aeglobal (souvent bloquée côté serveur → HTML 404 au lieu de JSON)
 * 2) Fallback : page article (shell CSR) → og:title, og:image, window._d_c_.DCData (images)
 */

const QUICK_FETCH_MS = 4500;
const ITEM_PAGE_FETCH_MS = 6500;

const JSON_HEADERS: Record<string, string> = {
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
  Referer: 'https://www.aliexpress.com/',
  Origin: 'https://www.aliexpress.com',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
};

const HTML_HEADERS: Record<string, string> = {
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
  Referer: 'https://www.aliexpress.com/',
  'Upgrade-Insecure-Requests': '1',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
};

export function extractAliExpressProductIdQuick(url: string): string | null {
  const cleanUrl = decodeURIComponent(url.trim());
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

type QuickProduct = {
  id: string;
  url: string;
  source: 'aliexpress';
  title: string;
  description: string;
  images: string[];
  price: number;
  currency: string;
  variants: { id: string; name: string; price: number }[];
  category: string;
  shippingTime: string;
  minOrderQuantity: number;
  supplierRating: number;
  createdAt: string;
};

function searchForPrice(obj: unknown, depth = 0): number {
  if (depth > 5 || obj == null) return 0;
  if (typeof obj !== 'object') return 0;
  const record = obj as Record<string, unknown>;
  const priceFields = ['price', 'amount', 'value', 'cost', 'minPrice', 'maxPrice', 'minAmount', 'maxAmount'];
  for (const field of priceFields) {
    const v = record[field];
    if (typeof v === 'number' && v > 0 && v < 100_000) return v;
    if (typeof v === 'string') {
      const num = parseFloat(v.replace(/[^0-9.]/g, ''));
      if (num > 0 && num < 100_000) return num;
    }
    if (typeof v === 'object' && v !== null) {
      const nested = searchForPrice(v, depth + 1);
      if (nested > 0) return nested;
    }
  }
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = searchForPrice(item, depth + 1);
      if (found > 0) return found;
    }
  } else {
    for (const key of Object.keys(record)) {
      const v = record[key];
      if (typeof v === 'object' && v !== null) {
        const found = searchForPrice(v, depth + 1);
        if (found > 0) return found;
      }
    }
  }
  return 0;
}

/** Déballage récursif data / result / data string JSON (formats Mtop / aeglobal variables). */
function deepUnwrapPayload(obj: unknown, depth = 0): Record<string, unknown> | null {
  if (depth > 12 || obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    return Array.isArray(obj) ? null : (obj as Record<string, unknown>);
  }
  const cur = obj as Record<string, unknown>;

  if (typeof cur.data === 'string') {
    const s = cur.data.trim();
    if (s.startsWith('{') || s.startsWith('[')) {
      try {
        return deepUnwrapPayload(JSON.parse(s) as unknown, depth + 1);
      } catch {
        /* ignore */
      }
    }
  }

  if (cur.data !== undefined && cur.data !== null && typeof cur.data === 'object') {
    const next = deepUnwrapPayload(cur.data, depth + 1);
    if (next && Object.keys(next).length > 0) return next;
  }

  if (
    cur.result !== undefined &&
    cur.result !== null &&
    typeof cur.result === 'object' &&
    !Array.isArray(cur.result)
  ) {
    const next = deepUnwrapPayload(cur.result, depth + 1);
    if (next && Object.keys(next).length > 0) return next;
  }

  return cur;
}

/** Extrait titre / prix / images depuis la réponse JSON aeglobal (structure variable). */
export function mapAliExpressDetailJsonToProduct(
  data: Record<string, unknown>,
  productId: string,
  originalUrl: string
): QuickProduct | null {
  try {
    const result =
      deepUnwrapPayload(data) ??
      ((data?.data ?? data?.result ?? data) as Record<string, unknown>);

    const productInfoComponent = result.productInfoComponent as { subject?: string } | undefined;
    const titleModule = result.titleModule as { subject?: string } | undefined;
    const pageModule = result.pageModule as { title?: string } | undefined;

    const title =
      productInfoComponent?.subject ||
      titleModule?.subject ||
      pageModule?.title ||
      (typeof result.title === 'string' ? result.title : undefined) ||
      (typeof result.subject === 'string' ? result.subject : undefined);

    if (!title || String(title).length < 3) return null;

    const priceModule = result.priceModule as
      | {
          minAmount?: { value?: number };
          formatedActivityPrice?: string;
          minActivityAmount?: { value?: number };
        }
      | undefined;
    const priceComponent = result.priceComponent as
      | {
          discountPrice?: { minPrice?: number };
          originalPrice?: { minPrice?: number };
        }
      | undefined;

    let price = 0;
    if (priceModule?.minAmount?.value) {
      price = priceModule.minAmount.value;
    } else if (priceModule?.formatedActivityPrice) {
      const priceStr = priceModule.formatedActivityPrice;
      const patterns = [/[\d.]+/, /\$?\s*([\d.]+)/, /([\d,]+\.?\d*)/];
      for (const pattern of patterns) {
        const match = priceStr.match(pattern);
        if (match) {
          const numStr = (match[1] || match[0]).replace(/,/g, '');
          price = parseFloat(numStr);
          if (price > 0) break;
        }
      }
    } else if (priceModule?.minActivityAmount?.value) {
      price = priceModule.minActivityAmount.value;
    } else if (priceComponent?.discountPrice?.minPrice) {
      price = priceComponent.discountPrice.minPrice;
    } else if (priceComponent?.originalPrice?.minPrice) {
      price = priceComponent.originalPrice.minPrice;
    } else if (result.price && typeof result.price === 'object' && result.price !== null) {
      const p = result.price as { min?: number };
      price = p.min || 0;
    } else {
      price = searchForPrice(result);
    }

    let images: string[] = [];
    const imageModule = result.imageModule as { imagePathList?: string[] } | undefined;
    const imageComponent = result.imageComponent as { imageList?: Array<{ url?: string }> } | undefined;
    if (imageModule?.imagePathList?.length) {
      images = imageModule.imagePathList.map((img) => (img.startsWith('//') ? `https:${img}` : img));
    } else if (imageComponent?.imageList?.length) {
      images = imageComponent.imageList
        .map((img) => {
          const u = img?.url || '';
          return u.startsWith('//') ? `https:${u}` : u;
        })
        .filter(Boolean);
    } else if (Array.isArray(result.images)) {
      images = (result.images as string[]).map((img) => (img.startsWith('//') ? `https:${img}` : img));
    }

    let rating = 4.5;
    const feedbackModule = result.feedbackModule as { averageStar?: number; evarageStar?: number } | undefined;
    if (feedbackModule?.averageStar) rating = feedbackModule.averageStar;
    else if (feedbackModule?.evarageStar) rating = feedbackModule.evarageStar;

    let shippingTime = '15-30 days';
    const shippingModule = result.shippingModule as {
      generalFreightInfo?: { deliveryDayMin?: number; deliveryDayMax?: number };
    } | undefined;
    if (shippingModule?.generalFreightInfo) {
      const min = shippingModule.generalFreightInfo.deliveryDayMin ?? 15;
      const max = shippingModule.generalFreightInfo.deliveryDayMax ?? 30;
      shippingTime = `${min}-${max} days`;
    }

    return {
      id: `aliexpress-${productId}`,
      url: originalUrl,
      source: 'aliexpress',
      title: String(title).slice(0, 200),
      description: String(title),
      images: images.length > 0 ? images.slice(0, 5) : ['https://via.placeholder.com/600x600?text=AliExpress'],
      price,
      currency: 'USD',
      variants: [{ id: 'v1', name: 'Standard', price }],
      category: 'General',
      shippingTime,
      minOrderQuantity: 1,
      supplierRating: rating,
      createdAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

async function fetchOneDetailEndpoint(url: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: JSON_HEADERS,
      signal: AbortSignal.timeout(QUICK_FETCH_MS),
      redirect: 'follow',
    });
    if (!res.ok) return null;
    const text = await res.text();
    const trimmed = text.trimStart();
    if (trimmed.startsWith('<') || trimmed.toLowerCase().startsWith('<!doctype')) {
      return null;
    }
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      return null;
    }
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Extrait un objet JSON équilibré à partir d'une position `{`. */
function extractBalancedJsonSlice(s: string, start: number): string | null {
  if (s[start] !== '{') return null;
  let depth = 0;
  let inStr = false;
  let quote = '';
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i]!;
    if (inStr) {
      if (esc) {
        esc = false;
        continue;
      }
      if (c === '\\') {
        esc = true;
        continue;
      }
      if (c === quote) {
        inStr = false;
        continue;
      }
      continue;
    }
    if (c === '"' || c === "'") {
      inStr = true;
      quote = c;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

function parseDcDataFromHtml(html: string): Record<string, unknown> | null {
  const marker = 'window._d_c_.DCData = ';
  const idx = html.indexOf(marker);
  if (idx === -1) return null;
  let i = idx + marker.length;
  while (i < html.length && /\s/.test(html[i]!)) i++;
  const slice = extractBalancedJsonSlice(html, i);
  if (!slice) return null;
  try {
    return JSON.parse(slice) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function titleFromAeThumbUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const seg = u.pathname.split('/').pop() || '';
    const base = seg.replace(/\.jpg.*$/i, '').replace(/\.jpeg.*$/i, '').replace(/\.png.*$/i, '');
    if (base.length < 10) return null;
    const decoded = decodeURIComponent(base.replace(/\+/g, ' '));
    return decoded.replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
  } catch {
    return null;
  }
}

/**
 * Fallback quand l'API aeglobal renvoie du HTML : shell CSR avec meta + DCData.
 * Le prix n'est souvent pas dans le HTML (chargé en JS) → price peut rester 0.
 */
export function mapAliExpressItemHtmlToProduct(
  html: string,
  productId: string,
  originalUrl: string
): QuickProduct | null {
  let title = '';

  const ogTitle =
    html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i) ||
    html.match(/<meta\s+content="([^"]+)"\s+property="og:title"/i);
  if (ogTitle?.[1]) title = ogTitle[1];

  if (!title) {
    const tw = html.match(/<meta\s+name="twitter:title"\s+content="([^"]+)"/i);
    if (tw?.[1]) title = tw[1];
  }

  const dc = parseDcDataFromHtml(html);
  const imagePathList = dc?.imagePathList;
  const summList = dc?.summImagePathList;
  const images: string[] = [];
  if (Array.isArray(imagePathList)) {
    for (const img of imagePathList) {
      if (typeof img === 'string' && img.startsWith('http')) images.push(img);
    }
  }

  if (!title && Array.isArray(summList) && typeof summList[0] === 'string') {
    const fromSlug = titleFromAeThumbUrl(summList[0]);
    if (fromSlug) title = fromSlug;
  }

  // runParams historique (souvent vide sur les pages CSR récentes)
  if (!title || title.length < 3) {
    const runParamsMatch = html.match(/window\.runParams\s*=\s*\{[\s\S]*?"data"\s*:\s*(\{[\s\S]*?\})\s*\}/);
    if (runParamsMatch?.[1]) {
      const dataStr = runParamsMatch[1];
      const titleMatch = dataStr.match(/"subject"\s*:\s*"([^"]+)"/);
      if (titleMatch?.[1]) title = titleMatch[1];
      if (images.length === 0) {
        const imagesMatch = dataStr.match(/"imagePathList"\s*:\s*\[([\s\S]*?)\]/);
        if (imagesMatch?.[1]) {
          const imgUrls = imagesMatch[1].match(/"([^"]+)"/g);
          if (imgUrls) {
            for (const u of imgUrls) {
              const cleanUrl = u.replace(/"/g, '');
              const full = cleanUrl.startsWith('//') ? `https:${cleanUrl}` : cleanUrl;
              if (full.includes('alicdn.com')) images.push(full);
            }
          }
        }
      }
    }
  }

  if (!title || title.length < 3) {
    const tMatch = html.match(/<title>([^<]+)<\/title>/i);
    if (tMatch?.[1]) {
      title = tMatch[1].split('|')[0].split('-')[0].trim();
    }
  }

  title = title
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s*[-|]\s*AliExpress.*$/i, '')
    .replace(/\s*[-|]\s*Alibaba.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!title || title.length < 3) return null;

  let price = searchForPrice(dc);

  if (images.length === 0) {
    const ogImage =
      html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i) ||
      html.match(/<meta\s+content="([^"]+)"\s+property="og:image"/i);
    if (ogImage?.[1]) {
      let imgUrl = ogImage[1];
      if (imgUrl.startsWith('//')) imgUrl = `https:${imgUrl}`;
      images.push(imgUrl);
    }
  }

  return {
    id: `aliexpress-${productId}`,
    url: originalUrl,
    source: 'aliexpress',
    title: title.slice(0, 200),
    description: title,
    images: images.length > 0 ? images.slice(0, 5) : ['https://via.placeholder.com/600x600?text=AliExpress'],
    price,
    currency: 'USD',
    variants: [{ id: 'v1', name: 'Standard', price }],
    category: 'General',
    shippingTime: '15-30 days',
    minOrderQuantity: 1,
    supplierRating: 4.5,
    createdAt: new Date().toISOString(),
  };
}

async function fetchItemPageHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: HTML_HEADERS,
      signal: AbortSignal.timeout(ITEM_PAGE_FETCH_MS),
      redirect: 'follow',
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/**
 * Essaie l'API JSON puis les pages article (www + fr).
 */
export async function fetchAliExpressProductQuick(originalUrl: string): Promise<QuickProduct | null> {
  const productId = extractAliExpressProductIdQuick(originalUrl);
  if (!productId) return null;

  const endpoints = [
    `https://www.aliexpress.com/aeglobal/api/web/product/detail?productId=${productId}&country=FR&locale=fr_FR`,
    `https://www.aliexpress.com/aeglobal/api/web/product/detail?productId=${productId}&country=US&locale=en_US`,
    `https://www.aliexpress.com/aeglobal/api/web/product/detail?productId=${productId}&country=GB&locale=en_GB`,
  ];

  const jsonResults = await Promise.all(endpoints.map((u) => fetchOneDetailEndpoint(u)));

  for (const json of jsonResults) {
    if (!json) continue;
    const product = mapAliExpressDetailJsonToProduct(json, productId, originalUrl);
    if (product) return product;
  }

  const itemUrls = [
    `https://www.aliexpress.com/item/${productId}.html`,
    `https://fr.aliexpress.com/item/${productId}.html`,
  ];
  const htmlResults = await Promise.all(itemUrls.map((u) => fetchItemPageHtml(u)));

  for (const html of htmlResults) {
    if (!html) continue;
    const fromPage = mapAliExpressItemHtmlToProduct(html, productId, originalUrl);
    if (fromPage) return fromPage;
  }

  return null;
}
