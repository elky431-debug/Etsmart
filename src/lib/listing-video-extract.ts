/**
 * Vidéo listing Etsy depuis Apify / payloads hétérogènes (clés plates + objets imbriqués).
 * Etsy expose souvent une URL HLS (.m3u8) ou un objet listingVideo sans champ unique.
 */

const URL_KEYS = [
  'videoUrl',
  'listingVideoUrl',
  'mediaVideoUrl',
  'videoSrc',
  'src',
  'url',
  'hlsUrl',
  'playbackUrl',
  'mp4Url',
  'previewUrl',
] as const;

const NESTED = ['listing', 'product', 'data', 'item', 'metadata', 'result', 'page', 'payload', 'media', 'listingVideo'] as const;

function isVideoUrl(s: string): boolean {
  const t = s.trim();
  if (!/^https?:\/\//i.test(t)) return false;
  if (/\.m3u8(\?|$)/i.test(t)) return true;
  if (/video|listingvideo|etsy.*video/i.test(t)) return true;
  if (/\.(mp4|webm|mov)(\?|$)/i.test(t)) return true;
  return false;
}

function firstUrlInRecord(rec: Record<string, unknown>): string | null {
  for (const key of Object.keys(rec)) {
    if (!/video|playback|hls|m3u8/i.test(key)) continue;
    const v = rec[key];
    if (typeof v === 'string' && /^https?:\/\//i.test(v.trim())) return v.trim();
  }
  for (const k of URL_KEYS) {
    const v = rec[k];
    if (typeof v === 'string' && isVideoUrl(v)) return v.trim();
  }
  const vid = rec.video;
  if (typeof vid === 'string' && isVideoUrl(vid)) return vid.trim();
  if (vid && typeof vid === 'object' && !Array.isArray(vid)) {
    const o = vid as Record<string, unknown>;
    for (const k of URL_KEYS) {
      const u = o[k];
      if (typeof u === 'string' && isVideoUrl(u)) return u.trim();
    }
  }
  return null;
}

function hasVideoFlag(rec: Record<string, unknown>): boolean {
  for (const k of ['hasVideo', 'has_listing_video', 'listingHasVideo', 'videoPresent', 'hasListingVideo']) {
    const v = rec[k];
    if (v === true) return true;
    if (v === 'true' || v === '1') return true;
  }
  return false;
}

function walk(rec: Record<string, unknown>, depth: number): { url: string | null; flag: boolean } {
  if (depth > 5) return { url: null, flag: false };
  const url = firstUrlInRecord(rec);
  let flag = hasVideoFlag(rec);
  if (url) return { url, flag: true };

  for (const nest of NESTED) {
    const inner = rec[nest];
    if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
      const w = walk(inner as Record<string, unknown>, depth + 1);
      if (w.url) return w;
      if (w.flag) flag = true;
    }
  }

  for (const v of Object.values(rec)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const w = walk(v as Record<string, unknown>, depth + 1);
      if (w.url) return w;
      if (w.flag) flag = true;
    }
  }

  return { url: null, flag };
}

export type ListingVideoExtract = {
  /** URL lisible si le scraper l’expose (souvent .m3u8). */
  url: string | null;
  /** Présence vidéo : URL détectée ou booléen explicite dans la payload. */
  hasVideo: boolean;
};

export function extractListingVideoFromItem(item: unknown): ListingVideoExtract {
  if (!item || typeof item !== 'object') return { url: null, hasVideo: false };
  const rec = item as Record<string, unknown>;
  const directUrl = firstUrlInRecord(rec);
  if (directUrl) return { url: directUrl, hasVideo: true };
  if (hasVideoFlag(rec)) return { url: null, hasVideo: true };

  const w = walk(rec, 0);
  if (w.url) return { url: w.url, hasVideo: true };
  if (w.flag) return { url: null, hasVideo: true };

  try {
    const blob = JSON.stringify(item);
    if (
      /"hasListingVideo"\s*:\s*true|hasListingVideo['"]?\s*:\s*true|listingVideoId['"]?\s*:\s*\d+/i.test(
        blob
      ) ||
      (/listing[_-]?video/i.test(blob) && (/m3u8|playback|videoUrl|hlsUrl/i.test(blob) || /"video"\s*:\s*\{/i.test(blob)))
    ) {
      return { url: null, hasVideo: true };
    }
  } catch {
    /* ignore */
  }

  return { url: null, hasVideo: false };
}
