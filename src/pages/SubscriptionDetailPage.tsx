import { useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowLeft, X, Pause, Play, Ban, Plus, Pencil, Check } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import {
  useSubscriptions,
  useSubscriptionTransactions,
  useUnlinkTransaction,
  useSetSubscriptionStatus,
  useUpdateSubscription,
  useSetLinkedAmount,
  type LinkedTxn,
} from '@/hooks/useSubscriptions';
import { AddTransactionDialog } from '@/components/subscriptions/AddTransactionDialog';
import { formatINR, formatINRCompact } from '@/lib/formatCurrency';
import { checkAttribution } from '@/lib/amountInput';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export default function SubscriptionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const updateSub = useUpdateSubscription();
  const [editOpen, setEditOpen] = useState(false);
  const [editLabel, setEditLabel] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editMerchant, setEditMerchant] = useState('');
  const { toast } = useToast();
  const { data: subs = [], isLoading } = useSubscriptions();
  const { data: linked = [], isLoading: txnsLoading } = useSubscriptionTransactions(id);
  const unlink = useUnlinkTransaction();
  const setStatus = useSetSubscriptionStatus();
  const setLinkedAmount = useSetLinkedAmount();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const [addOpen, setAddOpen] = useState(false);
  const sub = useMemo(() => subs.find((s) => s.id === id), [subs, id]);
  const variable = sub && sub.amount_min != null && sub.amount_max != null && sub.amount_min !== sub.amount_max;

  const editTarget = linked.find((l) => l.transaction_id === editingId);
  const editCheck = editTarget ? checkAttribution(draft, editTarget.txn_amount) : null;
  const editError = editCheck && !editCheck.ok ? editCheck.error : null;

  const doUnlink = async (transactionId: string) => {
    if (!id) return;
    try {
      await unlink.mutateAsync({ subscriptionId: id, transactionId });
    } catch {
      toast({ title: 'Failed to unlink', variant: 'destructive' });
    }
  };

  const saveAttribution = async (t: LinkedTxn) => {
    if (!id) return;
    const check = checkAttribution(draft, t.txn_amount);
    if (!check.ok) {
      toast({ title: check.error, variant: 'destructive' });
      return;
    }
    try {
      await setLinkedAmount.mutateAsync({
        subscriptionId: id,
        transactionId: t.transaction_id,
        amount: check.amount,
      });
      setEditingId(null);
      toast({
        title: check.isWholeTransaction
          ? 'Counting the whole transaction'
          : `Counting ${formatINR(check.amount)} of ${formatINR(t.txn_amount)}`,
      });
    } catch (e) {
      toast({ title: 'Could not save that', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const changeStatus = async (status: 'active' | 'paused' | 'cancelled') => {
    if (!id) return;
    try {
      await setStatus.mutateAsync({ id, status });
      toast({ title: status === 'active' ? 'Reactivated' : status === 'paused' ? 'Paused' : 'Cancelled' });
    } catch {
      toast({ title: 'Failed to update', variant: 'destructive' });
    }
  };

  if (!isLoading && !sub) {
    return (
      <AppLayout>
        <div className="px-4 pt-6 page-shell">
          <button onClick={() => navigate('/subscriptions')} className="text-sm text-muted-foreground">← Subscriptions</button>
          <p className="text-center py-16 text-muted-foreground">Subscription not found.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="sticky top-0 z-10 backdrop-blur-xl bg-background/95 border-b border-border/30 safe-area-top">
        <div className="flex items-center gap-3 px-4 py-3 page-shell">
          <button onClick={() => navigate('/subscriptions')} className="p-1.5 -ml-1.5 rounded-lg hover:bg-muted/30" aria-label="Back">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold truncate flex-1">{sub?.label ?? 'Subscription'}</h1>
          {sub && (
            <button
              onClick={() => {
                setEditLabel(sub.label);
                setEditNote(sub.match_note ?? '');
                setEditMerchant(sub.match_merchant ?? '');
                setEditOpen(true);
              }}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors shrink-0"
              aria-label="Edit subscription"
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="px-4 pb-24 page-shell">
        {isLoading || !sub ? (
          <div className="pt-6 space-y-4"><Skeleton className="h-28 w-full bg-muted/20" /></div>
        ) : (
          <>
            <div className="py-5 border-b border-border/50">
              <div className="flex items-center gap-2">
                {sub.cadence && (
                  <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-full border border-primary/40 text-primary">{sub.cadence}</span>
                )}
                <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-full border border-border text-muted-foreground">
                  {sub.status}
                </span>
              </div>
              <div className="font-mono text-3xl font-semibold mt-3">
                {formatINR(sub.median_amount ?? 0)}
                {variable && <span className="text-sm text-muted-foreground"> avg</span>}
              </div>
              <div className="text-sm text-muted-foreground mt-1.5">
                {variable && <>Ranges {formatINRCompact(sub.amount_min!)}–{formatINRCompact(sub.amount_max!)} · </>}
                {sub.predicted_next
                  ? <>next expected <b className="text-foreground">~{format(new Date(`${sub.predicted_next}T12:00:00`), 'MMM d, yyyy')}</b></>
                  : 'not enough history to predict yet'}
              </div>
            </div>

            <div className="flex items-center justify-between mt-5 mb-1">
              <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                Linked transactions · {linked.length}
              </span>
              <button
                onClick={() => setAddOpen(true)}
                className="flex items-center gap-1 text-xs font-medium text-primary hover:opacity-80"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
            {txnsLoading ? (
              <Skeleton className="h-16 w-full bg-muted/20 mt-3" />
            ) : linked.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6">No linked transactions yet.</p>
            ) : (
              <div>
                {linked.map((t) => {
                  const partial = t.amount < t.txn_amount - 0.005;
                  const editing = editingId === t.transaction_id;
                  return (
                    <div key={t.transaction_id} className="flex items-center justify-between gap-3 py-3 border-b border-border/40">
                      <Link to={`/transactions/${t.transaction_id}`} className="min-w-0 flex-1 group">
                        <div className="text-sm truncate group-hover:text-primary transition-colors">
                          {t.notes?.trim() || t.merchant || 'Transaction'}
                          {t.linked_by === 'manual' && <span className="text-[9px] font-mono text-muted-foreground ml-1.5">manual</span>}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">{format(new Date(t.transacted_at), 'MMM d, yyyy')}</div>
                      </Link>

                      {editing ? (
                        <span className="flex items-center gap-1.5 shrink-0">
                          <Input
                            autoFocus
                            type="number"
                            step="0.01"
                            min="0"
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') void saveAttribution(t);
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                            className="h-9 w-24 text-sm font-mono"
                            aria-label={`Amount counted toward ${sub.label}`}
                          />
                          <button
                            onClick={() => void saveAttribution(t)}
                            disabled={!!editError || setLinkedAmount.isPending}
                            aria-label="Save attributed amount"
                            className="h-9 w-9 grid place-items-center rounded-lg text-primary hover:bg-primary/10 transition-colors disabled:opacity-40"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            aria-label="Cancel"
                            className="h-9 w-9 grid place-items-center rounded-lg text-muted-foreground hover:bg-muted/30 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingId(t.transaction_id);
                            setDraft(String(t.amount));
                          }}
                          aria-label={`Change how much of this counts toward ${sub.label}`}
                          className="text-right shrink-0 rounded px-1 -mx-1 hover:bg-muted/30 transition-colors"
                        >
                          <span className="font-mono text-sm block">{formatINR(t.amount)}</span>
                          {partial && (
                            <span className="text-2xs text-muted-foreground font-mono block">
                              of {formatINR(t.txn_amount)}
                            </span>
                          )}
                        </button>
                      )}

                      {!editing && (
                        <button
                          onClick={() => doUnlink(t.transaction_id)}
                          disabled={unlink.isPending}
                          aria-label="Unlink"
                          className="h-9 w-9 grid place-items-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
                {editError && <p className="text-xs text-warning pt-2">{editError}</p>}
              </div>
            )}

            <div className="flex gap-2 mt-6">
              {sub.status === 'active' ? (
                <button onClick={() => changeStatus('paused')} className="flex-1 flex items-center justify-center gap-1.5 border border-border rounded-lg py-2.5 text-sm font-medium">
                  <Pause className="w-4 h-4" /> Pause
                </button>
              ) : sub.status === 'paused' ? (
                <button onClick={() => changeStatus('active')} className="flex-1 flex items-center justify-center gap-1.5 border border-border rounded-lg py-2.5 text-sm font-medium">
                  <Play className="w-4 h-4" /> Resume
                </button>
              ) : (
                <button onClick={() => changeStatus('active')} className="flex-1 flex items-center justify-center gap-1.5 border border-border rounded-lg py-2.5 text-sm font-medium">
                  <Play className="w-4 h-4" /> Reactivate
                </button>
              )}
              {sub.status !== 'cancelled' && (
                <button onClick={() => changeStatus('cancelled')} className={cn('flex-1 flex items-center justify-center gap-1.5 border rounded-lg py-2.5 text-sm font-medium', 'border-destructive/30 text-destructive')}>
                  <Ban className="w-4 h-4" /> Cancel
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {sub && <AddTransactionDialog open={addOpen} onOpenChange={setAddOpen} subscriptionId={sub.id} />}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="glass-elevated border-border/50">
          <DialogHeader>
            <DialogTitle className="font-heading font-normal text-2xl">Edit subscription</DialogTitle>
            <DialogDescription>
              Name and matching rules only. Cadence and amounts are derived from the
              linked transactions, so they follow what is actually linked.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sub-label" className="text-2xs font-mono uppercase tracking-wider text-muted-foreground">
                Name
              </Label>
              <Input id="sub-label" value={editLabel} onChange={(e) => setEditLabel(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sub-note" className="text-2xs font-mono uppercase tracking-wider text-muted-foreground">
                Match note
              </Label>
              <Input
                id="sub-note"
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                placeholder="blank to stop matching on the note"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sub-merchant" className="text-2xs font-mono uppercase tracking-wider text-muted-foreground">
                Match merchant
              </Label>
              <Input
                id="sub-merchant"
                value={editMerchant}
                onChange={(e) => setEditMerchant(e.target.value)}
                placeholder="blank to stop matching on the merchant"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button
              disabled={!editLabel.trim() || updateSub.isPending}
              onClick={async () => {
                if (!sub) return;
                try {
                  await updateSub.mutateAsync({
                    id: sub.id,
                    label: editLabel,
                    matchNote: editNote,
                    matchMerchant: editMerchant,
                  });
                  setEditOpen(false);
                  toast({ title: 'Subscription updated' });
                } catch (e) {
                  toast({
                    title: 'Could not save',
                    description: e instanceof Error ? e.message : undefined,
                    variant: 'destructive',
                  });
                }
              }}
            >
              {updateSub.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </AppLayout>
  );
}
