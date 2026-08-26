import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { AppLayout } from '@/components/layout/AppLayout';
import { useMonthlySummary } from '@/hooks/useMonthlySummary';
import { formatINR, formatINRCompact } from '@/lib/formatCurrency';
import { PALETTE, LONG_TAIL_COLOR, FOLD_LABEL, FOLD_DONUT, assignColors } from '@/lib/categoryColors';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export default function MonthlyReviewPage() {
  const { month = '' } = useParams<{ month: string }>();
  const valid = MONTH_RE.test(month);
  const { data: review, isLoading } = useMonthlySummary(valid ? month : null);

  const asDate = valid ? new Date(`${month}-01T12:00:00`) : null;
  const monthName = asDate ? format(asDate, 'MMMM') : '';
  const year = asDate ? format(asDate, 'yyyy') : '';

  const slices = review?.spend_slices ?? [];
  const totalSpent = useMemo(() => slices.reduce((s, x) => s + x.amount, 0), [slices]);

  // The donut folds so the slivers stay readable; the list beside it keeps
  // every slice, since a list has no crowding problem.
  const segments = useMemo(() => {
    const colors = assignColors(slices.map((s) => s.label));
    const ranked = slices.map((s) => ({ ...s, fill: colors.get(s.label) ?? LONG_TAIL_COLOR }));
    if (ranked.length <= FOLD_DONUT + 1) return ranked;
    const kept = ranked.slice(0, FOLD_DONUT);
    const tail = ranked.slice(FOLD_DONUT);
    return [
      ...kept,
      {
        label: FOLD_LABEL,
        amount: tail.reduce((s, x) => s + x.amount, 0),
        count: tail.reduce((s, x) => s + x.count, 0),
        fill: LONG_TAIL_COLOR,
      },
    ];
  }, [slices]);

  const sliceColor = useMemo(() => assignColors(slices.map((s) => s.label)), [slices]);
  const pct = (n: number) => (totalSpent > 0 ? `${Math.round((n / totalSpent) * 100)}%` : '');

  if (!valid) {
    return (
      <AppLayout>
        <div className="px-5 pt-10 max-w-2xl mx-auto">
          <p className="text-sm text-muted-foreground">That is not a month.</p>
          <Link to="/insights" className="mt-3 inline-block text-xs font-mono text-primary">
            BACK TO INSIGHTS
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <article className="px-5 md:px-8 pt-6 md:pt-12 pb-24 max-w-2xl mx-auto">
        <Link
          to="/insights"
          className="inline-flex items-center gap-1.5 text-2xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3 h-3" /> Insights
        </Link>

        <header className="mt-6 pb-6 border-b border-border/60">
          <p className="text-2xs font-mono uppercase tracking-widest text-muted-foreground">
            Monthly review · {year}
          </p>
          <h1 className="mt-2 text-5xl md:text-6xl font-heading font-normal leading-[0.95]">
            {monthName},{' '}
            <em className="italic text-gold">reviewed</em>
          </h1>
          {review && (
            <p className="mt-4 text-2xs font-mono text-muted-foreground/70">
              Written {format(new Date(review.generated_at), 'd MMM, h:mm a')}
            </p>
          )}
        </header>

        {isLoading ? (
          <div className="mt-8 space-y-3">
            <Skeleton className="h-5 w-full bg-muted/20" />
            <Skeleton className="h-5 w-11/12 bg-muted/20" />
            <Skeleton className="h-5 w-4/5 bg-muted/20" />
          </div>
        ) : !review ? (
          <p className="mt-8 text-sm text-muted-foreground">
            No review for {monthName} yet. It is written by the nightly run.
          </p>
        ) : (
          <>
            {/* Deck: the month in one breath, at reading size */}
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-8 text-lg leading-relaxed text-foreground"
            >
              {review.summary}
            </motion.p>

            {review.highlights.length > 0 && (
              <section className="mt-10">
                <h2 className="text-2xs font-mono uppercase tracking-widest text-muted-foreground pb-3 border-b border-border/60">
                  What stood out
                </h2>
                <ol className="mt-1">
                  {review.highlights.map((h, i) => (
                    <li
                      key={i}
                      className="flex gap-4 py-3.5 border-b border-border/40 last:border-b-0"
                    >
                      <span className="font-heading italic text-gold/80 text-sm w-5 shrink-0 pt-0.5">
                        {i + 1}
                      </span>
                      <p className="text-sm leading-relaxed text-foreground/90">{h}</p>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {slices.length > 0 && (
              <section className="mt-12">
                <h2 className="text-2xs font-mono uppercase tracking-widest text-muted-foreground pb-3 border-b border-border/60">
                  Where it went
                </h2>

                <div className="mt-6 flex flex-col sm:flex-row gap-8 items-center">
                  <div className="relative w-44 h-44 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={segments}
                          dataKey="amount"
                          nameKey="label"
                          innerRadius="64%"
                          outerRadius="100%"
                          startAngle={90}
                          endAngle={-270}
                          stroke="hsl(var(--background))"
                          strokeWidth={2}
                          isAnimationActive={false}
                        >
                          {segments.map((s) => (
                            <Cell key={s.label} fill={s.fill} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-lg font-bold currency-display">
                        {formatINRCompact(totalSpent)}
                      </span>
                      <span className="text-2xs font-mono uppercase tracking-wider text-muted-foreground">
                        spent
                      </span>
                    </div>
                  </div>

                  <ul className="flex-1 w-full min-w-0">
                    {slices.map((s) => (
                      <li
                        key={s.label}
                        className="flex items-center gap-2.5 py-1.5 text-xs border-b border-border/30 last:border-b-0"
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: sliceColor.get(s.label) ?? LONG_TAIL_COLOR }}
                        />
                        <span className="text-foreground/90 truncate">
                          {s.label}
                          <span className="text-muted-foreground/60 ml-1.5">×{s.count}</span>
                        </span>
                        <span className="ml-auto shrink-0 amount text-foreground">
                          {formatINR(s.amount)}
                        </span>
                        <span className="w-9 text-right shrink-0 amount text-muted-foreground/60">
                          {pct(s.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            )}

            {review.category_breakdowns.length > 0 && (
              <section className="mt-12">
                <h2 className="text-2xs font-mono uppercase tracking-widest text-muted-foreground pb-3 border-b border-border/60">
                  Bucket by bucket
                </h2>

                {[...review.category_breakdowns]
                  .sort((a, b) => b.total - a.total)
                  .map((b) => (
                    <div key={b.name} className="py-5 border-b border-border/40 last:border-b-0">
                      <div className="flex items-baseline justify-between gap-4">
                        <h3 className="font-heading text-xl font-normal text-foreground">{b.name}</h3>
                        <span className="amount text-sm text-foreground shrink-0">
                          {formatINR(b.total)}
                        </span>
                      </div>

                      {b.one_liner && (
                        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                          {b.one_liner}
                        </p>
                      )}

                      {b.groups.length > 0 && (
                        <ul className="mt-3">
                          {b.groups.map((g) => (
                            <li
                              key={g.label}
                              className="flex items-center gap-3 py-1 text-2xs text-muted-foreground/80"
                            >
                              <span className="truncate">
                                {g.label}
                                <span className="opacity-50 ml-1.5">×{g.count}</span>
                              </span>
                              <span className="ml-auto shrink-0 amount">{formatINR(g.amount)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
              </section>
            )}

            <Link
              to="/insights"
              className={cn(
                'mt-12 inline-flex items-center gap-1.5 text-xs font-mono text-primary',
                'hover:underline underline-offset-4',
              )}
            >
              BACK TO INSIGHTS <ChevronRight className="w-3 h-3" />
            </Link>
          </>
        )}
      </article>
    </AppLayout>
  );
}
