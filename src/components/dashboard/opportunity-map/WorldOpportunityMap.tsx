'use client';

import { useMemo, useState } from 'react';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import type { Feature, FeatureCollection } from 'geojson';
import countriesTopology from 'world-atlas/countries-110m.json';
import { geoGraticule, geoNaturalEarth1, geoPath } from 'd3-geo';
import type { CountryOpportunity, MapMarket } from '@/types/opportunityMap';

const ACCENT = '#00BFA5';
const SAT = '#e85d4c';
const NEU = '#3d4556';
const OPP = '#00d9a8';

/** world-atlas utilise l’ISO 3166-1 numérique (chaîne 3 chiffres) comme `id` */
const ISO_A2_TO_NUMERIC: Record<string, string> = {
  FR: '250',
  GB: '826',
  DE: '276',
  US: '840',
  CA: '124',
  AU: '036',
  ES: '724',
  IT: '380',
  NL: '528',
  BE: '056',
  SE: '752',
  PL: '616',
  JP: '392',
};

const VIEW_W = 1000;
const VIEW_H = 500;

type Props = {
  markets: MapMarket[];
  topCountries: CountryOpportunity[];
};

export function WorldOpportunityMap({ markets }: Props) {
  const [hovered, setHovered] = useState<MapMarket | null>(null);
  const [tipPos, setTipPos] = useState({ x: 0, y: 0 });

  const marketByNumericId = useMemo(() => {
    const m = new Map<string, MapMarket>();
    for (const mm of markets) {
      const id = ISO_A2_TO_NUMERIC[mm.code];
      if (id) m.set(id, mm);
    }
    return m;
  }, [markets]);

  const { landFeatures, path, graticulePath } = useMemo(() => {
    const topo = countriesTopology as unknown as Topology;
    const countriesObj = topo.objects.countries as GeometryCollection;
    const geojson = feature(topo, countriesObj) as FeatureCollection;

    const projection = geoNaturalEarth1();
    projection.fitSize([VIEW_W, VIEW_H], geojson);
    const pathGen = geoPath(projection);

    const graticule = geoGraticule().step([30, 30]);
    const graticulePath = pathGen(graticule()) ?? '';

    return {
      landFeatures: geojson.features as Feature[],
      path: pathGen,
      graticulePath,
    };
  }, []);

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-[#1e2535] bg-[#0a0c10]">
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="h-auto w-full touch-none"
        role="img"
        aria-label="Carte des opportunités par marché"
        onMouseLeave={() => setHovered(null)}
      >
        <defs>
          <linearGradient id="opp-ocean" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#12151f" />
            <stop offset="100%" stopColor="#0d1018" />
          </linearGradient>
        </defs>

        <rect width={VIEW_W} height={VIEW_H} fill="url(#opp-ocean)" />

        <path
          d={graticulePath}
          fill="none"
          stroke="#1e2535"
          strokeWidth={0.35}
          opacity={0.45}
          pointerEvents="none"
        />

        {landFeatures.map((f) => {
          const id = f.id != null ? String(f.id) : '';
          const market = id ? marketByNumericId.get(id) : undefined;
          const d = path(f);
          if (!d) return null;

          const baseFill = '#151a24';
          const baseStroke = '#1e2535';

          let fill = baseFill;
          let stroke = baseStroke;
          let strokeW = 0.35;
          let opacity = 0.92;

          if (market) {
            if (market.level === 'opportunity') {
              fill = market.isTop ? OPP : OPP;
              opacity = market.isTop ? 0.42 : 0.32;
              stroke = market.isTop ? ACCENT : '#1a3d36';
              strokeW = market.isTop ? 0.9 : 0.5;
            } else if (market.level === 'saturated') {
              fill = SAT;
              opacity = 0.38;
              stroke = '#5c2a24';
              strokeW = 0.55;
            } else {
              fill = NEU;
              opacity = 0.35;
              stroke = '#2a3140';
              strokeW = 0.45;
            }
          }

          return (
            <path
              key={id || `${f.properties?.name ?? 'land'}-${d.slice(0, 40)}`}
              d={d}
              fill={fill}
              fillOpacity={opacity}
              stroke={stroke}
              strokeWidth={strokeW}
              strokeOpacity={market ? 0.95 : 0.7}
              className={market ? 'cursor-pointer transition-[fill-opacity,stroke] duration-150 hover:fill-opacity-[0.55]' : ''}
              onMouseEnter={
                market
                  ? (e) => {
                      setHovered(market);
                      setTipPos({ x: e.clientX, y: e.clientY });
                    }
                  : undefined
              }
              onMouseMove={
                market
                  ? (e) => {
                      setTipPos({ x: e.clientX, y: e.clientY });
                    }
                  : undefined
              }
            />
          );
        })}
      </svg>

      {hovered && (
        <div
          className="pointer-events-none fixed z-[200] rounded-lg border border-[#1e2535] bg-[#151922] px-3 py-2 text-xs text-white shadow-xl"
          style={{
            left: Math.min(
              tipPos.x + 12,
              typeof window !== 'undefined' ? window.innerWidth - 200 : tipPos.x,
            ),
            top: tipPos.y + 12,
          }}
        >
          <p className="font-semibold text-[#00BFA5]">{hovered.name}</p>
          <p className="text-white/70">Score opportunité : {hovered.score}/100</p>
          <p className="mt-0.5 text-[10px] uppercase tracking-wide text-white/40">
            {hovered.level === 'opportunity'
              ? 'Opportunité'
              : hovered.level === 'saturated'
                ? 'Saturé'
                : 'Neutre'}
          </p>
        </div>
      )}
    </div>
  );
}
