/**
 * Prix listing depuis une payload Apify / Etsy : privilégier le libellé affiché (ex. "Price")
 * avant les champs numériques, et éviter min/max de variations comme prix principal.
 */

function extractNumericPrice(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  if (typeof value === 'string') {
    const normalized = value.replace(/,/g, '.').replace(/[^0-9.]/g, '');
    const n = Number.parseFloat(normalized);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }
  if (value && typeof value === 'object') {
    const rec = value as Record<string, unknown>;
    for (const key of ['value', 'amount', 'price', 'min', 'minPrice']) {
      const n = extractNumericPrice(rec[key]);
      if (n > 0) return n;
    }
  }
  return 0;
}

/** Parse un prix type "$49.00+", "€36,32", "36,32 EUR". */
export function parsePriceFromText(raw: string): number {
  const s = raw.replace(/\u00a0/g, ' ').replace(/\+/g, '').trim();
  if (!s) return 0;
  const m = s.match(/(\d[\d.,]*)/);
  if (!m) return 0;
  let num = m[1];
  const lastComma = num.lastIndexOf(',');
  const lastDot = num.lastIndexOf('.');
  if (lastComma !== -1 && lastDot !== -1) {
    if (lastDot > lastComma) num = num.replace(/,/g, '');
    else num = num.replace(/\./g, '').replace(',', '.');
  } else if (lastComma !== -1) {
    const parts = num.split(',');
    if (parts.length === 2 && parts[1].length <= 2) num = num.replace(',', '.');
    else num = num.replace(/,/g, '');
  }
  const n = Number.parseFloat(num);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

const DISPLAY_STRING_KEYS = [
  'Price',
  'formattedPrice',
  'priceFormatted',
  'priceDisplay',
  'priceText',
  'displayPrice',
  'priceString',
  'listingPrice',
] as const;

/** Champs numériques « prix courant » (pas fourchette variation). */
const PRIMARY_NUMERIC_KEYS = ['price', 'productPrice', 'salePrice', 'currentPrice', 'regularPrice'] as const;

const FALLBACK_NUMERIC_KEYS = ['minPrice', 'maxPrice'] as const;

const NESTED = ['listing', 'product', 'data', 'item', 'metadata', 'result', 'page'] as const;

function pickCurrencyHint(rec: Record<string, unknown>): string {
  const c =
    typeof rec.currencyCode === 'string'
      ? rec.currencyCode
      : typeof rec.currency === 'string'
        ? rec.currency
        : typeof rec.priceCurrency === 'string'
          ? rec.priceCurrency
          : '';
  return c.trim();
}

function formatAmountForDisplay(n: number, rec: Record<string, unknown>): string {
  const cur = pickCurrencyHint(rec).toUpperCase();
  if (cur === 'EUR' || cur === '€') {
    return `${n.toFixed(2).replace('.', ',')} €`;
  }
  if (cur === 'USD' || cur === 'US$') {
    return `$${n.toFixed(2)}`;
  }
  if (cur === 'GBP' || cur === '£') {
    return `£${n.toFixed(2)}`;
  }
  if (cur) return `${n.toFixed(2)} ${cur}`;
  return n.toFixed(2);
}

export type ListingPriceExtract = {
  amount: number;
  /** Libellé à afficher en priorité (souvent identique à la fiche Etsy). */
  display: string;
};

function extractFromRecord(rec: Record<string, unknown>, depth: number): ListingPriceExtract {
  if (depth > 4) return { amount: 0, display: '' };

  for (const key of DISPLAY_STRING_KEYS) {
    const v = rec[key];
    if (typeof v === 'string' && v.trim()) {
      const t = v.trim();
      const n = parsePriceFromText(t);
      if (n > 0) return { amount: n, display: t };
    }
  }

  for (const key of PRIMARY_NUMERIC_KEYS) {
    const n = extractNumericPrice(rec[key]);
    if (n > 0) return { amount: n, display: formatAmountForDisplay(n, rec) };
  }

  if (depth < 3) {
    for (const nest of NESTED) {
      const inner = rec[nest];
      if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
        const got = extractFromRecord(inner as Record<string, unknown>, depth + 1);
        if (got.amount > 0) return got;
      }
    }
  }

  for (const key of FALLBACK_NUMERIC_KEYS) {
    const n = extractNumericPrice(rec[key]);
    if (n > 0) return { amount: n, display: formatAmountForDisplay(n, rec) };
  }

  return { amount: 0, display: '' };
}

export function extractListingPriceFromItem(item: unknown): ListingPriceExtract {
  if (!item || typeof item !== 'object') return { amount: 0, display: '' };
  return extractFromRecord(item as Record<string, unknown>, 0);
}
