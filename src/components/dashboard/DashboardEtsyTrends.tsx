'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, BarChart3, Zap, ChevronLeft, ChevronRight } from 'lucide-react';

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
      <span>Page {page} of {total}</span>
      <div className="flex gap-2">
        <button
          onClick={onPrev}
          disabled={page <= 1}
          className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-white transition-colors"
        >
          <span className="flex items-center gap-1"><ChevronLeft size={12} /> Previous</span>
        </button>
        <button
          onClick={onNext}
          disabled={page >= total}
          className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-white transition-colors"
        >
          <span className="flex items-center gap-1">Next <ChevronRight size={12} /></span>
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function DashboardEtsyTrends() {
  const [trendPage, setTrendPage] = useState(1);
  const [breakPage, setBreakPage] = useState(1);

  const trendTotal = Math.ceil(TRENDING.length / PER_PAGE);
  const breakTotal = Math.ceil(BREAKTHROUGH.length / PER_PAGE);

  const trendSlice = TRENDING.slice((trendPage - 1) * PER_PAGE, trendPage * PER_PAGE);
  const breakSlice = BREAKTHROUGH.slice((breakPage - 1) * PER_PAGE, breakPage * PER_PAGE);

  return (
    <div className="p-4 md:p-8 bg-black min-h-screen pb-12">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex items-center gap-3 mb-4">
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* ── Trending Monthly Searches ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="bg-white/3 border border-white/10 rounded-xl overflow-hidden"
          >
            {/* Panel header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <TrendingUp size={16} className="text-emerald-400" />
                Recherches Tendances du Mois
              </h2>
              <span className="text-xs text-white/30 bg-white/5 px-2 py-0.5 rounded-full">{TRENDING.length} phrases</span>
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-[48px_1fr_80px] px-5 py-2 border-b border-white/5">
              <span className="text-[11px] font-semibold text-white/30 uppercase tracking-wider">Rank</span>
              <span className="text-[11px] font-semibold text-white/30 uppercase tracking-wider">Search Phrase</span>
              <span className="text-[11px] font-semibold text-white/30 uppercase tracking-wider text-right">Change</span>
            </div>

            {/* Rows */}
            <div className="divide-y divide-white/5">
              {trendSlice.map((item) => (
                <div key={item.rank} className="grid grid-cols-[48px_1fr_80px] px-5 py-3 hover:bg-white/3 transition-colors items-center">
                  <span className="text-white/40 text-sm font-mono">{item.rank}.</span>
                  <span className="text-white text-sm font-medium capitalize">{item.phrase}</span>
                  <div className="flex justify-end">
                    <ChangeBadge change={item.change} />
                  </div>
                </div>
              ))}
            </div>

            <Pagination
              page={trendPage} total={trendTotal}
              onPrev={() => setTrendPage(p => Math.max(1, p - 1))}
              onNext={() => setTrendPage(p => Math.min(trendTotal, p + 1))}
            />
          </motion.div>

          {/* ── Breakthrough Searches ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="bg-white/3 border border-white/10 rounded-xl overflow-hidden"
          >
            {/* Panel header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Zap size={16} className="text-amber-400" />
                Recherches Émergentes
              </h2>
              <span className="text-xs text-white/30 bg-white/5 px-2 py-0.5 rounded-full">{BREAKTHROUGH.length} phrases</span>
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-[1fr_80px] px-5 py-2 border-b border-white/5">
              <span className="text-[11px] font-semibold text-white/30 uppercase tracking-wider">Search Phrase</span>
              <span className="text-[11px] font-semibold text-white/30 uppercase tracking-wider text-right">Change</span>
            </div>

            {/* Rows */}
            <div className="divide-y divide-white/5">
              {breakSlice.map((item) => (
                <div key={item.phrase} className="grid grid-cols-[1fr_80px] px-5 py-3 hover:bg-white/3 transition-colors items-center">
                  <span className="text-white text-sm font-medium capitalize">{item.phrase}</span>
                  <div className="flex justify-end">
                    <span className="flex items-center gap-1 text-emerald-400 font-medium text-sm">
                      <TrendingUp size={13} />
                      <span>new</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <Pagination
              page={breakPage} total={breakTotal}
              onPrev={() => setBreakPage(p => Math.max(1, p - 1))}
              onNext={() => setBreakPage(p => Math.min(breakTotal, p + 1))}
            />
          </motion.div>

        </div>

        {/* Info note */}
        <p className="mt-4 text-xs text-white/20 text-center">
          Données basées sur les tendances de recherche Etsy · Mise à jour mensuelle
        </p>
      </div>
    </div>
  );
}
