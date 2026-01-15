'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  TrendingUp, 
  Users,
  Check,
  Gift,
  Heart,
  Home,
  PawPrint,
  Baby,
  Gem,
  Palette,
  Clock,
  Scissors,
  Plus,
  LucideIcon,
  ChevronRight,
  Sparkles,
  ArrowRight,
  Zap,
  Activity,
  Shirt,
  UtensilsCrossed,
  Flower2
} from 'lucide-react';
import { Button } from '@/components/ui';
import { Logo } from '@/components/ui/Logo';
import { niches } from '@/lib/niches';
import { useStore } from '@/store/useStore';
import type { Niche, NicheInfo } from '@/types';

const iconMap: Record<string, LucideIcon> = {
  gift: Gift,
  heart: Heart,
  home: Home,
  pawprint: PawPrint,
  baby: Baby,
  sparkles: Sparkles,
  gem: Gem,
  palette: Palette,
  clock: Clock,
  scissors: Scissors,
  activity: Activity,
  plus: Plus,
  shirt: Shirt,
  utensils: UtensilsCrossed,
  flower: Flower2,
};

function NicheCard({ niche, isSelected, onClick }: { niche: NicheInfo; isSelected: boolean; onClick: () => void }) {
  const IconComponent = iconMap[niche.icon] || Sparkles;
  
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.03, y: -6 }}
      whileTap={{ scale: 0.97 }}
      className={`
        relative group w-full text-left p-8 rounded-3xl transition-all duration-500 overflow-hidden
        ${isSelected 
          ? 'bg-gradient-to-br from-[#00d4ff] via-[#00c9b7] to-[#00b8e6] text-white shadow-2xl shadow-[#00d4ff]/40' 
          : 'bg-white border-2 border-slate-200 hover:border-[#00d4ff]/50 hover:shadow-xl hover:shadow-[#00d4ff]/20'}
      `}
    >
      {/* Animated background gradient */}
      {isSelected && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent"
        />
      )}

      {/* Shine effect */}
      <motion.div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: 'linear-gradient(110deg, transparent 40%, rgba(255,255,255,0.3) 50%, transparent 60%)',
        }}
        animate={isSelected ? {
          x: ['-100%', '200%'],
        } : {}}
        transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
      />

      {/* Content */}
      <div className="relative z-10">
        {/* Icon with glow */}
        <div className="relative mb-6">
          <motion.div 
            className={`w-20 h-20 rounded-3xl flex items-center justify-center ${
              isSelected 
                ? 'bg-white/20 backdrop-blur-sm' 
                : 'bg-gradient-to-br from-[#00d4ff]/10 to-[#00c9b7]/10'
            }`}
            whileHover={{ rotate: [0, -10, 10, 0] }}
            transition={{ duration: 0.5 }}
          >
            <IconComponent 
              size={36} 
              className={isSelected ? 'text-white' : 'text-[#00d4ff]'} 
            />
          </motion.div>
          {isSelected && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-lg"
            >
              <Check size={18} className="text-[#00d4ff]" />
            </motion.div>
          )}
        </div>
        
        <h3 className={`font-bold text-2xl mb-3 ${isSelected ? 'text-white' : 'text-slate-900'}`}>
          {niche.name}
        </h3>
        <p className={`text-base mb-6 line-clamp-2 leading-relaxed ${
          isSelected ? 'text-white/90' : 'text-slate-600'
        }`}>
          {niche.description}
        </p>
        
        {/* Stats */}
        <div className={`flex items-center gap-4 pt-6 border-t ${
          isSelected ? 'border-white/30' : 'border-slate-200'
        }`}>
          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl ${
            isSelected 
              ? 'bg-white/20 backdrop-blur-sm' 
              : 'bg-slate-50'
          }`}>
            <Users size={16} className={isSelected ? 'text-white' : 'text-[#00d4ff]'} />
            <span className={`text-sm font-bold ${
              isSelected ? 'text-white' : 'text-slate-700'
            }`}>
              {niche.avgCompetition === 'low' ? 'Faible' : niche.avgCompetition === 'medium' ? 'Moyenne' : 'Forte'}
            </span>
          </div>
          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl ${
            isSelected 
              ? 'bg-white/20 backdrop-blur-sm' 
              : 'bg-slate-50'
          }`}>
            <TrendingUp size={16} className={isSelected ? 'text-white' : 'text-[#00c9b7]'} />
            <span className={`text-sm font-bold ${
              isSelected ? 'text-white' : 'text-slate-700'
            }`}>
              {niche.avgDemand === 'low' ? 'Faible' : niche.avgDemand === 'medium' ? 'Moyenne' : 'Forte'}
            </span>
          </div>
        </div>
      </div>
    </motion.button>
  );
}

export function NicheSelection() {
  const { selectedNiche, setNiche, customNiche, setCustomNiche, setStep } = useStore();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredNiches = niches.filter((niche) =>
    niche.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    niche.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleNicheSelect = (nicheId: Niche) => {
    setNiche(nicheId);
    if (nicheId !== 'custom') {
      setCustomNiche('');
    }
  };

  const handleContinue = () => {
    if (selectedNiche && (selectedNiche !== 'custom' || customNiche.trim())) {
      setStep(2);
    }
  };

  const canContinue = selectedNiche && (selectedNiche !== 'custom' || customNiche.trim().length > 0);

  return (
    <div className="min-h-screen w-full relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#00d4ff]/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#00c9b7]/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="relative z-10 w-full max-w-7xl mx-auto px-6 py-16"
      >
        {/* Header Section */}
        <motion.div 
          className="text-center mb-16"
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.2 }}
            className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-white/80 backdrop-blur-xl border-2 border-[#00d4ff]/20 shadow-lg mb-8"
          >
            <div className="w-2 h-2 rounded-full bg-[#00d4ff] animate-pulse" />
            <span className="text-sm font-bold text-[#00d4ff]">ÉTAPE 1 SUR 3</span>
            <Zap size={16} className="text-[#00c9b7]" />
          </motion.div>
          
          <motion.h1 
            className="text-6xl md:text-7xl font-black mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <span className="text-slate-900">Choisissez</span>
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00d4ff] via-[#00c9b7] to-[#00d4ff]">
              votre niche
            </span>
          </motion.h1>
          
          <motion.p 
            className="text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            Trouvez la catégorie parfaite pour lancer votre boutique Etsy
          </motion.p>
        </motion.div>

        {/* Search Bar - Large and prominent */}
        <motion.div 
          className="max-w-2xl mx-auto mb-16"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] rounded-3xl blur-lg opacity-0 group-hover:opacity-30 transition-opacity duration-500" />
            <div className="relative bg-white/90 backdrop-blur-xl rounded-3xl border-2 border-slate-200 shadow-2xl p-2">
              <div className="flex items-center gap-4 px-6">
                <Logo size="sm" showText={false} />
                <input
                  type="text"
                  placeholder="Rechercher une niche..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 py-5 text-lg bg-transparent text-slate-900 placeholder-slate-400 focus:outline-none"
                />
                {searchQuery && (
                  <motion.button
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    onClick={() => setSearchQuery('')}
                    className="p-2 rounded-xl hover:bg-slate-100 transition-colors"
                  >
                    <span className="text-slate-400">✕</span>
                  </motion.button>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Niche Grid - Modern card layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          <AnimatePresence mode="popLayout">
            {filteredNiches.map((niche, index) => (
              <motion.div
                key={niche.id}
                initial={{ opacity: 0, y: 50, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ 
                  delay: index * 0.05,
                  type: 'spring',
                  stiffness: 100,
                  damping: 15
                }}
                layout
              >
                <NicheCard
                  niche={niche}
                  isSelected={selectedNiche === niche.id}
                  onClick={() => handleNicheSelect(niche.id)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Custom Niche Input */}
        <AnimatePresence>
          {selectedNiche === 'custom' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="max-w-2xl mx-auto mb-12"
            >
              <div className="p-8 rounded-3xl bg-white/90 backdrop-blur-xl border-2 border-[#00d4ff]/30 shadow-2xl">
                <label className="block text-lg font-bold text-slate-900 mb-4">
                  Décrivez votre niche personnalisée
                </label>
                <input
                  type="text"
                  placeholder="Ex: Accessoires gaming personnalisés..."
                  value={customNiche}
                  onChange={(e) => setCustomNiche(e.target.value)}
                  className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-lg text-slate-900 placeholder-slate-400 focus:border-[#00d4ff] focus:bg-white focus:shadow-lg focus:shadow-[#00d4ff]/20 focus:outline-none transition-all duration-300"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer with CTA */}
        <motion.div 
          className="flex flex-col items-center gap-8"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          {selectedNiche && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="flex items-center gap-4 px-8 py-4 rounded-full bg-gradient-to-r from-[#00d4ff]/20 to-[#00c9b7]/20 border-2 border-[#00d4ff]/30 backdrop-blur-xl shadow-xl"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] flex items-center justify-center shadow-lg">
                <Check size={20} className="text-white" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Niche sélectionnée</p>
                <p className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#00d4ff] to-[#00c9b7]">
                  {niches.find(n => n.id === selectedNiche)?.name || customNiche}
                </p>
              </div>
            </motion.div>
          )}
          
          <motion.button
            onClick={handleContinue}
            disabled={!canContinue}
            whileHover={canContinue ? { scale: 1.05, y: -2 } : {}}
            whileTap={canContinue ? { scale: 0.95 } : {}}
            className={`
              group relative px-16 py-6 text-xl font-bold rounded-2xl transition-all duration-300 overflow-hidden
              ${canContinue 
                ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white shadow-2xl shadow-[#00d4ff]/40 hover:shadow-[#00d4ff]/60' 
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }
            `}
          >
            {canContinue && (
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-[#00c9b7] to-[#00d4ff] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              />
            )}
            <span className="relative z-10 flex items-center gap-3">
              Continuer
              <ChevronRight size={24} className="group-hover:translate-x-1 transition-transform" />
            </span>
          </motion.button>
        </motion.div>
      </motion.div>
    </div>
  );
}
