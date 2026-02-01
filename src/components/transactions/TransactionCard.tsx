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
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={onClick}
      className="flex items-center gap-3 p-4 rounded-xl bg-card hover:bg-card/80 transition-colors cursor-pointer group"
    >
      <CategoryBadge category={transaction.categories} size="md" />
      
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-foreground truncate">
          {transaction.merchant || 'Unknown'}
        </h4>
        <p className="text-xs text-muted-foreground">
          {format(new Date(transaction.transacted_at), 'MMM d, h:mm a')}
          {transaction.payment_method && (
            <span className="ml-2 opacity-70">• {transaction.payment_method}</span>
          )}
        </p>
      </div>
      
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'font-semibold tabular-nums',
            isCredit ? 'text-success' : 'text-foreground'
          )}
        >
          {isCredit ? '+' : '-'}{formatINR(transaction.amount)}
        </span>
        <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </motion.div>
  );
}
