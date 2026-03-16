'use client';

import { useState, useRef, useEffect } from 'react';
import { Package, Loader2, Copy, Check, AlertCircle, Calendar, ChevronDown, Search, Truck, ChevronRight, MapPin } from 'lucide-react';
import { supabase } from '@/lib/supabase';

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

export function DashboardTracking() {
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

  const [parcellTracking, setParcellTracking] = useState('');
  const [parcellLoading, setParcellLoading] = useState(false);
  const [parcellResult, setParcellResult] = useState<ParcellResult | null>(null);
  const [parcellError, setParcellError] = useState<string | null>(null);
  const [parcellDetailOpen, setParcellDetailOpen] = useState(false);

  const carrier = 'fedex';
  const type = 'intl';

  const countryMatches = countryInput.trim().length >= 1
    ? COUNTRY_LIST.filter(
        (c) =>
          c.name.toLowerCase().includes(countryInput.toLowerCase().trim()) ||
          c.code.toLowerCase().includes(countryInput.toLowerCase().trim())
      ).slice(0, 12)
    : [];

  const currentCountryName = COUNTRY_LIST.find((c) => c.code === country)?.name;
  const countryInputMismatch = country && currentCountryName !== countryInput.trim();
  const effectiveCountry = countryInputMismatch ? '' : country;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (deliveryDropdownRef.current && !deliveryDropdownRef.current.contains(target)) setDeliveryDropdownOpen(false);
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(target)) setCountryDropdownOpen(false);
    }
    if (deliveryDropdownOpen || countryDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [deliveryDropdownOpen, countryDropdownOpen]);

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
        if (state.trim()) body.state = state.toUpperCase().slice(0, 2);
        if (city.trim()) body.city = city.trim();
      } else {
        if (state.trim()) body.state = state.toUpperCase().slice(0, 2);
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

  const inputClass = 'w-full px-4 py-3 rounded-xl bg-zinc-900/80 border-2 border-zinc-700 text-white placeholder-zinc-500 hover:border-zinc-600 focus:border-[#00d4ff] focus:ring-4 focus:ring-[#00d4ff]/25 focus:outline-none text-sm transition-all duration-200';
  const labelClass = 'block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-2';

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-black to-black p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
          {/* Left panel - Form */}
          <div className="lg:w-[420px] flex-shrink-0">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#00d4ff] to-[#00c9b7] flex items-center justify-center shadow-xl shadow-[#00d4ff]/30 flex-shrink-0 ring-2 ring-[#00d4ff]/20">
                  <Package className="w-7 h-7 text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-2xl font-bold text-white truncate">Obtenir un suivi</h1>
                  <p className="text-zinc-400 text-sm mt-0.5">Tracktaco · Generer un numero (FedEx)</p>
                </div>
              </div>
            </div>
            <p className="text-xs text-zinc-500 mb-4 leading-relaxed">
              Ce bloc sert a generer un numero de suivi test selon tes filtres (pays, ville, statut).
            </p>

            <form onSubmit={handleSubmit} className="rounded-2xl border-2 border-zinc-800 bg-zinc-900/50 p-6 sm:p-7 space-y-5 shadow-2xl shadow-black/40 backdrop-blur-sm">
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
                  <div className="absolute z-50 mt-1 w-full rounded-xl border-2 border-zinc-700 bg-zinc-900 shadow-xl shadow-black/50 overflow-hidden max-h-64 overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-zinc-800 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-600">
                    {countryMatches.map((c) => (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => {
                          setCountry(c.code);
                          setCountryInput(c.name);
                          setCountryDropdownOpen(false);
                        }}
                        className={`w-full px-4 py-2.5 text-left text-sm transition-colors flex items-center justify-between ${
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
                  <div className="absolute z-50 mt-1 w-full rounded-xl border-2 border-zinc-700 bg-zinc-900 shadow-xl shadow-black/50 px-4 py-3 text-sm text-zinc-400">
                    Aucun pays trouvé pour « {countryInput.trim()} »
                  </div>
                )}
              </div>

              <div>
                <label className={labelClass}>État (optionnel)</label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value.toUpperCase().slice(0, 2))}
                  placeholder="GA"
                  className={inputClass}
                  maxLength={2}
                />
              </div>

              <div>
                <label className={labelClass}>Ville (optionnel)</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Atlanta"
                  className={inputClass}
                />
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
                    <div className="absolute z-50 mt-1 w-full rounded-xl border-2 border-zinc-700 bg-zinc-900 shadow-xl shadow-black/50 overflow-hidden">
                      <div className="py-1">
                        <button
                          type="button"
                          onClick={() => { setDeliveryStatus('in-transit'); setDeliveryDropdownOpen(false); }}
                          className={`w-full px-4 py-3 text-left text-sm transition-colors flex items-center justify-between ${
                            deliveryStatus === 'in-transit' ? 'bg-[#00d4ff]/15 text-[#00d4ff] font-semibold' : 'text-zinc-200 hover:bg-zinc-800 hover:text-white'
                          }`}
                        >
                          En transit
                          {deliveryStatus === 'in-transit' ? <Check className="w-4 h-4 flex-shrink-0" /> : null}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setDeliveryStatus('delivered'); setDeliveryDropdownOpen(false); }}
                          className={`w-full px-4 py-3 text-left text-sm transition-colors flex items-center justify-between ${
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
                  <label className={labelClass}>Date livraison min</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Date livraison max</label>
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
                className="w-full py-4 rounded-xl bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-black font-bold flex items-center justify-center gap-2 text-base shadow-xl shadow-[#00d4ff]/25 hover:shadow-2xl hover:shadow-[#00d4ff]/35 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all duration-200"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Récupération...
                  </>
                ) : (
                  <>
                    <Package className="w-5 h-5" />
                    Obtenir un numéro de suivi
                  </>
                )}
              </button>
            </form>

            {error && (
              <div className="mt-4 p-4 rounded-xl bg-red-500/10 border-2 border-red-500/40 flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-red-200 text-sm">{error}</p>
              </div>
            )}

            {/* Parcell App : rechercher un colis par numéro de suivi */}
            <div className="mt-8 flex items-center gap-3 min-w-0">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/90 to-teal-600 flex items-center justify-center shadow-xl flex-shrink-0 ring-2 ring-emerald-500/20">
                <Search className="w-7 h-7 text-white" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-white truncate">Rechercher un colis</h2>
                <p className="text-zinc-400 text-sm mt-0.5">Parcell App · Suivre un colis existant</p>
              </div>
            </div>
            <p className="text-xs text-zinc-500 mt-2 mb-3 leading-relaxed">
              Entre un numero de suivi pour obtenir l'etat du colis et identifier son transporteur.
            </p>
            <form onSubmit={handleParcellSearch} className="mt-4 rounded-2xl border-2 border-zinc-800 bg-zinc-900/50 p-6 sm:p-7 space-y-4 shadow-2xl shadow-black/40 backdrop-blur-sm">
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
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold flex items-center justify-center gap-2 text-sm shadow-xl hover:opacity-95 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {parcellLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Recherche...
                  </>
                ) : (
                  <>
                    <Search className="w-5 h-5" />
                    Obtenir transporteur et état
                  </>
                )}
              </button>
            </form>
            {parcellError && (
              <div className="mt-3 p-4 rounded-xl bg-red-500/10 border-2 border-red-500/40 flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-red-200 text-sm">{parcellError}</p>
              </div>
            )}
          </div>

          {/* Right panel - Results table */}
          <div className="flex-1 min-w-0 rounded-2xl border-2 border-zinc-800 bg-zinc-900/50 overflow-hidden shadow-2xl shadow-black/40 backdrop-blur-sm">
            <div className="p-4 sm:p-5 border-b-2 border-zinc-800 flex items-center gap-3 bg-zinc-800/30">
              <div className="w-10 h-10 rounded-xl bg-[#00d4ff]/20 flex items-center justify-center ring-2 ring-[#00d4ff]/20">
                <Calendar className="w-5 h-5 text-[#00d4ff]" />
              </div>
              <h2 className="text-lg font-bold text-white">Résultats</h2>
              {results.length > 0 && (
                <span className="px-3 py-1 rounded-full bg-[#00d4ff]/25 text-[#00d4ff] text-sm font-semibold border border-[#00d4ff]/30">
                  {results.length} numéro{results.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            {parcellResult && (
              <div className="border-b-2 border-zinc-800 bg-emerald-950/30">
                <button
                  type="button"
                  onClick={() => setParcellDetailOpen((v) => !v)}
                  className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-3 hover:bg-emerald-950/50 transition-colors rounded-t-lg"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Recherche Parcell</p>
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
            )}
            <div className="overflow-x-auto min-h-[320px]">
              {results.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center px-8 relative">
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#00d4ff]/5 to-transparent pointer-events-none rounded-b-2xl" />
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#00d4ff]/20 to-[#00c9b7]/20 border-2 border-[#00d4ff]/30 flex items-center justify-center mb-5 shadow-lg shadow-[#00d4ff]/10">
                    <Package className="w-10 h-10 text-[#00d4ff]/70" />
                  </div>
                  <p className="text-xl font-bold text-white mb-1">Aucun numéro de suivi</p>
                  <p className="text-zinc-400 text-sm max-w-sm leading-relaxed">Utilise Tracktaco pour generer un numero de suivi, ou Parcell App pour suivre un colis existant et voir son transporteur.</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-zinc-700 text-left text-zinc-400 text-xs uppercase tracking-wider bg-zinc-800/50">
                      <th className="py-4 px-4 font-bold">N° suivi</th>
                      <th className="py-4 px-4 font-bold">Date envoi</th>
                      <th className="py-4 px-4 font-bold">Origine</th>
                      <th className="py-4 px-4 font-bold">Destination</th>
                      <th className="py-4 px-4 font-bold">Livraison estimée</th>
                      <th className="py-4 px-4 font-bold">Transporteur</th>
                      <th className="py-4 px-4 font-bold w-20"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r, i) => (
                      <tr
                        key={`${r.trackingNr}-${i}`}
                        className={`border-b border-zinc-800 transition-colors ${i % 2 === 0 ? 'bg-transparent' : 'bg-zinc-800/30'} hover:bg-[#00d4ff]/5`}
                      >
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => copyTracking(r.trackingNr)}
                            className="group flex items-center gap-2 text-left w-full min-w-0"
                            title="Copier le numéro"
                          >
                            <code className="text-[#00d4ff] font-mono text-xs truncate group-hover:underline">{r.trackingNr}</code>
                            {copiedId === r.trackingNr ? <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" /> : <Copy className="w-3.5 h-3.5 text-white/40 group-hover:text-white/70 flex-shrink-0" />}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-zinc-200">{formatDate(r.shippedAt)}</td>
                        <td className="py-3 px-4 text-zinc-200">{originStr(r)}</td>
                        <td className="py-3 px-4 text-zinc-200">{destStr(r)}</td>
                        <td className="py-3 px-4 text-zinc-200">{formatDate(r.estDeliveryDate)}</td>
                        <td className="py-3 px-4 text-zinc-400">{r.shipMethod || 'FedEx'}</td>
                        <td className="py-3 px-4">
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
          </div>
        </div>
      </div>
    </div>
  );
}
