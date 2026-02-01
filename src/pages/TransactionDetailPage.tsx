import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Edit2, Check, X, MessageSquare, EyeOff, Eye, Pencil, TrendingUp, TrendingDown } from 'lucide-react';
import { format } from 'date-fns';
import { useTransaction, useUpdateTransaction } from '@/hooks/useTransactions';
import { formatINR } from '@/lib/formatCurrency';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { CategoryBadge } from '@/components/ui/CategoryBadge';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { EditTransactionDialog } from '@/components/transactions/EditTransactionDialog';

export default function TransactionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const { data: transaction, isLoading } = useTransaction(id!);
  const updateMutation = useUpdateTransaction();

  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-5 safe-area-top">
        <Skeleton className="h-8 w-32 mb-8" />
        <Skeleton className="h-48 rounded-2xl mb-4" />
        <Skeleton className="h-24 rounded-2xl mb-4" />
        <Skeleton className="h-24 rounded-2xl" />
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
      {/* Background gradient */}
      <div 
        className="fixed inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 80% 50% at 50% -20%, hsl(252 87% 64% / 0.08), transparent)',
        }}
      />
      
      {/* Header */}
      <div className="sticky top-0 z-10 nav-pill mx-4 mt-4 safe-area-top">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate(-1)}
              className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </button>
            <h1 className="text-base font-semibold text-foreground">Transaction Details</h1>
          </div>
          <button 
            onClick={() => setEditDialogOpen(true)}
            className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors"
          >
            <Pencil className="w-4 h-4 text-primary" />
          </button>
        </div>
      </div>

      <div className="px-5 py-6 space-y-4 relative">
        {/* Main Card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="glass-elevated p-6"
        >
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3">
              <CategoryBadge category={transaction.categories} size="lg" />
              {/* Debit/Credit Indicator */}
              <div className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold",
                isCredit 
                  ? "bg-success/15 text-success" 
                  : "bg-destructive/15 text-destructive"
              )}>
                {isCredit ? (
                  <TrendingUp className="w-3.5 h-3.5" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5" />
                )}
                {isCredit ? 'Credit' : 'Debit'}
              </div>
            </div>
            {transaction.is_excluded && (
              <span className="text-2xs bg-muted/50 px-2.5 py-1 rounded-full text-muted-foreground font-medium uppercase tracking-wide">
                Excluded
              </span>
            )}
          </div>

          <h2 className="text-xl font-bold text-foreground mb-2">
            {transaction.merchant || 'Unknown Merchant'}
          </h2>
          
          <p className={cn(
            'text-display currency-display',
            isCredit ? 'text-success' : 'text-foreground'
          )}>
            {isCredit ? '+' : '−'}
            <span className="text-[0.6em] opacity-70 mr-1">₹</span>
            {formatINR(Number(transaction.amount)).replace('₹', '')}
          </p>

          <div className="mt-6 space-y-3 text-sm">
            <div className="flex justify-between items-center p-3 rounded-xl bg-muted/30">
              <span className="text-muted-foreground">Date</span>
              <span className="text-foreground font-medium">
                {format(new Date(transaction.transacted_at), 'PPP p')}
              </span>
            </div>
            {transaction.payment_method && (
              <div className="flex justify-between items-center p-3 rounded-xl bg-muted/30">
                <span className="text-muted-foreground">Payment Method</span>
                <span className="text-foreground font-medium">{transaction.payment_method}</span>
              </div>
            )}
            {transaction.account_last4 && (
              <div className="flex justify-between items-center p-3 rounded-xl bg-muted/30">
                <span className="text-muted-foreground">Account</span>
                <span className="text-foreground font-medium">••••{transaction.account_last4}</span>
              </div>
            )}
            {transaction.bank_name && (
              <div className="flex justify-between items-center p-3 rounded-xl bg-muted/30">
                <span className="text-muted-foreground">Bank</span>
                <span className="text-foreground font-medium">{transaction.bank_name}</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Category */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="glass-card p-5"
        >
          <span className="text-sm font-semibold text-foreground mb-3 block">Category</span>
          <CategoryBadge category={transaction.categories} showLabel />
        </motion.div>

        {/* Notes */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="glass-card p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center">
                <MessageSquare className="w-4 h-4 text-muted-foreground" />
              </div>
              <span className="text-sm font-semibold text-foreground">Notes</span>
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
              className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors text-primary"
            >
              {editingNotes ? <Check className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
            </button>
          </div>

          {editingNotes ? (
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes..."
              className="bg-muted/30 border-border/50 min-h-[100px] rounded-xl text-sm"
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              {transaction.notes || 'No notes added'}
            </p>
          )}
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <Button
            variant="outline"
            className="w-full justify-start gap-3 h-12 rounded-xl border-border/50 hover:bg-muted/50"
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
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="glass-card p-5"
          >
            <p className="text-sm font-semibold text-foreground mb-3">Original SMS</p>
            <p className="text-xs text-muted-foreground font-mono whitespace-pre-wrap break-all p-3 bg-muted/30 rounded-xl">
              {transaction.raw_sms}
            </p>
          </motion.div>
        )}
      </div>

      {/* Edit Dialog */}
      <EditTransactionDialog
        transaction={transaction}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />
    </div>
  );
}
