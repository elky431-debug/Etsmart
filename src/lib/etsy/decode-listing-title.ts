/**
 * Titres issus du JSON/HTML Etsy (apostrophes échappées, etc.).
 * Module autonome : importable côté client sans tirer playwright / scrape.
 */
export function decodeListingTitleEntities(title: string): string {
  return title
    .replace(/\\&#39;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}
