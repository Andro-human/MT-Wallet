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
    down: 'text-primary', // Success is now typically lime/primary in this theme
    neutral: 'text-muted-foreground',
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'neo-card p-5 relative overflow-hidden group',
        variant === 'primary' && 'border-primary/50 bg-primary/5',
        variant === 'success' && 'border-primary/50 bg-primary/5'
      )}
    >
      {/* Background Grid Pattern for primary cards */}
      {(variant === 'primary' || variant === 'success') && (
        <div className="absolute inset-0 bg-grid-small opacity-30 pointer-events-none" />
      )}

      <div className="flex items-start justify-between relative z-10">
        <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        {icon && (
          <div className={cn(
            'p-1.5 rounded-none border',
            variant === 'default' ? 'border-border text-muted-foreground bg-background' : 'border-primary/30 text-primary bg-primary/10'
          )}>
            {icon}
          </div>
        )}
      </div>

      <div className="mt-4 relative z-10">
        <span className={cn(
          'text-3xl font-heading font-bold tracking-tight',
          variant === 'default' ? 'text-foreground' : 'text-primary'
        )}>
          {value}
        </span>

        {(subValue || trendValue) && (
          <div className="flex items-center gap-3 mt-2">
            {subValue && (
              <span className="text-xs font-mono text-muted-foreground">
                {subValue}
              </span>
            )}
            {trend && trendValue && (
              <span className={cn('text-xs font-mono font-medium', trendClasses[trend])}>
                {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '•'} {trendValue}
              </span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
