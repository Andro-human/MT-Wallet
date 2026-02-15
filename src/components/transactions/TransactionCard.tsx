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
        "flex items-center gap-4 p-4 glass-card transition-all duration-300 hover:bg-card-elevated cursor-pointer group",
        isNotCounted && "border border-dashed border-border/40"
      )}
    >
      {/* Category emoji badge */}
      <div
        className={cn(
          "w-10 h-10 flex items-center justify-center rounded-xl text-base flex-shrink-0",
          isNotCounted && "grayscale opacity-50"
        )}
        style={category ? {
          backgroundColor: `${category.color}18`,
          boxShadow: `0 0 0 1px ${category.color}20 inset`,
        } : {
          backgroundColor: 'hsl(var(--muted) / 0.5)',
        }}
      >
        {category?.icon || '📦'}
      </div>
      
      <div className="flex-1 min-w-0">
        <h4 className={cn(
          "font-semibold truncate text-[15px]",
          isNotCounted ? "text-muted-foreground" : "text-foreground"
        )}>
          {transaction.merchant || 'Unknown'}
        </h4>
        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
          <span>{format(new Date(transaction.transacted_at), 'MMM d, h:mm a')}</span>
        </p>
        {transaction.notes && (
          <p className="text-xs text-muted-foreground/70 mt-1 truncate italic">
            {transaction.notes}
          </p>
        )}
      </div>
      
      <div className="flex items-center gap-3">
        <div className="text-right">
          <span
            className={cn(
              'font-bold text-base currency-display',
              isNotCounted 
                ? 'text-muted-foreground line-through decoration-muted-foreground/50' 
                : isCredit ? 'text-success' : 'text-foreground'
            )}
          >
            {isCredit ? '+' : '−'}
            <span className="currency-symbol">₹</span>
            {formatINR(displayAmount).replace('₹', '')}
          </span>
          {hasRefund && !isNotCounted && (
            <p className="text-[10px] text-muted-foreground line-through">
              ₹{formatINR(transaction.amount).replace('₹', '')}
            </p>
          )}
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
      </div>
    </motion.div>
  );
}