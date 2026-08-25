import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { isToday } from 'date-fns';
import { formatINR } from '@/lib/formatCurrency';
import { cn } from '@/lib/utils';
import { TransactionCard } from '@/components/transactions/TransactionCard';
import type { DayLedgerRow } from '@/hooks/useDashboardStats';
import { lookupBankDisplay } from '@/hooks/useBankDisplayMap';

interface DayLedgerProps {
  days: DayLedgerRow[];
  bankDisplayMap: Map<string, string>;
  netAmountFor: (txnId: string, direction: string) => number | undefined;
  summaries?: Record<string, string>;
}

export function DayLedger({ days, bankDisplayMap, netAmountFor, summaries = {} }: DayLedgerProps) {
  const [open, setOpen] = useState<string | null>(null);
  // Bar length is a share of the heaviest day, so a fat weekend reads as fat
  // without any axis. Comparing days to each other is the whole point.
  const heaviest = Math.max(...days.map((d) => d.spent), 1);

  return (
    <div>
      {days.map((day, i) => {
        const isOpen = open === day.key;
        return (
          <motion.div
            key={day.key}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: Math.min(i * 0.015, 0.3) }}
            className="border-b border-border/60 last:border-b-0"
          >
            <div
              role="button"
              tabIndex={0}
              onClick={() => setOpen(isOpen ? null : day.key)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setOpen(isOpen ? null : day.key);
                }
              }}
              className="group w-full cursor-pointer px-1 pt-3 pb-2.5 text-left transition-colors hover:bg-muted/20"
            >
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    'font-heading italic text-xs w-16 shrink-0',
                    day.weekend ? 'text-gold' : 'text-muted-foreground',
                  )}
                >
                  {day.folio}
                </span>

                <span className="flex-1 flex items-center gap-px h-2 min-w-0">
                  {day.segments.map((seg) => (
                    <span
                      key={seg.categoryId}
                      title={`${seg.name} ${formatINR(seg.value)}`}
                      className="h-2 rounded-sm"
                      style={{
                        backgroundColor: seg.color,
                        width: `${Math.max((seg.value / heaviest) * 100, 0.8)}%`,
                      }}
                    />
                  ))}
                  {isToday(day.date) && <span className="h-3 w-px bg-primary ml-1 shrink-0" />}
                </span>

                <span className="amount text-xs w-20 text-right shrink-0">
                  {day.spent > 0 ? formatINR(day.spent) : '—'}
                </span>
              </div>

              {summaries[day.key] && (
                <p className="pl-[4.75rem] pr-1 mt-1 text-2xs leading-relaxed text-muted-foreground/75 transition-colors group-hover:text-muted-foreground">
                  {summaries[day.key]}
                </p>
              )}
            </div>

            {isOpen && (
              <div className="pb-2">
                {day.income > 0 && (
                  <div className="flex justify-between px-2 py-1.5 text-2xs font-mono text-gold">
                    <span>IN</span>
                    <span>+{formatINR(day.income)}</span>
                  </div>
                )}
                {day.txns.map((txn, j) => (
                  <Link key={txn.id} to={`/transactions/${txn.id}`}>
                    <TransactionCard
                      transaction={txn}
                      index={j}
                      netAmount={netAmountFor(txn.id, txn.direction)}
                      bankDisplay={lookupBankDisplay(bankDisplayMap, txn.bank_name, txn.account_last4)}
                    />
                  </Link>
                ))}
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
