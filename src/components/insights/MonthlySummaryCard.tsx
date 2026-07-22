import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { Sparkles, RefreshCw } from 'lucide-react';
import {
  useMonthlySummary,
  useGenerateMonthlySummary,
  type MonthlyAggregates,
  type MonthlyCategoryInput,
} from '@/hooks/useMonthlySummary';
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

  if (!month || isLoading) return null;

  const run = async () => {
    try {
      await generate.mutateAsync(buildPayload());
    } catch (e) {
      toast({ title: 'Summary failed', description: (e as Error).message, variant: 'destructive' });
    }
  };

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
