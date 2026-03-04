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

  const totalInserted = allRuns.reduce((sum, r) => sum + r.inserted, 0);
  const totalRuns = data?.pages?.[0]?.totalCount ?? allRuns.length;
  const successRuns = data?.pages?.[0]?.successCount ?? allRuns.filter(r => r.status === 'success').length;

  return (
    <AppLayout>
      <div className="px-5 pt-8 pb-4 safe-area-top">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center gap-3 mb-6"
        >
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-xl bg-card/60 flex items-center justify-center active:scale-95 transition-transform"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold">Sync History</h1>
            <p className="text-sm text-muted-foreground">SMS ingestion runs</p>
          </div>
        </motion.div>

        {/* Summary stats */}
        {!isLoading && allRuns.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.4 }}
            className="grid grid-cols-3 gap-3 mb-6"
          >
            <div className="glass-card p-4 text-center">
              <p className="text-xl font-bold text-foreground">{totalRuns}</p>
              <p className="text-sm text-muted-foreground">Total Runs</p>
            </div>
            <div className="glass-card p-4 text-center">
              <p className="text-xl font-bold text-green-400">{successRuns}</p>
              <p className="text-sm text-muted-foreground">Successful</p>
            </div>
            <div className="glass-card p-4 text-center">
              <p className="text-xl font-bold text-foreground">{totalInserted}</p>
              <p className="text-sm text-muted-foreground">Transactions</p>
            </div>
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
