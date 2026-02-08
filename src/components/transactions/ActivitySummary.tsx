import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight, Pencil, Check, X } from 'lucide-react';
import { BudgetCircle } from './BudgetCircle';
import { TransactionWithCategory } from '@/types/database';
import { formatINR } from '@/lib/formatCurrency';
import { useProfile, useUpdateBudget } from '@/hooks/useProfile';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface ActivitySummaryProps {
  transactions: TransactionWithCategory[];
  dateRange: { startDate?: Date; endDate?: Date };
  isLoading?: boolean;
}

export function ActivitySummary({ transactions, dateRange, isLoading }: ActivitySummaryProps) {
  const { data: profile } = useProfile();
  const updateBudget = useUpdateBudget();
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');

  const stats = useMemo(() => {
    const expenses = transactions
      .filter(t => t.direction === 'debit' && !t.is_excluded)
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const income = transactions
      .filter(t => t.direction === 'credit')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    return { expenses, income, net: income - expenses };
  }, [transactions]);

  const budget = profile?.monthly_budget ?? 0;

  const handleStartEdit = () => {
    setBudgetInput(budget > 0 ? String(budget) : '');
    setEditingBudget(true);
  };

  const handleSaveBudget = () => {
    const val = parseFloat(budgetInput);
    if (isNaN(val) || val < 0) {
      toast.error('Enter a valid budget amount');
      return;
    }
    updateBudget.mutate(val, {
      onSuccess: () => {
        setEditingBudget(false);
        toast.success('Budget updated');
      },
    });
  };

  const handleCancelEdit = () => {
    setEditingBudget(false);
  };

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-5 mb-5"
      >
        <div className="h-56 bg-muted/20 rounded-xl animate-pulse mx-auto w-56" />
        <div className="grid grid-cols-2 gap-3 mt-4">
          {[1, 2].map(i => (
            <div key={i} className="h-16 bg-muted/20 rounded-xl animate-pulse" />
          ))}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="glass-card p-5 mb-5"
    >
      {/* Budget Circle */}
      <BudgetCircle spent={stats.expenses} budget={budget} />

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-px mt-5">
        {/* Income */}
        <div className="text-center py-3 border-r border-border/30">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <ArrowDownRight className="w-3.5 h-3.5 text-success" />
            <span className="text-2xs text-muted-foreground uppercase tracking-wider font-medium">
              Income
            </span>
          </div>
          <p className="text-sm font-bold text-foreground currency-display">
            {formatINR(stats.income)}
          </p>
        </div>

        {/* Safe to Spend */}
        <div className="text-center py-3 border-r border-border/30">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <span className="text-2xs text-muted-foreground uppercase tracking-wider font-medium">
              Safe to Spend
            </span>
          </div>
          {budget > 0 ? (
            <p className={`text-sm font-bold currency-display ${(budget - stats.expenses) >= 0 ? 'text-success' : 'text-destructive'}`}>
              {formatINR(Math.max(budget - stats.expenses, 0))}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Set budget</p>
          )}
        </div>

        {/* Budget */}
        <div className="text-center py-3">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <span className="text-2xs text-muted-foreground uppercase tracking-wider font-medium">
              Budget
            </span>
            {!editingBudget && (
              <button
                onClick={handleStartEdit}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <Pencil className="w-3 h-3" />
              </button>
            )}
          </div>

          {editingBudget ? (
            <div className="flex items-center justify-center gap-1.5">
              <span className="text-xs text-muted-foreground">₹</span>
              <Input
                type="number"
                value={budgetInput}
                onChange={e => setBudgetInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSaveBudget();
                  if (e.key === 'Escape') handleCancelEdit();
                }}
                className="w-20 h-7 text-xs text-center bg-muted/30 border-border/50 rounded-lg"
                autoFocus
                placeholder="25000"
              />
              <button
                onClick={handleSaveBudget}
                className="text-success hover:text-success/80 transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleCancelEdit}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <p
              className="text-sm font-bold text-foreground currency-display cursor-pointer hover:text-primary transition-colors"
              onClick={handleStartEdit}
            >
              {budget > 0 ? formatINR(budget) : 'Set budget'}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
