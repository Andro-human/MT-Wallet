import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { Sparkles, RefreshCw, ChevronDown } from 'lucide-react';
import {
  useMonthlySummary,
  useGenerateMonthlySummary,
  type MonthlyAggregates,
  type MonthlyCategoryInput,
} from '@/hooks/useMonthlySummary';
import { formatINRCompact } from '@/lib/formatCurrency';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export function MonthlySummaryCard({
  month,
  buildPayload,
}: {
  month: string | null;
  buildPayload: () => { aggregates: MonthlyAggregates; categories: MonthlyCategoryInput[] };
}) {
  const { toast } = useToast();
  const { data: cached, isLoading } = useMonthlySummary(month);
  const generate = useGenerateMonthlySummary();
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!month || isLoading) return null;

  const run = async () => {
    try {
      await generate.mutateAsync(buildPayload());
    } catch (e) {
      toast({ title: 'Summary failed', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const breakdowns = (cached?.category_breakdowns ?? [])
    .filter((b) => b.total > 0)
    .sort((a, b) => b.total - a.total);

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
        <button
          onClick={run}
          disabled={generate.isPending}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-none border border-border text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn('w-3 h-3', generate.isPending && 'animate-spin')} />
          {cached ? 'Refresh' : 'Generate'}
        </button>
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

          {breakdowns.length > 0 && (
            <div className="mt-5 pt-4 border-t border-border/50">
              <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-3">
                Where it went
              </p>
              <div className="space-y-1">
                {breakdowns.map((b) => {
                  const isOpen = expanded === b.category;
                  const canExpand = b.reconciled && b.groups.length > 0;
                  return (
                    <div key={b.category} className="border-b border-border/20 last:border-b-0">
                      <button
                        onClick={() => canExpand && setExpanded(isOpen ? null : b.category)}
                        className={cn(
                          'w-full flex items-center justify-between gap-3 py-2 text-left',
                          canExpand && 'group cursor-pointer',
                        )}
                      >
                        <span className="flex items-center gap-1.5 text-sm font-medium text-foreground uppercase tracking-wide">
                          {b.name}
                          {canExpand && (
                            <ChevronDown
                              className={cn(
                                'w-3.5 h-3.5 text-muted-foreground transition-transform',
                                isOpen && 'rotate-180',
                              )}
                            />
                          )}
                        </span>
                        <span className="font-mono text-sm text-foreground shrink-0">{formatINRCompact(b.total)}</span>
                      </button>
                      <AnimatePresence>
                        {isOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="pb-3 pl-1 pr-1">
                              {b.one_liner && (
                                <p className="text-xs text-muted-foreground/90 italic mb-2">{b.one_liner}</p>
                              )}
                              <div className="space-y-1">
                                {b.groups.map((g, i) => (
                                  <div key={i} className="flex items-center justify-between gap-3 text-xs">
                                    <span className="text-muted-foreground">
                                      {g.label}
                                      <span className="opacity-50 ml-1.5">×{g.count}</span>
                                    </span>
                                    <span className="font-mono text-muted-foreground shrink-0">{formatINRCompact(g.amount)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <p className="text-[10px] text-muted-foreground/50 mt-4 font-mono">
            generated {format(new Date(cached.generated_at), 'MMM d, h:mm a')}
          </p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          {generate.isPending
            ? 'Writing your month...'
            : 'A dense AI recap of where the money went, grouped by what it was for.'}
        </p>
      )}
    </motion.div>
  );
}
