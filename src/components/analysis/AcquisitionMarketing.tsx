'use client';

import { motion } from 'framer-motion';
import { 
  Users, 
  Target, 
  Video, 
  Facebook, 
  Instagram, 
  Image as PinterestIcon,
  Sparkles,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Info
} from 'lucide-react';
import type { AcquisitionMarketing } from '@/types';

interface AcquisitionMarketingProps {
  acquisition: AcquisitionMarketing;
}

const channelIcons = {
  tiktok: Video,
  facebook: Facebook,
  instagram: Instagram,
  pinterest: PinterestIcon,
};

const channelColors = {
  tiktok: {
    bg: 'bg-black',
    text: 'text-white',
    border: 'border-black',
    light: 'bg-black/10',
    icon: 'text-black',
  },
  facebook: {
    bg: 'bg-blue-600',
    text: 'text-white',
    border: 'border-blue-600',
    light: 'bg-blue-50',
    icon: 'text-blue-600',
  },
  instagram: {
    bg: 'bg-gradient-to-r from-purple-500 to-pink-500',
    text: 'text-white',
    border: 'border-purple-500',
    light: 'bg-purple-50',
    icon: 'text-purple-600',
  },
  pinterest: {
    bg: 'bg-red-600',
    text: 'text-white',
    border: 'border-red-600',
    light: 'bg-red-50',
    icon: 'text-red-600',
  },
};

const channelNames: Record<string, string> = {
  tiktok: 'TikTok',
  facebook: 'Facebook',
  instagram: 'Instagram',
  pinterest: 'Pinterest',
};

export function AcquisitionMarketing({ acquisition }: AcquisitionMarketingProps) {
  const { targetAudience, acquisitionChannel, tiktokIdeas, facebookIdeas } = acquisition;
  
  const PrimaryIcon = channelIcons[acquisitionChannel.primary];
  const primaryColors = channelColors[acquisitionChannel.primary];
  const SecondaryIcon = acquisitionChannel.secondary ? channelIcons[acquisitionChannel.secondary] : null;
  const secondaryColors = acquisitionChannel.secondary ? channelColors[acquisitionChannel.secondary] : null;

  return (
    <div className="space-y-6">
      {/* Personnes visées */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-5 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-indigo-500 flex items-center justify-center">
            <Users size={20} className="text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Target Audience</h2>
            <p className="text-slate-500 text-xs">Dominant buyer profile</p>
          </div>
        </div>
        
        <div className="p-4 rounded-lg bg-white border border-indigo-200">
          <p className="text-sm text-slate-700 leading-relaxed">{targetAudience.description}</p>
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-200">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Age:</span>
              <span className="text-sm font-medium text-slate-900">{targetAudience.ageRange}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Situation:</span>
              <span className="text-sm font-medium text-slate-900">{targetAudience.situation}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Behavior:</span>
              <span className={`text-sm font-medium ${
                targetAudience.buyingBehavior === 'impulsive' ? 'text-amber-600' : 'text-blue-600'
              }`}>
                {targetAudience.buyingBehavior === 'impulsive' ? 'Impulsive' : 'Reflective'}
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Canal d'acquisition recommandé */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="p-5 rounded-xl bg-white border border-slate-200"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] flex items-center justify-center">
            <Target size={20} className="text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Recommended Acquisition Channel</h2>
            <p className="text-slate-500 text-xs">Where to invest your time and budget</p>
          </div>
        </div>

        <div className="space-y-3">
          {/* Canal principal */}
          <div className={`p-4 rounded-lg border-2 ${primaryColors.border} ${primaryColors.light}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg ${primaryColors.bg} flex items-center justify-center`}>
                  <PrimaryIcon size={20} className={primaryColors.text} />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    {channelNames[acquisitionChannel.primary] || acquisitionChannel.primary}
                  </p>
                  <p className="text-xs text-slate-500">Priority channel</p>
                </div>
              </div>
              {acquisitionChannel.notSuitableForTikTok && (
                <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
                  <AlertCircle size={12} />
                  Not suitable
                </div>
              )}
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">{acquisitionChannel.justification}</p>
          </div>

          {/* Canal secondaire */}
          {acquisitionChannel.secondary && SecondaryIcon && secondaryColors && (
            <div className={`p-4 rounded-lg border ${secondaryColors.border} ${secondaryColors.light}`}>
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg ${secondaryColors.bg} flex items-center justify-center`}>
                  <SecondaryIcon size={16} className={secondaryColors.text} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {channelNames[acquisitionChannel.secondary] || acquisitionChannel.secondary}
                  </p>
                  <p className="text-xs text-slate-500">Secondary channel</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Idées TikTok */}
      {tiktokIdeas && tiktokIdeas.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="p-5 rounded-xl bg-black text-white border border-slate-800"
        >
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
              <Video size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold">Original TikTok Ideas</h2>
              <p className="text-white/60 text-xs">Creative and potentially viral concepts</p>
            </div>
          </div>

          <div className="space-y-4">
            {tiktokIdeas.map((idea, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + index * 0.1 }}
                className="p-4 rounded-lg bg-white/5 border border-white/10"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-sm font-bold text-white">{idea.title}</h3>
                  <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
                    {index + 1}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div>
                    <p className="text-xs font-semibold text-white/70 mb-1">Principle</p>
                    <p className="text-sm text-white/90">{idea.concept}</p>
                  </div>
                  
                  <div>
                    <p className="text-xs font-semibold text-white/70 mb-1">What to show</p>
                    <p className="text-sm text-white/80">{idea.whatToShow}</p>
                  </div>
                  
                  <div className="p-3 rounded-lg bg-white/10 border border-white/20">
                    <div className="flex items-start gap-2">
                      <TrendingUp size={14} className="text-[#00d4ff] flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-[#00d4ff] mb-1">Why it can go viral</p>
                        <p className="text-xs text-white/80">{idea.whyViral}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Idées Facebook */}
      {facebookIdeas && facebookIdeas.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="p-5 rounded-xl bg-blue-50 border border-blue-200"
        >
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center">
              <Facebook size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Facebook Content Ideas</h2>
              <p className="text-slate-600 text-xs">Reassuring and explanatory content</p>
            </div>
          </div>

          <div className="space-y-4">
            {facebookIdeas.map((idea, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + index * 0.1 }}
                className="p-4 rounded-lg bg-white border border-blue-200"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-900">{idea.title}</h3>
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                    {index + 1}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-1">Principle</p>
                    <p className="text-sm text-slate-700">{idea.concept}</p>
                  </div>
                  
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-1">What to show</p>
                    <p className="text-sm text-slate-600">{idea.whatToShow}</p>
                  </div>
                  
                  <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 size={14} className="text-blue-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-blue-700 mb-1">Why it's effective on Facebook</p>
                        <p className="text-xs text-slate-600">{idea.whyEffective}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Message pédagogique */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="p-4 rounded-lg bg-slate-50 border border-slate-200"
      >
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center flex-shrink-0">
            <Info size={16} className="text-slate-600" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-700 mb-1">Important note</p>
            <p className="text-xs text-slate-600 leading-relaxed">
              These ideas are based on buyer behavior and high-performing formats on each platform.
              They serve as a creative guide, not a guarantee of virality.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

