import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { ArrowLeft, HandCoins, X, Plus } from 'lucide-react';
import { RecordDebtDialog } from '@/components/debt/RecordDebtDialog';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useEnrichmentMap, useUpdateEnrichment, type TxnEnrichment } from '@/hooks/useTxnEnrichment';
import { useRefundTotals } from '@/hooks/useRefundLinks';
import { formatINR } from '@/lib/formatCurrency';
import { repaymentProgress } from '@/lib/repaymentProgress';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface LoanTxn {
  id: string;
  amount: number;
  merchant: string | null;
  notes: string | null;
  transacted_at: string;
}

export default function DebtPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: enrichmentMap, isLoading: enrichmentLoading } = useEnrichmentMap();
  const { data: refundTotals = {} } = useRefundTotals();
  const updateEnrichment = useUpdateEnrichment();
  const [recordOpen, setRecordOpen] = useState(false);

  const loanRows = useMemo(() => {
    if (!enrichmentMap) return [] as TxnEnrichment[];
    return [...enrichmentMap.values()].filter((r) => r.lending);
  }, [enrichmentMap]);

  const loanIds = useMemo(() => loanRows.map((r) => r.transaction_id).sort(), [loanRows]);

  const { data: loanTxns = [], isLoading: txnsLoading } = useQuery({
    queryKey: ['debt-transactions', user?.id, loanIds.join(',')],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('id, amount, merchant, notes, transacted_at')
        .in('id', loanIds);
      if (error) throw error;
      return (data ?? []) as LoanTxn[];
    },
    enabled: !!user && loanIds.length > 0,
  });

  const byCounterparty = useMemo(() => {
    const txnById = new Map(loanTxns.map((t) => [t.id, t]));
    const groups = new Map<
      string,
      { loans: { txn: LoanTxn; enrichment: TxnEnrichment; repaid: number; outstanding: number }[]; outstanding: number }
    >();
    for (const row of loanRows) {
      const txn = txnById.get(row.transaction_id);
      if (!txn) continue;
      const repaid = refundTotals[txn.id] || 0;
      const outstanding = Math.max(Number(txn.amount) - repaid, 0);
      const key = row.lending!.counterparty.toLowerCase();
      const group = groups.get(key) ?? { loans: [], outstanding: 0 };
      group.loans.push({ txn, enrichment: row, repaid, outstanding });
      group.outstanding += outstanding;
      groups.set(key, group);
    }
    for (const g of groups.values()) {
      g.loans.sort((a, b) => +new Date(b.txn.transacted_at) - +new Date(a.txn.transacted_at));
    }
    return [...groups.entries()].sort((a, b) => b[1].outstanding - a[1].outstanding);
  }, [loanRows, loanTxns, refundTotals]);

  const totalOutstanding = byCounterparty.reduce((s, [, g]) => s + g.outstanding, 0);
  const isLoading = enrichmentLoading || (loanIds.length > 0 && txnsLoading);

  const unmark = async (loan: { txn: LoanTxn; enrichment: TxnEnrichment }) => {
    try {
      await updateEnrichment.mutateAsync({
        transactionId: loan.txn.id,
        notes: loan.txn.notes,
        existing: loan.enrichment,
        lending: null,
      });
      toast({ title: 'Removed from debt tracking' });
    } catch {
      toast({ title: 'Failed to remove', variant: 'destructive' });
    }
  };

  return (
    <AppLayout>
      <div className="px-4 pt-6 pb-24 page-shell">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-muted/30 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <HandCoins className="w-5 h-5" /> Debt Tracker
            </h1>
            <p className="text-sm text-muted-foreground">Money lent, detected from your notes</p>
          </div>
          <button
            onClick={() => setRecordOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium shrink-0"
          >
            <Plus className="w-4 h-4" /> Record
          </button>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full bg-muted/20" />
            <Skeleton className="h-24 w-full bg-muted/20" />
          </div>
        ) : byCounterparty.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-sm">No open loans.</p>
            <button
              onClick={() => setRecordOpen(true)}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
            >
              <Plus className="w-4 h-4" /> Record a debt
            </button>
            <p className="text-xs text-muted-foreground/70 mt-3">or mark any transaction as lent from its detail page</p>
          </div>
        ) : (
          <>
            <div className="mb-6 pb-4 border-b border-border/60">
              <p className="text-2xs font-mono uppercase tracking-widest text-muted-foreground mb-1">
                Total outstanding
              </p>
              <p className="text-3xl font-semibold currency-display text-gold">
                {formatINR(totalOutstanding)}
              </p>
            </div>
            <div>
              {byCounterparty.map(([key, group]) => (
                <motion.div
                  key={key}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="border-b border-border/50 last:border-b-0 py-4"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-heading text-lg font-normal capitalize">{key}</span>
                    <span className="flex items-baseline gap-2 shrink-0">
                      <span className="text-2xs text-muted-foreground/70 uppercase tracking-wider">
                        outstanding
                      </span>
                      <span className={cn('amount text-sm', group.outstanding > 0 ? 'text-gold' : 'text-muted-foreground line-through')}>
                        {formatINR(group.outstanding)}
                      </span>
                    </span>
                  </div>

                  {group.loans.map((loan) => {
                    const lent = Number(loan.txn.amount);
                    const paid = repaymentProgress(lent, loan.repaid);
                    return (
                      <div key={loan.txn.id} className="mt-3 flex items-start gap-3">
                        <Link to={`/transactions/${loan.txn.id}`} className="flex-1 min-w-0 group">
                          <div className="flex items-baseline justify-between gap-3 text-sm">
                            <span className="truncate text-foreground group-hover:text-primary transition-colors">
                              {loan.txn.notes || loan.txn.merchant || 'Loan'}
                            </span>
                            <span className="shrink-0 flex items-baseline gap-1.5">
                              <span className="amount">{formatINR(lent)}</span>
                              <span className="text-2xs text-muted-foreground/70">lent</span>
                            </span>
                          </div>
                          <div className="mt-0.5 flex items-baseline justify-between gap-3 text-2xs text-muted-foreground/80">
                            <span>{format(new Date(loan.txn.transacted_at), 'MMM d, yyyy')}</span>
                            <span className="shrink-0 amount">
                              {loan.repaid > 0
                                ? `${formatINR(loan.repaid)} back · ${formatINR(loan.outstanding)} due`
                                : 'nothing back yet'}
                            </span>
                          </div>
                          {/* The track is filled, not empty: at 0% repaid the whole
                              bar reads as still-out rather than as a hairline rule. */}
                          <div className="mt-2 h-1.5 w-full rounded-full bg-muted/40 overflow-hidden">
                            <div className="h-full rounded-full bg-gold" style={{ width: `${paid}%` }} />
                          </div>
                        </Link>
                        <button
                          onClick={() => unmark(loan)}
                          disabled={updateEnrichment.isPending}
                          aria-label="Remove from debt tracking"
                          className="p-1.5 -mr-1.5 rounded-full text-muted-foreground/60 hover:bg-destructive/10 hover:text-destructive transition-colors shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </motion.div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground/70 mt-6">
              Repayments are the credits you link to a loan from its transaction page (same flow as linking a refund).
            </p>
          </>
        )}
      </div>

      <RecordDebtDialog open={recordOpen} onOpenChange={setRecordOpen} />
    </AppLayout>
  );
}
