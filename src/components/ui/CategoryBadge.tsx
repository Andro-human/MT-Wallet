import { cn } from '@/lib/utils';
import { Category } from '@/types/database';

interface CategoryBadgeProps {
  category: Category | null;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export function CategoryBadge({ category, size = 'md', showLabel = false }: CategoryBadgeProps) {
  const sizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-10 h-10 text-base',
  };

  if (!category) {
    return (
      <div className={cn(
        'flex items-center justify-center rounded-full bg-muted',
        sizeClasses[size]
      )}>
        📦
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          'flex items-center justify-center rounded-full',
          sizeClasses[size]
        )}
        style={{ backgroundColor: `${category.color}20` }}
      >
        <span>{category.icon}</span>
      </div>
      {showLabel && (
        <span className="text-sm text-muted-foreground">{category.name}</span>
      )}
    </div>
  );
}
