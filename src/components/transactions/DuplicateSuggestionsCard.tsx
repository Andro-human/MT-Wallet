import { useState, forwardRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Check, ChevronDown, X } from 'lucide-react';
import { format } from 'date-fns';
import { formatINR } from '@/lib/formatCurrency';
import { useCreateDuplicateLink } from '@/hooks/useDuplicateLinks';
import { useToast } from '@/hooks/use-toast';
import { DuplicatePair } from '@/hooks/usePotentialDuplicates';
import type { TransactionWithCategory } from '@/types/database';
import { cn } from '@/lib/utils';

interface DuplicateSuggestionsCardProps {
  pairs: DuplicatePair[];
  onDismiss: (pairKey: string) => void;
}

// Friendly label for the message source. Falls back to the raw value.
function formatSource(source: string | null | undefined): string {
  switch (source) {
    case 'email': return 'Email';
    case 'ios_shortcut': return 'SMS';
    case 'sms': return 'SMS';
    case 'manual': return 'Manual';
    case 'axio': return 'Axio';
    default: return source || 'Unknown';
  }
}

interface PairCardProps {
  pair: DuplicatePair;
  onDismiss: (pairKey: string) => void;
  onLink: (keep: TransactionWithCategory, discard: TransactionWithCategory) => Promise<void>;
  isPending: boolean;
}

// AnimatePresence mode="popLayout" measures its direct child through a ref, so
// a plain function component here means the ref never attaches and exit/layout
// animation silently does nothing.
const PairCard = forwardRef<HTMLDivElement, PairCardProps>(function PairCard(
  { pair, onDismiss, onLink, isPending },
  ref,
) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.15 }}
      className="rounded-xl border border-warning/20 bg-warning/5 px-4 py-3"
    >
      {/* Always-visible summary row */}
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-3.5 h-3.5 text-warning flex-shrink-0" />
        <p className="text-sm text-foreground flex-1 min-w-0 truncate">
          <span className="font-medium">{pair.transactionA.merchant || 'Unknown'}</span>
          <span className="text-muted-foreground"> &amp; </span>
          <span className="font-medium">{pair.transactionB.merchant || 'Unknown'}</span>
          <span className="text-muted-foreground">
            {' · '}{formatINR(Number(pair.transactionA.amount))}
            {' · '}{format(new Date(pair.transactionA.transacted_at), 'MMM d')}
          </span>
        </p>
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="text-xs font-medium text-warning hover:text-warning transition-colors flex items-center gap-1 flex-shrink-0"
        >
          Resolve
          <ChevronDown
            className={cn('w-3 h-3 transition-transform', expanded && 'rotate-180')}
          />
        </button>
        <button
          onClick={() => onDismiss(pair.pairKey)}
          className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
          aria-label="Not a duplicate"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Expand-to-pick choice */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="expanded"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <p className="text-xs text-muted-foreground ml-5 mt-2 mb-2">
              Tap the one you want to keep. The other will be marked as a duplicate.
            </p>
            <div className="ml-5 space-y-1.5">
              {[pair.transactionA, pair.transactionB].map((txn, idx, arr) => {
                const other = arr[1 - idx];
                return (
                  <button
                    key={txn.id}
                    type="button"
                    onClick={() => onLink(txn, other)}
                    disabled={isPending}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left',
                      'bg-background/40 border border-border/30',
                      'hover:bg-background/80 hover:border-warning/40 active:scale-[0.98]',
                      'transition-all disabled:opacity-50',
                    )}
                  >
                    <Check className="w-3.5 h-3.5 text-warning/70 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-medium text-foreground truncate">
                          {txn.merchant || 'Unknown'}
                        </span>
                        <span className="text-[11px] font-mono text-muted-foreground whitespace-nowrap">
                          {formatSource((txn as any).source)} · {format(new Date(txn.transacted_at), 'HH:mm')}
                        </span>
                      </div>
                      {txn.category?.name && (
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {txn.category.icon} {txn.category.name}
                        </p>
                      )}
                    </div>
                    <span className="text-[11px] text-warning/80 whitespace-nowrap font-medium">
                      Keep
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

export function DuplicateSuggestionsCard({ pairs, onDismiss }: DuplicateSuggestionsCardProps) {
  const createLink = useCreateDuplicateLink();
  const { toast } = useToast();

  if (pairs.length === 0) return null;

  const handleLink = async (keep: TransactionWithCategory, discard: TransactionWithCategory) => {
    try {
      await createLink.mutateAsync({
        primaryTransactionId: keep.id,
        duplicateTransactionId: discard.id,
      });
      toast({ title: 'Linked as duplicate', description: `Kept "${keep.merchant || 'Unknown'}".` });
    } catch {
      toast({ title: 'Failed to link', variant: 'destructive' });
    }
  };

  return (
    <div className="mb-4 space-y-2">
      <AnimatePresence mode="popLayout">
        {pairs.map((pair) => (
          <PairCard
            key={pair.pairKey}
            pair={pair}
            onDismiss={onDismiss}
            onLink={handleLink}
            isPending={createLink.isPending}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
