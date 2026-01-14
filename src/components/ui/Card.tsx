'use client';

import { type HTMLAttributes, type ReactNode, type MouseEventHandler } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface CardProps {
  variant?: 'default' | 'glass' | 'gradient';
  hover?: boolean;
  children?: ReactNode;
  className?: string;
  onClick?: MouseEventHandler<HTMLDivElement>;
}

export function Card({ 
  className, 
  variant = 'default', 
  hover = false, 
  children,
  onClick 
}: CardProps) {
  const variants = {
    default:
      'glass-card',
    glass:
      'glass-card backdrop-blur-xl',
    gradient:
      'bg-gradient-to-br from-violet-500/10 via-transparent to-cyan-500/10 border border-white/10 backdrop-blur-sm',
  };

  return (
    <motion.div
      className={cn(
        'rounded-2xl p-6',
        variants[variant],
        hover && 'transition-all duration-300 hover:border-violet-500/30 hover:shadow-lg hover:shadow-violet-500/10 cursor-pointer card-shine',
        className
      )}
      onClick={onClick}
    >
      {children}
    </motion.div>
  );
}

interface CardSubProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
}

export function CardHeader({ className, children, ...props }: CardSubProps) {
  return (
    <div
      className={cn('flex flex-col space-y-1.5 mb-4', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...props }: CardSubProps) {
  return (
    <h3
      className={cn(
        'text-lg font-semibold text-white tracking-tight',
        className
      )}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({ className, children, ...props }: CardSubProps) {
  return (
    <p
      className={cn('text-sm text-slate-400', className)}
      {...props}
    >
      {children}
    </p>
  );
}

export function CardContent({ className, children, ...props }: CardSubProps) {
  return (
    <div className={cn('', className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ className, children, ...props }: CardSubProps) {
  return (
    <div
      className={cn('flex items-center mt-4 pt-4 border-t border-white/10', className)}
      {...props}
    >
      {children}
    </div>
  );
}
