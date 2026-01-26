'use client';

import { Heart, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/">
            <Logo size="sm" showText={true} />
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
        
        <div className="mt-4 pt-4 border-t border-slate-100">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-1.5 text-center">
            <AlertTriangle size={12} className="text-slate-400 flex-shrink-0" />
            <span className="text-[10px] sm:text-[10px] text-slate-400 px-2 sm:px-0 leading-relaxed">
              Les données affichées sont des estimations basées sur l&apos;analyse IA. Aucune garantie de revenus n&apos;est promise.
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
