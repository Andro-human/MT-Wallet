import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string;
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  icon?: ReactNode;
  variant?: 'default' | 'primary' | 'success';
}

export function StatCard({
  label,
  value,
  subValue,
  trend,
  trendValue,
  icon,
  variant = 'default',
}: StatCardProps) {
  const trendClasses = {
    up: 'text-destructive',
    down: 'text-success',
    neutral: 'text-muted-foreground',
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'glass-card p-4 transition-all duration-300 hover:scale-[1.02]',
        variant === 'primary' && 'gradient-primary glow-primary',
        variant === 'success' && 'gradient-success'
      )}
    >
      <div className="flex items-start justify-between">
        <span className={cn(
          'text-2xs uppercase tracking-extra-wide font-medium',
          variant === 'default' ? 'text-muted-foreground' : 'text-white/70'
        )}>
          {label}
        </span>
        {icon && (
          <div className={cn(
            'p-1.5 rounded-lg',
            variant === 'default' ? 'bg-muted/50' : 'bg-white/10'
          )}>
            {icon}
          </div>
        )}
      </div>
      
      <div className="mt-3">
        <span className={cn(
          'text-2xl font-bold currency-display',
          variant === 'default' ? 'text-foreground' : 'text-white'
        )}>
          {value}
        </span>
        
        {(subValue || trendValue) && (
          <div className="flex items-center gap-2 mt-1.5">
            {subValue && (
              <span className={cn(
                'text-xs',
                variant === 'default' ? 'text-muted-foreground' : 'text-white/70'
              )}>
                {subValue}
              </span>
            )}
            {trend && trendValue && (
              <span className={cn('text-xs font-medium', trendClasses[trend])}>
                {trend === 'up' ? '↑' : trend === 'down' ? '↓' : ''} {trendValue}
              </span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
