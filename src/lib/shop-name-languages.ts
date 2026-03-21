/** Langues boutique pour la génération de noms / slogans Etsy */
export const SHOP_NAME_LANGUAGES = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Español' },
  { code: 'it', label: 'Italiano' },
  { code: 'nl', label: 'Nederlands' },
  { code: 'pt', label: 'Português' },
  { code: 'pl', label: 'Polski' },
] as const;

export type ShopNameLanguageCode = (typeof SHOP_NAME_LANGUAGES)[number]['code'];

const ALLOWED = new Set<string>(SHOP_NAME_LANGUAGES.map((l) => l.code));

export function parseShopNameLanguage(raw: string | undefined): ShopNameLanguageCode {
  const c = (raw && String(raw).trim().toLowerCase()) || 'fr';
  return (ALLOWED.has(c) ? c : 'fr') as ShopNameLanguageCode;
}
