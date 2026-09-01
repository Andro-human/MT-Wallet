import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Ban, RotateCcw } from 'lucide-react';
import { formatINR } from '@/lib/formatCurrency';
import {
  useOutliers,
  useDismissOutlier,
  useDismissLabelEverywhere,
  useRestoreOutlier,
  useDismissedOutliers,
} from '@/hooks/useOutliers';
import { EVERY_MONTH, totalsAcross } from '@/lib/outliers';
import { cn } from '@/lib/utils';

const monthLabel = (m: string) => format(new Date(`${m}-01T12:00:00`), 'MMMM yyyy');

/** Steps down so the eye ranks the marks without a second hue. Vermilion is the
 *  anomaly colour and there is nothing else it could be here. */
const OPACITY = [1, 0.78, 0.62, 0.5, 0.42, 0.36, 0.32, 0.3];

export function MonthDifferences({ only, title }: { only?: string[]; title?: string }) {
  const { months, budget, budgetFrom, isLoading } = useOutliers(only);
  const { data: dismissed } = useDismissedOutliers();
  const dismiss = useDismissOutlier();
  const dismissEverywhere = useDismissLabelEverywhere();
  const restore = useRestoreOutlier();
  const [showDismissed, setShowDismissed] = useState(false);
  const [openMark, setOpenMark] = useState<string | null>(null);

  const scale = useMemo(() => Math.max(1, ...months.map((m) => m.total)), [months]);
  const totals = useMemo(() => totalsAcross(months), [months]);
  const ordinary = useMemo(() => {
    if (months.length === 0) return 0;
    const s = months.map((m) => m.baseline).sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  }, [months]);

  const header = (
    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
      {title ? <h3 className="font-heading font-bold text-foreground">{title}</h3> : <span />}
      {months.length > 0 && (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 sm:justify-end">
          <span className="amount text-[15px] text-foreground">{formatINR(totals.total)}</span>
          <span className="inline-flex items-baseline gap-1.5 text-[11px] text-muted-foreground">
            <span className="h-[5px] w-[5px] shrink-0 translate-y-[-2px] rounded-full bg-muted-foreground/40" />
            <span className="amount">{formatINR(totals.baseline)}</span> ordinary
          </span>
          <span className="inline-flex items-baseline gap-1.5 text-[11px] text-muted-foreground">
            <span className="h-[5px] w-[5px] shrink-0 translate-y-[-2px] rounded-full bg-primary" />
            <span className="amount">{formatINR(totals.flagged)}</span> one-offs
          </span>
        </div>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <div>
        {header}
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-muted/10" />
          ))}
        </div>
      </div>
    );
  }

  if (months.length === 0) {
    return (
      <div>
        {header}
        <p className="text-sm text-muted-foreground">
          No monthly reviews in this range, so there is nothing to compare.
        </p>
      </div>
    );
  }

  return (
    <div>
      {header}
      <p className="text-[15px] text-foreground">
        An ordinary month costs <span className="amount">{formatINR(ordinary)}</span>. Everything past
        that is one-offs.
      </p>
      <p className="mt-1 text-[12px] text-muted-foreground">
        Tap a mark for detail, cross it off if it is not unusual.
      </p>

      <div className="mt-7">
        {months.map((m) => (
          <div key={m.month} className="border-b border-border/40 py-4 last:border-b-0">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-heading italic text-[17px] text-foreground">
                {monthLabel(m.month)}
              </span>
              <span className="amount text-[14px] text-foreground">{formatINR(m.total)}</span>
            </div>

            <div className="relative mt-2.5">
              <div className="flex h-[13px] items-stretch gap-[1.5px]">
                <div
                  className="rounded-[1px] bg-muted-foreground/40"
                  style={{ width: `${(m.baseline / scale) * 100}%` }}
                />
                {m.outliers.map((o, i) => (
                  <div
                    key={o.label}
                    className="rounded-[1px] bg-primary"
                    style={{
                      width: `${(o.amount / scale) * 100}%`,
                      opacity: OPACITY[Math.min(i, 7)],
                    }}
                  />
                ))}
              </div>
              {m.budget !== null && m.budget < scale && (
                <div
                  className="absolute -top-1 bottom-[-4px] w-px bg-foreground/45"
                  style={{ left: `${(m.budget / scale) * 100}%` }}
                  title={`budget ${formatINR(m.budget)}`}
                />
              )}
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
                      <button
                        onClick={() =>
                          setOpenMark((k) => (k === `${m.month}|${o.label}` ? null : `${m.month}|${o.label}`))
                        }
                        disabled={!o.one_liner}
                        className={cn(
                          'inline-flex items-baseline gap-1.5 text-left',
                          o.one_liner && 'underline decoration-dotted decoration-border underline-offset-4',
                        )}
                      >
                        <span>{o.label}</span>
                        <span className="amount">{formatINR(o.amount)}</span>
                        <span className="text-[11px] text-muted-foreground">{o.detail}</span>
                      </button>
                      <span className="ml-0.5 flex items-center opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                        <button
                          onClick={() => dismiss.mutate({ month: m.month, label: o.label })}
                          title={`${o.label} is ordinary for ${monthLabel(m.month)}`}
                          aria-label={`${o.label} is ordinary for ${monthLabel(m.month)}`}
                          className="grid h-5 w-5 place-items-center rounded text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => dismissEverywhere.mutate({ label: o.label })}
                          title={`never flag ${o.label}, in any month`}
                          aria-label={`never flag ${o.label}, in any month`}
                          className="grid h-5 w-5 place-items-center rounded text-muted-foreground hover:text-foreground"
                        >
                          <Ban className="h-3 w-3" />
                        </button>
                      </span>
                    </motion.span>
                  ))}
                </AnimatePresence>
              </div>
            )}

            {(() => {
              const open = m.outliers.find((o) => `${m.month}|${o.label}` === openMark);
              return open?.one_liner ? (
                <p className="mt-2 max-w-[60ch] text-[12px] leading-relaxed text-muted-foreground/85">
                  {open.one_liner}
                </p>
              ) : null;
            })()}

            <p className="mt-2 text-[12px] text-muted-foreground">
              {m.outliers.length > 0 && (
                <>
                  <span className="amount">{formatINR(m.flagged)}</span> of one-offs.{' '}
                </>
              )}
              {m.ordinaryWithinBudget === null ? null : m.ordinaryWithinBudget ? (
                <>
                  {m.outliers.length > 0 ? 'Without them, ' : 'Ordinary spend '}
                  <span className="amount">{formatINR(m.baseline)}</span> against a{' '}
                  <span className="amount">{formatINR(m.budget!)}</span> budget.
                </>
              ) : (
                <>
                  Over budget {m.outliers.length > 0 ? 'even without them' : 'on ordinary spend alone'}:{' '}
                  <span className="amount">{formatINR(m.baseline)}</span> of{' '}
                  <span className="amount">{formatINR(m.budget!)}</span>.
                </>
              )}
            </p>
          </div>
        ))}
      </div>

      {budget !== null && (
        <p className="mt-6 text-[12px] leading-relaxed text-muted-foreground">
          The tick is your current {formatINR(budget)} a month, drawn on every month as one fixed line
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
                const sep = k.indexOf('|');
                const month = k.slice(0, sep);
                const label = k.slice(sep + 1);
                return (
                  <button
                    key={k}
                    onClick={() => restore.mutate({ month, label })}
                    title={`flag ${label} again`}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border/60 px-2.5 py-1',
                      'text-[12px] text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <RotateCcw className="h-3 w-3" />
                    {label}
                    <span className="text-[11px] opacity-70">
                      {month === EVERY_MONTH ? 'every month' : month}
                    </span>
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
