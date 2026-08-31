import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { X, RotateCcw } from 'lucide-react';
import { formatINR, formatINRCompact } from '@/lib/formatCurrency';
import {
  useOutliers,
  useDismissOutlier,
  useRestoreOutlier,
  useDismissedOutliers,
} from '@/hooks/useOutliers';
import { cn } from '@/lib/utils';

const monthLabel = (m: string) => format(new Date(`${m}-01T12:00:00`), 'MMMM yyyy');

/** Steps down so the eye ranks the marks without a second hue. Vermilion is the
 *  anomaly colour and there is nothing else it could be here. */
const OPACITY = [1, 0.78, 0.62, 0.5, 0.42, 0.36, 0.32, 0.3];

export function MonthDifferences() {
  const { months, budget, budgetFrom, isLoading } = useOutliers();
  const { data: dismissed } = useDismissedOutliers();
  const dismiss = useDismissOutlier();
  const restore = useRestoreOutlier();
  const [showDismissed, setShowDismissed] = useState(false);

  const scale = useMemo(() => Math.max(1, ...months.map((m) => m.total)), [months]);
  const ordinary = useMemo(() => {
    if (months.length === 0) return 0;
    const s = months.map((m) => m.baseline).sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  }, [months]);

  // One line down the whole list rather than a tick per row: on a shared scale
  // a fixed ceiling lands at the same x every month, and 19 unlabelled ticks at
  // one x read as a rendering fault instead of an axis.
  const budgetPct = budget !== null && budget < scale ? (budget / scale) * 100 : null;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 rounded-xl bg-muted/10" />
        ))}
      </div>
    );
  }

  if (months.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No monthly reviews yet, so there is nothing to compare.
      </p>
    );
  }

  return (
    <div>
      <p className="text-[15px] text-foreground">
        An ordinary month costs <span className="amount">{formatINR(ordinary)}</span>. Everything past
        that is one-offs.
      </p>
      <p className="mt-1.5 max-w-[46ch] text-[13px] leading-relaxed text-muted-foreground">
        Bars share one scale. The quiet part recurs every month; each vermilion mark is a theme that
        did not, or that came in far above its usual size. Tap the cross on anything you would not
        call unusual.
      </p>

      {budgetPct !== null && (
        <div className="relative mt-6 h-4">
          <span
            className="absolute -translate-x-1/2 whitespace-nowrap text-[10px] font-mono uppercase tracking-[0.12em] text-muted-foreground"
            style={{ left: `${budgetPct}%` }}
          >
            {formatINRCompact(budget!)} budget
          </span>
        </div>
      )}

      <div className={cn('relative', budgetPct === null && 'mt-7')}>
        {budgetPct !== null && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 border-l border-dashed border-muted-foreground/30"
            style={{ left: `${budgetPct}%` }}
          />
        )}

        {months.map((m) => (
          <div key={m.month} className="border-b border-border/40 py-4 last:border-b-0">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-heading italic text-[17px] text-foreground">
                {monthLabel(m.month)}
              </span>
              <span className="amount text-[14px] text-foreground">{formatINR(m.total)}</span>
            </div>

            <div className="mt-2.5 flex h-[13px] items-stretch gap-[1.5px]">
              <div
                className="rounded-[1px] bg-muted-foreground/40"
                style={{ width: `${(m.baseline / scale) * 100}%` }}
              />
              {m.outliers.map((o, i) => (
                <div
                  key={o.label}
                  className="rounded-[1px] bg-primary"
                  style={{ width: `${(o.amount / scale) * 100}%`, opacity: OPACITY[Math.min(i, 7)] }}
                />
              ))}
            </div>

            {m.outliers.length === 0 ? (
              <p className="mt-2.5 font-heading text-[13px] italic text-muted-foreground">
                nothing out of the ordinary
              </p>
            ) : (
              <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5">
                <AnimatePresence mode="popLayout">
                  {m.outliers.map((o) => (
                    <motion.span
                      key={o.label}
                      layout
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="group inline-flex items-center gap-1.5 text-[13px] text-foreground"
                    >
                      <span className="h-[5px] w-[5px] shrink-0 rounded-full bg-primary" />
                      {o.label} <span className="amount">{formatINR(o.amount)}</span>
                      <span className="text-[11px] text-muted-foreground">{o.detail}</span>
                      <button
                        onClick={() => dismiss.mutate({ month: m.month, label: o.label })}
                        aria-label={`${o.label} is ordinary`}
                        className="ml-0.5 grid h-5 w-5 place-items-center rounded text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </motion.span>
                  ))}
                </AnimatePresence>
              </div>
            )}

            {m.ordinaryWithinBudget !== null && (
              <p className="mt-2 text-[12px] text-muted-foreground">
                {m.ordinaryWithinBudget ? (
                  <>
                    Without these, <span className="amount">{formatINR(m.baseline)}</span> against a{' '}
                    <span className="amount">{formatINR(m.budget!)}</span> budget.
                  </>
                ) : (
                  <>
                    Over budget even without these:{' '}
                    <span className="amount">{formatINR(m.baseline)}</span> of{' '}
                    <span className="amount">{formatINR(m.budget!)}</span>.
                  </>
                )}
              </p>
            )}
          </div>
        ))}
      </div>

      {budget !== null && (
        <p className="mt-6 text-[12px] leading-relaxed text-muted-foreground">
          The dashed line is your current {formatINR(budget)} a month, drawn across every month as one
          fixed line
          {budgetFrom ? (
            <>
              {' '}
              to read history against. You only set it in {monthLabel(budgetFrom)}, so earlier months
              were not actually measured against it.
            </>
          ) : (
            '.'
          )}
        </p>
      )}

      {(dismissed?.size ?? 0) > 0 && (
        <div className="mt-5">
          <button
            onClick={() => setShowDismissed((v) => !v)}
            className="text-[12px] font-mono uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground"
          >
            {dismissed!.size} marked ordinary {showDismissed ? '−' : '+'}
          </button>
          {showDismissed && (
            <div className="mt-3 flex flex-wrap gap-2">
              {[...dismissed!].sort().map((k) => {
                const [month, label] = k.split('|');
                return (
                  <button
                    key={k}
                    onClick={() => restore.mutate({ month, label })}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border/60 px-2.5 py-1',
                      'text-[12px] text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <RotateCcw className="h-3 w-3" />
                    {label}
                    <span className="text-[11px] opacity-70">{month}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
