'use client';

import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStore } from '@/store/useStore';

const steps = [
  { id: 1, label: 'Niche' },
  { id: 2, label: 'Products' },
  { id: 3, label: 'Analysis' },
  { id: 4, label: 'Results' },
];

export function Stepper() {
  const { currentStep } = useStore();

  return (
    <div className="w-full">
      {/* Progress bar ultra fine */}
      <div className="h-1 bg-slate-100 relative">
        <motion.div
          className="absolute left-0 top-0 h-full bg-gradient-to-r from-[#00d4ff] to-[#00c9b7]"
          initial={{ width: '0%' }}
          animate={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
      
      {/* Steps labels */}
      <div className="max-w-3xl mx-auto px-4 py-2">
        <div className="flex items-center justify-between">
          {steps.map((step) => {
            const isCompleted = currentStep > step.id;
            const isCurrent = currentStep === step.id;

            return (
              <div
                key={step.id}
                className="flex items-center gap-1.5"
              >
                <div
                  className={cn(
                    'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all',
                    isCompleted
                      ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white'
                      : isCurrent
                      ? 'bg-[#00d4ff]/20 text-[#00d4ff] border border-[#00d4ff]'
                      : 'bg-slate-100 text-slate-400'
                  )}
                >
                  {isCompleted ? <Check className="w-3 h-3" /> : step.id}
                </div>
                <span
                  className={cn(
                    'text-xs font-medium hidden sm:block',
                    isCompleted ? 'text-[#00c9b7]' : isCurrent ? 'text-slate-900' : 'text-slate-400'
                  )}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
