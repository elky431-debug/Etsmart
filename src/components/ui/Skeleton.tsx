'use client';

import { motion } from 'framer-motion';

interface SkeletonProps {
  className?: string;
  width?: string;
  height?: string;
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

export function Skeleton({ className = '', width = '100%', height = '1rem', rounded = 'md' }: SkeletonProps) {
  const roundedClasses = {
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    xl: 'rounded-xl',
    full: 'rounded-full',
  };

  return (
    <motion.div
      className={`bg-slate-200 ${roundedClasses[rounded]} ${className}`}
      style={{ width, height }}
      animate={{
        opacity: [0.5, 1, 0.5],
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="p-4 sm:p-6 bg-white border border-slate-200 rounded-xl sm:rounded-2xl">
      <div className="flex items-start gap-4">
        <Skeleton width="4rem" height="4rem" rounded="lg" />
        <div className="flex-1 space-y-2">
          <Skeleton width="60%" height="1.25rem" />
          <Skeleton width="40%" height="1rem" />
          <Skeleton width="80%" height="1rem" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonButton() {
  return <Skeleton width="8rem" height="2.75rem" rounded="lg" />;
}

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          width={i === lines - 1 ? '60%' : '100%'}
          height="1rem"
        />
      ))}
    </div>
  );
}






