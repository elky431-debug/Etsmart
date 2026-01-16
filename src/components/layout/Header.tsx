'use client';

import { motion } from 'framer-motion';
import { RotateCcw, Home, Cpu, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui';
import { Logo } from '@/components/ui/Logo';
import { useStore } from '@/store/useStore';
import Link from 'next/link';

export function Header() {
  const { reset, currentStep, products, analyses } = useStore();

  return (
    <header className="fixed top-12 left-0 right-0 z-40">
      <div className="mx-4 mt-2">
        <div className="max-w-7xl mx-auto px-6 py-3 bg-white border border-slate-200 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-4"
            >
              <Link href="/" className="group">
                <div className="flex items-center gap-2">
                  <Logo size="sm" showText={true} />
                  <p className="text-[10px] text-slate-400 hidden sm:block">
                    AI Copilot for Etsy
                  </p>
                </div>
              </Link>
              
              <Link href="/">
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<Home size={14} />}
                  className="text-xs"
                >
                  Home
                </Button>
              </Link>
              
              <Link href="/dashboard">
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<LayoutDashboard size={14} />}
                  className="text-xs"
                >
                  Dashboard
                </Button>
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3"
            >
              {(products.length > 0 || analyses.length > 0 || currentStep > 1) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={reset}
                  leftIcon={<RotateCcw size={14} />}
                  className="text-xs"
                >
                  Restart
                </Button>
              )}
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500">
                <Cpu className="w-3.5 h-3.5 text-[#00d4ff]" />
                <span>AI active</span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#00d4ff] animate-pulse" />
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </header>
  );
}
