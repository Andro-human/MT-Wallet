import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { ChevronDown, Layers, Ungroup } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatINR } from '@/lib/formatCurrency';
import { TransactionWithCategory } from '@/types/database';

interface CombinedTransactionCardProps {
  members: TransactionWithCategory[];
  index?: number;
  onUngroup?: () => void;
}

// Display-only: the member rows are the real records; aggregates count them individually.
export function CombinedTransactionCard({ members, index = 0, onUngroup }: CombinedTransactionCardProps) {
  const [expanded, setExpanded] = useState(false);

  const { net, isCredit, label, when, category, note } = useMemo(() => {
    const debit = members
      .filter((m) => m.direction === 'debit')
      .reduce((s, m) => s + Number(m.amount), 0);
    const credit = members
      .filter((m) => m.direction === 'credit')
      .reduce((s, m) => s + Number(m.amount), 0);
    const signed = credit - debit;

    const counts: Record<string, number> = {};
    for (const m of members) {
      const name = m.merchant || 'Unknown';
      counts[name] = (counts[name] || 0) + 1;
    }
    const label =
      Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Combined';

    const anchor = [...members].sort(
      (a, b) => new Date(b.transacted_at).getTime() - new Date(a.transacted_at).getTime()
    )[0];

    const note = members.map((m) => m.notes?.trim()).find((n) => !!n) || null;

    return {
      net: Math.abs(signed),
      isCredit: signed >= 0,
      label,
      when: anchor?.transacted_at,
      category: anchor?.categories,
      note,
    };
  }, [members]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="border-b border-border/50"
    >
      {/* Parent row */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-4 p-3 hover:bg-muted/30 transition-colors group text-left"
      >
        {/* Combine glyph layered over the category icon */}
        <div
          className="relative w-10 h-10 flex items-center justify-center rounded-none border bg-background text-lg flex-shrink-0"
          style={
            category
              ? {
                  borderColor: category.color ? `${category.color}40` : 'var(--border)',
                  color: category.color || 'var(--foreground)',
                }
              : { borderColor: 'var(--border)' }
          }
        >
          {category?.icon || '📦'}
          <span className="absolute -bottom-1.5 -right-1.5 w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
            <Layers className="w-2.5 h-2.5" />
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="font-medium truncate text-sm font-sans text-foreground">{label}</h4>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5 font-mono">
            {when ? format(new Date(when), 'MMM d • HH:mm') : ''} • {members.length} combined
          </p>
          {note && (
            <p className="text-xs text-muted-foreground/60 mt-0.5 truncate">{note}</p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span
            className={cn(
              'font-mono font-medium text-sm',
              isCredit ? 'text-primary' : 'text-foreground'
            )}
          >
            {isCredit ? '+' : ''}
            <span className="text-muted-foreground mr-0.5">₹</span>
            {formatINR(net).replace('₹', '')}
          </span>
          <ChevronDown
            className={cn(
              'w-4 h-4 text-muted-foreground/40 transition-transform duration-200',
              expanded && 'rotate-180'
            )}
          />
        </div>
      </button>

      {/* Member legs */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden bg-muted/20"
          >
            <div className="pl-6 border-l-2 border-primary/30 ml-5">
              {members.map((m) => {
                const memberCredit = m.direction === 'credit';
                return (
                  <Link
                    key={m.id}
                    to={`/transactions/${m.id}`}
                    className="flex items-center gap-3 py-2.5 pr-3 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">{m.merchant || 'Unknown'}</p>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5 font-mono">
                        {format(new Date(m.transacted_at), 'MMM d • HH:mm')}
                        {m.bank_name ? ` • ${m.bank_name}` : ''}
                        {m.account_last4 ? ` ••${m.account_last4}` : ''}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'font-mono font-medium text-sm',
                        memberCredit ? 'text-primary' : 'text-foreground'
                      )}
                    >
                      {memberCredit ? '+' : ''}
                      <span className="text-muted-foreground mr-0.5">₹</span>
                      {formatINR(Number(m.amount)).replace('₹', '')}
                    </span>
                  </Link>
                );
              })}

              {onUngroup && (
                <div className="py-2 pr-3">
                  <button
                    type="button"
                    onClick={onUngroup}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Ungroup className="w-3.5 h-3.5" />
                    Ungroup
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
