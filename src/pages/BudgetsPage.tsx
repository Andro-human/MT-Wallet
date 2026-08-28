import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { format, startOfMonth, subMonths, addMonths, isSameMonth } from 'date-fns';
import { ArrowLeft, Plus, Pencil, Trash2, Wallet, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useBudgetStandings, type WeekTxn } from '@/hooks/useBudgetStandings';
import { useDeleteBudget } from '@/hooks/useBudgets';
import { BudgetDialog } from '@/components/budgets/BudgetDialog';
import { formatINR, formatINRCompact } from '@/lib/formatCurrency';
import { Link } from 'react-router-dom';
import { entityColor } from '@/lib/categoryColors';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { BudgetDef } from '@/lib/budgetMath';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/** One line per purchase rather than per row: transactions the user combined
 *  are folded together, so this list agrees with the order count above it
 *  instead of contradicting it. */
function foldPurchases(txns: WeekTxn[]) {
  const seen = new Set<string>();
  const out: { key: string; id: string; label: string; amount: number; day: string; parts: number }[] = [];
  for (const tx of txns) {
    if (tx.combineId) {
      if (seen.has(tx.combineId)) continue;
      seen.add(tx.combineId);
      const members = txns.filter((x) => x.combineId === tx.combineId);
      // A combined purchase has no single row to open, so link to the member
      // carrying the note, else the largest: the one whose detail page explains
      // the purchase rather than the fee stuck to it.
      const anchor =
        members.find((m) => m.note?.trim()) ??
        [...members].sort((a, b) => b.amount - a.amount)[0];
      out.push({
        key: tx.combineId,
        id: anchor.id,
        label: members.find((m) => m.note)?.note || tx.merchant || 'Unknown',
        amount: members.reduce((a, m) => a + m.amount, 0),
        day: tx.day,
        parts: members.length,
      });
    } else {
      out.push({
        key: tx.id,
        id: tx.id,
        label: tx.note || tx.merchant || 'Unknown',
        amount: tx.amount,
        day: tx.day,
        parts: 1,
      });
    }
  }
  return out;
}

export default function BudgetsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  // The month being viewed. Carry already walks history, so an earlier month
  // shows what was actually available then.
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()));
  const monthKey = format(viewMonth, 'yyyy-MM');
  const isCurrentMonth = isSameMonth(viewMonth, new Date());
  const { standings, ceiling, ceilingIsFallback, excluded, isLoading } = useBudgetStandings(monthKey);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Heaviest pressure first. useBudgets orders by amount, which put an untouched
  // Rs 10K Travel budget in the top slot ahead of everything actually running
  // out. Same ordering as the Home strip so the two agree.
  const rows = useMemo(
    () =>
      [...standings].sort((a, b) => {
        const pa = a.allowance > 0 ? a.spent / a.allowance : 0;
        const pb = b.allowance > 0 ? b.spent / b.allowance : 0;
        return pb - pa;
      }),
    [standings],
  );
  const [openWeek, setOpenWeek] = useState<string | null>(null);
  const deleteBudget = useDeleteBudget();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BudgetDef | null>(null);
  const [deleting, setDeleting] = useState<BudgetDef | null>(null);

  const totalSpent = standings.reduce((s, x) => s + x.spent, 0);

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  return (
    <AppLayout>
      <div className="sticky top-0 z-10 backdrop-blur-xl bg-background/95 border-b border-border/30 safe-area-top">
        <div className="flex items-center gap-3 px-5 py-3 page-shell">
          <button
            onClick={() => navigate('/settings')}
            className="p-1.5 -ml-1.5 rounded-lg hover:bg-muted/30"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold flex-1">Budgets</h1>
          {!isLoading && standings.length > 0 && (
            <span className="amount text-sm">
              {formatINRCompact(totalSpent)}
              <span className="text-muted-foreground"> / {formatINRCompact(ceiling)}</span>
            </span>
          )}
        </div>
      </div>

      <div className="px-5 py-6 pb-28 page-shell">
        <div className="flex items-center justify-center gap-1 mb-5">
          <button
            onClick={() => setViewMonth((m) => subMonths(m, 1))}
            className="w-10 h-10 rounded-full grid place-items-center text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-medium min-w-[130px] text-center tabular-nums select-none">
            {format(viewMonth, 'MMMM yyyy')}
          </span>
          <button
            onClick={() => setViewMonth((m) => addMonths(m, 1))}
            disabled={isCurrentMonth}
            className="w-10 h-10 rounded-full grid place-items-center text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
            aria-label="Next month"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {excluded > 0 && (
          <p className="text-2xs text-muted-foreground text-center -mt-3 mb-4">
            <span className="amount">{formatINR(excluded)}</span> excluded as one-off, counted in
            spend but not against a budget
          </p>
        )}

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded bg-muted/20" />
            ))}
          </div>
        ) : standings.length === 0 ? (
          <div className="text-center py-16">
            <Wallet className="w-10 h-10 mx-auto mb-4 text-muted-foreground/30" />
            <p className="font-medium">No budgets yet</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
              {ceilingIsFallback && ceiling > 0
                ? `Your ${formatINR(ceiling)} monthly budget is still in use. Add budgets here and the ceiling becomes their total instead.`
                : 'Set a limit per category or group. One budget can cover several, and one can be the catch-all for everything else.'}
            </p>
            <button
              onClick={openNew}
              className="mt-5 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
            >
              <Plus className="w-4 h-4" /> New budget
            </button>
          </div>
        ) : (
          <div>
            {rows.map((s, i) => {
              const pct = s.allowance > 0 ? (s.spent / s.allowance) * 100 : 0;
              const over = s.remaining < 0;
              const color = entityColor(s.budget.id);
              return (
                <motion.div
                  key={s.budget.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i, 12) * 0.02, duration: 0.3 }}
                  className="group border-b border-border/50 last:border-b-0 py-3.5"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="flex items-baseline gap-2 min-w-0">
                      <span className="font-heading text-lg font-normal truncate">
                        {s.budget.name}
                      </span>
                      {s.budget.isRemainder && (
                        <span className="text-2xs font-mono uppercase tracking-wider text-muted-foreground shrink-0">
                          everything else
                        </span>
                      )}
                    </span>

                    <span className="flex items-baseline gap-2.5 shrink-0">
                      <span className={cn('amount text-sm', over && 'text-warning')}>
                        {formatINRCompact(s.spent)}
                      </span>
                      <span className="text-2xs text-muted-foreground">
                        / {formatINRCompact(s.allowance)}
                      </span>
                      <span className="flex items-center justify-end gap-0.5 w-[3.25rem]">
                        <button
                          onClick={() => {
                            setEditing(s.budget);
                            setDialogOpen(true);
                          }}
                          className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                          aria-label={`Edit ${s.budget.name}`}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleting(s.budget)}
                          className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          aria-label={`Delete ${s.budget.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    </span>
                  </div>

                  <div className="mt-1 flex items-baseline gap-2.5 text-2xs text-muted-foreground">
                    {s.carryIn > 0 && (
                      <span className="amount">{formatINRCompact(s.carryIn)} rolled over</span>
                    )}
                    {s.budget.weeklyAmount ? (
                      <span className="amount">
                        {formatINRCompact(s.spentThisWeek)} of {formatINRCompact(s.budget.weeklyAmount)} this week
                      </span>
                    ) : null}
                    {s.ordersThisWeek !== null && s.budget.weeklyCount ? (
                      <span
                        className={cn(
                          'amount',
                          s.ordersThisWeek > s.budget.weeklyCount && 'text-warning',
                        )}
                      >
                        {s.ordersThisWeek} of {s.budget.weeklyCount} orders
                      </span>
                    ) : null}
                    <span className={cn('ml-auto amount', over && 'text-warning')}>
                      {over
                        ? `${formatINRCompact(-s.remaining)} over`
                        : `${formatINRCompact(s.remaining)} left`}
                    </span>
                  </div>

                  <div className="mt-2 h-1.5 w-full rounded-full bg-muted/30 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-[width]"
                      style={{
                        width: `${Math.min(pct, 100)}%`,
                        background: over ? 'hsl(var(--warning))' : color,
                      }}
                    />
                  </div>

                  <button
                    onClick={() => setExpanded(expanded === s.budget.id ? null : s.budget.id)}
                    className="mt-1.5 flex items-center gap-1 text-2xs text-muted-foreground hover:text-foreground transition-colors"
                    aria-expanded={expanded === s.budget.id}
                  >
                    week by week
                    <ChevronDown
                      className={cn(
                        'w-3 h-3 transition-transform',
                        expanded === s.budget.id && 'rotate-180',
                      )}
                    />
                  </button>

                  <AnimatePresence initial={false}>
                    {expanded === s.budget.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.18 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-2 pl-3 border-l border-border/50">
                          {s.weeks.map((w) => {
                            const overWeek =
                              s.budget.weeklyAmount != null && w.spent > s.budget.weeklyAmount;
                            const overCount =
                              s.budget.weeklyCount != null && w.orders > s.budget.weeklyCount;
                            return (
                              <div key={w.start}>
                                <button
                                  onClick={() => {
                                    const key = `${s.budget.id}|${w.start}`;
                                    setOpenWeek(openWeek === key ? null : key);
                                  }}
                                  disabled={w.txns.length === 0}
                                  aria-expanded={openWeek === `${s.budget.id}|${w.start}`}
                                  className="w-full flex items-baseline gap-3 py-1 text-2xs text-left rounded hover:bg-muted/10 transition-colors disabled:cursor-default disabled:hover:bg-transparent"
                                >
                                  <span
                                    className={cn(
                                      'amount w-20 shrink-0',
                                      w.isCurrent ? 'text-foreground' : 'text-muted-foreground',
                                    )}
                                  >
                                    {format(new Date(`${w.start}T12:00:00`), 'MMM d')}
                                    {w.isCurrent ? ' \u00B7' : ''}
                                  </span>
                                  <span className={cn('amount w-24 shrink-0', overWeek && 'text-warning')}>
                                    {formatINRCompact(w.spent)}
                                    {s.budget.weeklyAmount
                                      ? ` / ${formatINRCompact(s.budget.weeklyAmount)}`
                                      : ''}
                                  </span>
                                  <span className={cn('amount', overCount && 'text-warning')}>
                                    {w.orders} order{w.orders === 1 ? '' : 's'}
                                    {s.budget.weeklyCount ? ` / ${s.budget.weeklyCount}` : ''}
                                  </span>
                                </button>

                                {openWeek === `${s.budget.id}|${w.start}` && (
                                  <div className="pl-3 pb-1.5 ml-1 border-l border-border/40">
                                    {foldPurchases(w.txns).map((l) => (
                                      <Link
                                        key={l.key}
                                        to={`/transactions/${l.id}`}
                                        className="flex items-baseline gap-2 py-0.5 text-2xs text-muted-foreground hover:text-foreground transition-colors"
                                      >
                                        <span className="amount w-12 shrink-0">
                                          {format(new Date(`${l.day}T12:00:00`), 'MMM d')}
                                        </span>
                                        <span className="truncate flex-1">
                                          {l.label}
                                          {l.parts > 1 ? ` (${l.parts} charges)` : ''}
                                        </span>
                                        <span className="amount shrink-0">{formatINR(l.amount)}</span>
                                      </Link>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {standings.length > 0 && (
        <motion.button
          className="fixed bottom-24 right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-xl flex items-center justify-center"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={openNew}
          aria-label="New budget"
        >
          <Plus className="w-6 h-6" />
        </motion.button>
      )}

      <BudgetDialog open={dialogOpen} onOpenChange={setDialogOpen} budget={editing} />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent className="glass-elevated border-border/50">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              It is archived rather than erased, so months already computed against it
              keep their figures. Its categories fall back to the catch-all budget.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!deleting) return;
                try {
                  await deleteBudget.mutateAsync(deleting.id);
                  toast({ title: 'Budget removed' });
                } catch {
                  toast({ title: 'Could not remove', variant: 'destructive' });
                } finally {
                  setDeleting(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
