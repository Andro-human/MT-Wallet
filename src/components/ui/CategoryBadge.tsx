import { cn } from '@/lib/utils';
import { Category } from '@/types/database';
import { forwardRef } from 'react';
import { entityColor } from '@/lib/categoryColors';

interface CategoryBadgeProps {
  category: Category | null;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export const CategoryBadge = forwardRef<HTMLDivElement, CategoryBadgeProps>(
  ({ category, size = 'md', showLabel = false }, ref) => {
    const sizeClasses = {
      sm: 'w-7 h-7 text-sm',
      md: 'w-10 h-10 text-base',
      lg: 'w-12 h-12 text-lg',
    };

    if (!category) {
      return (
        <div
          ref={ref}
          className={cn(
            'flex items-center justify-center rounded-xl bg-muted/50 inner-glow',
            sizeClasses[size]
          )}
        >
          📦
        </div>
      );
    }

    return (
      <div ref={ref} className="flex items-center gap-2.5">
        <div
          className={cn(
            'flex items-center justify-center rounded-xl transition-transform duration-200 hover:scale-105',
            sizeClasses[size]
          )}
          style={{
            backgroundColor: `${entityColor(category.id)}18`,
            boxShadow: `0 0 0 1px ${entityColor(category.id)}20 inset, 0 4px 12px -4px ${entityColor(category.id)}30`,
          }}
        >
          <span>{category.icon}</span>
        </div>
        {showLabel && (
          <span className="text-sm text-muted-foreground font-medium">{category.name}</span>
        )}
      </div>
    );
  }
);

CategoryBadge.displayName = 'CategoryBadge';
