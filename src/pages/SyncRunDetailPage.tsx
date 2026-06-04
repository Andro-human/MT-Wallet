import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, CheckCircle2, AlertCircle, XCircle, Inbox,
  Clock, MessageSquare, ArrowDownCircle, SkipForward,
  AlertTriangle, ChevronDown, ChevronUp, Plus, Trash2, Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { useSyncRun, type SyncRunMessage, type SyncRunDetail } from '@/hooks/useSyncRuns';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatINR } from '@/lib/formatCurrency';
import { AddTransactionDialog } from '@/components/transactions/AddTransactionDialog';
import { useMarkAsNotTransaction } from '@/hooks/useReclassify';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';

const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
  success: { color: 'text-green-400', bg: 'bg-green-400/10', label: 'Success' },
  partial: { color: 'text-yellow-400', bg: 'bg-yellow-400/10', label: 'Partial' },
  failed: { color: 'text-red-400', bg: 'bg-red-400/10', label: 'Failed' },
  no_messages: { color: 'text-muted-foreground', bg: 'bg-muted/30', label: 'No Messages' },
};

const detailStatusConfig: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
  inserted: { icon: ArrowDownCircle, color: 'text-green-400', label: 'Inserted' },
  skipped: { icon: SkipForward, color: 'text-muted-foreground', label: 'Skipped' },
  error: { icon: XCircle, color: 'text-red-400', label: 'Error' },
};

const sourceLabels: Record<string, string> = {
  email: 'Email (Gmail)',
  ios_shortcut: 'SMS Sync',
  manual: 'Manual',
  axio: 'Axio',
};

function formatSource(source: string): string {
  return sourceLabels[source] ?? source;
}

type TabType = 'overview' | 'messages';

function MessageCard({
  message,
  detail,
  runId,
}: {
  message?: SyncRunMessage;
  detail?: SyncRunDetail;
  runId: string | undefined;
}) {
  const [expanded, setExpanded] = useState(false);
  const [reclassifyOpen, setReclassifyOpen] = useState(false);
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);
  const { toast } = useToast();
  const markNotTxn = useMarkAsNotTransaction(runId);

  const detailConfig = detail ? detailStatusConfig[detail.status] : null;
  const DetailIcon = detailConfig?.icon || MessageSquare;

  // Reclassify is only meaningful when we have both a runId and the message body
  // (we need the body for AI extract on the backend, which reads it from the run).
  const canReclassifyAsTransaction =
    !!runId && !!message?.id && detail?.status !== 'inserted';
  const canRemoveTransaction =
    !!runId && !!message?.id && detail?.status === 'inserted';

  const handleRemove = async () => {
    if (!message) return;
    try {
      await markNotTxn.mutateAsync(message.id);
      toast({ title: 'Marked as not a transaction', description: 'Transaction removed.' });
    } catch (err: any) {
      toast({
        title: 'Failed',
        description: err?.message ?? 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setConfirmRemoveOpen(false);
    }
  };

  return (
    <div className="glass-card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 text-left flex items-start gap-3"
      >
        {/* Status icon */}
        <div className={cn("mt-0.5 shrink-0", detailConfig?.color || 'text-muted-foreground')}>
          <DetailIcon className="w-5 h-5" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {message && (
                <span className="text-xs font-mono text-muted-foreground shrink-0">
                  #{message.id}
                </span>
              )}
              {message?.sender && (
                <span className="text-[15px] font-semibold text-foreground truncate">
                  {message.sender}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {detail?.status && (
                <span className={cn(
                  "text-xs font-medium px-2 py-0.5 rounded-full",
                  detail.status === 'inserted' && 'bg-green-400/10 text-green-400',
                  detail.status === 'skipped' && 'bg-muted/50 text-muted-foreground',
                  detail.status === 'error' && 'bg-red-400/10 text-red-400',
                )}>
                  {detailConfig?.label}
                </span>
              )}
              {expanded ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
          </div>

          {/* Transaction summary (if inserted) */}
          {detail?.transaction && (
            <div className="flex items-center gap-2.5 mt-1.5">
              <span className={cn(
                "text-base font-bold",
                detail.transaction.direction === 'debit' ? 'text-red-400' : 'text-green-400'
              )}>
                {detail.transaction.direction === 'debit' ? '−' : '+'}{formatINR(detail.transaction.amount)}
              </span>
              {detail.transaction.merchant && (
                <span className="text-sm text-muted-foreground truncate">
                  {detail.transaction.merchant}
                </span>
              )}
              {detail.transaction.category && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  {detail.transaction.category}
                </span>
              )}
            </div>
          )}

          {/* Skip reason */}
          {detail?.reason && !detail.transaction && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
              {detail.reason}
            </p>
          )}

          {detail?.ai_model && (
            <p className="text-xs text-muted-foreground mt-1">
              AI: <span className="font-mono">{detail.ai_model}</span>
            </p>
          )}

          {/* Email subject (when present — this is what the classifier saw) */}
          {message?.subject && (
            <p className="text-sm text-foreground/90 mt-1 line-clamp-1">
              <span className="text-muted-foreground">Subject: </span>
              {message.subject}
            </p>
          )}

          {/* Message preview (collapsed) */}
          {!expanded && message?.body && (
            <p className="text-sm text-muted-foreground/70 mt-1 line-clamp-1">
              {message.body}
            </p>
          )}
        </div>
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-border/30 pt-3">
              {/* Email subject (what the classifier saw on Pass 1 for emails) */}
              {message?.subject && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                    Subject
                  </p>
                  <p className="text-sm text-foreground/80 bg-muted/20 rounded-lg p-3 font-mono leading-relaxed whitespace-pre-wrap break-words">
                    {message.subject}
                  </p>
                </div>
              )}

              {/* Full message body */}
              {message?.body && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                    {message.subject ? 'Body' : 'Raw SMS'}
                  </p>
                  <p className="text-sm text-foreground/80 bg-muted/20 rounded-lg p-3 font-mono leading-relaxed whitespace-pre-wrap break-all">
                    {message.body}
                  </p>
                </div>
              )}

              {/* Timestamp */}
              {message?.timestamp && (
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {format(new Date(message.timestamp), 'PPP p')}
                  </span>
                </div>
              )}

              {/* Detail reason */}
              {detail?.reason && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                    Reason
                  </p>
                  <p className="text-sm text-foreground/80">{detail.reason}</p>
                </div>
              )}

              {/* Transaction details */}
              {detail?.transaction && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                    Parsed Transaction
                  </p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                    <span className="text-muted-foreground">Amount</span>
                    <span className="text-foreground font-medium">{formatINR(detail.transaction.amount)}</span>
                    <span className="text-muted-foreground">Direction</span>
                    <span className={cn("font-medium", detail.transaction.direction === 'debit' ? 'text-red-400' : 'text-green-400')}>
                      {detail.transaction.direction}
                    </span>
                    {detail.transaction.merchant && (
                      <>
                        <span className="text-muted-foreground">Merchant</span>
                        <span className="text-foreground font-medium">{detail.transaction.merchant}</span>
                      </>
                    )}
                    {detail.transaction.category && (
                      <>
                        <span className="text-muted-foreground">Category</span>
                        <span className="text-foreground font-medium">{detail.transaction.category}</span>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Reclassify actions — one button per row, flipped by current status. */}
              {(canReclassifyAsTransaction || canRemoveTransaction) && (
                <div className="pt-1">
                  {canReclassifyAsTransaction && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setReclassifyOpen(true); }}
                      className="w-full flex items-center justify-center gap-2 text-sm font-medium py-2.5 px-3 rounded-lg bg-primary/10 text-primary hover:bg-primary/15 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Add as transaction
                    </button>
                  )}
                  {canRemoveTransaction && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmRemoveOpen(true); }}
                      disabled={markNotTxn.isPending}
                      className="w-full flex items-center justify-center gap-2 text-sm font-medium py-2.5 px-3 rounded-lg bg-red-400/10 text-red-400 hover:bg-red-400/15 transition-colors disabled:opacity-50"
                    >
                      {markNotTxn.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                      Not a transaction
                    </button>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {message && runId && (
        <AddTransactionDialog
          open={reclassifyOpen}
          onOpenChange={setReclassifyOpen}
          smsContext={{
            runId,
            smsId: message.id,
            sender: message.sender,
            body: message.body,
            timestamp: message.timestamp,
          }}
        />
      )}

      <AlertDialog open={confirmRemoveOpen} onOpenChange={setConfirmRemoveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark as not a transaction?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes the transaction created from this SMS.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={markNotTxn.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleRemove(); }}
              disabled={markNotTxn.isPending}
              className="bg-red-500 hover:bg-red-600"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function SyncRunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: run, isLoading } = useSyncRun(id);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  if (isLoading) {
    return (
      <AppLayout>
        <div className="px-5 pt-8 pb-4 safe-area-top space-y-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      </AppLayout>
    );
  }

  if (!run) {
    return (
      <AppLayout>
        <div className="px-5 pt-8 pb-4 safe-area-top text-center py-20">
          <AlertCircle className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">Sync run not found</p>
        </div>
      </AppLayout>
    );
  }

  const config = statusConfig[run.status] || statusConfig.failed;
  const startedAt = new Date(run.started_at);

  // Build merged message+detail list
  const messages = run.messages || [];
  const details = run.details || [];
  const detailMap = new Map(details.map(d => [d.sms_id, d]));
  const aiModelsUsed = Array.from(
    new Set(details.map((d) => d.ai_model).filter((m): m is string => !!m))
  );

  const mergedItems = messages.map(msg => ({
    message: msg,
    detail: detailMap.get(msg.id),
  }));

  // Also include details that don't have a matching message (shouldn't happen, but just in case)
  const messageIds = new Set(messages.map(m => m.id));
  const orphanDetails = details.filter(d => !messageIds.has(d.sms_id));

  const filteredItems = filterStatus === 'all'
    ? mergedItems
    : mergedItems.filter(item => item.detail?.status === filterStatus);

  const insertedCount = details.filter(d => d.status === 'inserted').length;
  const skippedCount = details.filter(d => d.status === 'skipped').length;
  const errorCount = details.filter(d => d.status === 'error').length;

  const tabs: { key: TabType; label: string; count?: number }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'messages', label: 'Messages', count: messages.length },
  ];

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
          <div className="flex-1">
            <h1 className="text-xl font-bold">Sync Run</h1>
            <p className="text-sm text-muted-foreground">
              {format(startedAt, 'MMM d, yyyy · h:mm a')}
            </p>
          </div>
          <span className={cn(
            "text-sm font-medium px-3 py-1 rounded-full",
            config.bg, config.color
          )}>
            {config.label}
          </span>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 bg-card/40 rounded-xl p-1">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex-1 text-sm font-medium py-2.5 px-3 rounded-lg transition-colors",
                activeTab === tab.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
              {tab.count != null && (
                <span className="ml-1 opacity-70">({tab.count})</span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="space-y-3 pb-24">
          {activeTab === 'overview' && (
            <>
              {/* Stats grid */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-2 gap-3"
              >
                <div className="glass-card p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <MessageSquare className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Messages</span>
                  </div>
                  <p className="text-2xl font-bold">{run.total_messages}</p>
                </div>
                <div className="glass-card p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <ArrowDownCircle className="w-4 h-4 text-green-400" />
                    <span className="text-sm text-muted-foreground">Inserted</span>
                  </div>
                  <p className="text-2xl font-bold text-green-400">{run.inserted}</p>
                </div>
                <div className="glass-card p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <SkipForward className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Skipped</span>
                  </div>
                  <p className="text-2xl font-bold">{run.skipped}</p>
                </div>
                <div className="glass-card p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertCircle className="w-4 h-4 text-red-400" />
                    <span className="text-sm text-muted-foreground">Errors</span>
                  </div>
                  <p className="text-2xl font-bold text-red-400">{run.errors}</p>
                </div>
              </motion.div>

              {/* Metadata */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="glass-card p-4 space-y-3.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Duration</span>
                  <span className="text-[15px] font-medium text-foreground">
                    {run.duration_ms != null
                      ? run.duration_ms < 1000
                        ? `${run.duration_ms}ms`
                        : `${(run.duration_ms / 1000).toFixed(1)}s`
                      : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Source</span>
                  <span className="text-[15px] font-medium text-foreground">{formatSource(run.source)}</span>
                </div>
                {aiModelsUsed.length > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">AI Model</span>
                    <span className="text-[15px] font-medium text-foreground text-right">
                      {aiModelsUsed.join(', ')}
                    </span>
                  </div>
                )}
                {run.usage && Object.keys(run.usage).length > 0 && (() => {
                  const entries = Object.entries(run.usage);
                  const totalIn = entries.reduce((s, [, v]) => s + (v?.input ?? 0), 0);
                  const totalOut = entries.reduce((s, [, v]) => s + (v?.output ?? 0), 0);
                  return (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Tokens</span>
                        <span className="text-[15px] font-medium text-foreground">
                          {(totalIn + totalOut).toLocaleString()}
                          <span className="text-muted-foreground"> ({totalIn.toLocaleString()} in / {totalOut.toLocaleString()} out)</span>
                        </span>
                      </div>
                      {entries.map(([model, v]) => (
                        <div key={model} className="flex items-center justify-between pl-3">
                          <span className="text-xs text-muted-foreground font-mono">{model}</span>
                          <span className="text-xs text-muted-foreground font-mono">
                            {(v?.input ?? 0).toLocaleString()} / {(v?.output ?? 0).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
                {run.rowid_range && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">ROWID Range</span>
                    <span className="text-[15px] font-medium text-foreground font-mono">
                      {(run.rowid_range as any).from} → {(run.rowid_range as any).to}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Started</span>
                  <span className="text-[15px] font-medium text-foreground">
                    {format(startedAt, 'PPP p')}
                  </span>
                </div>
                {run.completed_at && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Completed</span>
                    <span className="text-[15px] font-medium text-foreground">
                      {format(new Date(run.completed_at), 'PPP p')}
                    </span>
                  </div>
                )}
              </motion.div>

              {/* Error message */}
              {run.error_message && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="glass-card p-4 border-red-400/20"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <XCircle className="w-5 h-5 text-red-400" />
                    <span className="text-sm font-semibold text-red-400">Error</span>
                  </div>
                  <p className="text-sm text-red-400/80 font-mono leading-relaxed">{run.error_message}</p>
                </motion.div>
              )}
            </>
          )}

          {activeTab === 'messages' && (
            <>
              {/* Filter chips */}
              <div className="flex gap-2 flex-wrap">
                {[
                  { key: 'all', label: 'All', count: messages.length },
                  { key: 'inserted', label: 'Inserted', count: insertedCount },
                  { key: 'skipped', label: 'Skipped', count: skippedCount },
                  { key: 'error', label: 'Errors', count: errorCount },
                ].map(chip => (
                  <button
                    key={chip.key}
                    onClick={() => setFilterStatus(chip.key)}
                    className={cn(
                      "text-sm px-3.5 py-1.5 rounded-full transition-colors",
                      filterStatus === chip.key
                        ? "bg-primary text-primary-foreground"
                        : "bg-card/60 text-muted-foreground"
                    )}
                  >
                    {chip.label} ({chip.count})
                  </button>
                ))}
              </div>

              {filteredItems.length === 0 && orphanDetails.length === 0 ? (
                <div className="text-center py-12">
                  <Inbox className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground">No messages to show</p>
                </div>
              ) : (
                <>
                  {filteredItems.map((item, i) => (
                    <motion.div
                      key={item.message.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02 }}
                    >
                      <MessageCard
                        message={item.message}
                        detail={item.detail}
                        runId={run.id}
                      />
                    </motion.div>
                  ))}
                  {orphanDetails.map((detail, i) => (
                    <motion.div
                      key={`orphan-${detail.sms_id}`}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: (filteredItems.length + i) * 0.02 }}
                    >
                      <MessageCard detail={detail} runId={run.id} />
                    </motion.div>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
