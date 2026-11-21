import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useCategories } from '@/hooks/useCategories';
import { useTransactionGroups } from '@/hooks/useTransactionGroups';
import { useMerchantMappings } from '@/hooks/useMerchantMappings';
import { visibleGroups } from '@/lib/visibleGroups';
import { batchByPatch, isEmptyEdit, patchFor, previousFor, type BulkEdit, type BulkEditTxn, type TxnPatch } from '@/lib/bulkEdit';
import { canRemember, proposeRules, type RuleProposal } from '@/lib/bulkRules';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ToastAction } from '@/components/ui/toast';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { CreateCategoryDialog } from './CreateCategoryDialog';
import { CreateGroupDialog } from './CreateGroupDialog';
import { BulkRuleReview } from './BulkRuleReview';

const KEEP = 'keep';
const NONE = 'none';
// PostgREST carries .in() filters in the URL; a few hundred UUIDs overflows it.
const IDS_PER_REQUEST = 100;

type Counted = typeof KEEP | 'counted' | 'not';

const COUNTED_OPTIONS: Array<{ value: Counted; label: string }> = [
  { value: KEEP, label: 'Keep as is' },
  { value: 'counted', label: 'Counted' },
  { value: 'not', label: 'Not counted' },
];

async function applyPatches(items: { id: string; patch: TxnPatch }[], userId: string) {
  for (const { patch, ids } of batchByPatch(items)) {
    for (let i = 0; i < ids.length; i += IDS_PER_REQUEST) {
      const { error } = await supabase
        .from('transactions')
        .update(patch as any)
        .in('id', ids.slice(i, i + IDS_PER_REQUEST))
        .eq('user_id', userId);
      if (error) throw error;
    }
  }
}

interface BulkEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactions: BulkEditTxn[];
  onApplied: () => void;
}

export function BulkEditDialog({ open, onOpenChange, transactions, onApplied }: BulkEditDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: categories = [] } = useCategories();
  const { data: groups = [] } = useTransactionGroups();
  const { data: mappings = [] } = useMerchantMappings();

  const [categoryId, setCategoryId] = useState(KEEP);
  const [groupId, setGroupId] = useState(KEEP);
  const [counted, setCounted] = useState<Counted>(KEEP);
  const [merchant, setMerchant] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [rememberRules, setRememberRules] = useState(false);
  const [proposals, setProposals] = useState<RuleProposal[] | null>(null);

  useEffect(() => {
    if (!open) return;
    setCategoryId(KEEP);
    setGroupId(KEEP);
    setCounted(KEEP);
    setMerchant('');
    setRememberRules(false);
    setProposals(null);
  }, [open]);

  const finish = () => {
    onOpenChange(false);
    onApplied();
  };

  const handleOpenChange = (next: boolean) => {
    if (!next && proposals) finish();
    else onOpenChange(next);
  };

  const n = transactions.length;
  const hasCredits = transactions.some((t) => t.direction === 'credit');
  const hasDebits = transactions.some((t) => t.direction !== 'credit');

  const categoryOptions = useMemo(
    () => [
      { value: KEEP, label: 'Keep as is' },
      { value: NONE, label: 'No category' },
      ...categories.map((c) => ({ value: c.id, label: c.name, icon: c.icon })),
    ],
    [categories],
  );

  const groupOptions = useMemo(
    () => [
      { value: KEEP, label: 'Keep as is' },
      { value: NONE, label: 'No group' },
      ...visibleGroups(groups).map((g) => ({ value: g.id, label: g.name, icon: g.icon })),
    ],
    [groups],
  );

  const edit: BulkEdit = {
    ...(categoryId !== KEEP ? { categoryId: categoryId === NONE ? null : categoryId } : {}),
    ...(groupId !== KEEP ? { groupId: groupId === NONE ? null : groupId } : {}),
    ...(counted !== KEEP ? { counted: counted === 'counted' } : {}),
    ...(merchant.trim() ? { merchant: merchant.trim() } : {}),
  };

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['transactions'] });
    queryClient.invalidateQueries({ queryKey: ['transaction'] });
    queryClient.invalidateQueries({ queryKey: ['month-summary'] });
    queryClient.invalidateQueries({ queryKey: ['merchants-autocomplete'] });
    queryClient.invalidateQueries({ queryKey: ['merchants-raw'] });
  };

  const handleApply = async () => {
    if (!user || n === 0 || isEmptyEdit(edit)) return;
    const changes = transactions.map((t) => ({ txn: t, patch: patchFor(t, edit) }));
    const undo = changes.map(({ txn, patch }) => ({ id: txn.id, patch: previousFor(txn, patch) }));
    const userId = user.id;

    const ruleProposals = rememberRules && canRemember(edit) ? proposeRules(transactions, edit, mappings) : [];

    setIsSaving(true);
    try {
      await applyPatches(changes.map(({ txn, patch }) => ({ id: txn.id, patch })), userId);
      refresh();
      if (ruleProposals.length > 0) setProposals(ruleProposals);
      else finish();
      toast({
        title: `Updated ${n} transaction${n === 1 ? '' : 's'}`,
        action: (
          <ToastAction
            altText="Undo"
            onClick={async () => {
              try {
                await applyPatches(undo, userId);
                refresh();
                toast({ title: 'Changes undone' });
              } catch {
                toast({ title: 'Could not undo', variant: 'destructive' });
              }
            }}
          >
            Undo
          </ToastAction>
        ),
      });
    } catch {
      refresh();
      toast({ title: 'Could not update every transaction', description: 'Some may have changed. Check the list.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="glass-elevated border-border/50 max-w-md max-h-[90vh] overflow-y-auto">
        {proposals ? (
          <BulkRuleReview proposals={proposals} onDone={finish} />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold">
                Edit {n} transaction{n === 1 ? '' : 's'}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Only the fields you change are applied. The rest stay as they are on each transaction.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Category</Label>
                  <button
                    type="button"
                    onClick={() => setShowCreateCategory(true)}
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    New
                  </button>
                </div>
                <SearchableSelect value={categoryId} onValueChange={setCategoryId} options={categoryOptions} />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Group</Label>
                  <button
                    type="button"
                    onClick={() => setShowCreateGroup(true)}
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    New
                  </button>
                </div>
                <SearchableSelect value={groupId} onValueChange={setGroupId} options={groupOptions} />
              </div>

              <div className="space-y-2">
                <Label>Counted</Label>
                <div role="radiogroup" aria-label="Counted" className="grid grid-cols-3 gap-1 p-1 rounded-lg border border-border/50">
                  {COUNTED_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      role="radio"
                      aria-checked={counted === o.value}
                      onClick={() => setCounted(o.value)}
                      className={cn(
                        'h-10 rounded-md text-sm transition-colors duration-150',
                        counted === o.value
                          ? 'bg-muted text-foreground'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                      )}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
                {counted !== KEEP && hasCredits && (
                  <p className="text-xs text-muted-foreground">
                    {hasDebits ? 'Debits count as spending, credits as income. ' : 'Credits count as income. '}
                    Any cashback among them stops being cashback.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="bulk-merchant">Merchant name</Label>
                <Input
                  id="bulk-merchant"
                  value={merchant}
                  onChange={(e) => setMerchant(e.target.value)}
                  placeholder="Keep as is"
                  className="bg-muted/30 border-border/50 rounded-xl"
                />
              </div>

              {canRemember(edit) && (
                <div className="space-y-1.5">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <Checkbox
                      checked={rememberRules}
                      onCheckedChange={(c) => setRememberRules(c === true)}
                      className="mt-0.5"
                    />
                    <span className="text-sm">Also apply to future transactions from these merchants</span>
                  </label>
                  {rememberRules && (
                    <p className="pl-7 text-xs text-muted-foreground">
                      You'll choose which merchants get a rule after applying.
                      {edit.groupId !== undefined && ' Groups can’t be remembered, so only the other changes become rules.'}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1 rounded-xl border-border/50" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button className="flex-1 rounded-xl" onClick={handleApply} disabled={isSaving || isEmptyEdit(edit)}>
                {isSaving ? 'Saving...' : `Apply to ${n}`}
              </Button>
            </div>
          </>
        )}
      </DialogContent>

      <CreateCategoryDialog
        open={showCreateCategory}
        onOpenChange={setShowCreateCategory}
        onCreated={setCategoryId}
      />

      <CreateGroupDialog
        open={showCreateGroup}
        onOpenChange={setShowCreateGroup}
        onCreated={setGroupId}
      />
    </Dialog>
  );
}
