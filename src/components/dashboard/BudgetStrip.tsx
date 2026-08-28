import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useBudgetStandings } from '@/hooks/useBudgetStandings';
import { formatINRCompact } from '@/lib/formatCurrency';
import { entityColor } from '@/lib/categoryColors';
import { cn } from '@/lib/utils';

/** Budgets at a glance on Home: one line each, heaviest pressure first.
 *
 *  Sorted by proportion of the allowance used rather than by size, so the
 *  buckets about to run out sit at the top where a glance lands. A budget that
 *  is over sorts above one that is merely large.
 */
export function BudgetStrip({ month }: { month?: string }) {
  const { standings, ceiling, isLoading } = useBudgetStandings(month);

  const rows = useMemo(
    () =>
      [...standings].sort((a, b) => {
        const pa = a.allowance > 0 ? a.spent / a.allowance : 0;
        const pb = b.allowance > 0 ? b.spent / b.allowance : 0;
        return pb - pa;
      }),
    [standings],
  );

  if (isLoading || rows.length === 0) return null;

  const spent = rows.reduce((s, x) => s + x.spent, 0);

  return (
    <div className="mb-6 md:mb-8">
      <div className="flex items-baseline justify-between mb-3 pb-2 border-b border-border/50">
        <h3 className="font-heading text-lg font-normal">Budgets</h3>
        <Link
          to="/settings/budgets"
          className="flex items-baseline gap-1.5 text-2xs font-mono uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors"
        >
          <span className="amount normal-case tracking-normal">
            {formatINRCompact(spent)} / {formatINRCompact(ceiling)}
          </span>
          <ChevronRight className="w-3 h-3 self-center" />
        </Link>
      </div>

      <div>
        {rows.map((s) => {
          const pct = s.allowance > 0 ? (s.spent / s.allowance) * 100 : 0;
          const over = s.remaining < 0;
          return (
            <Link
              key={s.budget.id}
              to="/settings/budgets"
              className="group flex items-center gap-3 py-1.5"
            >
              <span className="text-2xs text-foreground/90 truncate basis-[34%] sm:basis-[22%] shrink-0 group-hover:text-primary transition-colors">
                {s.budget.name}
              </span>

              <span className="flex-1 h-1 rounded-full bg-muted/30 overflow-hidden min-w-0">
                <span
                  className="block h-full rounded-full"
                  style={{
                    width: `${Math.min(pct, 100)}%`,
                    background: over ? 'hsl(var(--warning))' : entityColor(s.budget.id),
                  }}
                />
              </span>

              <span
                className={cn(
                  'amount text-2xs shrink-0 w-[5.5rem] text-right',
                  over ? 'text-warning' : 'text-muted-foreground',
                )}
              >
                {over
                  ? `${formatINRCompact(-s.remaining)} over`
                  : `${formatINRCompact(s.remaining)} left`}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
