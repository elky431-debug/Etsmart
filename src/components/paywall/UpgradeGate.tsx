'use client';

import { Lock, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface UpgradeGateProps {
  title?: string;
  description?: string;
  overlay?: boolean;
  children?: React.ReactNode;
  hideButton?: boolean;
  onNavigateToSubscription?: () => void;
}

export function UpgradeGate({
  title = 'Fonctionnalité Premium',
  description = 'Cette fonctionnalité est réservée aux abonnés payants.',
  overlay = false,
  children,
  hideButton = false,
  onNavigateToSubscription,
}: UpgradeGateProps) {
  const router = useRouter();

  const handleUpgrade = () => {
    if (onNavigateToSubscription) {
      onNavigateToSubscription();
    } else {
      router.push('/dashboard?section=subscription');
    }
  };

  const gate = (
    <div className="flex flex-col items-center justify-center gap-5 py-16 px-8 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[#00d4ff]/10 border border-[#00d4ff]/25 flex items-center justify-center">
        <Lock className="w-6 h-6 text-[#00d4ff]" />
      </div>
      <div>
        <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
        <p className="text-white/50 text-sm max-w-xs">{description}</p>
      </div>
      {!hideButton && (
        <button
          onClick={handleUpgrade}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white font-semibold text-sm hover:opacity-90 transition-opacity"
        >
          <Zap size={15} />
          Passer à un plan payant
        </button>
      )}
    </div>
  );

  if (!overlay || !children) return gate;

  return (
    <div className="relative">
      {children}
      <div className="absolute inset-0 backdrop-blur-sm bg-black/60 rounded-xl flex flex-col items-center justify-center gap-4 z-10">
        <div className="w-12 h-12 rounded-xl bg-[#00d4ff]/10 border border-[#00d4ff]/25 flex items-center justify-center">
          <Lock className="w-5 h-5 text-[#00d4ff]" />
        </div>
        <div className="text-center px-6">
          <p className="text-white font-semibold text-sm mb-1">{title}</p>
          <p className="text-white/50 text-xs">{description}</p>
        </div>
        <button
          onClick={handleUpgrade}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white font-semibold text-xs hover:opacity-90 transition-opacity"
        >
          <Zap size={13} />
          Passer à un plan payant
        </button>
      </div>
    </div>
  );
}
