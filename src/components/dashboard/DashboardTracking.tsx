'use client';

import { useState, useRef, useEffect } from 'react';
import { Package, Loader2, Copy, Check, AlertCircle, Calendar, ChevronDown, Search, Truck, ChevronRight, MapPin } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  filterUSStates,
  filterCitySuggestions,
  getUSStateName,
  normalizeForSearch,
  suggestAlternativeCities,
} from '@/lib/tracktaco-location-data';

interface ParcellResult {
  trackingNumber: string;
  carrier: string;
  status: string;
  dateExpected?: string | null;
  origin?: string | Record<string, unknown> | null;
  destination?: string | Record<string, unknown> | null;
  events?: { event?: string; date?: string; location?: string; description?: string }[];
}

function formatPlace(v: string | Record<string, unknown> | null | undefined): string {
  if (v == null) return '—';
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && v !== null) {
    const o = v as Record<string, unknown>;
    const parts = [o.country, o.city, o.label].filter(Boolean) as string[];
    return parts.length ? parts.join(', ') : (String(o.name ?? o.title ?? '').trim() || '—');
  }
  return '—';
}


interface TracktacoSuccess {
  trackingNr: string;
  creditsRemaining?: number;
  destCity?: string;
  destState?: string;
  destCountry?: string;
  estDeliveryDate?: string;
  shippedAt?: string;
  originCity?: string;
  originState?: string;
  originCountry?: string;
  shipMethod?: string;
}

const ERROR_MESSAGES: Record<string, string> = {
  NO_CREDITS: 'Plus de crédits Tracktaco. Rechargez votre compte sur app.tracktaco.com',
  NO_TN_FOUND: 'Aucun numéro de suivi trouvé pour ces critères. Essayez d\'élargir (pays, état).',
  INVALID_APIKEY: 'Clé API Tracktaco invalide. Vérifiez la clé sur app.tracktaco.com.',
  FORBIDDEN: 'Accès refusé par Tracktaco. Vérifiez votre clé API (app.tracktaco.com) et vos crédits.',
  DOUBLE_CHECK_FAILED: 'Vérification transporteur en échec. Réessayez.',
};

const COUNTRY_LIST: { code: string; name: string }[] = [
  { code: 'AF', name: 'Afghanistan' }, { code: 'ZA', name: 'Afrique du Sud' }, { code: 'AL', name: 'Albanie' }, { code: 'DZ', name: 'Algérie' },
  { code: 'DE', name: 'Allemagne' }, { code: 'AD', name: 'Andorre' }, { code: 'AO', name: 'Angola' }, { code: 'SA', name: 'Arabie saoudite' },
  { code: 'AR', name: 'Argentine' }, { code: 'AM', name: 'Arménie' }, { code: 'AU', name: 'Australie' }, { code: 'AT', name: 'Autriche' },
  { code: 'AZ', name: 'Azerbaïdjan' }, { code: 'BH', name: 'Bahreïn' }, { code: 'BD', name: 'Bangladesh' }, { code: 'BE', name: 'Belgique' },
  { code: 'BZ', name: 'Belize' }, { code: 'BJ', name: 'Bénin' }, { code: 'BT', name: 'Bhoutan' }, { code: 'BY', name: 'Biélorussie' },
  { code: 'BO', name: 'Bolivie' }, { code: 'BA', name: 'Bosnie-Herzégovine' }, { code: 'BW', name: 'Botswana' }, { code: 'BR', name: 'Brésil' },
  { code: 'BN', name: 'Brunei' }, { code: 'BG', name: 'Bulgarie' }, { code: 'BF', name: 'Burkina Faso' }, { code: 'BI', name: 'Burundi' },
  { code: 'KH', name: 'Cambodge' }, { code: 'CM', name: 'Cameroun' }, { code: 'CA', name: 'Canada' }, { code: 'CV', name: 'Cap-Vert' },
  { code: 'CL', name: 'Chili' }, { code: 'CN', name: 'Chine' }, { code: 'CY', name: 'Chypre' }, { code: 'CO', name: 'Colombie' },
  { code: 'KM', name: 'Comores' }, { code: 'CG', name: 'Congo' }, { code: 'KR', name: 'Corée du Sud' }, { code: 'KP', name: 'Corée du Nord' },
  { code: 'CR', name: 'Costa Rica' }, { code: 'CI', name: 'Côte d\'Ivoire' }, { code: 'HR', name: 'Croatie' }, { code: 'CU', name: 'Cuba' },
  { code: 'DK', name: 'Danemark' }, { code: 'DJ', name: 'Djibouti' }, { code: 'DM', name: 'Dominique' }, { code: 'EG', name: 'Égypte' },
  { code: 'AE', name: 'Émirats arabes unis' }, { code: 'EC', name: 'Équateur' }, { code: 'ER', name: 'Érythrée' }, { code: 'ES', name: 'Espagne' },
  { code: 'EE', name: 'Estonie' }, { code: 'US', name: 'États-Unis' }, { code: 'ET', name: 'Éthiopie' }, { code: 'FJ', name: 'Fidji' },
  { code: 'FI', name: 'Finlande' }, { code: 'FR', name: 'France' }, { code: 'GA', name: 'Gabon' }, { code: 'GM', name: 'Gambie' },
  { code: 'GE', name: 'Géorgie' }, { code: 'GH', name: 'Ghana' }, { code: 'GR', name: 'Grèce' }, { code: 'GT', name: 'Guatemala' },
  { code: 'GN', name: 'Guinée' }, { code: 'GQ', name: 'Guinée équatoriale' }, { code: 'GW', name: 'Guinée-Bissau' }, { code: 'GY', name: 'Guyana' },
  { code: 'HT', name: 'Haïti' }, { code: 'HN', name: 'Honduras' }, { code: 'HU', name: 'Hongrie' }, { code: 'IN', name: 'Inde' },
  { code: 'ID', name: 'Indonésie' }, { code: 'IQ', name: 'Irak' }, { code: 'IR', name: 'Iran' }, { code: 'IE', name: 'Irlande' },
  { code: 'IS', name: 'Islande' }, { code: 'IL', name: 'Israël' }, { code: 'IT', name: 'Italie' }, { code: 'JM', name: 'Jamaïque' },
  { code: 'JP', name: 'Japon' }, { code: 'JO', name: 'Jordanie' }, { code: 'KZ', name: 'Kazakhstan' }, { code: 'KE', name: 'Kenya' },
  { code: 'KG', name: 'Kirghizistan' }, { code: 'KW', name: 'Koweït' }, { code: 'LA', name: 'Laos' }, { code: 'LS', name: 'Lesotho' },
  { code: 'LV', name: 'Lettonie' }, { code: 'LB', name: 'Liban' }, { code: 'LR', name: 'Liberia' }, { code: 'LY', name: 'Libye' },
  { code: 'LI', name: 'Liechtenstein' }, { code: 'LT', name: 'Lituanie' }, { code: 'LU', name: 'Luxembourg' }, { code: 'MK', name: 'Macédoine du Nord' },
  { code: 'MG', name: 'Madagascar' }, { code: 'MY', name: 'Malaisie' }, { code: 'MW', name: 'Malawi' }, { code: 'MV', name: 'Maldives' },
  { code: 'ML', name: 'Mali' }, { code: 'MT', name: 'Malte' }, { code: 'MA', name: 'Maroc' }, { code: 'MU', name: 'Maurice' },
  { code: 'MR', name: 'Mauritanie' }, { code: 'MX', name: 'Mexique' }, { code: 'MD', name: 'Moldavie' }, { code: 'MC', name: 'Monaco' },
  { code: 'MN', name: 'Mongolie' }, { code: 'ME', name: 'Monténégro' }, { code: 'MZ', name: 'Mozambique' }, { code: 'MM', name: 'Myanmar' },
  { code: 'NA', name: 'Namibie' }, { code: 'NP', name: 'Népal' }, { code: 'NI', name: 'Nicaragua' }, { code: 'NE', name: 'Niger' },
  { code: 'NG', name: 'Nigeria' }, { code: 'NO', name: 'Norvège' }, { code: 'NZ', name: 'Nouvelle-Zélande' }, { code: 'OM', name: 'Oman' },
  { code: 'UG', name: 'Ouganda' }, { code: 'UZ', name: 'Ouzbékistan' }, { code: 'PK', name: 'Pakistan' }, { code: 'PA', name: 'Panama' },
  { code: 'PG', name: 'Papouasie-Nouvelle-Guinée' }, { code: 'PY', name: 'Paraguay' }, { code: 'NL', name: 'Pays-Bas' }, { code: 'PE', name: 'Pérou' },
  { code: 'PH', name: 'Philippines' }, { code: 'PL', name: 'Pologne' }, { code: 'PT', name: 'Portugal' }, { code: 'QA', name: 'Qatar' },
  { code: 'CF', name: 'République centrafricaine' }, { code: 'CD', name: 'République démocratique du Congo' }, { code: 'DO', name: 'République dominicaine' },
  { code: 'RO', name: 'Roumanie' }, { code: 'GB', name: 'Royaume-Uni' }, { code: 'RU', name: 'Russie' }, { code: 'RW', name: 'Rwanda' },
  { code: 'SN', name: 'Sénégal' }, { code: 'RS', name: 'Serbie' }, { code: 'SG', name: 'Singapour' }, { code: 'SK', name: 'Slovaquie' },
  { code: 'SI', name: 'Slovénie' }, { code: 'SO', name: 'Somalie' }, { code: 'SD', name: 'Soudan' }, { code: 'SS', name: 'Soudan du Sud' },
  { code: 'SE', name: 'Suède' }, { code: 'CH', name: 'Suisse' }, { code: 'SR', name: 'Suriname' }, { code: 'SZ', name: 'Eswatini' },
  { code: 'SY', name: 'Syrie' }, { code: 'TJ', name: 'Tadjikistan' }, { code: 'TZ', name: 'Tanzanie' }, { code: 'TD', name: 'Tchad' },
  { code: 'CZ', name: 'Tchéquie' }, { code: 'TH', name: 'Thaïlande' }, { code: 'TL', name: 'Timor oriental' }, { code: 'TG', name: 'Togo' },
  { code: 'TT', name: 'Trinité-et-Tobago' }, { code: 'TN', name: 'Tunisie' }, { code: 'TM', name: 'Turkménistan' }, { code: 'TR', name: 'Turquie' },
  { code: 'UA', name: 'Ukraine' }, { code: 'UY', name: 'Uruguay' }, { code: 'VU', name: 'Vanuatu' }, { code: 'VA', name: 'Vatican' },
  { code: 'VE', name: 'Venezuela' }, { code: 'VN', name: 'Viêt Nam' }, { code: 'YE', name: 'Yémen' }, { code: 'ZM', name: 'Zambie' },
  { code: 'ZW', name: 'Zimbabwe' },
];

type TrackingMainTab = 'tracking-number' | 'parcel-search';

export function DashboardTracking() {
  const [mainTab, setMainTab] = useState<TrackingMainTab>('tracking-number');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('US');
  const [countryInput, setCountryInput] = useState('États-Unis');
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  const countryDropdownRef = useRef<HTMLDivElement>(null);
  const [deliveryStatus, setDeliveryStatus] = useState<'in-transit' | 'delivered'>('in-transit');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<TracktacoSuccess[]>([]);
  const [creditsRemaining, setCreditsRemaining] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deliveryDropdownOpen, setDeliveryDropdownOpen] = useState(false);
  const deliveryDropdownRef = useRef<HTMLDivElement>(null);
  const [stateInput, setStateInput] = useState('');
  const [stateDropdownOpen, setStateDropdownOpen] = useState(false);
  const stateDropdownRef = useRef<HTMLDivElement>(null);
  const [cityDropdownOpen, setCityDropdownOpen] = useState(false);
  const cityDropdownRef = useRef<HTMLDivElement>(null);
  const [alternativeCities, setAlternativeCities] = useState<string[]>([]);

  const [parcellTracking, setParcellTracking] = useState('');
  const [parcellLoading, setParcellLoading] = useState(false);
  const [parcellResult, setParcellResult] = useState<ParcellResult | null>(null);
  const [parcellError, setParcellError] = useState<string | null>(null);
  const [parcellDetailOpen, setParcellDetailOpen] = useState(false);

  const carrier = 'fedex';
  const type = 'intl';

  const countryQueryRaw = countryInput.trim();
  const countryQueryNorm = countryQueryRaw.length >= 1 ? normalizeForSearch(countryQueryRaw, true) : '';
  const countryMatches = countryQueryNorm
    ? COUNTRY_LIST.filter((c) => {
        const nameNorm = normalizeForSearch(c.name, true);
        const codeL = c.code.toLowerCase();
        const rawL = countryQueryRaw.toLowerCase();
        return nameNorm.includes(countryQueryNorm) || codeL.includes(rawL);
      }).slice(0, 12)
    : [];

  const currentCountryName = COUNTRY_LIST.find((c) => c.code === country)?.name;
  const countryInputMismatch =
    Boolean(country && currentCountryName) &&
    normalizeForSearch(countryInput.trim(), true) !== normalizeForSearch(currentCountryName!, true);
  const effectiveCountry = countryInputMismatch ? '' : country;
  const isUnitedStates = effectiveCountry === 'US';

  const stateMatches = isUnitedStates && stateInput.trim().length >= 1
    ? filterUSStates(stateInput.trim(), 14)
    : isUnitedStates
      ? filterUSStates('', 14)
      : [];

  const cityMatches =
    effectiveCountry && (isUnitedStates ? state.trim().length === 2 : true)
      ? filterCitySuggestions(effectiveCountry, isUnitedStates ? state : null, city.trim(), 14)
      : [];

  useEffect(() => {
    if (country && country !== 'US') {
      setState('');
      setStateInput('');
    }
  }, [country]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (deliveryDropdownRef.current && !deliveryDropdownRef.current.contains(target)) setDeliveryDropdownOpen(false);
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(target)) setCountryDropdownOpen(false);
      if (stateDropdownRef.current && !stateDropdownRef.current.contains(target)) setStateDropdownOpen(false);
      if (cityDropdownRef.current && !cityDropdownRef.current.contains(target)) setCityDropdownOpen(false);
    }
    if (deliveryDropdownOpen || countryDropdownOpen || stateDropdownOpen || cityDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [deliveryDropdownOpen, countryDropdownOpen, stateDropdownOpen, cityDropdownOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Si aucun code pays sélectionné mais que des résultats existent, utiliser le premier match
      let countryCode = effectiveCountry;
      if (!countryCode) {
        const firstMatch = countryMatches[0];
        if (firstMatch) {
          countryCode = firstMatch.code;
          setCountry(firstMatch.code);
          setCountryInput(firstMatch.name);
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setError('Vous devez être connecté.');
        return;
      }

      const body: Record<string, unknown> = { type, carrier };
      if (type === 'intl') {
        body.country = (countryCode || '').toUpperCase().slice(0, 2);
        if (countryCode === 'US' && state.trim()) body.state = state.toUpperCase().slice(0, 2);
        if (city.trim()) body.city = city.trim();
      } else {
        if (countryCode === 'US' && state.trim()) body.state = state.toUpperCase().slice(0, 2);
        if (city.trim()) body.city = city.trim();
      }
      body.deliveryState = [deliveryStatus];
      if (dateFrom) body.from = new Date(dateFrom).getTime();
      if (dateTo) body.to = new Date(dateTo).getTime();

      const res = await fetch('/api/tracktaco/get-tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (data.errorCode === 'NO_TN_FOUND' && countryCode) {
          const alts = suggestAlternativeCities(
            countryCode,
            countryCode === 'US' && state.trim() ? state.toUpperCase().slice(0, 2) : null,
            city.trim(),
            6
          );
          setAlternativeCities(alts);
          setError(
            alts.length > 0
              ? 'Aucun numéro pour cette zone. Essaie une ville plus grande (suggestions ci-dessous).'
              : ERROR_MESSAGES.NO_TN_FOUND
          );
          return;
        }
        const msg = data.errorCode && ERROR_MESSAGES[data.errorCode]
          ? ERROR_MESSAGES[data.errorCode]
          : data.message || data.error || (res.status === 403 ? ERROR_MESSAGES.FORBIDDEN : 'Erreur lors de la récupération du numéro de suivi.');
        setError(msg);
        return;
      }

      setResults(prev => [data, ...prev]);
      if (data.creditsRemaining != null) setCreditsRemaining(data.creditsRemaining);
    } catch (err) {
      setError('Erreur réseau. Réessayez.');
    } finally {
      setLoading(false);
    }
  };

  const copyTracking = async (trackingNr: string) => {
    await navigator.clipboard.writeText(trackingNr);
    setCopiedId(trackingNr);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleParcellSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parcellTracking.trim();
    if (!num) return;
    setParcellError(null);
    setParcellResult(null);
    setParcellDetailOpen(false);
    setParcellLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setParcellError('Vous devez être connecté.');
        return;
      }
      const res = await fetch('/api/parcell/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ trackingNumber: num }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setParcellError(data?.message || data?.error || 'Erreur lors de la recherche.');
        return;
      }
      setParcellResult({
        trackingNumber: data.trackingNumber || num,
        carrier: data.carrier ?? '—',
        status: data.status ?? '—',
        dateExpected: data.dateExpected,
        origin: data.origin,
        destination: data.destination,
        events: data.events,
      });
    } catch {
      setParcellError('Erreur réseau. Réessayez.');
    } finally {
      setParcellLoading(false);
    }
  };

  const formatDate = (iso?: string) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
    } catch {
      return iso;
    }
  };

  const originStr = (r: TracktacoSuccess) => [r.originCity, r.originState, r.originCountry].filter(Boolean).join(', ') || '—';
  const destStr = (r: TracktacoSuccess) => [r.destCity, r.destState, r.destCountry].filter(Boolean).join(', ') || '—';

  // Autoriser le clic dès qu'il y a du texte dans le champ pays
  const canSubmit = countryInput.trim().length >= 1;

  const inputClass =
    'w-full rounded-xl border border-zinc-600 bg-zinc-900/90 px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 transition-all duration-200 hover:border-zinc-500 focus:border-[#00d4ff] focus:outline-none focus:ring-2 focus:ring-[#00d4ff]/25 sm:px-4 sm:py-3';
  const labelClass = 'mb-1.5 block text-xs font-bold uppercase tracking-wide text-zinc-300';

  const tabBtnClass = (active: boolean) =>
    `flex flex-1 cursor-pointer items-center justify-center gap-0 rounded-full px-3 py-2.5 text-sm font-semibold transition-all sm:px-4 sm:py-3 ${
      active
        ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-black shadow-lg shadow-[#00d4ff]/25'
        : 'text-zinc-400 hover:bg-zinc-800/80 hover:text-white'
    }`;

  return (
    <div className="bg-gradient-to-b from-zinc-950 via-black to-black p-4 pb-8 sm:p-6 md:p-8">
      <div className="mx-auto max-w-7xl">
        {/* Onglets principaux */}
        <div className="mb-5 flex rounded-full border border-zinc-700 bg-zinc-900/70 p-1.5 shadow-xl shadow-black/25">
          <button type="button" onClick={() => setMainTab('tracking-number')} className={tabBtnClass(mainTab === 'tracking-number')}>
            Numéro de suivi
          </button>
          <button type="button" onClick={() => setMainTab('parcel-search')} className={tabBtnClass(mainTab === 'parcel-search')}>
            Recherche de colis
          </button>
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:gap-5">
          {/* Left panel - Form */}
          <div className="w-full flex-shrink-0 lg:w-[min(100%,380px)]">
            {mainTab === 'tracking-number' ? (
              <>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#00d4ff] to-[#00c9b7] shadow-lg shadow-[#00d4ff]/30 ring-2 ring-[#00d4ff]/20">
                  <Package className="h-6 w-6 text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="truncate text-xl font-bold text-white sm:text-2xl">Obtenir un suivi</h1>
                  <p className="mt-0.5 truncate text-sm text-zinc-400">Tracktaco · FedEx</p>
                </div>
              </div>
            </div>
            <p className="mb-3 text-sm leading-relaxed text-zinc-500">
              Choisis le pays : pour les <span className="text-zinc-300">États-Unis</span>, sélectionne l’État puis la ville
              (suggestions). Pour les autres pays, indique une ville (grandes villes proposées).
            </p>

            <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-zinc-700 bg-zinc-900/50 p-5 shadow-2xl shadow-black/35 backdrop-blur-sm sm:p-6">
              <div className="relative" ref={countryDropdownRef}>
                <label className={labelClass}>Pays *</label>
                <input
                  type="text"
                  value={countryInput}
                  onChange={(e) => {
                    setCountryInput(e.target.value);
                    setCountryDropdownOpen(true);
                  }}
                  onFocus={() => setCountryDropdownOpen(countryMatches.length > 0)}
                  placeholder="Rechercher un pays (ex. France, FR)..."
                  className={inputClass}
                  autoComplete="off"
                />
                {countryDropdownOpen && countryMatches.length > 0 && (
                  <div className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-zinc-600 bg-zinc-900 shadow-xl [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-600 [&::-webkit-scrollbar-track]:bg-zinc-800 [&::-webkit-scrollbar]:w-2">
                    {countryMatches.map((c) => (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => {
                          setCountry(c.code);
                          setCountryInput(c.name);
                          setCountryDropdownOpen(false);
                          setAlternativeCities([]);
                          if (c.code !== 'US') {
                            setState('');
                            setStateInput('');
                          }
                        }}
                        className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors ${
                          effectiveCountry === c.code ? 'bg-[#00d4ff]/15 text-[#00d4ff] font-semibold' : 'text-zinc-200 hover:bg-zinc-800 hover:text-white'
                        }`}
                      >
                        <span>{c.name}</span>
                        <span className="text-zinc-500 text-xs">{c.code}</span>
                        {effectiveCountry === c.code ? <Check className="w-4 h-4 flex-shrink-0 text-[#00d4ff]" /> : null}
                      </button>
                    ))}
                  </div>
                )}
                {countryDropdownOpen && countryInput.trim() && countryMatches.length === 0 && (
                  <div className="absolute z-50 mt-1 w-full rounded-xl border border-zinc-600 bg-zinc-900 px-4 py-3 text-sm text-zinc-400 shadow-xl">
                    Aucun pays trouvé pour « {countryInput.trim()} »
                  </div>
                )}
              </div>

              {isUnitedStates && (
                <div className="relative" ref={stateDropdownRef}>
                  <label className={labelClass}>État (obligatoire pour les US)</label>
                  <input
                    type="text"
                    value={stateInput}
                    onChange={(e) => {
                      const v = e.target.value;
                      setStateInput(v);
                      setStateDropdownOpen(true);
                      if (!v.trim()) {
                        setState('');
                        return;
                      }
                      const two = v.trim().toUpperCase();
                      if (two.length === 2 && getUSStateName(two)) {
                        setState(two);
                      }
                    }}
                    onFocus={() => setStateDropdownOpen(true)}
                    placeholder="Tape ou choisis (ex. Géorgie, GA)…"
                    className={inputClass}
                    autoComplete="off"
                  />
                  {stateDropdownOpen && stateMatches.length > 0 && (
                    <div className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-zinc-600 bg-zinc-900 shadow-xl [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-600 [&::-webkit-scrollbar-track]:bg-zinc-800 [&::-webkit-scrollbar]:w-2">
                      {stateMatches.map((s) => (
                        <button
                          key={s.code}
                          type="button"
                          onClick={() => {
                            setState(s.code);
                            setStateInput(`${s.name} (${s.code})`);
                            setStateDropdownOpen(false);
                            setCity('');
                          }}
                          className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors ${
                            state === s.code ? 'bg-[#00d4ff]/15 font-semibold text-[#00d4ff]' : 'text-zinc-200 hover:bg-zinc-800 hover:text-white'
                          }`}
                        >
                          <span>{s.name}</span>
                          <span className="text-xs text-zinc-500">{s.code}</span>
                          {state === s.code ? <Check className="h-4 w-4 flex-shrink-0 text-[#00d4ff]" /> : null}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="relative" ref={cityDropdownRef}>
                <label className={labelClass}>Ville (optionnel)</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => {
                    setCity(e.target.value);
                    setCityDropdownOpen(true);
                    setAlternativeCities([]);
                  }}
                  onFocus={() => setCityDropdownOpen(true)}
                  placeholder={
                    isUnitedStates
                      ? state.trim()
                        ? 'Tape ou choisis une ville…'
                        : 'D’abord choisis l’État ci-dessus'
                      : 'Tape ou choisis une grande ville…'
                  }
                  className={inputClass}
                  autoComplete="off"
                />
                {isUnitedStates && !state.trim() ? (
                  <p className="mt-1 text-xs text-zinc-500">Les suggestions de ville apparaissent après le choix de l’État.</p>
                ) : null}
                {cityDropdownOpen && cityMatches.length > 0 && (
                  <div className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-zinc-600 bg-zinc-900 shadow-xl [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-600 [&::-webkit-scrollbar-track]:bg-zinc-800 [&::-webkit-scrollbar]:w-2">
                    {cityMatches.map((cityName) => (
                      <button
                        key={cityName}
                        type="button"
                        onClick={() => {
                          setCity(cityName);
                          setCityDropdownOpen(false);
                          setAlternativeCities([]);
                        }}
                        className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${
                          city === cityName ? 'bg-[#00d4ff]/15 font-semibold text-[#00d4ff]' : 'text-zinc-200 hover:bg-zinc-800 hover:text-white'
                        }`}
                      >
                        {cityName}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className={labelClass}>Statut livraison</label>
                <div className="relative" ref={deliveryDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setDeliveryDropdownOpen((v) => !v)}
                    className={`${inputClass} flex items-center justify-between gap-2 text-left`}
                  >
                    <span className="text-white">{deliveryStatus === 'in-transit' ? 'En transit' : 'Livré'}</span>
                    <ChevronDown className={`w-4 h-4 text-zinc-400 flex-shrink-0 transition-transform ${deliveryDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {deliveryDropdownOpen && (
                    <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-zinc-600 bg-zinc-900 shadow-xl">
                      <div className="py-1">
                        <button
                          type="button"
                          onClick={() => { setDeliveryStatus('in-transit'); setDeliveryDropdownOpen(false); }}
                          className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors ${
                            deliveryStatus === 'in-transit' ? 'bg-[#00d4ff]/15 text-[#00d4ff] font-semibold' : 'text-zinc-200 hover:bg-zinc-800 hover:text-white'
                          }`}
                        >
                          En transit
                          {deliveryStatus === 'in-transit' ? <Check className="w-4 h-4 flex-shrink-0" /> : null}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setDeliveryStatus('delivered'); setDeliveryDropdownOpen(false); }}
                          className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors ${
                            deliveryStatus === 'delivered' ? 'bg-[#00d4ff]/15 text-[#00d4ff] font-semibold' : 'text-zinc-200 hover:bg-zinc-800 hover:text-white'
                          }`}
                        >
                          Livré
                          {deliveryStatus === 'delivered' ? <Check className="w-4 h-4 flex-shrink-0" /> : null}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Livraison min</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Livraison max</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !canSubmit}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] py-3.5 text-base font-bold text-black shadow-xl shadow-[#00d4ff]/25 transition-all duration-200 hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:brightness-100 sm:py-4"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Récupération…
                  </>
                ) : (
                  <>
                    <Package className="h-5 w-5" />
                    Obtenir un numéro de suivi
                  </>
                )}
              </button>
            </form>

            {error && (
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-red-500/40 bg-red-500/10 p-4">
                <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-400" />
                <p className="text-sm text-red-200">{error}</p>
              </div>
            )}

            {alternativeCities.length > 0 && (
              <div className="mt-4 rounded-xl border border-[#00d4ff]/35 bg-[#00d4ff]/[0.07] p-4">
                <p className="mb-3 text-sm font-semibold text-[#00d4ff]">Villes plus grandes à essayer</p>
                <p className="mb-3 text-xs text-zinc-400">
                  Clique pour remplir le champ ville et relance « Obtenir un numéro de suivi ».
                </p>
                <div className="flex flex-wrap gap-2">
                  {alternativeCities.map((cName) => (
                    <button
                      key={cName}
                      type="button"
                      onClick={() => {
                        setCity(cName);
                        setAlternativeCities([]);
                        setError(null);
                      }}
                      className="rounded-lg border border-[#00d4ff]/40 bg-zinc-900/80 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[#00d4ff]/20 hover:text-[#00d4ff]"
                    >
                      {cName}
                    </button>
                  ))}
                </div>
              </div>
            )}
              </>
            ) : (
              <>
            <div className="mb-4 flex min-w-0 items-center gap-3">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/90 to-teal-600 shadow-lg ring-2 ring-emerald-500/20">
                <Search className="h-6 w-6 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-bold text-white sm:text-2xl">Rechercher un colis</h1>
                <p className="mt-0.5 truncate text-sm text-zinc-400">Parcell · colis existant</p>
              </div>
            </div>
            <p className="mb-3 text-sm leading-relaxed text-zinc-500">
              Saisis un numéro de suivi pour l&apos;état du colis et le transporteur.
            </p>
            <form onSubmit={handleParcellSearch} className="space-y-4 rounded-2xl border border-zinc-700 bg-zinc-900/50 p-5 shadow-2xl shadow-black/35 backdrop-blur-sm sm:p-6">
              <div>
                <label className={labelClass}>Numéro de suivi</label>
                <input
                  type="text"
                  value={parcellTracking}
                  onChange={(e) => setParcellTracking(e.target.value)}
                  placeholder="Ex. 1Z999AA10123456784"
                  className={inputClass}
                  autoComplete="off"
                />
              </div>
              <button
                type="submit"
                disabled={parcellLoading || !parcellTracking.trim()}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 py-3.5 text-base font-bold text-white shadow-xl transition-all hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 sm:py-4"
              >
                {parcellLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Recherche…
                  </>
                ) : (
                  <>
                    <Search className="h-5 w-5" />
                    Obtenir transporteur et état
                  </>
                )}
              </button>
            </form>
            {parcellError && (
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-red-500/40 bg-red-500/10 p-4">
                <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-400" />
                <p className="text-sm text-red-200">{parcellError}</p>
              </div>
            )}
              </>
            )}
          </div>

          {/* Right panel - Results */}
          <div className="min-h-0 min-w-0 flex-1 overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900/50 shadow-2xl shadow-black/35 backdrop-blur-sm">
            {mainTab === 'tracking-number' ? (
              <>
            <div className="flex items-center gap-3 border-b border-zinc-700 bg-zinc-800/40 px-4 py-3 sm:px-5 sm:py-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#00d4ff]/20 ring-2 ring-[#00d4ff]/20">
                <Calendar className="h-5 w-5 text-[#00d4ff]" />
              </div>
              <h2 className="text-lg font-bold text-white sm:text-xl">Résultats Tracktaco</h2>
              {results.length > 0 && (
                <span className="rounded-full border border-[#00d4ff]/30 bg-[#00d4ff]/25 px-2.5 py-1 text-sm font-semibold text-[#00d4ff]">
                  {results.length} numéro{results.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="min-h-[280px] overflow-x-auto">
              {results.length === 0 ? (
                <div className="relative flex flex-col items-center justify-center px-6 py-16 text-center sm:py-20">
                  <div className="pointer-events-none absolute inset-0 rounded-b-2xl bg-gradient-to-b from-transparent via-[#00d4ff]/5 to-transparent" />
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#00d4ff]/30 bg-gradient-to-br from-[#00d4ff]/20 to-[#00c9b7]/20 shadow-lg shadow-[#00d4ff]/15">
                    <Package className="h-8 w-8 text-[#00d4ff]/80" />
                  </div>
                  <p className="mb-2 text-lg font-bold text-white sm:text-xl">Aucun numéro de suivi</p>
                  <p className="max-w-md text-sm leading-relaxed text-zinc-400">
                    Remplis le formulaire à gauche puis clique sur « Obtenir un numéro de suivi ».
                  </p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-700 bg-zinc-800/50 text-left text-xs uppercase tracking-wide text-zinc-400">
                      <th className="px-3 py-3 font-bold sm:px-4">N° suivi</th>
                      <th className="px-3 py-3 font-bold sm:px-4">Date envoi</th>
                      <th className="px-3 py-3 font-bold sm:px-4">Origine</th>
                      <th className="px-3 py-3 font-bold sm:px-4">Destination</th>
                      <th className="px-3 py-3 font-bold sm:px-4">Livraison est.</th>
                      <th className="px-3 py-3 font-bold sm:px-4">Transporteur</th>
                      <th className="w-20 px-3 py-3 font-bold sm:px-4"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r, i) => (
                      <tr
                        key={`${r.trackingNr}-${i}`}
                        className={`border-b border-zinc-800 transition-colors ${i % 2 === 0 ? 'bg-transparent' : 'bg-zinc-800/30'} hover:bg-[#00d4ff]/5`}
                      >
                        <td className="px-3 py-3 sm:px-4">
                          <button
                            type="button"
                            onClick={() => copyTracking(r.trackingNr)}
                            className="group flex min-w-0 w-full items-center gap-2 text-left"
                            title="Copier le numéro"
                          >
                            <code className="truncate font-mono text-sm text-[#00d4ff] group-hover:underline">{r.trackingNr}</code>
                            {copiedId === r.trackingNr ? <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" /> : <Copy className="w-3.5 h-3.5 text-white/40 group-hover:text-white/70 flex-shrink-0" />}
                          </button>
                        </td>
                        <td className="px-3 py-3 text-zinc-200 sm:px-4">{formatDate(r.shippedAt)}</td>
                        <td className="px-3 py-3 text-zinc-200 sm:px-4">{originStr(r)}</td>
                        <td className="px-3 py-3 text-zinc-200 sm:px-4">{destStr(r)}</td>
                        <td className="px-3 py-3 text-zinc-200 sm:px-4">{formatDate(r.estDeliveryDate)}</td>
                        <td className="px-3 py-3 text-zinc-400 sm:px-4">{r.shipMethod || 'FedEx'}</td>
                        <td className="px-3 py-3 sm:px-4">
                          <button
                            type="button"
                            onClick={() => copyTracking(r.trackingNr)}
                            className="p-2 rounded-xl bg-zinc-800 hover:bg-[#00d4ff]/20 text-zinc-400 hover:text-[#00d4ff] transition-colors border border-transparent hover:border-[#00d4ff]/30"
                            title="Copier le numéro"
                          >
                            {copiedId === r.trackingNr ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
              </>
            ) : (
              <>
            <div className="flex items-center gap-3 border-b border-zinc-700 bg-zinc-800/40 px-4 py-3 sm:px-5 sm:py-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 ring-2 ring-emerald-500/20">
                <Truck className="h-5 w-5 text-emerald-400" />
              </div>
              <h2 className="text-lg font-bold text-white sm:text-xl">Résultats Parcell</h2>
            </div>
            <div className="min-h-[280px]">
              {parcellResult ? (
                <div className="bg-emerald-950/30">
                  <button
                    type="button"
                    onClick={() => setParcellDetailOpen((v) => !v)}
                    className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-3 hover:bg-emerald-950/50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Colis trouvé</p>
                      <div className="flex flex-wrap gap-4">
                        <div className="flex items-center gap-2">
                          <Truck className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                          <span className="text-zinc-400 text-sm">Transporteur</span>
                          <span className="text-white font-semibold">{parcellResult.carrier || '—'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Package className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                          <span className="text-zinc-400 text-sm">État</span>
                          <span className="text-white font-semibold">{parcellResult.status}</span>
                        </div>
                      </div>
                      <p className="mt-2 text-zinc-500 text-xs font-mono truncate">N° {parcellResult.trackingNumber}</p>
                    </div>
                    <span className="text-zinc-400 text-sm flex items-center gap-1 flex-shrink-0">
                      {parcellDetailOpen ? 'Masquer le détail' : 'Voir le détail'}
                      <ChevronRight className={`w-4 h-4 transition-transform ${parcellDetailOpen ? 'rotate-90' : ''}`} />
                    </span>
                  </button>
                  {parcellDetailOpen && (
                    <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-0 border-t border-zinc-800/80">
                      {(parcellResult.origin || parcellResult.destination) && (
                        <div className="flex flex-wrap gap-4 mb-4">
                          {parcellResult.origin != null && (
                            <div className="flex items-center gap-2">
                              <MapPin className="w-4 h-4 text-emerald-400" />
                              <span className="text-zinc-400 text-xs">Origine</span>
                              <span className="text-white text-sm">{formatPlace(parcellResult.origin)}</span>
                            </div>
                          )}
                          {parcellResult.destination != null && (
                            <div className="flex items-center gap-2">
                              <MapPin className="w-4 h-4 text-emerald-400" />
                              <span className="text-zinc-400 text-xs">Destination</span>
                              <span className="text-white text-sm">{formatPlace(parcellResult.destination)}</span>
                            </div>
                          )}
                        </div>
                      )}
                      {parcellResult.dateExpected && (
                        <p className="text-zinc-400 text-xs mb-3">
                          <span className="font-semibold text-zinc-300">Livraison estimée</span> {parcellResult.dateExpected}
                        </p>
                      )}
                      {parcellResult.events && parcellResult.events.length > 0 ? (
                        <div>
                          <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Historique du colis</p>
                          <ul className="space-y-2 max-h-64 overflow-y-auto pr-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-600">
                            {parcellResult.events.map((ev, i) => (
                              <li key={i} className="flex gap-3 text-sm border-l-2 border-emerald-500/30 pl-3 py-1.5">
                                <span className="text-zinc-500 text-xs whitespace-nowrap flex-shrink-0">{ev.date ?? '—'}</span>
                                <span className="text-white">{ev.event ?? ev.description ?? (typeof ev === 'object' ? JSON.stringify(ev) : String(ev))}</span>
                                {ev.location && <span className="text-zinc-400 text-xs flex-shrink-0">· {ev.location}</span>}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <p className="text-zinc-500 text-sm">Aucun événement détaillé disponible.</p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center px-6 py-16 text-center sm:py-20">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/20 to-teal-600/20 shadow-lg">
                    <Search className="h-8 w-8 text-emerald-400/90" />
                  </div>
                  <p className="mb-2 text-lg font-bold text-white sm:text-xl">Aucun colis recherché</p>
                  <p className="max-w-md text-sm leading-relaxed text-zinc-400">
                    Saisis un numéro de suivi à gauche pour afficher le transporteur et l&apos;état du colis.
                  </p>
                </div>
              )}
            </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
