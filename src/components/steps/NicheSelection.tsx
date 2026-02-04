'use client';

import { useState, useEffect } from 'react';
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
import { useIsMobile } from '@/hooks/useIsMobile';

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

function NicheCard({ niche, isSelected, onClick, isMobile = false }: { niche: NicheInfo; isSelected: boolean; onClick: () => void; isMobile?: boolean }) {
  const IconComponent = iconMap[niche.icon] || Sparkles;
  
  return (
    <motion.button
      onClick={onClick}
      whileHover={isMobile ? {} : { scale: 1.03, y: -6 }}
      whileTap={isMobile ? {} : { scale: 0.97 }}
      className={`
        relative group w-full text-left p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl transition-all duration-500 overflow-hidden
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
              size={isMobile ? 28 : 36} 
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
        
        <h3 className={`font-bold text-base sm:text-xl md:text-2xl mb-2 sm:mb-3 ${isSelected ? 'text-white' : 'text-slate-900'}`}>
          {niche.name}
        </h3>
        <p className={`text-sm sm:text-base mb-4 sm:mb-6 line-clamp-2 leading-relaxed ${
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
              {niche.avgCompetition === 'low' ? 'Faible' : niche.avgCompetition === 'medium' ? 'Moyen' : 'Élevé'}
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
              {niche.avgDemand === 'low' ? 'Faible' : niche.avgDemand === 'medium' ? 'Moyenne' : 'Élevée'}
            </span>
          </div>
        </div>
      </div>
    </motion.button>
  );
}

export function NicheSelection() {
  const { selectedNiche, setNiche, customNiche, setCustomNiche, setStep, setAnalyses } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const isMobile = useIsMobile();

  // Nettoyer les analyses du store quand on démarre une nouvelle analyse
  useEffect(() => {
    setAnalyses([]);
  }, [setAnalyses]);

  const filteredNiches = niches.filter((niche) =>
    niche.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    niche.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleNicheSelect = (nicheId: Niche) => {
    setNiche(nicheId);
    if (nicheId !== 'custom') {
      setCustomNiche('');
      // Passer automatiquement à l'étape suivante après un court délai pour l'animation
      setTimeout(() => {
        setStep(2);
      }, 300);
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
        className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-16"
      >
        {/* Header Section */}
        <motion.div 
          className="text-center mb-8 sm:mb-12 md:mb-16"
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.2 }}
            className="inline-flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-2 sm:py-3 rounded-full bg-white/80 backdrop-blur-xl border-2 border-[#00d4ff]/20 shadow-lg mb-4 sm:mb-8 text-xs sm:text-sm"
          >
            <div className="w-2 h-2 rounded-full bg-[#00d4ff] animate-pulse" />
            <span className="text-sm font-bold text-[#00d4ff]">ÉTAPE 1 SUR 3</span>
            <Zap size={16} className="text-[#00c9b7]" />
          </motion.div>
          
          <motion.h1 
            className="text-2xl sm:text-5xl md:text-6xl lg:text-7xl font-black mb-3 sm:mb-6"
            initial={isMobile ? undefined : { opacity: 0, y: 20 }}
            animate={isMobile ? undefined : { opacity: 1, y: 0 }}
            transition={isMobile ? undefined : { delay: 0.3 }}
          >
            <span className="text-slate-900">Choisissez</span>
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00d4ff] via-[#00c9b7] to-[#00d4ff]">
              votre niche
            </span>
          </motion.h1>
          
          <motion.p 
            className="text-sm sm:text-base md:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed px-2 sm:px-0"
            initial={isMobile ? undefined : { opacity: 0 }}
            animate={isMobile ? undefined : { opacity: 1 }}
            transition={isMobile ? undefined : { delay: 0.4 }}
          >
            Trouvez la catégorie parfaite pour lancer votre boutique Etsy
          </motion.p>
        </motion.div>

        {/* Search Bar - Large and prominent */}
        <motion.div 
          className="max-w-2xl mx-auto mb-8 sm:mb-12 md:mb-16"
          initial={isMobile ? undefined : { opacity: 0, y: 20 }}
          animate={isMobile ? undefined : { opacity: 1, y: 0 }}
          transition={isMobile ? undefined : { delay: 0.5 }}
        >
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] rounded-2xl sm:rounded-3xl blur-lg opacity-0 group-hover:opacity-20 transition-opacity duration-500" />
            <div className="relative bg-slate-900/80 backdrop-blur-xl rounded-2xl sm:rounded-3xl border-2 border-white/10 shadow-2xl p-1.5 sm:p-2 group-hover:border-[#00d4ff]/30 transition-all duration-300">
              <div className="flex items-center gap-2 sm:gap-4 px-3 sm:px-4 md:px-6">
                <div className="flex-shrink-0">
                  <Search className="w-5 h-5 sm:w-6 sm:h-6 text-[#00d4ff]" />
                </div>
                <input
                  type="text"
                  placeholder="Rechercher une niche..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 py-3 sm:py-4 md:py-5 text-sm sm:text-base md:text-lg bg-transparent text-white placeholder-white/40 focus:outline-none"
                />
                {searchQuery && (
                  <motion.button
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    onClick={() => setSearchQuery('')}
                    className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl hover:bg-white/10 transition-colors"
                  >
                    <span className="text-white/60 hover:text-white text-sm sm:text-base">✕</span>
                  </motion.button>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Niche Grid - Modern card layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8 mb-8 sm:mb-12 md:mb-16">
          <AnimatePresence mode="popLayout">
            {filteredNiches.map((niche, index) => (
              <motion.div
                key={niche.id}
                initial={isMobile ? undefined : { opacity: 0, y: 50, scale: 0.9 }}
                animate={isMobile ? undefined : { opacity: 1, y: 0, scale: 1 }}
                exit={isMobile ? undefined : { opacity: 0, scale: 0.9 }}
                transition={isMobile ? undefined : { 
                  delay: index * 0.05,
                  type: 'spring',
                  stiffness: 100,
                  damping: 15
                }}
                layout={!isMobile}
              >
                <NicheCard
                  niche={niche}
                  isSelected={selectedNiche === niche.id}
                  onClick={() => handleNicheSelect(niche.id)}
                  isMobile={isMobile}
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
                  className="w-full px-4 sm:px-6 py-3 sm:py-4 bg-slate-50 border-2 border-slate-200 rounded-xl sm:rounded-2xl text-base sm:text-lg text-slate-900 placeholder-slate-400 focus:border-[#00d4ff] focus:bg-white focus:shadow-lg focus:shadow-[#00d4ff]/20 focus:outline-none transition-all duration-300"
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
            whileHover={canContinue && !isMobile ? { scale: 1.05, y: -2 } : {}}
            whileTap={canContinue && !isMobile ? { scale: 0.95 } : {}}
            className={`
              group relative w-full sm:w-auto px-6 sm:px-16 py-2.5 sm:py-4 md:py-6 text-sm sm:text-lg md:text-xl font-bold rounded-xl sm:rounded-2xl transition-all duration-300 overflow-hidden btn-mobile
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
            <span className="relative z-10 flex items-center gap-2 sm:gap-3">
              Continuer
              <ChevronRight size={isMobile ? 18 : 24} className="group-hover:translate-x-1 transition-transform" />
            </span>
          </motion.button>
        </motion.div>
      </motion.div>
    </div>
  );
}
