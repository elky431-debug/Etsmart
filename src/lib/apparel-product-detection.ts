/**
 * Détection simple vêtement / textile pour adapter les prompts image (sans logique « safety » agressive).
 */

const KIND_APPAREL = /^(apparel|clothing|vetement|vêtement|textile|fashion)$/i;

/** Mots-clés produits clairement non-textile (évite faux positifs). */
const NON_APPAREL_HINT = /\b(phone\s*case|coque|charger|câble|cable|puzzle|figurine|statue|pop\s*socket|support\s*téléphone|mug|tasse|vase|lampe(?!tte)|bougie\s*(?!parfum)|sticker|autocollant|affiche|poster|cadre\s*photo|imprimante|outil|drill|bit|cheville)\b/i;

const APPAREL_HINT = /\b(t-?shirt|tee\b|shirt\b|blouse|tank\b|tanktop|tank\s*top|racerback|halter|hoodie|sweatshirt|sweater|cardigan|pullover|polo|dress\b|skirt|pants|trousers|jeans|shorts|leggings?|joggers?|jogger|jacket|coat|blazer|vest\b|gilet|romper|jumpsuit|bodysuit|bralette|bra\b|lingerie|underwear|sock|socks|stockings?|tights|scarf|beanie|bonnet|hat\b|cap\b|glove|mitten|mitt\b|sneaker|trainer|boot|sandal|slipper|bikini|swimwear|swimsuit|activewear|athletic\s+wear|sportswear|gym\s+wear|yoga\s+pants|parka|anorak|chemise\b|jean\b|denim|maille|knitwear|survêtement|sweat\b|debardeur|débardeur|crop\s*top|crop\b|top\b|bas\b|collants?|chaussettes?|chaussures?|manteau|veste\b|jupe|robe\b|pull\b|short\b|pantalon|legging|cagoule\s*(?:ski)?|écharpe|bonnet)\b/i;

const APPAREL_HINT_FR = /\b(vêtement|vetement|textile|prêt[\s-]à[\s-]porter|sportswear|streetwear)\b/i;

export function isLikelyApparelProduct(input: {
  productTitle: string;
  tags: unknown;
  materials?: unknown;
  /** Si true : force le mode textile (prompts adaptés). */
  forceApparel?: boolean;
  /** Si true : désactive le mode textile même si le titre ressemble à du vêtement. */
  forceNotApparel?: boolean;
  productKind?: string | null;
  /**
   * Si !== true, on n'infère pas le textile depuis titre/tags (comportement aligné prod sans variable d'env).
   * `forceApparel` et `productKind` restent prioritaires.
   */
  keywordHeuristicEnabled?: boolean;
}): boolean {
  if (input.forceNotApparel === true) return false;
  if (input.forceApparel === true) return true;

  const kind = String(input.productKind || '').trim();
  if (kind && KIND_APPAREL.test(kind)) return true;

  if (input.keywordHeuristicEnabled !== true) {
    return false;
  }

  const title = String(input.productTitle || '');
  const titleLower = title.toLowerCase();
  const tagStr = Array.isArray(input.tags) ? input.tags.join(' ').toLowerCase() : '';
  const matStr = String(input.materials || '').toLowerCase();
  const blob = `${titleLower} ${tagStr} ${matStr}`;

  if (NON_APPAREL_HINT.test(titleLower) && !APPAREL_HINT.test(titleLower) && !APPAREL_HINT_FR.test(blob)) {
    return false;
  }

  return APPAREL_HINT.test(blob) || APPAREL_HINT_FR.test(blob);
}

/**
 * Yoga, fitness, swim, débardeurs, etc. : l’API image Gemini bloque souvent les sorties
 * avec peau / modèle même pour du e-commerce — on bascule vers présentations sans humain.
 */
const ATHLETIC_OR_FORM_FITTING = /\b(yoga|pilates|gym\s*wear|workout|aerobic|activewear|sportswear|athletic\s+wear|fitness\s+wear|performance\s+wear|running\s+(top|shirt|tank)|sports?\s*bra|sport\s+bra|compression\s+(short|tight|legging)|athleisure|moisture[\s-]*wick|wicking|leggings?|leotard|unitard|swim(wea)?r|swimsuit|bikini|beach\s+wear|racerback|halter\s*neck|halter\b|cropped?\s+tank|tank\s*top|débardeur|debardeur|crop\s*top|crossfit|hiit|spin\s+class|barre\s+class|hot\s+yoga|yoga\s+top|yoga\s+shirt|sports?\s+tank|athletic\s+tank|gym\s+top|training\s+top|running\s+tank)\b/i;

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
