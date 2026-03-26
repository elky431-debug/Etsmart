import type { ShopPayload } from '@/lib/etsy/shop-scrape-service';

export type ShopCompareSynthesis = {
  strongerShop: 'A' | 'B' | 'tie';
  why: string;
  opportunityForUser: string;
};

export type ShopCompareTagDiff = {
  common: string[];
  onlyA: string[];
  onlyB: string[];
};

export type ShopCompareIndicators = {
  sales: number;
  avgPrice: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  listingsSampleCount: number;
  listingsActive: number | null;
  rating: number;
  reviewCount: number;
  shopAgeLabel: string;
};

export type ShopCompareQuality = {
  score100: number;
  grade: string;
  verbal: string;
};
