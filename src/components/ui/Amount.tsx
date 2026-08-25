import { cn } from '@/lib/utils';
import { formatINR, formatINRCompact } from '@/lib/formatCurrency';

interface AmountProps {
  value: number;
  compact?: boolean;
  income?: boolean;
  showDecimals?: boolean | 'auto';
  className?: string;
}

// DESIGN.md iron rules: every rupee amount is mono + tabular; income is gold
// with a + prefix, never green; spending is never red.
export function Amount({ value, compact = false, income = false, showDecimals = 'auto', className }: AmountProps) {
  const formatted = compact ? formatINRCompact(value) : formatINR(value, showDecimals);
  return (
    <span className={cn('amount', income && 'text-gold', className)}>
      {income && value > 0 ? '+' : ''}
      {formatted}
    </span>
  );
}
