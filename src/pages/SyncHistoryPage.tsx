import { Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle2, AlertCircle, XCircle, Inbox, Clock, MessageSquare, ArrowDownCircle, SkipForward, AlertTriangle } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { useSyncRuns, type SyncRun } from '@/hooks/useSyncRuns';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const statusConfig: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
  success: { icon: CheckCircle2, color: 'text-green-400', label: 'Success' },
  partial: { icon: AlertTriangle, color: 'text-yellow-400', label: 'Partial' },
  failed: { icon: XCircle, color: 'text-red-400', label: 'Failed' },
  no_messages: { icon: Inbox, color: 'text-muted-foreground', label: 'No Messages' },
};

function SyncRunCard({ run, onClick }: { run: SyncRun; onClick: () => void }) {
  const config = statusConfig[run.status] || statusConfig.failed;
  const StatusIcon = config.icon;
  const startedAt = new Date(run.started_at);

  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className="w-full glass-card p-4 text-left active:scale-[0.98] transition-transform"
    >
      <div className="flex items-start gap-3">
        {/* Status icon */}
        <div className={cn("mt-0.5", config.color)}>
          <StatusIcon className="w-5 h-5" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Top row: date + time ago */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[15px] font-semibold text-foreground">
              {format(startedAt, 'MMM d, yyyy · h:mm a')}
            </span>
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {formatDistanceToNow(startedAt, { addSuffix: true })}
            </span>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-3 mt-1.5">
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <MessageSquare className="w-3.5 h-3.5" />
              {run.total_messages} msgs
            </span>
            {run.inserted > 0 && (
              <span className="flex items-center gap-1.5 text-sm text-green-400">
                <ArrowDownCircle className="w-3.5 h-3.5" />
                {run.inserted} inserted
              </span>
            )}
            {run.skipped > 0 && (
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <SkipForward className="w-3.5 h-3.5" />
                {run.skipped} skipped
              </span>
            )}
            {run.errors > 0 && (
              <span className="flex items-center gap-1.5 text-sm text-red-400">
                <AlertCircle className="w-3.5 h-3.5" />
                {run.errors} errors
              </span>
            )}
          </div>

          {/* Duration */}
          {run.duration_ms != null && (
            <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              {run.duration_ms < 1000
                ? `${run.duration_ms}ms`
                : `${(run.duration_ms / 1000).toFixed(1)}s`}
            </div>
          )}

          {/* Error message preview */}
          {run.error_message && (
            <p className="mt-1.5 text-sm text-red-400/80 line-clamp-1">
              {run.error_message}
            </p>
          )}
        </div>
      </div>
    </motion.button>
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

      <div className="px-5 py-6 pb-4">
        {/* Per-day averages — compact 3×3 grid */}
        {!isLoading && dailyStats && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.4 }}
            className="mb-6"
          >
            <div className="glass-card p-3">
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 gap-y-1.5 text-sm items-center">
                <div />
                <div className="text-right text-[10px] text-muted-foreground uppercase tracking-wider">Total</div>
                <div className="text-right text-[10px] text-muted-foreground uppercase tracking-wider">Email</div>
                <div className="text-right text-[10px] text-muted-foreground uppercase tracking-wider">SMS</div>

                {([
                  { key: 'encountered', label: 'Encountered', color: 'text-foreground' },
                  { key: 'inserted', label: 'Inserted', color: 'text-green-400' },
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
            <p className="text-[11px] text-muted-foreground/60 text-center mt-1.5">
              avg / day over last {dailyStats.days} day{dailyStats.days === 1 ? '' : 's'}
            </p>
          </motion.div>
        )}

        {/* Run list */}
        <div className="space-y-3 pb-24">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))
          ) : allRuns.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16"
            >
              <Inbox className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">No sync runs yet</p>
              <p className="text-sm text-muted-foreground/60 mt-1">
                Runs will appear here after the SMS sync processes messages
              </p>
            </motion.div>
          ) : (
            <>
              {allRuns.map((run, i) => (
                <motion.div
                  key={run.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i, 20) * 0.03, duration: 0.3 }}
                >
                  <SyncRunCard
                    run={run}
                    onClick={() => navigate(`/sync/${run.id}`)}
                  />
                </motion.div>
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
