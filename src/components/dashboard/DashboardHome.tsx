'use client';

import type { ComponentType, ReactNode } from 'react';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  Coins,
  Copy,
  FileSearch,
  Image as ImageIcon,
  FileText,
  Layers3,
  LineChart,
  PauseCircle,
  PlayCircle,
  Search,
  Sparkles,
  Target,
  Wand2,
} from 'lucide-react';

type DashboardActionTarget =
  | 'quick-generate'
  | 'listing'
  | 'images'
  | 'competitors'
  | 'keyword-research';

interface DashboardHomeProps {
  onNavigate: (section: DashboardActionTarget) => void;
}

interface KpiItem {
  label: string;
  value: string;
  helper: string;
  icon: ComponentType<{ className?: string }>;
}

type ContinueItem = {
  title: string;
  name: string;
  meta: string;
  cta: string;
  icon: ComponentType<{ className?: string }>;
  target: DashboardActionTarget;
};

type PriorityItem = {
  title: string;
  description: string;
  cta: string;
  target: DashboardActionTarget;
};

type WorkStatus = 'Brouillon' | 'Termine' | 'A optimiser' | 'En attente';
type WorkItem = {
  name: string;
  type: string;
  updatedAt: string;
  status: WorkStatus;
  target: DashboardActionTarget;
  cta: string;
};

const continueItems: ContinueItem[] = [
  {
    title: 'Dernier listing',
    name: 'Mini porte fee boho',
    meta: 'Modifie il y a 2h',
    cta: 'Reprendre',
    icon: FileText,
    target: 'listing',
  },
  {
    title: 'Derniere analyse boutique',
    name: 'MegaMarketd',
    meta: 'Score global 67/100',
    cta: 'Optimiser',
    icon: Target,
    target: 'competitors',
  },
  {
    title: 'Derniere recherche mot-cle',
    name: 'fairy door decor',
    meta: '18 idees trouvees',
    cta: 'Voir',
    icon: Search,
    target: 'keyword-research',
  },
  {
    title: "Derniere generation d'image",
    name: 'Pack lifestyle 1080x1080',
    meta: '4 variantes pretes',
    cta: 'Dupliquer',
    icon: ImageIcon,
    target: 'images',
  },
];

const priorities: PriorityItem[] = [
  {
    title: 'Optimiser votre dernier listing',
    description: 'Le score tags est faible. Ajoutez des tags long-tail plus precis.',
    cta: 'Optimiser',
    target: 'listing',
  },
  {
    title: 'Analyser une boutique concurrente',
    description: 'Vous avez une analyse datee. Lancez un refresh concurrentiel.',
    cta: 'Analyser',
    target: 'competitors',
  },
  {
    title: 'Reprendre votre dernier keyword research',
    description: 'Transformez vos mots-cles recents en nouveau listing.',
    cta: 'Reprendre',
    target: 'keyword-research',
  },
  {
    title: "Generer le visuel principal d'un brouillon",
    description: "Un listing en brouillon n'a pas encore d'image hero.",
    cta: 'Generer',
    target: 'images',
  },
  {
    title: 'Finaliser un listing en attente',
    description: 'Completer la description et publier pour lancer le test.',
    cta: 'Finaliser',
    target: 'listing',
  },
];

const workInProgress: WorkItem[] = [
  {
    name: 'Porte fee rustique',
    type: 'Listing draft',
    updatedAt: "Aujourd'hui, 09:42",
    status: 'Brouillon',
    target: 'listing',
    cta: 'Continuer',
  },
  {
    name: 'Analyse Boutique - FairyNest',
    type: 'Shop analysis',
    updatedAt: 'Hier, 18:10',
    status: 'A optimiser',
    target: 'competitors',
    cta: 'Relancer',
  },
  {
    name: 'Keyword niche decor fantasy',
    type: 'Keyword research',
    updatedAt: 'Hier, 16:03',
    status: 'En attente',
    target: 'keyword-research',
    cta: 'Reprendre',
  },
  {
    name: 'Visuel listing #128',
    type: 'Image generation',
    updatedAt: 'Lun. 14:22',
    status: 'Termine',
    target: 'images',
    cta: 'Dupliquer',
  },
];

const kpis: KpiItem[] = [
  { label: 'Brouillons en cours', value: '7', helper: '2 a traiter aujourd hui', icon: Layers3 },
  { label: 'Credits restants', value: '186', helper: 'Plan Pro actif', icon: Coins },
  { label: 'Analyses cette semaine', value: '14', helper: '+4 vs semaine derniere', icon: FileSearch },
  { label: 'Listings a optimiser', value: '5', helper: 'Priorite elevee: 2', icon: LineChart },
];

const insights = [
  'Votre dernier listing a un score tags faible.',
  "Aucun keyword research n'a ete lance depuis 5 jours.",
  '2 brouillons n ont pas ete finalises.',
  'Votre derniere boutique analysee merite une relance.',
];

function CardShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-lg shadow-black/20">
      <h3 className="text-white font-semibold mb-4">{title}</h3>
      {children}
    </div>
  );
}

function statusBadgeClass(status: WorkStatus): string {
  if (status === 'Termine') return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
  if (status === 'Brouillon') return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
  if (status === 'A optimiser') return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
  return 'bg-white/10 text-white/70 border-white/20';
}

export function DashboardHome({ onNavigate }: DashboardHomeProps) {
  return (
    <div className="p-4 md:p-8 bg-black">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-white">Dashboard</h1>
          <p className="text-white/60 mt-1">Reprenez rapidement votre travail sur Etsmart</p>
        </div>

        <div className="space-y-3">
          <h2 className="text-white font-semibold text-lg">Continuer ou vous vous etes arrete</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {continueItems.map((item) => (
              <div key={item.title} className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-lg shadow-black/20">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-white/60">{item.title}</p>
                  <item.icon className="w-4 h-4 text-[#00d4ff]" />
                </div>
                <p className="text-sm font-semibold text-white mb-1 line-clamp-1">{item.name}</p>
                <p className="text-xs text-white/50 mb-3">{item.meta}</p>
                <button
                  onClick={() => onNavigate(item.target)}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-[#00d4ff]/40 bg-[#00d4ff]/10 px-3 py-2 text-sm font-medium text-[#9befff] hover:bg-[#00d4ff]/20"
                >
                  {item.cta}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-lg shadow-black/20">
              <div className="flex items-center justify-between mb-2">
                <p className="text-white/60 text-sm">{kpi.label}</p>
                <kpi.icon className="w-4 h-4 text-[#00d4ff]" />
              </div>
              <p className="text-2xl font-bold text-white">{kpi.value}</p>
              <p className="text-xs text-white/50 mt-1">{kpi.helper}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <CardShell title="Priorites">
            <div className="space-y-3">
              {priorities.map((item) => (
                <div key={item.title} className="rounded-xl border border-white/10 bg-black/30 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium">{item.title}</p>
                      <p className="text-xs text-white/60 mt-1">{item.description}</p>
                    </div>
                    <button
                      onClick={() => onNavigate(item.target)}
                      className="flex-shrink-0 px-3 py-1.5 rounded-lg border border-[#00d4ff]/40 bg-[#00d4ff]/10 text-xs text-[#9befff] hover:bg-[#00d4ff]/20"
                    >
                      {item.cta}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </CardShell>

          <CardShell title="Insights">
            <div className="space-y-3">
              {insights.map((item) => (
                <div key={item} className="rounded-xl border border-white/10 bg-black/30 p-3 flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-[#00d4ff] mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-white/85">{item}</p>
                </div>
              ))}
            </div>
          </CardShell>
        </div>

        <CardShell title="Travaux en cours">
          <div className="space-y-2">
            {workInProgress.map((item) => (
              <div key={item.name} className="rounded-xl border border-white/10 bg-black/30 p-3">
                <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white line-clamp-1">{item.name}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/55">
                      <span>{item.type}</span>
                      <span>•</span>
                      <span className="inline-flex items-center gap-1">
                        <Clock3 className="w-3.5 h-3.5" />
                        {item.updatedAt}
                      </span>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs ${statusBadgeClass(item.status)}`}>
                    {item.status === 'Termine' && <CheckCircle2 className="w-3.5 h-3.5" />}
                    {item.status === 'Brouillon' && <PlayCircle className="w-3.5 h-3.5" />}
                    {item.status === 'A optimiser' && <LineChart className="w-3.5 h-3.5" />}
                    {item.status === 'En attente' && <PauseCircle className="w-3.5 h-3.5" />}
                    {item.status}
                  </span>
                  <button
                    onClick={() => onNavigate(item.target)}
                    className="md:ml-auto px-3 py-1.5 rounded-lg border border-white/20 text-xs text-white/80 hover:bg-white/10 inline-flex items-center gap-1.5"
                  >
                    {item.cta}
                    {item.cta === 'Dupliquer' ? <Copy className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </CardShell>
      </div>
    </div>
  );
}
