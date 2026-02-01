import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Edit2, Check, X, MessageSquare, EyeOff, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { useTransaction, useUpdateTransaction } from '@/hooks/useTransactions';
import { useCategories } from '@/hooks/useCategories';
import { formatINR } from '@/lib/formatCurrency';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { CategoryBadge } from '@/components/ui/CategoryBadge';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

export default function TransactionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const { data: transaction, isLoading } = useTransaction(id!);
  const { data: categories = [] } = useCategories();
  const updateMutation = useUpdateTransaction();

  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const [editingCategory, setEditingCategory] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 safe-area-top">
        <Skeleton className="h-8 w-32 mb-6" />
        <Skeleton className="h-40 rounded-2xl mb-4" />
        <Skeleton className="h-20 rounded-xl mb-4" />
        <Skeleton className="h-20 rounded-xl" />
      </div>
    );
  }

  if (!transaction) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Transaction not found</p>
      </div>
    );
  }

  const isCredit = transaction.direction === 'credit';

  const handleCategoryChange = async (categoryId: string) => {
    try {
      await updateMutation.mutateAsync({
        id: transaction.id,
        updates: { category_id: categoryId === 'none' ? null : categoryId },
      });
      setEditingCategory(false);
      toast({ title: 'Category updated' });
    } catch {
      toast({ title: 'Failed to update category', variant: 'destructive' });
    }
  };

  const handleNotesSubmit = async () => {
    try {
      await updateMutation.mutateAsync({
        id: transaction.id,
        updates: { notes },
      });
      setEditingNotes(false);
      toast({ title: 'Notes saved' });
    } catch {
      toast({ title: 'Failed to save notes', variant: 'destructive' });
    }
  };

  const toggleExcluded = async () => {
    try {
      await updateMutation.mutateAsync({
        id: transaction.id,
        updates: { is_excluded: !transaction.is_excluded },
      });
      toast({ 
        title: transaction.is_excluded ? 'Included in analytics' : 'Excluded from analytics' 
      });
    } catch {
      toast({ title: 'Failed to update', variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 glass border-b border-border/50 safe-area-top">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate(-1)}>
            <ArrowLeft className="w-6 h-6 text-foreground" />
          </button>
          <h1 className="text-lg font-semibold text-foreground">Transaction Details</h1>
        </div>
      </div>

      <div className="px-4 py-6 space-y-4">
        {/* Main Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-card p-6"
        >
          <div className="flex items-start justify-between mb-4">
            <CategoryBadge category={transaction.categories} size="lg" />
            {transaction.is_excluded && (
              <span className="text-xs bg-muted px-2 py-1 rounded-full text-muted-foreground">
                Excluded
              </span>
            )}
          </div>

          <h2 className="text-xl font-bold text-foreground mb-1">
            {transaction.merchant || 'Unknown Merchant'}
          </h2>
          
          <p className={cn(
            'text-3xl font-bold',
            isCredit ? 'text-success' : 'text-foreground'
          )}>
            {isCredit ? '+' : '-'}{formatINR(Number(transaction.amount))}
          </p>

          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Date</span>
              <span className="text-foreground">
                {format(new Date(transaction.transacted_at), 'PPP p')}
              </span>
            </div>
            {transaction.payment_method && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payment Method</span>
                <span className="text-foreground">{transaction.payment_method}</span>
              </div>
            )}
            {transaction.account_last4 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Account</span>
                <span className="text-foreground">••••{transaction.account_last4}</span>
              </div>
            )}
            {transaction.bank_name && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bank</span>
                <span className="text-foreground">{transaction.bank_name}</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Category */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl bg-card p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-foreground">Category</span>
            <button
              onClick={() => setEditingCategory(!editingCategory)}
              className="text-primary text-sm"
            >
              {editingCategory ? <X className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
            </button>
          </div>

          {editingCategory ? (
            <Select
              value={transaction.category_id || 'none'}
              onValueChange={handleCategoryChange}
            >
              <SelectTrigger className="bg-muted">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No category</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.icon} {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <CategoryBadge category={transaction.categories} showLabel />
          )}
        </motion.div>

        {/* Notes */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-xl bg-card p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Notes</span>
            </div>
            <button
              onClick={() => {
                if (editingNotes) {
                  handleNotesSubmit();
                } else {
                  setNotes(transaction.notes || '');
                  setEditingNotes(true);
                }
              }}
              className="text-primary text-sm"
            >
              {editingNotes ? <Check className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
            </button>
          </div>

          {editingNotes ? (
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes..."
              className="bg-muted min-h-[80px]"
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              {transaction.notes || 'No notes added'}
            </p>
          )}
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Button
            variant="outline"
            className="w-full justify-start gap-3"
            onClick={toggleExcluded}
          >
            {transaction.is_excluded ? (
              <>
                <Eye className="w-4 h-4" />
                Include in Analytics
              </>
            ) : (
              <>
                <EyeOff className="w-4 h-4" />
                Exclude from Analytics
              </>
            )}
          </Button>
        </motion.div>

        {/* Raw SMS */}
        {transaction.raw_sms && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="rounded-xl bg-card p-4"
          >
            <p className="text-sm font-medium text-foreground mb-2">Original SMS</p>
            <p className="text-xs text-muted-foreground font-mono whitespace-pre-wrap break-all">
              {transaction.raw_sms}
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
