'use client';

import { Heart, Sparkles, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-base font-bold text-slate-900">
              Ets<span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00d4ff] to-[#00c9b7]">mart</span>
            </span>
          </Link>
          
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span>Fait avec</span>
            <Heart className="w-3 h-3 text-[#00d4ff] fill-[#00d4ff]" />
            <span>pour les entrepreneurs</span>
          </div>
          
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>© 2026 Etsmart</span>
          </div>
        </div>
        
        <div className="mt-4 pt-4 border-t border-slate-100 text-center text-[10px] text-slate-400 flex items-center justify-center gap-1.5">
          <AlertTriangle size={10} />
          <span>Les données affichées sont des estimations basées sur l&apos;analyse IA. Aucune garantie de revenus n&apos;est promise.</span>
        </div>
      </div>
    </footer>
  );
}
