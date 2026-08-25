import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { Sparkles } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { useMonthlySummary, type SpendSlice } from '@/hooks/useMonthlySummary';
import { formatINR, formatINRCompact } from '@/lib/formatCurrency';
import { PALETTE, LONG_TAIL_COLOR, FOLD_LABEL } from '@/lib/categoryColors';
import { cn } from '@/lib/utils';

// Gray is the de-emphasis fill for the folded tail segment,
// not a sixth identity.
const SLICE_COLORS = PALETTE;
const OTHER_COLOR = LONG_TAIL_COLOR;
// A donut reads part-to-whole at a glance only up to ~6 segments; the tail
// folds into one aggregated slice while the list beside it still shows every one.
const MAX_SEGMENTS = 6;

function SpendDonut({ slices }: { slices: SpendSlice[] }) {
  const total = slices.reduce((s, x) => s + x.amount, 0);
  if (total <= 0) return null;

  const fold = slices.length > MAX_SEGMENTS;
  const shown = fold ? slices.slice(0, MAX_SEGMENTS - 1) : slices;
  const rest = fold ? slices.slice(MAX_SEGMENTS - 1) : [];
  const segments = [
    ...shown.map((s, i) => ({ ...s, fill: SLICE_COLORS[i % SLICE_COLORS.length] })),
    ...(rest.length > 0
      ? [
          {
            label: FOLD_LABEL,
            amount: rest.reduce((s, x) => s + x.amount, 0),
            count: rest.reduce((s, x) => s + x.count, 0),
            fill: OTHER_COLOR,
          },
        ]
      : []),
  ];

  const pct = (amount: number) => `${Math.round((amount / total) * 100)}%`;

  return (
    <div className="mt-5 pt-4 border-t border-border/50">
      <p className="text-2xs font-mono text-muted-foreground uppercase tracking-wider mb-3">
        Where it went
      </p>
      <div className="flex flex-col sm:flex-row items-center gap-5">
        <div className="relative w-44 h-44 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={segments}
                dataKey="amount"
                nameKey="label"
                innerRadius="62%"
                outerRadius="100%"
                startAngle={90}
                endAngle={-270}
                stroke="hsl(var(--card))"
                strokeWidth={2}
                isAnimationActive={false}
              >
                {segments.map((s) => (
                  <Cell key={s.label} fill={s.fill} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) =>
                  active && payload?.[0] ? (
                    <div className="bg-background border border-border px-3 py-2 shadow-2xl">
                      <p className="text-xs text-foreground font-medium">{payload[0].payload.label}</p>
                      <p className="text-xs font-mono text-muted-foreground mt-0.5">
                        {formatINR(payload[0].payload.amount)} · {pct(payload[0].payload.amount)} ·{' '}
                        {payload[0].payload.count}×
                      </p>
                    </div>
                  ) : null
                }
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-lg font-bold text-foreground currency-display">
              {formatINRCompact(total)}
            </span>
            <span className="text-2xs font-mono text-muted-foreground uppercase tracking-wider">
              spent
            </span>
          </div>
        </div>

        <ul className="flex-1 w-full space-y-1.5 min-w-0">
          {slices.map((s, i) => {
            const folded = fold && i >= MAX_SEGMENTS - 1;
            return (
              <li key={s.label} className="flex items-center gap-2 text-xs">
                <span
                  className={cn('w-2 h-2 shrink-0 rounded-full', folded && 'opacity-60')}
                  style={
                    folded
                      ? { border: `1.5px solid ${OTHER_COLOR}` }
                      : { backgroundColor: SLICE_COLORS[i % SLICE_COLORS.length] }
                  }
                />
                <span className="text-muted-foreground truncate">
                  {s.label}
                  <span className="opacity-50 ml-1.5">×{s.count}</span>
                </span>
                <span className="ml-auto shrink-0 font-mono text-foreground">
                  {formatINRCompact(s.amount)}
                </span>
                <span className="w-9 text-right shrink-0 font-mono text-muted-foreground/60">
                  {pct(s.amount)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

// Display-only: reviews are generated and stored by the nightly agent
// (Gemini Spark via the backend's reconcile guard), never from the client.
export function MonthlySummaryCard({ month }: { month: string | null }) {
  const { data: cached, isLoading } = useMonthlySummary(month);

  if (!month || isLoading) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="neo-card p-6 mb-6"
    >
      <div className="flex items-center justify-between mb-3 gap-3">
        <h3 className="font-heading font-bold text-foreground flex items-center gap-2">
          <Sparkles className="w-4 h-4" /> {format(new Date(`${month}-01`), 'MMMM yyyy')} in review
        </h3>
      </div>

      {cached ? (
        <>
          <p className="text-sm text-foreground leading-relaxed">{cached.summary}</p>
          {cached.highlights.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {cached.highlights.map((h, i) => (
                <li key={i} className="text-xs text-muted-foreground flex gap-2">
                  <span className="text-primary shrink-0">—</span>
                  {h}
                </li>
              ))}
            </ul>
          )}

          {cached.spend_slices.length > 0 && <SpendDonut slices={cached.spend_slices} />}

          <p className="text-[10px] text-muted-foreground/50 mt-4 font-mono">
            generated {format(new Date(cached.generated_at), 'MMM d, h:mm a')}
          </p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          No review for this month yet — it's written by the nightly AI run.
        </p>
      )}
    </motion.div>
  );
}
