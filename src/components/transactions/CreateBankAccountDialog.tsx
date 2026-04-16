import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  useCreateSavedBankAccount,
  useSetBankAccountNickname,
} from '@/hooks/useBankAccounts';
import { toTechnicalDisplay } from '@/lib/bankDisplay';

interface CreateBankAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after the account is created and react-query has refetched, with the
   *  technical display string ("HDFC ••1234") so callers can auto-select it. */
  onCreated?: (technicalDisplay: string) => void;
}

export function CreateBankAccountDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateBankAccountDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createSaved = useCreateSavedBankAccount();
  const setNickname = useSetBankAccountNickname();

  const [bankName, setBankName] = useState('');
  const [last4, setLast4] = useState('');
  const [nickname, setNickname2] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setBankName('');
      setLast4('');
      setNickname2('');
      setIsSubmitting(false);
    }
  }, [open]);

  const handleLast4Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
    setLast4(digits);
  };

  const handleCreate = async () => {
    const trimmedName = bankName.trim();
    if (!trimmedName) {
      toast({ title: 'Bank name is required', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);

    let savedId: string | null = null;
    try {
      // Step 1: insert preset row
      const saved = await createSaved.mutateAsync({
        bankName: trimmedName,
        accountLast4: last4,
      });
      savedId = saved.id;

      // Step 2: optionally insert nickname. Roll back the preset on failure.
      if (nickname.trim()) {
        try {
          await setNickname.mutateAsync({
            bankName: trimmedName,
            accountLast4: last4,
            nickname: nickname.trim(),
          });
        } catch (nicknameErr) {
          await supabase.from('saved_bank_accounts').delete().eq('id', saved.id);
          throw nicknameErr;
        }
      }

      // Step 3: await a refetch so the Add/Edit dialog's memoized options see
      // the new account before onCreated tries to auto-select it.
      await queryClient.refetchQueries({ queryKey: ['bank-accounts'] });

      const display = toTechnicalDisplay(trimmedName, last4);
      toast({ title: 'Bank account added' });
      onCreated?.(display);
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to create bank account';
      toast({ title: message, variant: 'destructive' });
      // savedId rollback already handled above for nickname failures; other
      // failures (step 1) leave no row to clean up.
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-elevated border-border/50 max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">New Bank Account</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="bankName" className="text-sm text-muted-foreground">
              Bank name *
            </Label>
            <Input
              id="bankName"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="e.g., HDFC"
              className="bg-muted/30 border-border/50 rounded-xl"
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="last4" className="text-sm text-muted-foreground">
              Last 4 digits
            </Label>
            <Input
              id="last4"
              value={last4}
              onChange={handleLast4Change}
              placeholder="1234"
              inputMode="numeric"
              maxLength={4}
              className="bg-muted/30 border-border/50 rounded-xl font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nickname" className="text-sm text-muted-foreground">
              Nickname (optional)
            </Label>
            <Input
              id="nickname"
              value={nickname}
              onChange={(e) => setNickname2(e.target.value)}
              placeholder="e.g., Salary account"
              className="bg-muted/30 border-border/50 rounded-xl"
              autoComplete="off"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            variant="outline"
            className="flex-1 rounded-xl border-border/50"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 rounded-xl"
            onClick={handleCreate}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Adding...' : 'Add'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
