import { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Edit2, Check, MessageSquare, EyeOff, Eye, TrendingUp, TrendingDown, ChevronRight, Folder, MoreVertical, RefreshCw, Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useTransaction, useUpdateTransaction } from '@/hooks/useTransactions';
import { useTransactionGroups } from '@/hooks/useTransactionGroups';
import { useRefundTransactions } from '@/hooks/useRefundLinks';
import { formatINR } from '@/lib/formatCurrency';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { EditTransactionDialog } from '@/components/transactions/EditTransactionDialog';
import { DeleteTransactionDialog } from '@/components/transactions/DeleteTransactionDialog';
import { LinkRefundDialog } from '@/components/transactions/LinkRefundDialog';
import { InlineEditableField } from '@/components/transactions/InlineEditableField';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function TransactionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const { data: transaction, isLoading } = useTransaction(id!);
  const { data: groups = [] } = useTransactionGroups();
  const { data: linkedRefunds = [] } = useRefundTransactions(id!);
  const updateMutation = useUpdateTransaction();

  const transactionGroup = groups.find(g => g.id === (transaction as any)?.group_id);

  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [linkRefundOpen, setLinkRefundOpen] = useState(false);

  // Calculate net amount after refunds
  const totalRefunded = useMemo(() => 
    linkedRefunds.reduce((sum, r) => sum + Number(r.amount), 0),
    [linkedRefunds]
  );
  
  const netAmount = transaction ? Number(transaction.amount) - totalRefunded : 0;

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

  const handleUpdateField = async (field: string, value: string) => {
    try {
      const updates: Record<string, any> = {};
      if (field === 'amount') {
        const parsedAmount = parseFloat(value);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
          throw new Error('Invalid amount');
        }
        updates.amount = parsedAmount;
      } else if (field === 'merchant') {
        updates.merchant = value.trim() || null;
      }
      
      await updateMutation.mutateAsync({
        id: transaction.id,
        updates,
      });
      toast({ title: 'Updated' });
    } catch {
      toast({ title: 'Failed to update', variant: 'destructive' });
      throw new Error('Failed');
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
            <h1 className={cn(
              "text-base font-semibold",
              isCredit ? "text-success" : "text-foreground"
            )}>
              {isCredit ? 'Credit Transaction' : 'Debit Transaction'}
            </h1>
          </div>
          
          {/* Hamburger Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors">
                <MoreVertical className="w-5 h-5 text-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 glass-elevated border-border/50">
              <DropdownMenuItem onClick={() => setLinkRefundOpen(true)} className="gap-2">
                <RefreshCw className="w-4 h-4" />
                Link Refund
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setEditDialogOpen(true)} className="gap-2">
                <Pencil className="w-4 h-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDeleteDialogOpen(true)} className="gap-2 text-destructive focus:text-destructive">
                <Trash2 className="w-4 h-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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

          {/* Merchant - inline editable */}
          <InlineEditableField
            value={transaction.merchant || 'Unknown Merchant'}
            onSave={(value) => handleUpdateField('merchant', value)}
            className="text-xl font-bold text-foreground mb-2 block"
          />
          
          {/* Amount with category emoji - inline editable */}
          <div className="flex items-center gap-3">
            {transaction.categories && (
              <div
                className="w-12 h-12 flex items-center justify-center rounded-xl text-xl"
                style={{
                  backgroundColor: `${transaction.categories.color}18`,
                  boxShadow: `0 0 0 1px ${transaction.categories.color}20 inset`,
                }}
              >
                {transaction.categories.icon}
              </div>
            )}
            <div className={cn(
              'text-display currency-display',
              isCredit ? 'text-success' : 'text-foreground'
            )}>
              {isCredit ? '+' : '−'}
              <span className="text-[0.6em] opacity-70 mr-1">₹</span>
              <InlineEditableField
                value={transaction.amount.toString()}
                onSave={(value) => handleUpdateField('amount', value)}
                type="number"
                className="inline"
                inputClassName="w-32 text-2xl font-bold"
                formatDisplay={(val) => formatINR(Number(val)).replace('₹', '')}
              />
            </div>
          </div>

          {/* Refund indicator */}
          {linkedRefunds.length > 0 && (
            <div className="mt-4 p-3 rounded-xl bg-success/10 border border-success/20">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Refunded</span>
                <span className="font-medium text-success">
                  ₹{formatINR(totalRefunded).replace('₹', '')}
                </span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-sm font-medium">Net Contribution</span>
                <span className={cn(
                  "font-bold",
                  netAmount === 0 ? "text-muted-foreground line-through" : "text-foreground"
                )}>
                  {netAmount === 0 ? '₹0' : `₹${formatINR(netAmount).replace('₹', '')}`}
                </span>
              </div>
            </div>
          )}

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

        {/* Category - clickable to filter */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          {transaction.categories ? (
            <Link 
              to={`/transactions?category=${transaction.category_id}`}
              className="glass-card p-5 flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 flex items-center justify-center rounded-xl text-base"
                  style={{
                    backgroundColor: `${transaction.categories.color}18`,
                    boxShadow: `0 0 0 1px ${transaction.categories.color}20 inset`,
                  }}
                >
                  {transaction.categories.icon}
                </div>
                <div>
                  <span className="text-sm font-semibold text-foreground block">Category</span>
                  <span className="text-sm text-muted-foreground">{transaction.categories.name}</span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
            </Link>
          ) : (
            <div className="glass-card p-5">
              <span className="text-sm font-semibold text-foreground mb-1 block">Category</span>
              <p className="text-sm text-muted-foreground">No category</p>
            </div>
          )}
        </motion.div>

        {/* Merchant - clickable to filter */}
        {transaction.merchant && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <Link 
              to={`/transactions?merchant=${encodeURIComponent(transaction.merchant)}`}
              className="glass-card p-5 flex items-center justify-between group"
            >
              <div>
                <span className="text-sm font-semibold text-foreground mb-1 block">Merchant</span>
                <p className="text-sm text-muted-foreground">{transaction.merchant}</p>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground group-hover:text-foreground transition-colors">
                <span className="text-xs">View all</span>
                <ChevronRight className="w-5 h-5" />
              </div>
            </Link>
          </motion.div>
        )}

        {/* Group */}
        {transactionGroup && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.13, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <Link 
              to={`/transactions?group=${transactionGroup.id}`}
              className="glass-card p-5 flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                  style={{ backgroundColor: transactionGroup.color + '20' }}
                >
                  {transactionGroup.icon}
                </div>
                <div>
                  <span className="text-sm font-semibold text-foreground block">{transactionGroup.name}</span>
                  {transactionGroup.description && (
                    <p className="text-xs text-muted-foreground">{transactionGroup.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground group-hover:text-foreground transition-colors">
                <Folder className="w-4 h-4" />
                <ChevronRight className="w-5 h-5" />
              </div>
            </Link>
          </motion.div>
        )}

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

        {/* Actions - Only Exclude toggle now, others moved to hamburger */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <button
            onClick={toggleExcluded}
            className="w-full flex items-center justify-start gap-3 h-12 px-4 rounded-xl border border-border/50 hover:bg-muted/50 transition-colors"
          >
            {transaction.is_excluded ? (
              <>
                <Eye className="w-4 h-4" />
                <span className="text-sm">Include in Analytics</span>
              </>
            ) : (
              <>
                <EyeOff className="w-4 h-4" />
                <span className="text-sm">Exclude from Analytics</span>
              </>
            )}
          </button>
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

      {/* Delete Dialog */}
      <DeleteTransactionDialog
        transactionId={transaction.id}
        merchantName={transaction.merchant || undefined}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
      />

      {/* Link Refund Dialog */}
      <LinkRefundDialog
        open={linkRefundOpen}
        onOpenChange={setLinkRefundOpen}
        transactionId={transaction.id}
        transactionAmount={Number(transaction.amount)}
      />
    </div>
  );
}
