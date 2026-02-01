import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatINR } from '@/lib/formatCurrency';
import { CategoryBadge } from '@/components/ui/CategoryBadge';
import { TransactionWithCategory } from '@/types/database';

interface TransactionCardProps {
  transaction: TransactionWithCategory;
  onClick?: () => void;
  index?: number;
}

export function TransactionCard({ transaction, onClick, index = 0 }: TransactionCardProps) {
  const isCredit = transaction.direction === 'credit';
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      onClick={onClick}
      className="flex items-center gap-4 p-4 glass-card transition-all duration-300 hover:bg-card-elevated cursor-pointer group"
    >
      <CategoryBadge category={transaction.categories} size="md" />
      
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
