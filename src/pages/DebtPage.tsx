import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { ArrowLeft, HandCoins, X, Plus, Pencil } from 'lucide-react';
import { RecordDebtDialog } from '@/components/debt/RecordDebtDialog';
import {
  RecordRepaymentDialog,
  type RepaymentTarget,
} from '@/components/debt/RecordRepaymentDialog';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useEnrichmentMap, useUpdateEnrichment, useMarkLentBulk, type TxnEnrichment } from '@/hooks/useTxnEnrichment';
import { useRefundTotals } from '@/hooks/useRefundLinks';
import { formatINR } from '@/lib/formatCurrency';
import { repaymentProgress } from '@/lib/repaymentProgress';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  const [repaying, setRepaying] = useState<RepaymentTarget | null>(null);
  const markLent = useMarkLentBulk();
  // Renaming a counterparty is re-marking every loan filed under it, which is
  // exactly what the bulk mark already does.
  const [renaming, setRenaming] = useState<
    { from: string; loans: { txn: LoanTxn; enrichment: TxnEnrichment }[] } | null
  >(null);
  const [renameTo, setRenameTo] = useState('');

  // Only what was lent out. The agent may also file a credit as
  // lending.type 'repayment', and without the type check those rows would list
  // here as debts owed to the user.
  const loanRows = useMemo(() => {
    if (!enrichmentMap) return [] as TxnEnrichment[];
    return [...enrichmentMap.values()].filter((r) => r.lending?.type === 'lent');
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
            <p className="text-xs text-muted-foreground mt-3">or mark any transaction as lent from its detail page</p>
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
                    <span className="flex items-baseline gap-1.5 min-w-0">
                      <span className="font-heading text-lg font-normal capitalize truncate">{key}</span>
                      <button
                        onClick={() => {
                          setRenaming({ from: key, loans: group.loans });
                          setRenameTo(key);
                        }}
                        className="p-1 rounded text-muted-foreground/60 hover:text-primary hover:bg-primary/10 transition-colors shrink-0"
                        aria-label={`Rename ${key}`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </span>
                    <span className="flex items-baseline gap-2 shrink-0">
                      <span className="text-2xs text-muted-foreground uppercase tracking-wider">
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
                              <span className="text-2xs text-muted-foreground">lent</span>
                            </span>
                          </div>
                          <div className="mt-0.5 flex items-baseline justify-between gap-3 text-2xs text-muted-foreground">
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
                        <div className="flex items-center gap-1 shrink-0">
                          {loan.outstanding > 0 && (
                            <button
                              onClick={() =>
                                setRepaying({
                                  transactionId: loan.txn.id,
                                  label: loan.txn.notes || loan.txn.merchant || 'Loan',
                                  counterparty: loan.enrichment.lending!.counterparty,
                                  lent,
                                  repaid: loan.repaid,
                                  outstanding: loan.outstanding,
                                })
                              }
                              aria-label="Record money back on this loan"
                              className="p-1.5 rounded-full text-muted-foreground hover:bg-gold/10 hover:text-gold transition-colors"
                            >
                              <HandCoins className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => unmark(loan)}
                            disabled={updateEnrichment.isPending}
                            aria-label="Remove from debt tracking"
                            className="p-1.5 -mr-1.5 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </motion.div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-6">
              Record money back with the coin icon on a loan, in full or in part. An
              existing credit can still be linked from its own transaction page.
            </p>
          </>
        )}
      </div>

      <Dialog open={!!renaming} onOpenChange={(o) => !o && setRenaming(null)}>
        <DialogContent className="glass-elevated border-border/50">
          <DialogHeader>
            <DialogTitle className="font-heading font-normal text-2xl">Rename counterparty</DialogTitle>
            <DialogDescription>
              Applies to {renaming?.loans.length ?? 0} loan
              {(renaming?.loans.length ?? 0) === 1 ? '' : 's'} filed under this name.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="debt-name" className="text-2xs font-mono uppercase tracking-wider text-muted-foreground">
              Name
            </Label>
            <Input
              id="debt-name"
              value={renameTo}
              onChange={(e) => setRenameTo(e.target.value)}
              autoFocus
            />
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenaming(null)}>Cancel</Button>
            <Button
              disabled={!renameTo.trim() || markLent.isPending}
              onClick={async () => {
                if (!renaming) return;
                try {
                  await markLent.mutateAsync({
                    counterparty: renameTo.trim(),
                    transactions: renaming.loans.map((l) => ({
                      id: l.txn.id,
                      notes: l.txn.notes,
                      existing: l.enrichment,
                    })),
                  });
                  setRenaming(null);
                  toast({ title: 'Counterparty renamed' });
                } catch {
                  toast({ title: 'Could not rename', variant: 'destructive' });
                }
              }}
            >
              {markLent.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RecordDebtDialog open={recordOpen} onOpenChange={setRecordOpen} />
      <RecordRepaymentDialog
        target={repaying}
        onOpenChange={(o) => {
          if (!o) setRepaying(null);
        }}
      />
    </AppLayout>
  );
}
