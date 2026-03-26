import { useState } from 'react';
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { format } from 'date-fns';
import { ChevronRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatINR } from '@/lib/formatCurrency';
import { TransactionWithCategory } from '@/types/database';

interface TransactionCardProps {
  transaction: TransactionWithCategory;
  onClick?: () => void;
  index?: number;
  /** Net amount after refunds. If provided, shows refund-adjusted amount. */
  netAmount?: number;
  /** Callback when user swipes to approve. If provided, enables swipe gesture. */
  onSwipeApprove?: (id: string) => void;
}

export function TransactionCard({ transaction, onClick, index = 0, netAmount, onSwipeApprove }: TransactionCardProps) {
  const isCredit = transaction.direction === 'credit';
  const category = transaction.categories;
  const needsReview = (transaction as any).needs_review;
  const swipeEnabled = !!onSwipeApprove && needsReview;

  const isNotCounted = isCredit
    ? transaction.is_income === false
    : transaction.is_expense === false;

  const displayAmount = netAmount !== undefined ? netAmount : Number(transaction.amount);
  const hasRefund = netAmount !== undefined && netAmount !== Number(transaction.amount);

  const x = useMotionValue(0);
  const bgOpacity = useTransform(x, [-120, -60, 0, 60, 120], [1, 0.6, 0, 0.6, 1]);
  const bgColor = useTransform(x, (val) => val > 0 ? 'rgb(34 197 94)' : 'rgb(34 197 94)');
  const [swiped, setSwiped] = useState(false);

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (!swipeEnabled) return;
    const threshold = 80;
    if (Math.abs(info.offset.x) > threshold) {
      setSwiped(true);
      onSwipeApprove?.(transaction.id);
    }
  };

  const cardContent = (
    <>
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

      {needsReview && (
        <div className="relative flex-shrink-0">
          <div className="w-2.5 h-2.5 rounded-full bg-orange-400 animate-pulse" />
        </div>
      )}

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
    </>
  );

  if (swipeEnabled) {
    return (
      <div className="relative overflow-hidden">
        {/* Background reveal on swipe */}
        <motion.div
          className="absolute inset-0 flex items-center justify-between px-6"
          style={{ opacity: bgOpacity }}
        >
          <div className="flex items-center gap-2 text-green-500">
            <Check className="w-5 h-5" />
            <span className="text-xs font-semibold">Approve</span>
          </div>
          <div className="flex items-center gap-2 text-green-500">
            <span className="text-xs font-semibold">Approve</span>
            <Check className="w-5 h-5" />
          </div>
        </motion.div>

        <motion.div
          style={{ x }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.5}
          onDragEnd={handleDragEnd}
          animate={swiped ? { x: 300, opacity: 0 } : { x: 0 }}
          transition={swiped ? { duration: 0.3 } : undefined}
          onClick={onClick}
          className={cn(
            "flex items-center gap-4 p-3 border-b border-border/50 hover:bg-muted/30 cursor-pointer group transition-colors bg-background relative z-10",
            isNotCounted && "opacity-60"
          )}
        >
          {cardContent}
        </motion.div>
      </div>
    );
  }

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
      {cardContent}
    </motion.div>
  );
}