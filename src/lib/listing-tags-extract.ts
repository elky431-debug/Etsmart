/**
 * Extraction des tags Etsy depuis une payload Apify / scraper (clés plates + objets imbriqués).
 * Ne déduit jamais les tags à partir du titre — ce n’est pas la liste officielle Etsy.
 */

function normalizeTag(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 20);
}

export function tagsFromUnknown(value: unknown): string[] {
  const out: string[] = [];
  if (Array.isArray(value)) {
    for (const v of value) {
      if (typeof v === 'string' && v.trim()) out.push(normalizeTag(v));
      else if (v && typeof v === 'object') {
        const rec = v as Record<string, unknown>;
        const s = rec.tag ?? rec.name ?? rec.keyword ?? rec.value ?? rec.text;
        if (typeof s === 'string' && s.trim()) out.push(normalizeTag(s));
      }
    }
  } else if (typeof value === 'string' && value.trim()) {
    for (const p of value.split(/[,\n|]/g)) {
      if (p.trim()) out.push(normalizeTag(p));
    }
  }
  return [...new Set(out)].filter((t) => t.length >= 2).slice(0, 13);
}

/** Clés où l’actor / Etsy expose souvent les tags (pas materials / attributes). */
const TAG_FIELD_KEYS = [
  'tags',
  'tag',
  'keywords',
  'keyword',
  'searchKeywords',
  'search_terms',
  'seoTags',
  'listingTags',
  'etsyTags',
  'productTags',
  'hashtags',
] as const;

const NESTED_OBJECTS = [
  'listing',
  'product',
  'data',
  'item',
  'metadata',
  'seo',
  'result',
  'page',
  'payload',
] as const;

function extractListingTagsFromRecord(rec: Record<string, unknown>, depth: number): string[] {
  if (depth > 4) return [];

  for (const key of TAG_FIELD_KEYS) {
    const fromKey = tagsFromUnknown(rec[key]);
    if (fromKey.length > 0) return fromKey;
  }

  if (depth < 3) {
    for (const nest of NESTED_OBJECTS) {
      const n = rec[nest];
      if (n && typeof n === 'object' && !Array.isArray(n)) {
        const inner = extractListingTagsFromRecord(n as Record<string, unknown>, depth + 1);
        if (inner.length > 0) return inner;
      }
    }
  }

  return [];
}

export function extractListingTagsFromItem(item: unknown): string[] {
  if (!item || typeof item !== 'object') return [];
  return extractListingTagsFromRecord(item as Record<string, unknown>, 0);
}
