const BLOCK_MARKERS = [
  'captcha',
  'access denied',
  'unusual traffic',
  'datadome',
  'verify you are human',
  'robot',
  'bot protection',
  'are you a human',
  'cloudflare',
  'blocked',
  'challenge',
  'consent',
  'sign in required',
  'sign in to continue',
  'cookie policy',
  'empty state',
];

export function detectBlockedPage(params: {
  html: string;
  textContent?: string;
  listingsCount?: number;
}): boolean {
  const htmlLower = (params.html || '').toLowerCase();
  const textLower = (params.textContent || '').toLowerCase();
  const haystack = `${htmlLower}\n${textLower}`;

  const hasBlockMarker = BLOCK_MARKERS.some((marker) => haystack.includes(marker));
  if (hasBlockMarker) return true;

  const hasEtsyShell = haystack.includes('etsy');
  const noListings = typeof params.listingsCount === 'number' ? params.listingsCount <= 0 : false;
  if (hasEtsyShell && noListings && haystack.includes('security')) return true;

  return false;
}
