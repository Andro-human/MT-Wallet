import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { Sparkles } from 'lucide-react';
import { useMonthlySummary } from '@/hooks/useMonthlySummary';
import { SpendTreemap } from './SpendTreemap';

// Display-only: reviews are written by the nightly Claude routine and stored
// behind the backend's reconcile guard, never generated from the client.
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
          {cached.highlights.length > 0 && (
            <ol className="mt-1">
              {cached.highlights.map((h, i) => (
                <li key={i} className="flex gap-3.5 py-2.5 border-b border-border/40 last:border-b-0">
                  <span className="font-heading italic text-gold text-sm w-4 shrink-0 pt-px">
                    {i + 1}
                  </span>
                  <p className="text-sm leading-relaxed text-foreground/90 prose-column">{h}</p>
                </li>
              ))}
            </ol>
          )}

          {cached.spend_slices.length > 0 && (
            <div className="mt-6 pt-5 border-t border-border/50">
              <p className="text-2xs font-mono text-muted-foreground uppercase tracking-wider mb-3">
                Where it went
              </p>
              {/* Area is the share and the name sits inside the box, so there
                  is no legend to correlate against. */}
              <SpendTreemap slices={cached.spend_slices} />
            </div>
          )}

          <p className="text-[10px] text-muted-foreground mt-4 font-mono">
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
