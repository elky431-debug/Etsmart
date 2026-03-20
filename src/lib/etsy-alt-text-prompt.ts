/**
 * Single ALT text for Etsy product images (English). Used by /api/generate-alt-text
 */
export const ALT_TEXT_SINGLE_USER = `This is an Etsy-style product photo.

Write ONE alt text in English only:
- Describe only what is visible; no false claims.
- SEO-friendly: natural keywords, no stuffing; lead with the main product term when it reads well.
- Under ~140 characters; plain text (letters, numbers, spaces, commas, periods, hyphens, apostrophes only — no emojis, no quotes, no hashtags).
- "Handmade" only if the image clearly suggests craft/handmade and it helps SEO.

Reply with JSON only: {"altText":"your single alt text here"}`;

export const ALT_TEXT_SYSTEM =
  'You are an Etsy SEO and accessibility expert. Output only valid JSON with key "altText" (one string).';
