/**
 * Détection vêtement / textile pour adapter les prompts image.
 * Toujours actif — pas de flag env. Doit être STRICT : uniquement
 * des articles que l'on porte sur soi.
 */

const KIND_APPAREL = /^(apparel|clothing|vetement|vêtement|textile|fashion)$/i;

/**
 * Produits clairement NON-vestimentaires — court-circuite la détection
 * même si le titre contient un mot ambigu.
 */
const NON_APPAREL_HINT =
  /\b(phone\s*case|coque|charger|câble|cable|puzzle|figurine|statue|pop\s*socket|mug|tasse|vase|lampe|bougie|sticker|autocollant|affiche|poster|cadre|imprimante|outil|drill|shelf|tablette|bureau|table\b|chaise|chair|sofa|canapé|canape|armoire|commode|meuble|furniture|cushion|coussin|pillow|rug\b|tapis\b|curtain|rideau|plaid|blanket|duvet|couette|bijou|jewelry|jewellery|necklace|collier|bracelet|earring|boucle\s*d.oreille|ring\b|bague|brooch|broche|watch\b|montre|bag\b|sac\b|handbag|backpack|wallet|portefeuille|purse|luggage|valise|plant\b|plante|vase|pot\b|candle|painting|tableau|art\b|print\b|illustration|download|digital|svg\b|png\b|pdf\b|pattern\b|template\b)\b/i;

/**
 * Mots-clés indiquant clairement un vêtement porté sur le corps.
 * Intentionnellement strict — on préfère les faux négatifs aux faux positifs.
 */
const APPAREL_HINT =
  /\b(t-?shirt|tee\s+shirt|blouse|hoodie|sweatshirt|sweater|cardigan|pullover|polo\s*shirt|dress(?:es)?|skirt|trousers|jeans|shorts|leggings?|joggers?|tracksuit|jacket|coat|blazer|waistcoat|gilet|romper|jumpsuit|bodysuit|bralette|lingerie|underwear|socks?|stockings?|tights|scarf|beanie|gloves?|mittens?|sneakers?|trainers?|boots?(?:\s+shoes?)?|sandals?|slippers?|bikini|swimwear|swimsuit|activewear|sportswear|yoga\s+pants|parka|anorak|tank\s*top|crop\s*top|racerback|halter\s*(?:top|neck)?|bra\b|sports?\s*bra|chemise|denim\s+(?:jacket|shirt|shorts?)|knitwear|sweat(?:shirt)?|débardeur|debardeur|collants?|chaussettes?|chaussures?|manteau|veste\b|jupe\b|robe\b|pantalon|legging\b|écharpe|survêtement|pull(?:over)?|polo\b)\b/i;

const APPAREL_HINT_FR =
  /\b(vêtement|vetement|prêt[\s-]à[\s-]porter|streetwear)\b/i;

export function isLikelyApparelProduct(input: {
  productTitle: string;
  tags: unknown;
  materials?: unknown;
  forceApparel?: boolean;
  forceNotApparel?: boolean;
  productKind?: string | null;
  /** @deprecated — plus utilisé, la détection est toujours active */
  keywordHeuristicEnabled?: boolean;
}): boolean {
  if (input.forceNotApparel === true) return false;
  if (input.forceApparel === true) return true;

  const kind = String(input.productKind || '').trim();
  if (kind && KIND_APPAREL.test(kind)) return true;

  const title = String(input.productTitle || '');
  const titleLower = title.toLowerCase();
  const tagStr = Array.isArray(input.tags) ? input.tags.join(' ').toLowerCase() : '';
  const matStr = String(input.materials || '').toLowerCase();
  const blob = `${titleLower} ${tagStr} ${matStr}`;

  // Si le titre contient un mot non-vestimentaire fort → pas de mode textile
  if (NON_APPAREL_HINT.test(titleLower)) return false;

  return APPAREL_HINT.test(blob) || APPAREL_HINT_FR.test(blob);
}

/**
 * Activewear, yoga, natation, etc. : Gemini refuse souvent de montrer
 * des modèles humains pour ce type d'article → mode sans peau.
 */
const ATHLETIC_OR_FORM_FITTING =
  /\b(yoga|pilates|gym\s*wear|workout|aerobic|activewear|sportswear|athletic\s+wear|fitness\s+wear|performance\s+wear|running\s+(?:top|shirt|tank)|sports?\s*bra|sport\s+bra|compression\s+(?:short|tight|legging)|athleisure|moisture[\s-]*wick|wicking|leggings?|leotard|swimwear|swimsuit|bikini|beach\s+wear|racerback|halter\s*(?:top|neck)?|cropped?\s+tank|tank\s*top|débardeur|debardeur|crop\s*top|crossfit|hiit|spin\s+class|barre\s+class|hot\s+yoga|yoga\s+(?:top|shirt|pants)|sports?\s+tank|athletic\s+tank|gym\s+top|training\s+top|running\s+tank)\b/i;

export function isAthleticOrFormFittingApparel(input: {
  productTitle: string;
  tags: unknown;
  materials?: unknown;
}): boolean {
  const titleLower = String(input.productTitle || '').toLowerCase();
  const tagStr = Array.isArray(input.tags) ? input.tags.join(' ').toLowerCase() : '';
  const matStr = String(input.materials || '').toLowerCase();
  const blob = `${titleLower} ${tagStr} ${matStr}`;
  return ATHLETIC_OR_FORM_FITTING.test(blob);
}
