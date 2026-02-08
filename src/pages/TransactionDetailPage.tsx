import { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Edit2, Check, MessageSquare, TrendingUp, TrendingDown, ChevronRight, Folder, MoreVertical, RefreshCw, Pencil, Trash2, Wallet, Banknote } from 'lucide-react';
import { format } from 'date-fns';
import { useTransaction, useUpdateTransaction } from '@/hooks/useTransactions';
import { useTransactionGroups } from '@/hooks/useTransactionGroups';
import { useCategories } from '@/hooks/useCategories';
import { useRefundTransactions } from '@/hooks/useRefundLinks';
import { usePaymentMethods } from '@/hooks/usePaymentMethods';
import { useBankAccounts, parseBankAccount } from '@/hooks/useBankAccounts';
import { formatINR } from '@/lib/formatCurrency';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { EditTransactionDialog } from '@/components/transactions/EditTransactionDialog';
import { DeleteTransactionDialog } from '@/components/transactions/DeleteTransactionDialog';
import { LinkRefundDialog } from '@/components/transactions/LinkRefundDialog';
import { InlineEditableField } from '@/components/transactions/InlineEditableField';
import { InlineSelectField } from '@/components/transactions/InlineSelectField';
import { InlineDateField } from '@/components/transactions/InlineDateField';
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
  const { data: categories = [] } = useCategories();
  const { data: linkedRefunds = [] } = useRefundTransactions(id!);
  const { data: paymentMethods = [] } = usePaymentMethods();
  const { data: bankAccounts = [] } = useBankAccounts();
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

  // Get combined bank account display
  const bankAccountDisplay = useMemo(() => {
    if (!transaction) return '';
    if (transaction.bank_name && transaction.account_last4) {
      return `${transaction.bank_name} ••${transaction.account_last4}`;
    } else if (transaction.bank_name) {
      return transaction.bank_name;
    } else if (transaction.account_last4) {
      return `••${transaction.account_last4}`;
    }
    return '';
  }, [transaction]);

  // Prepare options for inline selects
  const categoryOptions = useMemo(() => [
    { value: 'none', label: 'No category' },
    ...categories.map(c => ({ value: c.id, label: c.name, icon: c.icon, color: c.color }))
  ], [categories]);

  const groupOptions = useMemo(() => [
    { value: 'none', label: 'No group' },
    ...groups.map(g => ({ value: g.id, label: g.name, icon: g.icon, color: g.color }))
  ], [groups]);

  const paymentMethodOptions = useMemo(() => [
    { value: '', label: 'None' },
    ...paymentMethods.map(pm => ({ value: pm, label: pm }))
  ], [paymentMethods]);

  const bankAccountOptions = useMemo(() => [
    { value: '', label: 'None' },
    ...bankAccounts.map(ba => ({ value: ba.display, label: ba.display }))
  ], [bankAccounts]);

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

  const toggleExpense = async () => {
    try {
      await updateMutation.mutateAsync({
        id: transaction.id,
        updates: { is_expense: !transaction.is_expense },
      });
      toast({ 
        title: transaction.is_expense ? 'Not counted as expense' : 'Counted as expense' 
      });
    } catch {
      toast({ title: 'Failed to update', variant: 'destructive' });
    }
  };

  const toggleIncome = async () => {
    try {
      await updateMutation.mutateAsync({
        id: transaction.id,
        updates: { is_income: !transaction.is_income },
      });
      toast({ 
        title: transaction.is_income ? 'Not counted as income' : 'Counted as income' 
      });
    } catch {
      toast({ title: 'Failed to update', variant: 'destructive' });
    }
  };

  const handleUpdateField = async (field: string, value: any) => {
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
      } else if (field === 'transacted_at') {
        updates.transacted_at = value.toISOString();
      } else if (field === 'category_id') {
        updates.category_id = value === 'none' ? null : value;
      } else if (field === 'group_id') {
        updates.group_id = value === 'none' ? null : value;
      } else if (field === 'payment_method') {
        updates.payment_method = value || null;
      } else if (field === 'bank_account') {
        const { bankName, accountLast4 } = parseBankAccount(value);
        updates.bank_name = bankName || null;
        updates.account_last4 = accountLast4 || null;
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
            
            {/* Hamburger Menu + Expense/Income badges - in top right of main content */}
            <div className="flex items-center gap-2">
              {isCredit && !transaction.is_income && (
                <span className="text-2xs bg-muted/50 px-2.5 py-1 rounded-full text-muted-foreground font-medium uppercase tracking-wide">
                  Not Income
                </span>
              )}
              {!isCredit && !transaction.is_expense && (
                <span className="text-2xs bg-muted/50 px-2.5 py-1 rounded-full text-muted-foreground font-medium uppercase tracking-wide">
                  Not Expense
                </span>
              )}
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
            {/* Date - inline editable */}
            <div className="flex justify-between items-center p-3 rounded-xl bg-muted/30">
              <span className="text-muted-foreground">Date</span>
              <InlineDateField
                value={new Date(transaction.transacted_at)}
                onSave={(date) => handleUpdateField('transacted_at', date)}
                className="text-foreground font-medium"
              />
            </div>
            
            {/* Payment Method - inline editable */}
            <div className="flex justify-between items-center p-3 rounded-xl bg-muted/30">
              <span className="text-muted-foreground">Payment Method</span>
              <InlineSelectField
                value={transaction.payment_method || ''}
                onSave={(value) => handleUpdateField('payment_method', value)}
                options={paymentMethodOptions}
                allowCustom
                emptyLabel="None"
                className="text-foreground font-medium"
              />
            </div>
            
            {/* Bank Account (combined) - inline editable */}
            <div className="flex justify-between items-center p-3 rounded-xl bg-muted/30">
              <span className="text-muted-foreground">Bank Account</span>
              <InlineSelectField
                value={bankAccountDisplay}
                onSave={(value) => handleUpdateField('bank_account', value)}
                options={bankAccountOptions}
                allowCustom
                emptyLabel="None"
                placeholder="e.g., HDFC ••1234"
                className="text-foreground font-medium"
              />
            </div>
          </div>
        </motion.div>

        {/* Category - inline editable */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="glass-card p-5"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {transaction.categories && (
                <div
                  className="w-10 h-10 flex items-center justify-center rounded-xl text-base"
                  style={{
                    backgroundColor: `${transaction.categories.color}18`,
                    boxShadow: `0 0 0 1px ${transaction.categories.color}20 inset`,
                  }}
                >
                  {transaction.categories.icon}
                </div>
              )}
              <div>
                <span className="text-sm font-semibold text-foreground block">Category</span>
                <InlineSelectField
                  value={transaction.category_id || 'none'}
                  displayValue={transaction.categories?.name}
                  onSave={(value) => handleUpdateField('category_id', value)}
                  options={categoryOptions}
                  emptyLabel="No category"
                  className="text-sm text-muted-foreground"
                />
              </div>
            </div>
            {transaction.category_id && (
              <Link to={`/transactions?category=${transaction.category_id}`}>
                <ChevronRight className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
              </Link>
            )}
          </div>
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

        {/* Group - inline editable */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.13, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="glass-card p-5"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {transactionGroup && (
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                  style={{ backgroundColor: transactionGroup.color + '20' }}
                >
                  {transactionGroup.icon}
                </div>
              )}
              <div>
                <span className="text-sm font-semibold text-foreground block">Group</span>
                <InlineSelectField
                  value={(transaction as any).group_id || 'none'}
                  displayValue={transactionGroup?.name}
                  onSave={(value) => handleUpdateField('group_id', value)}
                  options={groupOptions}
                  emptyLabel="No group"
                  className="text-sm text-muted-foreground"
                />
              </div>
            </div>
            {transactionGroup && (
              <Link to={`/transactions?group=${transactionGroup.id}`}>
                <div className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                  <Folder className="w-4 h-4" />
                  <ChevronRight className="w-5 h-5" />
                </div>
              </Link>
            )}
          </div>
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

        {/* Actions - Expense/Income toggles */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-2"
        >
          {/* Expense toggle - shown for debit transactions */}
          {!isCredit && (
            <button
              onClick={toggleExpense}
              className={cn(
                "w-full flex items-center justify-between gap-3 h-12 px-4 rounded-xl border transition-colors",
                transaction.is_expense
                  ? "border-destructive/30 bg-destructive/5 hover:bg-destructive/10"
                  : "border-border/50 hover:bg-muted/50"
              )}
            >
              <div className="flex items-center gap-3">
                <Wallet className="w-4 h-4" />
                <span className="text-sm">Count as Expense</span>
              </div>
              <div className={cn(
                "w-10 h-6 rounded-full relative transition-colors duration-200",
                transaction.is_expense ? "bg-destructive" : "bg-muted"
              )}>
                <div className={cn(
                  "absolute top-1 w-4 h-4 rounded-full bg-white transition-transform duration-200",
                  transaction.is_expense ? "translate-x-5" : "translate-x-1"
                )} />
              </div>
            </button>
          )}

          {/* Income toggle - shown for credit transactions */}
          {isCredit && (
            <button
              onClick={toggleIncome}
              className={cn(
                "w-full flex items-center justify-between gap-3 h-12 px-4 rounded-xl border transition-colors",
                transaction.is_income
                  ? "border-success/30 bg-success/5 hover:bg-success/10"
                  : "border-border/50 hover:bg-muted/50"
              )}
            >
              <div className="flex items-center gap-3">
                <Banknote className="w-4 h-4" />
                <span className="text-sm">Count as Income</span>
              </div>
              <div className={cn(
                "w-10 h-6 rounded-full relative transition-colors duration-200",
                transaction.is_income ? "bg-success" : "bg-muted"
              )}>
                <div className={cn(
                  "absolute top-1 w-4 h-4 rounded-full bg-white transition-transform duration-200",
                  transaction.is_income ? "translate-x-5" : "translate-x-1"
                )} />
              </div>
            </button>
          )}
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
