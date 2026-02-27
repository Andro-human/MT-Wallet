import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Link2, X } from 'lucide-react';
import { format } from 'date-fns';
import { formatINR } from '@/lib/formatCurrency';
import { useCreateDuplicateLink } from '@/hooks/useDuplicateLinks';
import { useToast } from '@/hooks/use-toast';
import { DuplicatePair } from '@/hooks/usePotentialDuplicates';

interface DuplicateSuggestionsCardProps {
  pairs: DuplicatePair[];
  onDismiss: (pairKey: string) => void;
}

export function DuplicateSuggestionsCard({ pairs, onDismiss }: DuplicateSuggestionsCardProps) {
  const createLink = useCreateDuplicateLink();
  const { toast } = useToast();

  if (pairs.length === 0) return null;

  const handleLink = async (pair: DuplicatePair) => {
    try {
      await createLink.mutateAsync({
        primaryTransactionId: pair.transactionA.id,
        duplicateTransactionId: pair.transactionB.id,
      });
      toast({ title: 'Linked as duplicate' });
    } catch {
      toast({ title: 'Failed to link', variant: 'destructive' });
    }
  };

  return (
    <div className="mb-4 space-y-2">
      <AnimatePresence mode="popLayout">
        {pairs.map((pair) => (
          <motion.div
            key={pair.pairKey}
            layout
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="rounded-xl border border-orange-500/20 bg-orange-500/5 px-4 py-3"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-orange-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-muted-foreground">
                  <span className="text-foreground font-medium">{pair.transactionA.merchant || 'Unknown'}</span>
                  {' & '}
                  <span className="text-foreground font-medium">{pair.transactionB.merchant || 'Unknown'}</span>
                  {' · '}
                  {formatINR(Number(pair.transactionA.amount))}
                  {' · '}
                  {format(new Date(pair.transactionA.transacted_at), 'MMM d')}
                </p>
                <div className="flex items-center gap-3 mt-2">
                  <button
                    onClick={() => handleLink(pair)}
                    disabled={createLink.isPending}
                    className="text-xs font-medium text-orange-500 hover:text-orange-400 transition-colors flex items-center gap-1"
                  >
                    <Link2 className="w-3 h-3" />
                    Link
                  </button>
                  <button
                    onClick={() => onDismiss(pair.pairKey)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                  >
                    <X className="w-3 h-3" />
                    Not a duplicate
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
