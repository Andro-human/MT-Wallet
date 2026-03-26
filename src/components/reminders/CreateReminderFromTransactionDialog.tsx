import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Transaction, ReminderType, RecurrenceInterval } from '@/types/database';
import { Banknote, Calendar, RefreshCw } from 'lucide-react';
import { format, addMonths } from 'date-fns';
import { cn } from '@/lib/utils';

interface CreateReminderFromTransactionDialogProps {
  transaction: Transaction;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ReminderFormData {
  title: string;
  amount: string;
  type: ReminderType;
  due_date: string;
  is_recurring: boolean;
  recurrence_interval: RecurrenceInterval;
}

export function CreateReminderFromTransactionDialog({
  transaction,
  open,
  onOpenChange,
}: CreateReminderFromTransactionDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Parse transaction amount, typically taking absolute value
  const initialAmount = Math.abs(transaction.amount).toString();
  // Suggest a due date 1 month from the transaction date
  const suggestedDate = addMonths(new Date(transaction.transacted_at), 1);
  const initialDateStr = format(suggestedDate, 'yyyy-MM-dd');

  const { register, handleSubmit, watch, setValue, formState: { errors }, reset } = useForm<ReminderFormData>({
    defaultValues: {
      title: transaction.merchant || 'Unknown Merchant',
      amount: initialAmount,
      type: 'subscription',
      due_date: initialDateStr,
      is_recurring: true,
      recurrence_interval: 'monthly',
    }
  });

  const isRecurring = watch('is_recurring');
  const typeValue = watch('type');

  // Reset form when opened with a new transaction
  useEffect(() => {
    if (open) {
      reset({
        title: transaction.merchant || 'Unknown Merchant',
        amount: Math.abs(transaction.amount).toString(),
        type: 'subscription',
        due_date: format(addMonths(new Date(transaction.transacted_at), 1), 'yyyy-MM-dd'),
        is_recurring: true,
        recurrence_interval: 'monthly',
      });
    }
  }, [open, transaction, reset]);

  const onSubmit = async (data: ReminderFormData) => {
    if (!user) return;
    setIsSubmitting(true);

    try {
      const amountNum = parseFloat(data.amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        throw new Error("Invalid amount");
      }

      // Convert local YYYY-MM-DD input to full ISO string considering local timezone
      const localDate = new Date(data.due_date);
      // add time to avoid timezone shifts jumping a day backward
      localDate.setHours(12, 0, 0, 0); 
      const dueDateIso = localDate.toISOString();

      const { error } = await supabase
        .from('reminders')
        .insert({
          user_id: user.id,
          title: data.title,
          amount: amountNum,
          currency: 'INR',
          type: data.type,
          due_date: dueDateIso,
          is_recurring: data.is_recurring,
          recurrence_interval: data.is_recurring ? data.recurrence_interval : null,
          is_completed: false,
        } as any);

      if (error) throw error;

      toast({
        title: "Reminder Created",
        description: `Successfully scheduled reminder for ${data.title}.`,
      });
      
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      onOpenChange(false);
      
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create reminder",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-[425px] max-h-[90vh] overflow-y-auto rounded-lg">
        <DialogHeader>
          <DialogTitle>Create Reminder</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" {...register('title', { required: true })} placeholder="e.g. Netflix Subscription" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (₹)</Label>
              <div className="relative">
                <Banknote className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="amount" 
                  type="number" 
                  step="0.01" 
                  className="pl-9" 
                  {...register('amount', { required: true, min: 0 })} 
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="due_date">Due Date</Label>
              <Input 
                id="due_date" 
                type="date" 
                {...register('due_date', { required: true })} 
                className={cn("w-full text-foreground", errors.due_date && "border-red-500")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={typeValue} onValueChange={(val: ReminderType) => setValue('type', val)}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="subscription">Subscription</SelectItem>
                <SelectItem value="emi">EMI / Loan Payment</SelectItem>
                <SelectItem value="lent">Money Lent</SelectItem>
                <SelectItem value="borrowed">Money Borrowed</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input 
              type="checkbox" 
              id="is_recurring" 
              className="rounded border-input text-primary"
              {...register('is_recurring')}
            />
            <Label htmlFor="is_recurring" className="font-normal cursor-pointer flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
              Make this a recurring reminder
            </Label>
          </div>

          {isRecurring && (
            <div className="space-y-2 pt-2 animate-in fade-in slide-in-from-top-2 duration-200">
              <Label>Recurrence Interval</Label>
              <Select 
                value={watch('recurrence_interval')} 
                onValueChange={(val: RecurrenceInterval) => setValue('recurrence_interval', val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select interval" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Reminder'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
