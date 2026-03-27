const MAX_LEN = 400;

export function listingKeywordHintsDevEnabled(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Extrait les hints « style / mots-clés » du body JSON.
 * En prod, toujours chaîne vide (ignoré même si le client envoie un champ).
 */
export function listingKeywordHintsFromRequestBody(body: unknown): string {
  if (!listingKeywordHintsDevEnabled() || body == null || typeof body !== 'object') return '';
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
