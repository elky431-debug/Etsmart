/**
 * Styles d’ambiance visuelle (listing Etsy) — alignés sur une grille type “design aesthetic”.
 * Utilisés par la génération rapide, l’onglet Image et /api/generate-images.
 */

export const DEFAULT_IMAGE_STYLE = 'no_style' as const;

export const IMAGE_STYLE_IDS = [
  /** Pas de preset d’ambiance — prompts généraux uniquement */
  'no_style',
  'rustic_luxury',
  'natural_wood_organic',
  'mediterranean_villa',
  'moody_heritage',
  'japandi_harmony',
  'neo_vintage_boutique',
  'french_countryside',
  'artisan_workshop',
  // Anciens presets (rétrocompat si requêtes / state obsolètes)
  'modern_farmhouse_chic',
  'soft_editorial_canvas',
  'bbq_provence_summer',
  'realistic',
  'studio',
  'lifestyle',
  'illustration',
] as const;

export type ImageStyleId = (typeof IMAGE_STYLE_IDS)[number];

export type ImageStylePreset = {
  id: ImageStyleId;
  label: string;
  emoji: string;
  hint: string;
};

/** Cartes affichées dans l’UI : aucun style + 8 ambiances */
export const IMAGE_STYLE_PRESETS: ImageStylePreset[] = [
    {
      id: 'no_style',
      label: 'Aucun style',
      emoji: '⬜',
      hint: 'Ambiance laissée au modèle (Etsy pro, sans thème imposé)',
    },
    {
      id: 'rustic_luxury',
      label: 'Luxe rustique',
      emoji: '🏺',
      hint: 'Céramiques, lin, bois patiné, lumière douce',
    },
    {
      id: 'natural_wood_organic',
      label: 'Bois naturel & terre',
      emoji: '🪵',
      hint: 'Matériaux bruts, verts profonds, authenticité',
    },
    {
      id: 'mediterranean_villa',
      label: 'Villa méditerranéenne',
      emoji: '🪴',
      hint: 'Blanc chaux, terre cuite, olivier, lumière du sud',
    },
    {
      id: 'moody_heritage',
      label: 'Patrimoine tamisé',
      emoji: '🕰️',
      hint: 'Bois sombre, velours, laiton, clair-obscur',
    },
    {
      id: 'japandi_harmony',
      label: 'Harmonie Japandi',
      emoji: '🍵',
      hint: 'Chêne clair, beige, papier, minimalisme chaleureux',
    },
    {
      id: 'neo_vintage_boutique',
      label: 'Boutique néo-vintage',
      emoji: '💎',
      hint: 'Velours, tons bijou, vitrine élégante',
    },
    {
      id: 'french_countryside',
      label: 'Campagne française',
      emoji: '🥖',
      hint: 'Table rustique, lavande, pierre et lin',
    },
    {
      id: 'artisan_workshop',
      label: 'Atelier artisan',
      emoji: '🔨',
      hint: 'Établi, outils, matières brutes, savoir-faire',
    },
  ];

/** Phrase courte injectée dans le contexte Gemini (anglais, stable pour le modèle). */
const GEMINI_HINTS: Record<string, string> = {
  no_style:
    'No specific named aesthetic preset: keep a versatile, clean Etsy-ready product presentation with natural believable lighting and a simple coherent background. Do not push a strong decorative theme beyond what fits the product.',
  rustic_luxury:
    'Rustic luxury product scene: aged ceramics, warm terracotta and linen, weathered wood surfaces, soft side light, artisan editorial Etsy photography.',
  natural_wood_organic:
    'Natural wood and organic earth aesthetic: raw oak, hemp or stone textures, deep forest greens, honest daylight, grounded premium product photo.',
  mediterranean_villa:
    'Mediterranean villa vibe: white stucco, terracotta pots, olive branches, airy sun, seaside warmth, clean product integration.',
  modern_farmhouse_chic:
    'Modern farmhouse chic: shiplap or light wood, neutral cream palette, subtle black metal accents, bright cozy interior.',
  moody_heritage:
    'Moody heritage interior: dark walnut, brass details, velvet or leather hints, dramatic low-key lighting, rich atmosphere.',
  japandi_harmony:
    'Japandi harmony: pale oak, rice paper textures, soft beige and grey, minimal calm composition, serene natural light.',
  neo_vintage_boutique:
    'Neo-vintage boutique: jewel tones, art deco or boutique display cues, velvet, refined glam, upscale retail mood.',
  french_countryside:
    'French countryside: rustic farm table, lavender or linen hints, soft pastoral light, charming provincial decor.',
  soft_editorial_canvas:
    'Soft editorial canvas: high-key gentle light, minimal props, magazine-style negative space, clean premium look.',
  artisan_workshop:
    'Artisan workshop setting: workbench, honest craft tools and materials in soft focus, maker authenticity, warm practical light.',
  bbq_provence_summer:
    'Provence summer outdoor table: herbs, sunlight, relaxed BBQ or garden lunch mood, warm Mediterranean afternoon light.',
  realistic:
    'Photorealistic product photo, soft natural light, high-end Etsy style.',
  studio: 'Studio product photo on clean neutral background, controlled light, soft shadows.',
  lifestyle: 'Lifestyle scene with product in a believable real environment.',
  illustration: 'Clean digital illustration style, harmonious colors, product still recognizable.',
};

/** Suffixe français ajouté aux prompts Nanobanana */
const NANO_SUFFIX_FR: Record<string, string> = {
  no_style: '',
  rustic_luxury:
    " Style d'ambiance : luxe rustique — céramiques patinées, lin, bois vieilli, tons terre chauds, lumière latérale douce, photo produit Etsy premium.",
  natural_wood_organic:
    " Style d'ambiance : bois naturel et matière organique — chêne brut, chanvre ou pierre, verts profonds, lumière naturelle honnête.",
  mediterranean_villa:
    " Style d'ambiance : villa méditerranéenne — chaux blanche, terre cuite, olivier, lumière du sud aérée et chaleureuse.",
  modern_farmhouse_chic:
    " Style d'ambiance : ferme moderne chic — bois clair, crème, touches métal noir, intérieur lumineux et cosy.",
  moody_heritage:
    " Style d'ambiance : patrimoine tamisé — bois sombre, velours ou cuir, laiton, éclairage bas contrasté dramatique.",
  japandi_harmony:
    " Style d'ambiance : Japandi — chêne pâle, textures papier, beige et gris doux, composition minimale apaisante.",
  neo_vintage_boutique:
    " Style d'ambiance : boutique néo-vintage — tons bijou, velours, vitrine élégante, glamour raffiné.",
  french_countryside:
    " Style d'ambiance : campagne française — table rustique, lin ou lavande, pierre, lumière pastorale douce.",
  soft_editorial_canvas:
    " Style d'ambiance : éditorial doux — high-key, peu d'accessoires, espace négatif, rendu magazine lifestyle.",
  artisan_workshop:
    " Style d'ambiance : atelier artisan — établi, outils et matières en arrière-plan flou, lumière d'atelier chaleureuse.",
  bbq_provence_summer:
    " Style d'ambiance : été en Provence / table conviviale — herbes, soleil, repas en extérieur, lumière méditerranéenne.",
  realistic: ' Style: photo produit ultra réaliste, éclairage naturel doux, rendu Etsy haut de gamme.',
  studio: ' Style: photo studio produit sur fond neutre propre, lumière contrôlée, ombres douces.',
  lifestyle: ' Style: scène lifestyle avec le produit dans un environnement réel cohérent, mise en scène naturelle.',
  illustration:
    ' Style: illustration digitale propre, légèrement stylisée, couleurs harmonieuses, mais produit parfaitement reconnaissable.',
};

export function geminiStyleHint(style: string | undefined): string {
  const key = style && GEMINI_HINTS[style] ? style : DEFAULT_IMAGE_STYLE;
  return GEMINI_HINTS[key] ?? GEMINI_HINTS[DEFAULT_IMAGE_STYLE];
}

export function nanoStyleSuffixFr(style: string | undefined): string {
  const key = style && NANO_SUFFIX_FR[style] ? style : DEFAULT_IMAGE_STYLE;
  return NANO_SUFFIX_FR[key] ?? NANO_SUFFIX_FR[DEFAULT_IMAGE_STYLE];
}

/** Normalise un id reçu du client vers un style connu */
export function normalizeImageStyleId(style: string | undefined): string {
  if (style && GEMINI_HINTS[style]) return style;
  return DEFAULT_IMAGE_STYLE;
}
