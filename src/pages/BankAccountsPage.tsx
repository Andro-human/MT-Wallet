import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Building2, Trash2, Merge, Loader2, AlertTriangle, Unlink, Pencil, Plus } from 'lucide-react';
import {
  useBankAccounts,
  useRemoveBankAccount,
  useBankAccountAliases,
  useCreateBankAccountAlias,
  useDeleteBankAccountAlias,
  useSetBankAccountNickname,
  useDeleteBankAccountNickname,
  useCreateSavedBankAccount,
  useDeleteSavedBankAccount,
  BankAccountInfo,
} from '@/hooks/useBankAccounts';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { toTechnicalDisplay } from '@/lib/bankDisplay';
import { useEntityTotals } from '@/hooks/useEntityTotals';
import { formatINRCompact } from '@/lib/formatCurrency';
import { entityColor } from '@/lib/categoryColors';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function BankAccountsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: bankAccounts = [], isLoading } = useBankAccounts();
  const { byRawAccount } = useEntityTotals();

  // An account's spend is the sum over every raw account aliased into it, or
  // the merged rows would report zero against a real balance.
  type Aliased = { rawAccounts: { bankName: string; accountLast4: string }[] };
  const foldRaw = useCallback(
    (account: Aliased, field: 'spent' | 'counted') =>
      account.rawAccounts.reduce(
        (sum, r) => sum + (byRawAccount[`${r.bankName}|${r.accountLast4}`]?.[field] ?? 0),
        0,
      ),
    [byRawAccount],
  );
  const spendFor = useCallback((a: Aliased) => foldRaw(a, 'spent'), [foldRaw]);
  // Not BankAccountInfo.transactionCount: that is the raw view count, which
  // ignores duplicates and refunds and so disagrees with every other page.
  const countedFor = useCallback((a: Aliased) => foldRaw(a, 'counted'), [foldRaw]);

  const ranked = useMemo(
    () =>
      [...bankAccounts].sort((a, b) => {
        const d = spendFor(b) - spendFor(a);
        return d !== 0 ? d : a.display.localeCompare(b.display);
      }),
    [bankAccounts, spendFor],
  );
  const maxAccountSpent = useMemo(
    () => ranked.reduce((m, a) => Math.max(m, spendFor(a)), 0),
    [ranked, spendFor],
  );
  const { data: aliases = [] } = useBankAccountAliases();
  const removeBankAccount = useRemoveBankAccount();
  const createAlias = useCreateBankAccountAlias();
  const deleteAlias = useDeleteBankAccountAlias();
  const setNickname = useSetBankAccountNickname();
  const deleteNickname = useDeleteBankAccountNickname();
  const createSavedBankAccount = useCreateSavedBankAccount();
  const deleteSavedBankAccount = useDeleteSavedBankAccount();

  // Remove dialog
  const [removeDialog, setRemoveDialog] = useState<{
    open: boolean;
    bankName: string;
    accountLast4: string;
    display: string;
    count: number;
    savedAccountId: string | null;
  }>({ open: false, bankName: '', accountLast4: '', display: '', count: 0, savedAccountId: null });

  // Add saved account dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addBankName, setAddBankName] = useState('');
  const [addLast4, setAddLast4] = useState('');

  // Link (alias) dialog
  const [mergeDialog, setMergeDialog] = useState<{
    open: boolean;
    source: BankAccountInfo | null;
  }>({ open: false, source: null });
  const [mergeTarget, setMergeTarget] = useState('');

  // Nickname dialog
  const [nicknameDialog, setNicknameDialog] = useState<{
    open: boolean;
    account: BankAccountInfo | null;
  }>({ open: false, account: null });
  const [nicknameValue, setNicknameValue] = useState('');

  const handleRemove = async () => {
    try {
      if (removeDialog.savedAccountId) {
        await deleteSavedBankAccount.mutateAsync(removeDialog.savedAccountId);
        toast({ title: 'Saved account removed' });
      } else {
        await removeBankAccount.mutateAsync({
          bankName: removeDialog.bankName,
          accountLast4: removeDialog.accountLast4,
        });
        toast({ title: `"${removeDialog.display}" removed from ${removeDialog.count} transactions` });
      }
      setRemoveDialog({
        open: false,
        bankName: '',
        accountLast4: '',
        display: '',
        count: 0,
        savedAccountId: null,
      });
    } catch {
      toast({ title: 'Failed to remove bank account', variant: 'destructive' });
    }
  };

  const handleAddSavedAccount = async () => {
    const name = addBankName.trim();
    if (!name) {
      toast({ title: 'Enter a bank name', variant: 'destructive' });
      return;
    }
    try {
      await createSavedBankAccount.mutateAsync({
        bankName: name,
        accountLast4: addLast4,
      });
      toast({ title: 'Account added' });
      setAddDialogOpen(false);
      setAddBankName('');
      setAddLast4('');
    } catch (err: unknown) {
      const code = err && typeof err === 'object' && 'code' in err ? String((err as { code?: string }).code) : '';
      const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message?: string }).message) : '';
      if (code === '23505' || /duplicate|unique/i.test(msg)) {
        toast({ title: 'This account is already in your list', variant: 'destructive' });
      } else {
        toast({ title: 'Failed to add account', variant: 'destructive' });
      }
    }
  };

  const handleMerge = async () => {
    if (!mergeDialog.source || !mergeTarget) return;

    const target = bankAccounts.find(
      (a) => `${a.bankName}|${a.accountLast4}` === mergeTarget
    );
    if (!target) return;

    try {
      await createAlias.mutateAsync({
        source: {
          bankName: mergeDialog.source.bankName,
          accountLast4: mergeDialog.source.accountLast4,
        },
        target: {
          bankName: target.bankName,
          accountLast4: target.accountLast4,
        },
      });
      toast({
        title: `Linked "${mergeDialog.source.display}" → "${target.display}"`,
        description: 'Transactions will appear under the target account in the UI. No data was modified.',
      });
      setMergeDialog({ open: false, source: null });
      setMergeTarget('');
    } catch {
      toast({ title: 'Failed to link accounts', variant: 'destructive' });
    }
  };

  const handleUnalias = async (aliasId: string) => {
    try {
      await deleteAlias.mutateAsync(aliasId);
      toast({ title: 'Account unlinked' });
    } catch {
      toast({ title: 'Failed to unlink account', variant: 'destructive' });
    }
  };

  const openNicknameDialog = (account: BankAccountInfo) => {
    setNicknameDialog({ open: true, account });
    setNicknameValue(account.nickname);
  };

  const handleSaveNickname = async () => {
    if (!nicknameDialog.account) return;

    const trimmed = nicknameValue.trim();

    try {
      if (trimmed) {
        await setNickname.mutateAsync({
          bankName: nicknameDialog.account.bankName,
          accountLast4: nicknameDialog.account.accountLast4,
          nickname: trimmed,
        });
        toast({ title: `Renamed to "${trimmed}"` });
      } else if (nicknameDialog.account.nicknameId) {
        // Empty nickname → remove it
        await deleteNickname.mutateAsync(nicknameDialog.account.nicknameId);
        toast({ title: 'Nickname removed' });
      }
      setNicknameDialog({ open: false, account: null });
    } catch {
      toast({ title: 'Failed to update nickname', variant: 'destructive' });
    }
  };

  // Find aliases that point to a given target account
  const getAliasesForTarget = (bankName: string, accountLast4: string) => {
    return aliases.filter(
      (a) => a.target_bank_name === bankName && a.target_account_last4 === accountLast4
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Background gradient */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 80% 50% at 50% -20%, hsl(252 87% 64% / 0.08), transparent)',
        }}
      />

      {/* Header */}
      <div className="sticky top-0 z-10 backdrop-blur-xl bg-background/95 border-b border-border/30 safe-area-top">
        <div className="flex items-center gap-3 px-5 py-3 page-shell">
          <button
            onClick={() => navigate(-1)}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted/50 transition-colors -ml-1"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-lg font-semibold text-foreground flex-1">Bank Accounts</h1>
          <Button
            type="button"
            size="sm"
            className="rounded-xl gap-1.5"
            onClick={() => {
              setAddBankName('');
              setAddLast4('');
              setAddDialogOpen(true);
            }}
          >
            <Plus className="w-4 h-4" />
            Add
          </Button>
        </div>
      </div>

      <div className="px-5 py-6 relative page-shell">
        {/* Summary */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="mb-2"
        >
          <p className="text-base text-muted-foreground">
            {bankAccounts.length} account{bankAccounts.length !== 1 ? 's' : ''}
            {aliases.length > 0 && ` · ${aliases.length} alias${aliases.length !== 1 ? 'es' : ''}`}
          </p>
        </motion.div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-2xl" />
            ))}
          </div>
        ) : bankAccounts.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <Building2 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-base text-muted-foreground">No bank accounts linked yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Add accounts here or they are detected from your transactions
            </p>
            <Button
              type="button"
              className="mt-4 rounded-xl gap-2"
              onClick={() => {
                setAddBankName('');
                setAddLast4('');
                setAddDialogOpen(true);
              }}
            >
              <Plus className="w-4 h-4" />
              Add bank account
            </Button>
          </motion.div>
        ) : (
          <div>
            {ranked.map((account, i) => {
            const key = `${account.bankName}|${account.accountLast4}`;
            const accountAliases = getAliasesForTarget(account.bankName, account.accountLast4);
            const hasAliases = accountAliases.length > 0;
            const spent = spendFor(account);
            const counted = countedFor(account);
            const barWidth = maxAccountSpent > 0 ? (spent / maxAccountSpent) * 100 : 0;
            const txnHref = `/transactions?bank=${encodeURIComponent(account.bankName)}&account=${encodeURIComponent(account.accountLast4)}`;

            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 12) * 0.02, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="group border-b border-border/50 last:border-b-0 py-3.5"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <button
                    onClick={() => navigate(txnHref)}
                    className="flex items-baseline gap-2 min-w-0 text-left"
                  >
                    <span className="font-heading text-lg font-normal truncate group-hover:text-primary transition-colors">
                      {account.display}
                    </span>
                    {account.nickname && (
                      <span className="hidden sm:inline text-2xs font-mono text-muted-foreground shrink-0">
                        {account.technicalDisplay}
                      </span>
                    )}
                  </button>

                  <span className="flex items-baseline gap-2.5 shrink-0">
                    <span className="hidden sm:inline text-2xs text-muted-foreground">
                      {counted} txn{counted !== 1 ? 's' : ''}
                    </span>
                    <span className="amount text-sm">{formatINRCompact(spent)}</span>
                    <span className="flex items-center justify-end gap-0.5 w-[4.75rem]">
                      <button
                        onClick={() => openNicknameDialog(account)}
                        className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                        title="Rename account"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setMergeDialog({ open: true, source: account });
                          setMergeTarget('');
                        }}
                        className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                        title="Link to another account"
                      >
                        <Merge className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() =>
                          setRemoveDialog({
                            open: true,
                            bankName: account.bankName,
                            accountLast4: account.accountLast4,
                            display: account.display,
                            count: account.transactionCount,
                            savedAccountId: account.savedAccountId,
                          })
                        }
                        className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title="Remove bank account"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  </span>
                </div>

                {spent > 0 && (
                  <div className="mt-2 h-1 w-full rounded-full bg-muted/25 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.max(barWidth, 0.6)}%`, background: entityColor(key) }}
                    />
                  </div>
                )}

                {/* Show aliased accounts under this one */}
                {hasAliases && (
                  <div className="mt-2.5 pl-4 border-l border-border/40 max-w-xs">
                    <p className="text-2xs font-mono uppercase tracking-wider text-muted-foreground mb-1">
                      merged in
                    </p>
                    {accountAliases.map((alias) => {
                      const srcDisplay = toTechnicalDisplay(alias.source_bank_name, alias.source_account_last4);
                      return (
                        <div key={alias.id} className="flex items-baseline justify-between gap-3 py-1">
                          <span className="text-2xs font-mono text-muted-foreground truncate">
                            {srcDisplay || 'unnamed account'}
                          </span>
                          <button
                            onClick={() => handleUnalias(alias.id)}
                            className="p-1 -mr-1 rounded text-muted-foreground/40 hover:text-warning hover:bg-warning/10 transition-colors shrink-0"
                            title="Unlink this account"
                            aria-label={`Unlink ${srcDisplay}`}
                          >
                            <Unlink className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            );
            })}
          </div>
        )}
      </div>

      {/* Remove Confirmation Dialog */}
      <AlertDialog open={removeDialog.open} onOpenChange={(open) => setRemoveDialog((prev) => ({ ...prev, open }))}>
        <AlertDialogContent className="glass-elevated border-border/50">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="w-5 h-5 text-warning" />
              Remove Bank Account
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p className="text-base">
                  Are you sure you want to remove <strong className="text-foreground">{removeDialog.display}</strong>?
                </p>
                {removeDialog.savedAccountId ? (
                  <p className="text-sm text-muted-foreground">
                    This only removes the saved name from your list. No transactions will be changed.
                  </p>
                ) : (
                  <>
                    <p className="text-warning font-medium text-base">
                      {removeDialog.count} transaction{removeDialog.count !== 1 ? 's' : ''} will be unlinked.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      The transactions themselves won&apos;t be deleted — only the bank account info will be cleared.
                    </p>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={removeBankAccount.isPending || deleteSavedBankAccount.isPending}
            >
              {(removeBankAccount.isPending || deleteSavedBankAccount.isPending) && (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              )}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="glass-elevated border-border/50 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" />
              Add bank account
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="add-bank-name">Bank name</Label>
              <Input
                id="add-bank-name"
                value={addBankName}
                onChange={(e) => setAddBankName(e.target.value)}
                placeholder="e.g. HDFC Bank, Amazon Pay"
                className="bg-muted/30 border-border/50 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-last4">Last 4 digits (optional)</Label>
              <Input
                id="add-last4"
                value={addLast4}
                onChange={(e) => setAddLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="1234"
                inputMode="numeric"
                className="bg-muted/30 border-border/50 rounded-xl"
              />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1 rounded-xl border-border/50"
              onClick={() => setAddDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="flex-1 rounded-xl"
              onClick={handleAddSavedAccount}
              disabled={!addBankName.trim() || createSavedBankAccount.isPending}
            >
              {createSavedBankAccount.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Link / Merge Dialog */}
      <Dialog
        open={mergeDialog.open}
        onOpenChange={(open) => {
          setMergeDialog((prev) => ({ ...prev, open }));
          if (!open) setMergeTarget('');
        }}
      >
        <DialogContent className="glass-elevated border-border/50 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold flex items-center gap-2">
              <Merge className="w-5 h-5 text-primary" />
              Link Bank Account
            </DialogTitle>
          </DialogHeader>

          {mergeDialog.source && (
            <div className="space-y-4 py-2">
              <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                <p className="text-sm text-muted-foreground mb-1">This account</p>
                <p className="text-base font-semibold text-foreground">{mergeDialog.source.display}</p>
                {mergeDialog.source.nickname && (
                  <p className="text-sm text-muted-foreground">{mergeDialog.source.technicalDisplay}</p>
                )}
                <p className="text-sm text-muted-foreground">
                  {mergeDialog.source.transactionCount} transaction{mergeDialog.source.transactionCount !== 1 ? 's' : ''}
                </p>
              </div>

              <div className="text-center text-muted-foreground text-sm">will appear under ↓</div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">Target account</p>
                <Select value={mergeTarget} onValueChange={setMergeTarget}>
                  <SelectTrigger className="bg-muted/30 border-border/50 rounded-xl h-12">
                    <SelectValue placeholder="Select target account" />
                  </SelectTrigger>
                  <SelectContent className="glass-card border-border/50">
                    {bankAccounts
                      .filter(
                        (a) =>
                          `${a.bankName}|${a.accountLast4}` !==
                          `${mergeDialog.source!.bankName}|${mergeDialog.source!.accountLast4}`
                      )
                      .map((a) => (
                        <SelectItem key={`${a.bankName}|${a.accountLast4}`} value={`${a.bankName}|${a.accountLast4}`}>
                          <span className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-info" />
                            {a.display}
                            <span className="text-muted-foreground">({a.transactionCount})</span>
                          </span>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {mergeTarget && (
                <div className="p-3 rounded-xl bg-info/10 border border-info/20">
                  <p className="text-sm text-info">
                    No data will be modified. Transactions from "{mergeDialog.source.display}" will
                    simply appear under the target account in the UI. You can unlink anytime.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1 rounded-xl border-border/50"
              onClick={() => {
                setMergeDialog({ open: false, source: null });
                setMergeTarget('');
              }}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 rounded-xl"
              onClick={handleMerge}
              disabled={!mergeTarget || createAlias.isPending}
            >
              {createAlias.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Link
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Nickname Dialog */}
      <Dialog
        open={nicknameDialog.open}
        onOpenChange={(open) => setNicknameDialog((prev) => ({ ...prev, open }))}
      >
        <DialogContent className="glass-elevated border-border/50 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Rename Account</DialogTitle>
          </DialogHeader>

          {nicknameDialog.account && (
            <div className="space-y-4 py-2">
              <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                <p className="text-sm text-muted-foreground mb-1">Account</p>
                <p className="text-base font-semibold text-foreground">
                  {nicknameDialog.account.technicalDisplay}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="nickname" className="text-sm text-muted-foreground">
                  Display name
                </Label>
                <Input
                  id="nickname"
                  value={nicknameValue}
                  onChange={(e) => setNicknameValue(e.target.value)}
                  placeholder={`e.g., ${nicknameDialog.account.bankName || 'My'} Savings`}
                  className="bg-muted/30 border-border/50 rounded-xl h-12"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveNickname();
                  }}
                />
                <p className="text-sm text-muted-foreground">
                  Leave empty to use the default name.
                </p>
              </div>

              {/* Preview */}
              <div className="p-4 rounded-xl bg-muted/20 border border-border/30">
                <p className="text-sm text-muted-foreground mb-2">Preview</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-info/10 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-info" />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-foreground">
                      {nicknameValue.trim() || nicknameDialog.account.technicalDisplay}
                    </p>
                    {nicknameValue.trim() && (
                      <p className="text-sm text-muted-foreground">
                        {nicknameDialog.account.technicalDisplay}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1 rounded-xl border-border/50"
              onClick={() => setNicknameDialog({ open: false, account: null })}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 rounded-xl"
              onClick={handleSaveNickname}
              disabled={setNickname.isPending || deleteNickname.isPending}
            >
              {(setNickname.isPending || deleteNickname.isPending) && (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              )}
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
