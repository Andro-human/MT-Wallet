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
  const variantClasses = {
    default: 'bg-card',
    primary: 'gradient-primary',
    success: 'gradient-success',
  };

  const trendClasses = {
    up: 'text-destructive',
    down: 'text-success',
    neutral: 'text-muted-foreground',
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        'rounded-2xl p-4',
        variantClasses[variant]
      )}
    >
      <div className="flex items-start justify-between">
        <span className={cn(
          'text-xs uppercase tracking-wider',
          variant === 'default' ? 'text-muted-foreground' : 'text-white/70'
        )}>
          {label}
        </span>
        {icon}
      </div>
      
      <div className="mt-2">
        <span className={cn(
          'text-2xl font-bold',
          variant === 'default' ? 'text-foreground' : 'text-white'
        )}>
          {value}
        </span>
        
        {(subValue || trendValue) && (
          <div className="flex items-center gap-2 mt-1">
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
