import { EtsyKeywordListing } from '@/lib/keyword-research/types';

export function isKeywordListingPayloadValid(listings: EtsyKeywordListing[]): boolean {
  if (!Array.isArray(listings) || listings.length < 3) return false;

  const validTitleCount = listings.filter((listing) => (listing.title || '').trim().length >= 4).length;
  const validUrlCount = listings.filter((listing) => (listing.listingUrl || '').includes('/listing/')).length;

  return validTitleCount >= 2 && validUrlCount >= 2;
}
