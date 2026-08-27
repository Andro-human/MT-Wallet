import { Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Inbox } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { useSyncRuns, type SyncRun } from '@/hooks/useSyncRuns';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { syncRunFlag } from '@/lib/syncRunFlag';

function formatDuration(ms: number) {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function SyncRunRow({ run, onClick }: { run: SyncRun; onClick: () => void }) {
  const flag = syncRunFlag(run.status);
  const startedAt = new Date(run.started_at);

  const facts: string[] = [`${run.total_messages} msg${run.total_messages === 1 ? '' : 's'}`];
  if (run.inserted > 0) facts.push(`${run.inserted} inserted`);
  if (run.skipped > 0) facts.push(`${run.skipped} skipped`);

  return (
    <button
      onClick={onClick}
      className="group w-full text-left flex flex-wrap sm:flex-nowrap items-baseline gap-x-3 border-b border-border/40 last:border-b-0 py-2.5"
    >
      <span className="flex items-baseline gap-2 flex-1 sm:flex-none sm:basis-[30%] min-w-0 order-1">
        {flag && (
          <span className={cn('text-2xs font-mono uppercase tracking-wider shrink-0', flag.color)}>
            {flag.label}
          </span>
        )}
        <span className="amount text-xs text-foreground truncate group-hover:text-primary transition-colors">
          {format(startedAt, 'MMM d, h:mm a')}
        </span>
      </span>

      <span className="text-2xs text-muted-foreground truncate basis-full sm:basis-auto sm:flex-1 order-3 sm:order-2">
        {facts.join('  \u00B7  ')}
        {run.errors > 0 && (
          <span className="text-primary">{`  \u00B7  ${run.errors} error${run.errors === 1 ? '' : 's'}`}</span>
        )}
        {run.error_message && (
          <span className="text-muted-foreground">{`  \u00B7  ${run.error_message}`}</span>
        )}
      </span>

      <span className="amount text-2xs text-muted-foreground shrink-0 w-12 text-right order-2 sm:order-3">
        {run.duration_ms != null ? formatDuration(run.duration_ms) : ''}
      </span>
      <span className="text-2xs text-muted-foreground shrink-0 w-24 text-right hidden sm:block order-4">
        {formatDistanceToNow(startedAt, { addSuffix: true })}
      </span>
    </button>
  );
}

export default function SyncHistoryPage() {
  const navigate = useNavigate();
  const { 
    data, 
    isLoading, 
    hasNextPage, 
    fetchNextPage, 
    isFetchingNextPage 
  } = useSyncRuns();

  const allRuns = data?.pages.flatMap(p => p.runs) || [];

  // Per-day averages over the loaded window, broken down by metric (messages
  // encountered, inserted, not-inserted) and by channel (total, email, SMS).
  // As the user scrolls back and loads older pages, the window expands and
  // the averages stabilise.
  const dailyStats = (() => {
    if (allRuns.length === 0) return null;
    const earliestMs = Math.min(...allRuns.map(r => new Date(r.started_at).getTime()));
    const days = Math.max(1, Math.ceil((Date.now() - earliestMs) / (24 * 60 * 60 * 1000)));

    const aggregate = (rows: SyncRun[]) => {
      const encountered = rows.reduce((s, r) => s + r.total_messages, 0);
      const inserted = rows.reduce((s, r) => s + r.inserted, 0);
      return {
        encountered: encountered / days,
        inserted: inserted / days,
        notInserted: (encountered - inserted) / days,
      };
    };

    const emailRuns = allRuns.filter(r => r.source === 'email');
    const smsRuns = allRuns.filter(r => r.source === 'ios_shortcut');

    return {
      days,
      total: aggregate([...emailRuns, ...smsRuns]),
      email: aggregate(emailRuns),
      sms: aggregate(smsRuns),
    };
  })();

  const formatAvg = (n: number) => (n >= 10 ? n.toFixed(0) : n.toFixed(1));

  return (
    <AppLayout>
      {/* Sticky page header — matches Bank Accounts / Categories pattern */}
      <div className="sticky top-0 z-10 backdrop-blur-xl bg-background/80 border-b border-border/30 safe-area-top">
        <div className="flex items-center gap-3 px-5 py-3">
          <button
            onClick={() => navigate(-1)}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted/50 transition-colors -ml-1"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-lg font-semibold text-foreground flex-1">Sync History</h1>
        </div>
      </div>

      <div className="px-5 py-6 pb-4 page-shell">
        {/* Per-day averages — compact 3×3 grid */}
        {!isLoading && dailyStats && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.4 }}
            className="mb-6"
          >
            <div className="glass-card p-3 max-w-sm">
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-5 gap-y-1.5 text-sm items-center">
                <div />
                <div className="text-right text-[10px] text-muted-foreground uppercase tracking-wider">Total</div>
                <div className="text-right text-[10px] text-muted-foreground uppercase tracking-wider">Email</div>
                <div className="text-right text-[10px] text-muted-foreground uppercase tracking-wider">SMS</div>

                {([
                  { key: 'encountered', label: 'Encountered', color: 'text-foreground' },
                  { key: 'inserted', label: 'Inserted', color: 'text-foreground' },
                  { key: 'notInserted', label: 'Not inserted', color: 'text-muted-foreground' },
                ] as const).map(({ key, label, color }) => (
                  <Fragment key={key}>
                    <div className="text-muted-foreground">{label}</div>
                    <div className={cn("text-right font-semibold tabular-nums", color)}>
                      {formatAvg(dailyStats.total[key])}
                    </div>
                    <div className="text-right font-mono text-xs text-foreground/80 tabular-nums">
                      {formatAvg(dailyStats.email[key])}
                    </div>
                    <div className="text-right font-mono text-xs text-foreground/80 tabular-nums">
                      {formatAvg(dailyStats.sms[key])}
                    </div>
                  </Fragment>
                ))}
              </div>
            </div>
            <p className="text-2xs text-muted-foreground mt-1.5">
              avg / day over last {dailyStats.days} day{dailyStats.days === 1 ? '' : 's'}
            </p>
          </motion.div>
        )}

        {/* Run list */}
        <div className="pb-24">
          {isLoading ? (
            Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-9 rounded mb-1" />
            ))
          ) : allRuns.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16"
            >
              <Inbox className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">No sync runs yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Runs will appear here after the SMS sync processes messages
              </p>
            </motion.div>
          ) : (
            <>
              {allRuns.map((run) => (
                <SyncRunRow
                  key={run.id}
                  run={run}
                  onClick={() => navigate(`/sync/${run.id}`)}
                />
              ))}

              {hasNextPage && (
                <div className="pt-4 pb-8 flex justify-center">
                  <button
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                    className="px-6 py-2.5 rounded-full bg-muted/30 hover:bg-muted/50 text-foreground text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {isFetchingNextPage ? 'Loading...' : 'Load older runs'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
