const MAX_LEN = 400;

/**
 * UI + API : mots-clés / style pour le listing (génération rapide, onglet Listing).
 * Activé par défaut en prod et en local.
 * Pour masquer complètement : `NEXT_PUBLIC_LISTING_KEYWORD_HINTS=0` (ou `false` / `off`) au build.
 */
export function listingKeywordHintsEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_LISTING_KEYWORD_HINTS?.trim().toLowerCase();
  if (v === '0' || v === 'false' || v === 'off' || v === 'no') return false;
  return true;
}

/**
 * Extrait les hints « style / mots-clés » du body JSON.
 */
export function listingKeywordHintsFromRequestBody(body: unknown): string {
  if (!listingKeywordHintsEnabled() || body == null || typeof body !== 'object') return '';
  const raw = (body as { listingKeywordHints?: unknown }).listingKeywordHints;
  if (typeof raw !== 'string') return '';
  const t = raw
    .replace(/\r\n/g, '\n')
    .trim()
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ');
  if (!t) return '';
  return t.slice(0, MAX_LEN);
}

/**
 * Bloc à ajouter aux prompts listing (anglais). `hints` déjà sanités / tronqués.
 */
export function listingKeywordHintsPromptAppendix(hints: string): string {
  if (!hints) return '';
  const safe = hints.replace(/\\/g, '\\\\').replace(/`/g, "'");
  return `

SELLER KEYWORD / STYLE HINTS (mandatory integration when this block is present):
The seller specified themes, eras, aesthetics, or phrases they want reflected in the Etsy listing. Integrate them naturally into the description (tone and hooks), the SEO title where appropriate, and several tags as real Etsy search phrases (respect tag length limits). Do not keyword-stuff. If a hint does not fit the product as described or shown, skip that hint rather than inventing claims.
Seller hints: ${safe}`;
}
