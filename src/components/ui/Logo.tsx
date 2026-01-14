'use client';

import { motion } from 'framer-motion';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showText?: boolean;
}

const sizeMap = {
  sm: { icon: 28, text: 'text-lg' },
  md: { icon: 36, text: 'text-xl' },
  lg: { icon: 52, text: 'text-2xl' },
  xl: { icon: 72, text: 'text-3xl' },
};

export function Logo({ size = 'md', className = '', showText = true }: LogoProps) {
  const { icon: iconSize, text: textSize } = sizeMap[size];

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <motion.div
        whileHover={{ scale: 1.08, rotate: 5 }}
        whileTap={{ scale: 0.95 }}
        className="relative"
        style={{ width: iconSize, height: iconSize }}
      >
        {/* Lueur derrière le logo */}
        <div 
          className="absolute inset-0 blur-xl opacity-30"
          style={{
            background: 'radial-gradient(circle, rgba(0,212,255,0.4) 0%, rgba(0,201,183,0.2) 100%)',
            transform: 'scale(1.5)',
          }}
        />
        
        {/* SVG du logo "e" */}
        <svg
          viewBox="0 0 100 100"
          width={iconSize}
          height={iconSize}
          className="relative z-10"
          style={{ filter: 'drop-shadow(0 0 8px rgba(0,212,255,0.3))' }}
        >
          <defs>
            <linearGradient id="eGradientKhaki" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00c9b7" />
              <stop offset="50%" stopColor="#00d4ff" />
              <stop offset="100%" stopColor="#00b8e6" />
            </linearGradient>
            <linearGradient id="eGradientKhaki2" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#A4AC86" />
              <stop offset="50%" stopColor="#00c9b7" />
              <stop offset="100%" stopColor="#00d4ff" />
            </linearGradient>
            <filter id="glowKhaki">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          
          {/* Forme du "e" stylisé */}
          <g filter="url(#glowKhaki)">
            {/* Corps principal du e */}
            <path
              d="M 20 50
                 C 20 28, 38 12, 55 12
                 C 75 12, 88 28, 88 45
                 L 88 52
                 L 35 52
                 C 36 70, 48 82, 62 82
                 C 75 82, 84 74, 87 62
                 L 92 65
                 C 88 80, 76 92, 58 92
                 C 32 92, 15 72, 15 50
                 C 15 28, 35 8, 58 8"
              fill="url(#eGradientKhaki)"
              strokeWidth="0"
            />
            
            {/* Barre horizontale du e */}
            <path
              d="M 35 45
                 L 78 45
                 C 76 30, 66 20, 55 20
                 C 42 20, 34 32, 35 45"
              fill="url(#eGradientKhaki2)"
            />
          </g>
          
          {/* Highlight */}
          <path
            d="M 25 48
               C 25 30, 40 16, 55 16
               C 70 16, 80 25, 84 38"
            fill="none"
            stroke="rgba(255,255,255,0.4)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          
          <path
            d="M 30 45
               C 30 32, 42 22, 55 22
               C 66 22, 75 28, 80 38"
            fill="none"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </motion.div>

      {showText && (
        <span className={`font-bold ${textSize}`}>
          <span className="text-slate-900">Ets</span>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00d4ff] to-[#00c9b7]">mart</span>
        </span>
      )}
    </div>
  );
}
