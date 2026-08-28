import { useEffect, useState } from 'react';
import { useCategories } from '@/hooks/useCategories';
import { useTransactionGroups } from '@/hooks/useTransactionGroups';
import { useCreateBudget, useUpdateBudget, useClaimedTargets } from '@/hooks/useBudgets';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { BudgetDef } from '@/lib/budgetMath';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null to create. */
  budget: BudgetDef | null;
}

export function BudgetDialog({ open, onOpenChange, budget }: Props) {
  const { toast } = useToast();
  const { data: categories = [] } = useCategories();
  const { data: groups = [] } = useTransactionGroups();
  const create = useCreateBudget();
  const update = useUpdateBudget();
  // A category or group already inside another budget cannot be picked: two
  // budgets over the same target would double-count its spend.
  const claimed = useClaimedTargets(budget?.id);

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [weekly, setWeekly] = useState('');
  const [weeklyCount, setWeeklyCount] = useState('');
  const [carryover, setCarryover] = useState(false);
  const [isRemainder, setIsRemainder] = useState(false);
  const [cats, setCats] = useState<Set<string>>(new Set());
  const [grps, setGrps] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    setName(budget?.name ?? '');
    setAmount(budget ? String(budget.amount) : '');
    setWeekly(budget?.weeklyAmount ? String(budget.weeklyAmount) : '');
    setWeeklyCount(budget?.weeklyCount ? String(budget.weeklyCount) : '');
    setCarryover(budget?.carryover ?? false);
    setIsRemainder(budget?.isRemainder ?? false);
    setCats(new Set(budget?.categoryIds ?? []));
    setGrps(new Set(budget?.groupIds ?? []));
  }, [open, budget]);

  const toggle = (set: Set<string>, apply: (s: Set<string>) => void, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    apply(next);
  };

  const amountNum = Number(amount);
  const weeklyNum = weekly.trim() === '' ? null : Number(weekly);
  const countNum = weeklyCount.trim() === '' ? null : Number(weeklyCount);
  const valid =
    name.trim().length > 0 &&
    Number.isFinite(amountNum) &&
    amountNum >= 0 &&
    (weeklyNum === null || (Number.isFinite(weeklyNum) && weeklyNum >= 0)) &&
    (countNum === null || (Number.isInteger(countNum) && countNum > 0)) &&
    (isRemainder || cats.size > 0 || grps.size > 0);

  const pending = create.isPending || update.isPending;

  const save = async () => {
    const input = {
      name,
      amount: amountNum,
      weeklyAmount: weeklyNum,
      weeklyCount: countNum,
      carryover,
      isRemainder,
      // The catch-all is defined by what it does NOT name, so it carries no
      // bindings of its own.
      categoryIds: isRemainder ? [] : [...cats],
      groupIds: isRemainder ? [] : [...grps],
    };
    try {
      if (budget) await update.mutateAsync({ ...input, id: budget.id });
      else await create.mutateAsync(input);
      onOpenChange(false);
      toast({ title: budget ? 'Budget updated' : 'Budget created' });
    } catch (e) {
      toast({
        title: 'Could not save',
        description:
          e instanceof Error && /unique|duplicate/i.test(e.message)
            ? 'Another budget already covers one of those, or a catch-all already exists.'
            : e instanceof Error
              ? e.message
              : undefined,
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-elevated border-border/50 max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading font-normal text-2xl">
            {budget ? 'Edit budget' : 'New budget'}
          </DialogTitle>
          <DialogDescription>
            One budget can cover several categories and groups. Spend counts against a
            group's budget first, then its category's, then the catch-all.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="b-name" className="text-2xs font-mono uppercase tracking-wider text-muted-foreground">
              Name
            </Label>
            <Input
              id="b-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Groceries & Home spend"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="b-amount" className="text-2xs font-mono uppercase tracking-wider text-muted-foreground">
                Per month
              </Label>
              <Input
                id="b-amount"
                inputMode="decimal"
                className="no-spinner amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="5000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="b-weekly" className="text-2xs font-mono uppercase tracking-wider text-muted-foreground">
                Per week
              </Label>
              <Input
                id="b-weekly"
                inputMode="decimal"
                className="no-spinner amount"
                value={weekly}
                onChange={(e) => setWeekly(e.target.value)}
                placeholder="optional"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="b-count" className="text-2xs font-mono uppercase tracking-wider text-muted-foreground">
              Orders per week
            </Label>
            <Input
              id="b-count"
              inputMode="numeric"
              className="no-spinner amount"
              value={weeklyCount}
              onChange={(e) => setWeeklyCount(e.target.value)}
              placeholder="optional, e.g. 3"
            />
            <p className="text-2xs text-muted-foreground">
              Counts orders, not charges. Transactions you have combined on the Activity
              page count once, so an order and the fee that follows it are one.
            </p>
          </div>

          {weeklyNum !== null && amountNum > 0 && (
            <p className="text-2xs text-muted-foreground -mt-2">
              A month is about 4.35 weeks, so {weeklyNum} a week runs to roughly{' '}
              <span className="amount">{Math.round(weeklyNum * 4.35).toLocaleString('en-IN')}</span> a
              month. The monthly figure is the real cap; this one is a rhythm.
            </p>
          )}

          <div className="flex items-center justify-between gap-3 py-1">
            <div>
              <p className="text-sm font-medium">Roll over what is unspent</p>
              <p className="text-2xs text-muted-foreground">
                Surplus carries to next month. Overspend never does.
              </p>
            </div>
            <Switch checked={carryover} onCheckedChange={setCarryover} />
          </div>

          <div className="flex items-center justify-between gap-3 py-1 border-t border-border/50 pt-4">
            <div>
              <p className="text-sm font-medium">Catch-all</p>
              <p className="text-2xs text-muted-foreground">
                Everything no other budget claims. Only one can be this.
              </p>
            </div>
            <Switch checked={isRemainder} onCheckedChange={setIsRemainder} />
          </div>

          {!isRemainder && (
            <>
              <div className="space-y-2">
                <Label className="text-2xs font-mono uppercase tracking-wider text-muted-foreground">
                  Categories
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {categories.map((c) => {
                    const taken = claimed.categories.has(c.id);
                    const on = cats.has(c.id);
                    return (
                      <button
                        key={c.id}
                        disabled={taken}
                        onClick={() => toggle(cats, setCats, c.id)}
                        title={taken ? 'Already in another budget' : undefined}
                        className={cn(
                          'px-2.5 py-1 rounded-full text-xs border transition-colors',
                          on
                            ? 'border-primary/50 bg-primary/10 text-foreground'
                            : 'border-border text-muted-foreground hover:text-foreground',
                          taken && 'opacity-35 cursor-not-allowed',
                        )}
                      >
                        {c.icon} {c.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-2xs font-mono uppercase tracking-wider text-muted-foreground">
                  Groups
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {groups.map((g) => {
                    const taken = claimed.groups.has(g.id);
                    const on = grps.has(g.id);
                    return (
                      <button
                        key={g.id}
                        disabled={taken}
                        onClick={() => toggle(grps, setGrps, g.id)}
                        title={taken ? 'Already in another budget' : undefined}
                        className={cn(
                          'px-2.5 py-1 rounded-full text-xs border transition-colors',
                          on
                            ? 'border-primary/50 bg-primary/10 text-foreground'
                            : 'border-border text-muted-foreground hover:text-foreground',
                          taken && 'opacity-35 cursor-not-allowed',
                        )}
                      >
                        {g.icon} {g.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!valid || pending} onClick={save}>
            {pending ? 'Saving...' : budget ? 'Save' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
