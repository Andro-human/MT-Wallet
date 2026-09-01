import { useMemo, useState } from 'react';
import { Trash2, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useMerchantMappings, useDeleteMerchantMapping } from '@/hooks/useMerchantMappings';
import { useCategories } from '@/hooks/useCategories';
import { describeRule, conflictingFields, ruleMatches } from '@/lib/describeRule';
import { cn } from '@/lib/utils';

interface MerchantRulesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  merchantName: string;
  /** The transaction you opened this from, so the list can say which rules
   *  actually fired on it rather than which ones merely mention the merchant. */
  amount: number;
  transactedAt: string;
}

export function MerchantRulesDialog({
  open,
  onOpenChange,
  merchantName,
  amount,
  transactedAt,
}: MerchantRulesDialogProps) {
  const { data: mappings = [], isLoading } = useMerchantMappings();
  const { data: categories = [] } = useCategories();
  const remove = useDeleteMerchantMapping();
  const [confirming, setConfirming] = useState<string | null>(null);

  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name;

  // Every rule that could fire on this merchant, matched the way ingest matches:
  // exact on the whole string, or contains anywhere inside it.
  const rules = useMemo(() => {
    const target = merchantName.toLowerCase();
    return mappings
      .filter((m) => {
        const raw = (m.raw_merchant ?? '').toLowerCase();
        return m.match_type === 'contains' ? target.includes(raw) : target === raw;
      })
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  }, [mappings, merchantName]);

  const firing = useMemo(
    () => rules.filter((r) => ruleMatches(r, { merchant: merchantName, amount, transactedAt })),
    [rules, merchantName, amount, transactedAt],
  );
  const firingIds = useMemo(() => new Set(firing.map((r) => r.id)), [firing]);

  // Only rules that can act on the same transaction can disagree. Swiggy's
  // under-₹200 and over-₹200 rules both set a category and never clash.
  const clashes = useMemo(() => conflictingFields(firing), [firing]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-elevated border-border/50 max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Rules for "{merchantName}"</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {isLoading
              ? 'Loading…'
              : rules.length === 0
                ? 'Nothing is set up for this merchant, so it is labelled from the SMS alone.'
                : `${rules.length} rule${rules.length > 1 ? 's' : ''} mention this merchant, oldest first. ${firing.length} appl${firing.length === 1 ? 'ies' : 'y'} to this transaction.`}
          </p>
        </DialogHeader>

        {clashes.length > 0 && (
          <div className="mt-2 flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="text-xs text-muted-foreground">
              Two rules that both apply here set{' '}
              <span className="text-foreground">{clashes.join(' and ')}</span>. Only the oldest
              takes effect, so a newer one you meant to apply is being ignored.
            </p>
          </div>
        )}

        {rules.length > 0 && (
          <div className="mt-3 flex-1 space-y-2 overflow-y-auto" style={{ maxHeight: '48vh' }}>
            {rules.map((rule, i) => {
              const { conditions, effects } = describeRule(rule, categoryName);
              const isConfirming = confirming === rule.id;
              return (
                <div
                  key={rule.id}
                  className={cn(
                    'rounded-xl border p-3',
                    isConfirming
                      ? 'border-destructive/40 bg-destructive/5'
                      : firingIds.has(rule.id)
                        ? 'border-border/50 bg-muted/20'
                        : 'border-border/30 bg-transparent opacity-70',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground">
                        When {conditions.join(' and ')}
                      </p>
                      <p className="mt-1 text-sm text-foreground">{effects.join(' · ')}</p>
                      {!firingIds.has(rule.id) && (
                        <p className="mt-1 text-2xs text-muted-foreground/70">
                          Does not apply to this transaction.
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => setConfirming(isConfirming ? null : rule.id)}
                      aria-label={`Delete rule ${i + 1}`}
                      className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {isConfirming && (
                    <div className="mt-3 flex items-center gap-2">
                      <Button
                        variant="outline"
                        className="h-8 flex-1 rounded-lg text-xs"
                        onClick={() => setConfirming(null)}
                      >
                        Keep
                      </Button>
                      <Button
                        variant="destructive"
                        className="h-8 flex-1 rounded-lg text-xs"
                        disabled={remove.isPending}
                        onClick={async () => {
                          await remove.mutateAsync(rule.id);
                          setConfirming(null);
                        }}
                      >
                        Delete rule
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <p className="mt-3 text-2xs text-muted-foreground">
          Deleting a rule changes nothing that is already recorded, only what happens to new
          transactions.
        </p>
      </DialogContent>
    </Dialog>
  );
}
