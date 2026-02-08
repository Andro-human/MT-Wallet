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
}

export function TransactionCard({ transaction, onClick, index = 0 }: TransactionCardProps) {
  const isCredit = transaction.direction === 'credit';
  const category = transaction.categories;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      onClick={onClick}
      className="flex items-center gap-4 p-4 glass-card transition-all duration-300 hover:bg-card-elevated cursor-pointer group"
    >
      {/* Category emoji badge */}
      <div
        className="w-10 h-10 flex items-center justify-center rounded-xl text-base flex-shrink-0"
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
        <h4 className="font-semibold text-foreground truncate text-[15px]">
          {transaction.merchant || 'Unknown'}
        </h4>
        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
          <span>{format(new Date(transaction.transacted_at), 'MMM d, h:mm a')}</span>
          {transaction.payment_method && (
            <>
              <span className="opacity-40">•</span>
              <span className="opacity-70">{transaction.payment_method}</span>
            </>
          )}
        </p>
        {transaction.notes && (
          <p className="text-xs text-muted-foreground/70 mt-1 truncate italic">
            {transaction.notes}
          </p>
        )}
      </div>
      
      <div className="flex items-center gap-3">
        <span
          className={cn(
            'font-bold text-base currency-display',
            isCredit ? 'text-success' : 'text-foreground'
          )}
        >
          {isCredit ? '+' : '−'}
          <span className="currency-symbol">₹</span>
          {formatINR(transaction.amount).replace('₹', '')}
        </span>
        <ChevronRight className="w-4 h-4 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
      </div>
    </motion.div>
  );
}