/**
 * Brief logo Etsy — analyse bannière + produit, puis prompt pour le modèle image.
 * Utilisé par /api/generate-logo (100 % côté serveur / “local” au SaaS).
 */

export const LOGO_BRIEF_SYSTEM = `You are a senior Etsy brand identity and logo direction assistant.

Your task is to analyze two user-provided images:
1. a shop banner screenshot
2. a product screenshot

Your goal is NOT to generate the final image directly.
Your goal is to create a precise logo design brief for an image generation model.

You must identify:
- the brand style
- the product category
- the likely target audience
- the visual mood
- the color palette suggested by the banner/product
- the hero subject and how it should read inside a premium emblem
- what should be avoided

The logo must:
- contain NO text, NO letters, NO numbers, NO watermarks, NO brand name
- be a RICH, DETAILED illustration — not a flat single-color silhouette or generic clip-art icon
- prefer a circular emblem / ornate badge / medallion layout: clear outer boundary (rope, filigree, metal rim, laurel, subtle jewels) with a focused subject inside
- use depth: soft shading, highlights, material realism (metal, glass, crystal, ceramic, wood, fabric) where it matches the shop
- stay legible as an Etsy shop icon: one clear focal subject, strong outer silhouette, avoid micro-details smaller than ~2% of the frame
- work well for Etsy branding and match both banner and product aesthetics
- avoid full-bleed “website screenshot” or unrelated wide scenes; the scene (if any) must be CONTAINED inside the circular emblem only
- avoid mockup frames (phone, laptop), UI chrome, and photorealistic product packshots pasted as-is

Etsy shop icons are SQUARE. The generated image must be a full 1:1 square where the OUTER CANVAS (the whole image, edge to edge) uses a background color or very soft gradient that harmonizes with the shop palette — NOT default white, NOT plain #FFFFFF, unless the brand is explicitly high-contrast white luxury. Prefer warm neutrals, deep jewel tones, muted charcoal with warm undertone, soft champagne, dusty rose, etc., matching the banner/products.

Return your answer in the following JSON format only:

{
  "brand_style": "",
  "product_category": "",
  "target_audience": "",
  "visual_mood": "",
  "suggested_palette": ["", "", ""],
  "square_background": "",
  "square_background_hex": "",
  "logo_direction": "",
  "main_symbol_ideas": ["", "", ""],
  "constraints": [
    "no text",
    "detailed illustrative emblem",
    "circular badge with decorative border",
    "rich materials and lighting",
    "etsy-friendly shop icon",
    "centered composition",
    "full square canvas filled with harmonious brand-colored background"
  ],
  "negative_constraints": ["", "", ""],
  "final_image_prompt": ""
}

The field "square_background" must briefly describe the ideal fill for the entire square (e.g. "warm deep champagne solid" or "soft gradient from burnt umber to antique gold").
The field "square_background_hex" must be a single 6-digit hex color WITHOUT # that best matches that fill (e.g. C9B8A4) — chosen from the banner/product mood, not white.

The field "final_image_prompt" must be a single high-quality prompt ready to send to an image generation model.
It must be specific and optimized for a PREMIUM, DETAILED circular emblem logo (painterly or refined digital illustration), not a minimalist flat icon, AND must state that the full square frame is filled with the harmonious background (no white matting).`;

export const LOGO_BRIEF_USER =
  'Analyze the two attached images: (1) shop banner screenshot, (2) product screenshot. Output ONLY valid JSON matching the schema from your instructions — no markdown, no code fences.';

export type LogoDesignBrief = {
  brand_style?: string;
  product_category?: string;
  target_audience?: string;
  visual_mood?: string;
  suggested_palette?: string[];
  /** Description du fond sur tout le carré 1:1 (harmonisé à la boutique) */
  square_background?: string;
  /** Hex 6 caractères, avec ou sans # */
  square_background_hex?: string;
  logo_direction?: string;
  main_symbol_ideas?: string[];
  constraints?: string[];
  negative_constraints?: string[];
  final_image_prompt?: string;
};

function normalizeHex6(raw: string | undefined): string | null {
  const s = String(raw || '')
    .trim()
    .replace(/^#/, '');
  if (/^[0-9a-fA-F]{6}$/.test(s)) return s.toUpperCase();
  return null;
}

/** RGB pour letterboxing / aplats — dérivé du brief ou neutre chaud par défaut */
export function briefBackgroundRgb(brief: LogoDesignBrief): { r: number; g: number; b: number } {
  const h = normalizeHex6(brief.square_background_hex);
  if (!h) return { r: 201, g: 184, b: 164 };
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function buildImageGenerationPromptFromBrief(brief: LogoDesignBrief): string {
  const core = String(brief.final_image_prompt || '').trim();
  const palette = Array.isArray(brief.suggested_palette)
    ? brief.suggested_palette.filter(Boolean).join(', ')
    : '';
  const avoid = Array.isArray(brief.negative_constraints)
    ? brief.negative_constraints.filter(Boolean).join('; ')
    : '';
  const keep = Array.isArray(brief.constraints) ? brief.constraints.filter(Boolean).join('; ') : '';
  const direction = String(brief.logo_direction || '').trim();
  const ideas = Array.isArray(brief.main_symbol_ideas)
    ? brief.main_symbol_ideas.filter(Boolean).slice(0, 3).join(' | ')
    : '';
  const bgDesc = String(brief.square_background || '').trim();
  const bgHex = normalizeHex6(brief.square_background_hex);

  const parts = [
    core,
    direction && `Logo direction: ${direction}`,
    ideas && `Symbol ideas: ${ideas}`,
    palette && `Palette: ${palette}`,
    bgDesc && `Full square canvas (Etsy 1:1): edge-to-edge background — ${bgDesc}. No white mat, no plain white (#FFFFFF) fill, no transparent corners.`,
    bgHex &&
      `Background: cover the entire square with this approximate solid or softly vignetted color as base: #${bgHex} (harmonize emblem lighting with this field).`,
    keep && `Must: ${keep}`,
    avoid && `Avoid: ${avoid}`,
    'Style: premium circular emblem / ornate badge, highly detailed illustration with depth, textures, and careful lighting — not flat minimalist vector, not a single flat silhouette.',
    'Composition: strictly square aspect ratio; emblem centered; outer field is the harmonious brand background filling 100% of the image — no device mockups, no UI.',
    'Hard rules: absolutely no text, no letters, no numbers, no watermark, no typography.',
  ].filter(Boolean);

  let combined = parts.join('\n');
  if (combined.length > 3500) combined = combined.slice(0, 3500);
  return combined;
}
