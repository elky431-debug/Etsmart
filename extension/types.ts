export interface ShopData {
  shopUrl: string;
  shopName: string;
  salesCount?: number;
  rating?: number;
  reviewCount?: number;
  shopAge?: string;
  sampleListings: Array<{
    title: string;
    url: string;
    priceText: string;
  }>;
}

export interface ScrapeMessage {
  type: 'SCRAPE_NOW' | 'SCRAPED_DATA' | 'START_IMPORT' | 'OPEN_ANALYZING_PAGE';
  data?: ShopData[];
  niche?: string;
  searchUrl?: string;
}

