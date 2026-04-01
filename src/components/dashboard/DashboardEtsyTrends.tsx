'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, BarChart3, Zap, ChevronLeft, ChevronRight, Calendar, Clock, Lock } from 'lucide-react';

// ─── Data — extracted from Etsy trending searches ────────────────────────────

type Change = { type: 'up' | 'down' | 'new' | 'stable'; value?: number };

interface TrendItem {
  rank: number;
  phrase: string;
  change: Change;
}

interface BreakthroughItem {
  phrase: string;
}

interface EventItem {
  name: string;
  date: string; // ISO YYYY-MM-DD
  emoji: string;
  category: 'holiday' | 'shopping' | 'seasonal' | 'awareness' | 'celebration';
}

const TRENDING: TrendItem[] = [
  { rank: 1,  phrase: 'wall art',              change: { type: 'up',     value: 2  } },
  { rank: 2,  phrase: 'mothers day',           change: { type: 'up',     value: 18 } },
  { rank: 3,  phrase: 'easter',                change: { type: 'up',     value: 5  } },
  { rank: 4,  phrase: 'tshirt',                change: { type: 'up',     value: 3  } },
  { rank: 5,  phrase: 'digital download',      change: { type: 'up',     value: 7  } },
  { rank: 6,  phrase: 'phone case',            change: { type: 'up',     value: 27 } },
  { rank: 7,  phrase: 'mental health',         change: { type: 'new'               } },
  { rank: 8,  phrase: 'rug',                   change: { type: 'down',   value: 7  } },
  { rank: 9,  phrase: 'mothers day gift',      change: { type: 'new'               } },
  { rank: 10, phrase: 'jesus',                 change: { type: 'new'               } },
  { rank: 11, phrase: 'leather jacket',        change: { type: 'up',     value: 21 } },
  { rank: 12, phrase: 'tote bag',              change: { type: 'up',     value: 2  } },
  { rank: 13, phrase: 'birthday invitation',   change: { type: 'up',     value: 25 } },
  { rank: 14, phrase: 'bookish',               change: { type: 'down',   value: 5  } },
  { rank: 15, phrase: 'mug',                   change: { type: 'down',   value: 4  } },
  { rank: 16, phrase: 'rugs',                  change: { type: 'down',   value: 12 } },
  { rank: 17, phrase: 'wedding invitation',    change: { type: 'new'               } },
  { rank: 18, phrase: 'autism',                change: { type: 'new'               } },
  { rank: 19, phrase: 'baby shower invitation',change: { type: 'up',     value: 17 } },
  { rank: 20, phrase: 'digital wall art',      change: { type: 'down',   value: 1  } },
  { rank: 21, phrase: 'journal',               change: { type: 'new'               } },
  { rank: 22, phrase: 'mothers day png',       change: { type: 'new'               } },
  { rank: 23, phrase: 'png',                   change: { type: 'down',   value: 1  } },
  { rank: 24, phrase: 'coffee mug',            change: { type: 'new'               } },
  { rank: 25, phrase: 'coffee table',          change: { type: 'new'               } },
  { rank: 26, phrase: 'cottagecore',           change: { type: 'new'               } },
  { rank: 27, phrase: 'kantha quilt',          change: { type: 'new'               } },
  { rank: 28, phrase: 'mama',                  change: { type: 'new'               } },
  { rank: 29, phrase: 'minimalist',            change: { type: 'new'               } },
  { rank: 30, phrase: 'planner',               change: { type: 'new'               } },
  { rank: 31, phrase: 'st patricks day',       change: { type: 'down',   value: 29 } },
  { rank: 32, phrase: 'stickers',              change: { type: 'new'               } },
  { rank: 33, phrase: 'teacher gift',          change: { type: 'new'               } },
  { rank: 34, phrase: 'vintage',               change: { type: 'up',     value: 48 } },
  { rank: 35, phrase: 'anime',                 change: { type: 'up',     value: 19 } },
  { rank: 36, phrase: 'anniversary gift',      change: { type: 'down',   value: 1  } },
  { rank: 37, phrase: 'baby shower',           change: { type: 'up',     value: 57 } },
  { rank: 38, phrase: 'birthday card',         change: { type: 'new'               } },
  { rank: 39, phrase: 'cat',                   change: { type: 'down',   value: 21 } },
  { rank: 40, phrase: 'coloring book',         change: { type: 'up',     value: 1  } },
  { rank: 41, phrase: 'habit tracker',         change: { type: 'new'               } },
  { rank: 42, phrase: 'kindle case',           change: { type: 'down',   value: 29 } },
  { rank: 43, phrase: 'necklace',              change: { type: 'down',   value: 22 } },
  { rank: 44, phrase: 'quilt',                 change: { type: 'new'               } },
  { rank: 45, phrase: 'seamless pattern',      change: { type: 'up',     value: 31 } },
  { rank: 46, phrase: 'sticker',               change: { type: 'up',     value: 3  } },
  { rank: 47, phrase: 't shirt',               change: { type: 'up',     value: 4  } },
  { rank: 48, phrase: 'birthday gift',         change: { type: 'new'               } },
  { rank: 49, phrase: 'books',                 change: { type: 'new'               } },
  { rank: 50, phrase: 'brain dump',            change: { type: 'new'               } },
];

const BREAKTHROUGH: BreakthroughItem[] = [
  { phrase: 'mental health'        },
  { phrase: 'mothers day gift'     },
  { phrase: 'jesus'                },
  { phrase: 'wedding invitation'   },
  { phrase: 'autism'               },
  { phrase: 'journal'              },
  { phrase: 'mothers day png'      },
  { phrase: 'coffee mug'           },
  { phrase: 'coffee table'         },
  { phrase: 'cottagecore'          },
  { phrase: 'kantha quilt'         },
  { phrase: 'mama'                 },
  { phrase: 'minimalist'           },
  { phrase: 'planner'              },
  { phrase: 'stickers'             },
  { phrase: 'teacher gift'         },
  { phrase: 'birthday card'        },
  { phrase: 'habit tracker'        },
  { phrase: 'quilt'                },
  { phrase: 'birthday gift'        },
  { phrase: 'books'                },
  { phrase: 'brain dump'           },
  { phrase: 'graduation gift'      },
  { phrase: 'spring garden'        },
  { phrase: 'wildflower'           },
  { phrase: 'cat mom'              },
  { phrase: 'dog mom'              },
  { phrase: 'bible verse'          },
  { phrase: 'prayer journal'       },
  { phrase: 'cinco de mayo'        },
  { phrase: 'teacher appreciation' },
  { phrase: 'end of school'        },
  { phrase: 'summer vibes'         },
  { phrase: 'beach decor'          },
  { phrase: 'mushroom art'         },
  { phrase: 'frog aesthetic'       },
  { phrase: 'personalized gift'    },
  { phrase: 'boho bedroom'         },
  { phrase: 'plant mom'            },
  { phrase: 'cottagecore art'      },
  { phrase: 'mothers day card'     },
  { phrase: 'sunday school'        },
  { phrase: 'graduation 2025'      },
  { phrase: 'retro aesthetic'      },
  { phrase: 'y2k aesthetic'        },
  { phrase: 'dark academia'        },
  { phrase: 'fairy garden'         },
  { phrase: 'mushroom earrings'    },
  { phrase: 'bookmarks handmade'   },
  { phrase: 'pressed flower'       },
  { phrase: 'vintage poster'       },
  { phrase: 'cloud lamp'           },
  { phrase: 'matcha aesthetic'     },
  { phrase: 'comfort food art'     },
  { phrase: 'calico cat'           },
  { phrase: 'frog mug'             },
  { phrase: 'grandma gift'         },
  { phrase: 'new baby gift'        },
  { phrase: 'bachelorette'         },
  { phrase: 'memorial day'         },
];

const EVENTS: EventItem[] = [
  // Janvier
  { name: 'Nouvel An',                        date: '2026-01-01', emoji: '🎆', category: 'holiday'     },
  { name: 'Martin Luther King Day',           date: '2026-01-19', emoji: '✊', category: 'holiday'     },
  // Février
  { name: 'Super Bowl',                       date: '2026-02-08', emoji: '🏈', category: 'celebration' },
  { name: 'Saint-Valentin',                   date: '2026-02-14', emoji: '❤️', category: 'holiday'     },
  { name: "President's Day",                  date: '2026-02-16', emoji: '🇺🇸', category: 'holiday'    },
  { name: 'Nouvel An Lunaire',                date: '2026-02-17', emoji: '🐍', category: 'celebration' },
  { name: 'Mardi Gras',                       date: '2026-02-17', emoji: '🎭', category: 'celebration' },
  { name: 'Ramadan',                          date: '2026-02-18', emoji: '🌙', category: 'holiday'     },
  // Mars
  { name: 'Read Across America Day',          date: '2026-03-02', emoji: '📚', category: 'awareness'   },
  { name: "Employee Appreciation Day",        date: '2026-03-06', emoji: '🙏', category: 'celebration' },
  { name: "Journée Internationale des Femmes",date: '2026-03-08', emoji: '♀️', category: 'awareness'   },
  { name: 'Pi Day',                           date: '2026-03-14', emoji: '🥧', category: 'celebration' },
  { name: "St. Patrick's Day",                 date: '2026-03-17', emoji: '☘️', category: 'holiday'     },
  { name: 'Équinoxe de Printemps',            date: '2026-03-20', emoji: '🌸', category: 'seasonal'    },
  // Avril
  { name: "April Fool's Day",                 date: '2026-04-01', emoji: '🃏', category: 'celebration' },
  { name: 'Vendredi Saint',                   date: '2026-04-03', emoji: '✝️', category: 'holiday'     },
  { name: 'Pâques',                           date: '2026-04-05', emoji: '🐣', category: 'holiday'     },
  { name: 'Tax Day',                          date: '2026-04-15', emoji: '💸', category: 'celebration' },
  { name: 'Earth Day',                        date: '2026-04-22', emoji: '🌍', category: 'awareness'   },
  // Mai
  { name: 'Cinco de Mayo',                    date: '2026-05-05', emoji: '🌮', category: 'celebration' },
  { name: 'Fête des Mères',                   date: '2026-05-10', emoji: '💐', category: 'holiday'     },
  { name: 'Teacher Appreciation Week',        date: '2026-05-04', emoji: '🍎', category: 'celebration' },
  { name: 'Memorial Day',                     date: '2026-05-25', emoji: '🎖️', category: 'holiday'    },
  // Juin
  { name: "Journée de l'Environnement",       date: '2026-06-05', emoji: '🌿', category: 'awareness'   },
  { name: 'Fête des Pères',                   date: '2026-06-21', emoji: '👔', category: 'holiday'     },
  { name: "Solstice d'Été",                    date: '2026-06-21', emoji: '☀️', category: 'seasonal'   },
  { name: 'Juneteenth',                       date: '2026-06-19', emoji: '✊', category: 'holiday'     },
  // Juillet
  { name: 'Independance Day',                 date: '2026-07-04', emoji: '🎇', category: 'holiday'     },
  { name: 'Prime Day (approx.)',              date: '2026-07-15', emoji: '🛒', category: 'shopping'    },
  // Août
  { name: 'Rentrée Scolaire',                 date: '2026-08-24', emoji: '🎒', category: 'celebration' },
  // Septembre
  { name: 'Labor Day',                        date: '2026-09-07', emoji: '🔨', category: 'holiday'     },
  { name: "Équinoxe d'Automne",               date: '2026-09-23', emoji: '🍂', category: 'seasonal'   },
  // Octobre
  { name: 'Breast Cancer Awareness Month',    date: '2026-10-01', emoji: '🎀', category: 'awareness'   },
  { name: 'Columbus Day',                     date: '2026-10-12', emoji: '⚓', category: 'holiday'     },
  { name: 'Halloween',                        date: '2026-10-31', emoji: '🎃', category: 'holiday'     },
  // Novembre
  { name: "Jour des Anciens Combattants",     date: '2026-11-11', emoji: '🎖️', category: 'holiday'    },
  { name: 'Thanksgiving',                     date: '2026-11-26', emoji: '🦃', category: 'holiday'     },
  { name: 'Black Friday',                     date: '2026-11-27', emoji: '🛍️', category: 'shopping'   },
  { name: 'Cyber Monday',                     date: '2026-11-30', emoji: '💻', category: 'shopping'    },
  // Décembre
  { name: 'Hanukkah',                         date: '2026-12-05', emoji: '🕎', category: 'holiday'     },
  { name: "Solstice d'Hiver",                  date: '2026-12-21', emoji: '❄️', category: 'seasonal'   },
  { name: 'Noël',                             date: '2026-12-25', emoji: '🎄', category: 'holiday'     },
  { name: 'Kwanzaa',                          date: '2026-12-26', emoji: '🕯️', category: 'holiday'    },
  { name: 'Nouvel An (veille)',               date: '2026-12-31', emoji: '🥂', category: 'celebration' },
];

const CATEGORY_STYLES: Record<EventItem['category'], { bg: string; text: string; label: string }> = {
  holiday:     { bg: 'bg-[#00d4ff]/10', text: 'text-[#00d4ff]',   label: 'Fête'       },
  shopping:    { bg: 'bg-amber-500/15',  text: 'text-amber-300',   label: 'Shopping'   },
  seasonal:    { bg: 'bg-emerald-500/15',text: 'text-emerald-300', label: 'Saison'     },
  awareness:   { bg: 'bg-sky-500/15',    text: 'text-sky-300',     label: 'Sensib.'    },
  celebration: { bg: 'bg-rose-500/15',   text: 'text-rose-300',    label: 'Célébration'},
};

const PER_PAGE = 10;

// ─── Change badge ─────────────────────────────────────────────────────────────
function ChangeBadge({ change }: { change: Change }) {
  if (change.type === 'new') {
    return (
      <span className="flex items-center gap-1 text-emerald-400 font-medium text-sm">
        <TrendingUp size={13} />
        <span>new</span>
      </span>
    );
  }
  if (change.type === 'up') {
    return (
      <span className="flex items-center gap-1 text-emerald-400 font-medium text-sm">
        <TrendingUp size={13} />
        <span>{change.value}</span>
      </span>
    );
  }
  if (change.type === 'down') {
    return (
      <span className="flex items-center gap-1 text-red-400 font-medium text-sm">
        <TrendingDown size={13} />
        <span>-{change.value}</span>
      </span>
    );
  }
  return <Minus size={13} className="text-white/30" />;
}

// ─── Pagination controls ──────────────────────────────────────────────────────
function Pagination({
  page, total, onPrev, onNext,
}: { page: number; total: number; onPrev: () => void; onNext: () => void }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-white/10 text-xs text-white/40">
      <span>Page {page} / {total}</span>
      <div className="flex gap-2">
        <button
          onClick={onPrev}
          disabled={page <= 1}
          className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-white transition-colors"
        >
          <span className="flex items-center gap-1"><ChevronLeft size={12} /> Précédent</span>
        </button>
        <button
          onClick={onNext}
          disabled={page >= total}
          className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-white transition-colors"
        >
          <span className="flex items-center gap-1">Suivant <ChevronRight size={12} /></span>
        </button>
      </div>
    </div>
  );
}

// ─── Days until helper ────────────────────────────────────────────────────────
function daysUntil(isoDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(isoDate);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

// ─── Free tier lock banner ────────────────────────────────────────────────────
function FreeLockBanner({ label, onUpgrade }: { label: string; onUpgrade?: () => void }) {
  return (
    <div className="border-t border-white/10 px-5 py-4 flex items-center justify-between gap-4 bg-[#00d4ff]/3">
      <div className="flex items-center gap-2 text-white/50 text-sm">
        <Lock size={13} className="text-[#00d4ff] flex-shrink-0" />
        <span>{label} avec un abonnement payant</span>
      </div>
      <button
        onClick={onUpgrade}
        className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white text-xs font-semibold hover:opacity-90 transition-opacity"
      >
        Débloquer
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function DashboardEtsyTrends({ isFreeUser = false, onUpgrade }: { isFreeUser?: boolean; onUpgrade?: () => void }) {
  const [trendPage, setTrendPage] = useState(1);
  const [breakPage, setBreakPage] = useState(1);
  const [activeMonth, setActiveMonth] = useState<string | null>(null);

  const trendTotal = Math.ceil(TRENDING.length / PER_PAGE);
  const breakTotal = Math.ceil(BREAKTHROUGH.length / PER_PAGE);

  const trendSlice = TRENDING.slice((trendPage - 1) * PER_PAGE, trendPage * PER_PAGE);
  const breakSlice = BREAKTHROUGH.slice((breakPage - 1) * PER_PAGE, breakPage * PER_PAGE);

  // Sort events by date and compute days until
  const sortedEvents = useMemo(() => {
    return EVENTS
      .map(e => ({ ...e, days: daysUntil(e.date) }))
      .sort((a, b) => a.days - b.days);
  }, []);

  // Group by month label
  const months = useMemo(() => {
    const map = new Map<string, typeof sortedEvents>();
    for (const e of sortedEvents) {
      const label = new Date(e.date).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(e);
    }
    return Array.from(map.entries());
  }, [sortedEvents]);

  const filteredEvents = useMemo(() => {
    if (!activeMonth) return sortedEvents;
    return sortedEvents.filter(e =>
      new Date(e.date).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) === activeMonth
    );
  }, [sortedEvents, activeMonth]);

  // Next upcoming event
  const nextEvent = sortedEvents.find(e => e.days >= 0);

  return (
    <div className="p-4 md:p-8 bg-black min-h-screen pb-12">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Etsy Trends</h1>
              <p className="text-white/50 text-sm mt-0.5">Recherches tendances sur Etsy — mises à jour mensuellement</p>
            </div>
          </div>
        </motion.div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">

          {/* ── Recherches Tendances du Mois ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="bg-white/3 border border-white/10 rounded-xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <TrendingUp size={16} className="text-emerald-400" />
                Recherches Tendances du Mois
              </h2>
              <span className="text-xs text-white/30 bg-white/5 px-2 py-0.5 rounded-full">{TRENDING.length} phrases</span>
            </div>

            <div className="grid grid-cols-[48px_1fr_80px] px-5 py-2 border-b border-white/5">
              <span className="text-[11px] font-semibold text-white/30 uppercase tracking-wider">Rang</span>
              <span className="text-[11px] font-semibold text-white/30 uppercase tracking-wider">Expression</span>
              <span className="text-[11px] font-semibold text-white/30 uppercase tracking-wider text-right">Évolution</span>
            </div>

            {/* Free: show first 10 + blurred lock overlay on rest */}
            {isFreeUser ? (
              <div className="relative">
                <div className="divide-y divide-white/5">
                  {TRENDING.slice(0, 10).map((item) => (
                    <div key={item.rank} className="grid grid-cols-[48px_1fr_80px] px-5 py-3 items-center">
                      <span className="text-white/40 text-sm font-mono">{item.rank}.</span>
                      <span className="text-white text-sm font-medium capitalize">{item.phrase}</span>
                      <div className="flex justify-end"><ChangeBadge change={item.change} /></div>
                    </div>
                  ))}
                  {/* Blurred rows preview */}
                  {TRENDING.slice(10, 14).map((item) => (
                    <div key={item.rank} className="grid grid-cols-[48px_1fr_80px] px-5 py-3 items-center blur-sm select-none pointer-events-none opacity-60">
                      <span className="text-white/40 text-sm font-mono">{item.rank}.</span>
                      <span className="text-white text-sm font-medium capitalize">{item.phrase}</span>
                      <div className="flex justify-end"><ChangeBadge change={item.change} /></div>
                    </div>
                  ))}
                </div>
                <FreeLockBanner label={`+${TRENDING.length - 10} recherches supplémentaires`} onUpgrade={onUpgrade} />
              </div>
            ) : (
              <>
                <div className="divide-y divide-white/5">
                  {trendSlice.map((item) => (
                    <div key={item.rank} className="grid grid-cols-[48px_1fr_80px] px-5 py-3 hover:bg-white/3 transition-colors items-center">
                      <span className="text-white/40 text-sm font-mono">{item.rank}.</span>
                      <span className="text-white text-sm font-medium capitalize">{item.phrase}</span>
                      <div className="flex justify-end"><ChangeBadge change={item.change} /></div>
                    </div>
                  ))}
                </div>
                <Pagination
                  page={trendPage} total={trendTotal}
                  onPrev={() => setTrendPage(p => Math.max(1, p - 1))}
                  onNext={() => setTrendPage(p => Math.min(trendTotal, p + 1))}
                />
              </>
            )}
          </motion.div>

          {/* ── Recherches Émergentes ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="bg-white/3 border border-white/10 rounded-xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Zap size={16} className="text-amber-400" />
                Recherches Émergentes
              </h2>
              <span className="text-xs text-white/30 bg-white/5 px-2 py-0.5 rounded-full">{BREAKTHROUGH.length} phrases</span>
            </div>

            <div className="grid grid-cols-[1fr_80px] px-5 py-2 border-b border-white/5">
              <span className="text-[11px] font-semibold text-white/30 uppercase tracking-wider">Expression</span>
              <span className="text-[11px] font-semibold text-white/30 uppercase tracking-wider text-right">Évolution</span>
            </div>

            {isFreeUser ? (
              <div className="relative">
                <div className="divide-y divide-white/5">
                  {BREAKTHROUGH.slice(0, 10).map((item) => (
                    <div key={item.phrase} className="grid grid-cols-[1fr_80px] px-5 py-3 items-center">
                      <span className="text-white text-sm font-medium capitalize">{item.phrase}</span>
                      <div className="flex justify-end">
                        <span className="flex items-center gap-1 text-emerald-400 font-medium text-sm"><TrendingUp size={13} /><span>new</span></span>
                      </div>
                    </div>
                  ))}
                  {BREAKTHROUGH.slice(10, 14).map((item) => (
                    <div key={item.phrase} className="grid grid-cols-[1fr_80px] px-5 py-3 items-center blur-sm select-none pointer-events-none opacity-60">
                      <span className="text-white text-sm font-medium capitalize">{item.phrase}</span>
                      <div className="flex justify-end">
                        <span className="flex items-center gap-1 text-emerald-400 font-medium text-sm"><TrendingUp size={13} /><span>new</span></span>
                      </div>
                    </div>
                  ))}
                </div>
                <FreeLockBanner label={`+${BREAKTHROUGH.length - 10} recherches supplémentaires`} onUpgrade={onUpgrade} />
              </div>
            ) : (
              <>
                <div className="divide-y divide-white/5">
                  {breakSlice.map((item) => (
                    <div key={item.phrase} className="grid grid-cols-[1fr_80px] px-5 py-3 hover:bg-white/3 transition-colors items-center">
                      <span className="text-white text-sm font-medium capitalize">{item.phrase}</span>
                      <div className="flex justify-end">
                        <span className="flex items-center gap-1 text-emerald-400 font-medium text-sm"><TrendingUp size={13} /><span>new</span></span>
                      </div>
                    </div>
                  ))}
                </div>
                <Pagination
                  page={breakPage} total={breakTotal}
                  onPrev={() => setBreakPage(p => Math.max(1, p - 1))}
                  onNext={() => setBreakPage(p => Math.min(breakTotal, p + 1))}
                />
              </>
            )}
          </motion.div>

        </div>

        {/* ── Événements à Venir ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Calendar size={16} className="text-[#00d4ff]" />
              Événements à venir
            </h2>
            {nextEvent && (
              <span className="text-xs text-white/40 hidden sm:block">
                Prochain : <span className="text-[#00d4ff] font-medium">{nextEvent.emoji} {nextEvent.name}</span>{' '}
                {nextEvent.days === 0 ? "— aujourd'hui" : `dans ${nextEvent.days}j`}
              </span>
            )}
          </div>

          {/* Month filter */}
          <div className="flex gap-1.5 flex-wrap mb-3">
            <button
              onClick={() => setActiveMonth(null)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                activeMonth === null
                  ? 'bg-[#00d4ff]/15 text-[#00d4ff] border border-[#00d4ff]/30'
                  : 'bg-white/5 text-white/40 border border-white/10 hover:bg-white/8'
              }`}
            >Tous</button>
            {months.map(([label]) => (
              <button
                key={label}
                onClick={() => setActiveMonth(label === activeMonth ? null : label)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize transition-colors ${
                  activeMonth === label
                    ? 'bg-[#00d4ff]/15 text-[#00d4ff] border border-[#00d4ff]/30'
                    : 'bg-white/5 text-white/40 border border-white/10 hover:bg-white/8'
                }`}
              >{label}</button>
            ))}
          </div>

          {/* Events list — compact rows */}
          <div className="rounded-xl border border-white/10 overflow-hidden">
            {filteredEvents.map((event) => {
              const s = CATEGORY_STYLES[event.category];
              const isPast = event.days < 0;
              const isSoon = event.days >= 0 && event.days <= 14;
              return (
                <div
                  key={event.date + event.name}
                  className={`flex items-center gap-3 px-4 py-2.5 border-b border-white/5 last:border-0 transition-colors ${
                    isPast ? 'opacity-30' : 'hover:bg-white/3'
                  }`}
                >
                  <span className="text-base flex-shrink-0 w-6 text-center">{event.emoji}</span>
                  <span className="flex-1 text-sm text-white font-medium">{event.name}</span>
                  <span className="text-xs text-white/40 hidden sm:block w-20 text-right flex-shrink-0">
                    {new Date(event.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </span>
                  <span className={`text-xs font-bold w-10 text-right flex-shrink-0 ${
                    isPast ? 'text-white/20' : isSoon ? 'text-[#00d4ff]' : 'text-white/50'
                  }`}>
                    {isPast ? '—' : event.days === 0 ? 'Auj.' : `J-${event.days}`}
                  </span>
                  <span className={`hidden md:block text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${s.bg} ${s.text}`}>
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </motion.div>

        <p className="mt-6 text-xs text-white/20 text-center">
          Données basées sur les tendances de recherche Etsy · Mise à jour mensuelle
        </p>
      </div>
    </div>
  );
}
