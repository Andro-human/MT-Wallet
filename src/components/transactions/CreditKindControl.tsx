import { useState } from 'react';
import { format, parseISO, startOfMonth, subMonths } from 'date-fns';
import { ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { defaultCashbackMonth } from '@/lib/transactionMath';
import { cn } from '@/lib/utils';

export type CreditKind = 'income' | 'cashback' | 'none';

export function creditKindOf(txn: { is_income: boolean; cashback_month?: string | null }): CreditKind {
  if (txn.cashback_month) return 'cashback';
  return txn.is_income ? 'income' : 'none';
}

const OPTIONS: Array<{ kind: CreditKind; label: string }> = [
  { kind: 'income', label: 'Income' },
  { kind: 'cashback', label: 'Cashback' },
  { kind: 'none', label: 'Not counted' },
];

const PICKABLE_MONTHS = 12;

function monthsUpTo(transactedAt: string): string[] {
  const latest = startOfMonth(new Date(transactedAt));
  return Array.from({ length: PICKABLE_MONTHS }, (_, i) =>
    format(subMonths(latest, PICKABLE_MONTHS - 1 - i), 'yyyy-MM-dd'),
  );
}

interface CreditKindControlProps {
  transactedAt: string;
  isIncome: boolean;
  cashbackMonth: string | null | undefined;
  /** cashbackMonth is the first of a month as yyyy-MM-dd, set only for 'cashback'. */
  onChange: (kind: CreditKind, cashbackMonth: string | null) => void;
  disabled?: boolean;
}

export function CreditKindControl({
  transactedAt,
  isIncome,
  cashbackMonth,
  onChange,
  disabled,
}: CreditKindControlProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const kind = creditKindOf({ is_income: isIncome, cashback_month: cashbackMonth });

  const select = (next: CreditKind) => {
    if (next === kind) return;
    onChange(next, next === 'cashback' ? defaultCashbackMonth(transactedAt) : null);
  };

  return (
    <div className="space-y-2">
      <div role="radiogroup" aria-label="Count this credit as" className="grid grid-cols-3 gap-1 p-1 rounded-lg border border-border/50">
        {OPTIONS.map((o) => (
          <button
            key={o.kind}
            type="button"
            role="radio"
            aria-checked={kind === o.kind}
            disabled={disabled}
            onClick={() => select(o.kind)}
            className={cn(
              'h-10 rounded-md text-sm transition-colors duration-150',
              kind === o.kind
                ? o.kind === 'none'
                  ? 'bg-muted text-foreground'
                  : 'bg-gold/10 text-gold'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>

      {kind === 'cashback' && cashbackMonth && (
        <div className="flex items-center justify-between gap-3 px-1">
          <span className="text-xs text-muted-foreground">Lowers spending in</span>
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                disabled={disabled}
                className="flex items-center gap-1 text-sm text-gold hover:opacity-80 transition-opacity"
              >
                {format(parseISO(cashbackMonth), 'MMMM yyyy')}
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 p-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Cashback for</p>
              <div className="grid grid-cols-3 gap-1">
                {monthsUpTo(transactedAt).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      if (m !== cashbackMonth) onChange('cashback', m);
                      setPickerOpen(false);
                    }}
                    className={cn(
                      'py-2 rounded-md text-xs transition-colors duration-150',
                      m === cashbackMonth
                        ? 'bg-gold/10 text-gold'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                    )}
                  >
                    {format(parseISO(m), 'MMM yy')}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  );
}
