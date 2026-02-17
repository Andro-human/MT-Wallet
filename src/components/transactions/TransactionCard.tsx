import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatINR } from '@/lib/formatCurrency';
import { TransactionWithCategory } from '@/types/database';

interface TransactionCardProps {
  transaction: TransactionWithCategory;
  onClick?: () => void;
  index?: number;
  /** Net amount after refunds. If provided, shows refund-adjusted amount. */
  netAmount?: number;
}

export function TransactionCard({ transaction, onClick, index = 0, netAmount }: TransactionCardProps) {
  const isCredit = transaction.direction === 'credit';
  const category = transaction.categories;

  // Determine if this transaction is not counted in analytics
  const isNotCounted = isCredit
    ? transaction.is_income === false
    : transaction.is_expense === false;

  // Use net amount if provided (refund-adjusted), otherwise use original amount
  const displayAmount = netAmount !== undefined ? netAmount : Number(transaction.amount);
  const hasRefund = netAmount !== undefined && netAmount !== Number(transaction.amount);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      onClick={onClick}
      className={cn(
        "flex items-center gap-4 p-3 border-b border-border/50 hover:bg-muted/30 cursor-pointer group transition-colors",
        isNotCounted && "opacity-60"
      )}
    >
      {/* Category icon - Square */}
      <div
        className={cn(
          "w-10 h-10 flex items-center justify-center rounded-none border bg-background text-lg flex-shrink-0",
          isNotCounted && "grayscale"
        )}
        style={category ? {
          borderColor: category.color ? `${category.color}40` : 'var(--border)',
          color: category.color || 'var(--foreground)',
        } : {
          borderColor: 'var(--border)',
        }}
      >
        {category?.icon || '📦'}
      </div>

      <div className="flex-1 min-w-0">
        <h4 className={cn(
          "font-medium truncate text-sm font-sans",
          isNotCounted ? "text-muted-foreground line-through" : "text-foreground"
        )}>
          {transaction.merchant || 'Unknown'}
        </h4>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5 font-mono">
          {format(new Date(transaction.transacted_at), 'MMM d • HH:mm')}
        </p>
        {transaction.notes && (
          <p className="text-xs text-muted-foreground/60 mt-0.5 truncate">
            {transaction.notes}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="text-right">
          <span
            className={cn(
              'font-mono font-medium text-sm',
              isNotCounted
                ? 'text-muted-foreground line-through'
                : isCredit ? 'text-primary' : 'text-foreground'
            )}
          >
            {isCredit ? '+' : ''}
            <span className="text-muted-foreground mr-0.5">₹</span>
            {formatINR(displayAmount).replace('₹', '')}
          </span>
          {hasRefund && !isNotCounted && (
            <p className="text-[10px] text-muted-foreground line-through font-mono">
              ₹{formatINR(transaction.amount).replace('₹', '')}
            </p>
          )}
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-primary transition-colors duration-200" />
      </div>
    </motion.div>
  );
}