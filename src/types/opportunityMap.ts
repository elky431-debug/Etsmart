export type MarketLevel = 'opportunity' | 'saturated' | 'neutral';

export type CountryOpportunity = {
  code: string;
  name: string;
  flag: string;
  rank: 1 | 2 | 3;
  score: number;
  demand: number;
  competition: number;
  profitPotential: number;
  insight: string;
  lat: number;
  lon: number;
  level: MarketLevel;
};

export type MapMarket = {
  code: string;
  name: string;
  lat: number;
  lon: number;
  level: MarketLevel;
  score: number;
  isTop: boolean;
};

export type OpportunityMapAnalysis = {
  id: string;
  analyzedAt: number;
  nicheHint: string;
  topCountries: CountryOpportunity[];
  mapMarkets: MapMarket[];
  globalInsights: {
    temperature: string;
    temperatureLabel: string;
    window: string;
    advice: string;
  };
};
