import type { CountryOpportunity, MapMarket, OpportunityMapAnalysis } from '@/types/opportunityMap';

const POOL: Omit<CountryOpportunity, 'rank' | 'score' | 'demand' | 'competition' | 'profitPotential' | 'insight' | 'level'>[] = [
  { code: 'FR', name: 'France', flag: '🇫🇷', lat: 46.5, lon: 2.5 },
  { code: 'GB', name: 'Royaume-Uni', flag: '🇬🇧', lat: 54.5, lon: -2.5 },
  { code: 'DE', name: 'Allemagne', flag: '🇩🇪', lat: 51.2, lon: 10.5 },
  { code: 'US', name: 'États-Unis', flag: '🇺🇸', lat: 39.8, lon: -98.5 },
  { code: 'CA', name: 'Canada', flag: '🇨🇦', lat: 56.1, lon: -106.3 },
  { code: 'AU', name: 'Australie', flag: '🇦🇺', lat: -25.3, lon: 133.8 },
  { code: 'ES', name: 'Espagne', flag: '🇪🇸', lat: 40.4, lon: -3.7 },
  { code: 'IT', name: 'Italie', flag: '🇮🇹', lat: 42.6, lon: 12.6 },
  { code: 'NL', name: 'Pays-Bas', flag: '🇳🇱', lat: 52.2, lon: 5.3 },
  { code: 'BE', name: 'Belgique', flag: '🇧🇪', lat: 50.5, lon: 4.5 },
  { code: 'SE', name: 'Suède', flag: '🇸🇪', lat: 62.2, lon: 15.6 },
  { code: 'PL', name: 'Pologne', flag: '🇵🇱', lat: 51.9, lon: 19.1 },
  { code: 'JP', name: 'Japon', flag: '🇯🇵', lat: 36.2, lon: 138.3 },
];

const INSIGHTS: string[] = [
  'Peu de vendeurs locaux, forte demande sur la recherche organique.',
  'Marge brute élevée possible si tu localises bien le listing.',
  'Concurrence modérée : fenêtre encore ouverte sur ce créneau.',
  'Demande UK/FR en hausse, peu de shops spécialisés identifiés.',
  'Marché mature mais sous-représenté sur les visuels premium.',
  'Opportunité cross-border : acheteurs sensibles au made-in EU.',
];

function rnd(min: number, max: number) {
  return Math.round(min + Math.random() * (max - min));
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function generateMockAnalysis(nicheHint: string): OpportunityMapAnalysis {
  const picked = shuffle(POOL).slice(0, 3);
  const topCountries: CountryOpportunity[] = picked.map((c, i) => ({
    ...c,
    rank: (i + 1) as 1 | 2 | 3,
    score: rnd(82, 97),
    demand: rnd(55, 94),
    competition: rnd(20, 75),
    profitPotential: rnd(60, 92),
    insight: INSIGHTS[rnd(0, INSIGHTS.length - 1)]!,
    level: 'opportunity',
  }));

  const codesTop = new Set(topCountries.map((c) => c.code));
  const others = POOL.filter((p) => !codesTop.has(p.code));
  const saturated = shuffle(others).slice(0, rnd(3, 5));
  const neutral = shuffle(others.filter((o) => !saturated.includes(o))).slice(0, rnd(4, 7));

  const mapMarkets: MapMarket[] = [
    ...topCountries.map((c) => ({
      code: c.code,
      name: c.name,
      lat: c.lat,
      lon: c.lon,
      level: 'opportunity' as const,
      score: c.score,
      isTop: true,
    })),
    ...saturated.map((c) => ({
      code: c.code,
      name: c.name,
      lat: c.lat,
      lon: c.lon,
      level: 'saturated' as const,
      score: rnd(35, 58),
      isTop: false,
    })),
    ...neutral.map((c) => ({
      code: c.code,
      name: c.name,
      lat: c.lat,
      lon: c.lon,
      level: 'neutral' as const,
      score: rnd(50, 70),
      isTop: false,
    })),
  ];

  const temps = [
    { t: 'Froide', l: 'Peu de signaux de demande récents.' },
    { t: 'Tiède', l: 'Intérêt régulier, à surveiller.' },
    { t: 'Chaude', l: 'Recherches et favoris en hausse.' },
    { t: 'Brûlante', l: 'Pic d’attention sur le segment.' },
  ];
  const tempPick = temps[rnd(1, 3)]!;

  const windows = [
    '3–6 mois avant saturation visible',
    '6–12 mois de marge sur le créneau',
    'Fenêtre courte : agir sous 8–10 semaines',
    '12–18 mois si tu différencies le positionnement',
  ];

  const advices = [
    'Teste 2 variantes de titre Etsy ciblant le pays #1 avant de scaler.',
    'Ajoute des visuels lifestyle alignés sur la culture locale du marché vert.',
    'Monte un bundle léger pour augmenter le panier moyen sur ce segment.',
    'Publie 3 listings dérivés pour couvrir les requêtes longue traîne.',
  ];

  return {
    id: `opp-${Date.now()}`,
    analyzedAt: Date.now(),
    nicheHint: nicheHint.trim(),
    topCountries,
    mapMarkets,
    globalInsights: {
      temperature: tempPick.t,
      temperatureLabel: tempPick.l,
      window: windows[rnd(0, windows.length - 1)]!,
      advice: advices[rnd(0, advices.length - 1)]!,
    },
  };
}

/** Projection équirectangulaire simple → coordonnées SVG viewBox 1000×500 */
export function projectLatLon(lat: number, lon: number): { x: number; y: number } {
  const x = ((lon + 180) / 360) * 1000;
  const y = ((90 - lat) / 180) * 500;
  return { x, y };
}
