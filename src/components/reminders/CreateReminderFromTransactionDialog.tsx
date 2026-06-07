import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Transaction, ReminderType, RecurrenceUnit } from '@/types/database';
import { Banknote, RefreshCw, CalendarIcon } from 'lucide-react';
import { format, addMonths } from 'date-fns';
import { cn } from '@/lib/utils';

interface CreateReminderFromTransactionDialogProps {
  transaction: Transaction;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ReminderFormData {
  title: string;
  merchant: string;
  amount: string;
  type: ReminderType;
  custom_type_label: string;
  due_date: string;
  is_recurring: boolean;
  recurrence_preset: string;
  recurrence_value: number;
  recurrence_unit: RecurrenceUnit;
}

const RECURRENCE_PRESETS: Record<string, { value: number; unit: RecurrenceUnit; label: string }> = {
  weekly:  { value: 1, unit: 'week',  label: 'Weekly' },
  monthly: { value: 1, unit: 'month', label: 'Monthly' },
};

export function CreateReminderFromTransactionDialog({
  transaction,
  open,
  onOpenChange,
}: CreateReminderFromTransactionDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const initialAmount = Math.abs(transaction.amount).toString();
  const suggestedDate = addMonths(new Date(transaction.transacted_at), 1);
  const initialDateStr = format(suggestedDate, 'yyyy-MM-dd');

  const { register, handleSubmit, watch, setValue, formState: { errors }, reset } = useForm<ReminderFormData>({
    defaultValues: {
      title: transaction.merchant || 'Unknown Merchant',
      merchant: transaction.merchant || '',
      amount: initialAmount,
      type: 'subscription',
      custom_type_label: '',
      due_date: initialDateStr,
      is_recurring: true,
      recurrence_preset: 'monthly',
      recurrence_value: 1,
      recurrence_unit: 'month',
    }
  });

  const typeValue = watch('type');
  const typeAllowsRecurring = (['subscription', 'emi', 'custom'] as ReminderType[]).includes(typeValue);
  const isRecurring = watch('is_recurring') && typeAllowsRecurring;
  const recurrencePreset = watch('recurrence_preset');
  const isCustomRecurrence = recurrencePreset === 'custom';
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  useEffect(() => {
    if (open) {
      reset({
        title: transaction.merchant || 'Unknown Merchant',
        merchant: transaction.merchant || '',
        amount: Math.abs(transaction.amount).toString(),
        type: 'subscription',
        custom_type_label: '',
        due_date: format(addMonths(new Date(transaction.transacted_at), 1), 'yyyy-MM-dd'),
        is_recurring: true,
        recurrence_preset: 'monthly',
        recurrence_value: 1,
        recurrence_unit: 'month',
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

      const localDate = new Date(data.due_date);
      localDate.setHours(12, 0, 0, 0);
      const dueDateIso = localDate.toISOString();

      const allowRecurring = (['subscription', 'emi', 'custom'] as ReminderType[]).includes(data.type);
      const effectiveRecurring = allowRecurring && data.is_recurring;

      let recurrenceValue: number | null = null;
      let recurrenceUnit: RecurrenceUnit | null = null;
      if (effectiveRecurring) {
        if (data.recurrence_preset === 'custom') {
          const v = Number(data.recurrence_value);
          if (!Number.isFinite(v) || v < 1) throw new Error('Custom recurrence value must be a positive number');
          recurrenceValue = Math.floor(v);
          recurrenceUnit = data.recurrence_unit;
        } else {
          const preset = RECURRENCE_PRESETS[data.recurrence_preset];
          if (!preset) throw new Error('Invalid recurrence preset');
          recurrenceValue = preset.value;
          recurrenceUnit = preset.unit;
        }
      }

      const trimmedMerchant = (data.merchant || '').trim();
      const trimmedCustomLabel = (data.custom_type_label || '').trim();
      const customTypeLabel = data.type === 'custom' && trimmedCustomLabel
        ? trimmedCustomLabel
        : null;

      const { error } = await supabase
        .from('reminders')
        .insert({
          user_id: user.id,
          title: data.title,
          merchant: trimmedMerchant || null,
          amount: amountNum,
          currency: 'INR',
          type: data.type,
          custom_type_label: customTypeLabel,
          due_date: dueDateIso,
          is_recurring: effectiveRecurring,
          recurrence_value: recurrenceValue,
          recurrence_unit: recurrenceUnit,
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
            <Input id="title" {...register('title', { required: true })} placeholder="e.g. Ketchup" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="merchant">Merchant</Label>
            <Input
              id="merchant"
              {...register('merchant')}
              placeholder="e.g. Amazon"
            />
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
                  className={cn("pl-9 no-spinner", errors.amount && "border-red-500")}
                  {...register('amount', { required: true, min: 0 })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Due Date</Label>
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal bg-muted/30 border-border/50 rounded-xl"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(new Date(watch('due_date')), 'MMM d, yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 glass-card border-border/50" align="start">
                  <Calendar
                    mode="single"
                    selected={new Date(watch('due_date'))}
                    onSelect={(d) => {
                      if (d) {
                        setValue('due_date', format(d, 'yyyy-MM-dd'));
                        setDatePickerOpen(false);
                      }
                    }}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
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
            {typeValue === 'custom' && (
              <Input
                placeholder="Name this type (e.g. Membership, Donation)"
                {...register('custom_type_label')}
              />
            )}
          </div>

          {typeAllowsRecurring && (
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
          )}

          {isRecurring && (
            <div className="space-y-2 pt-2 animate-in fade-in slide-in-from-top-2 duration-200">
              <Label>Interval</Label>
              <Select
                value={recurrencePreset}
                onValueChange={(v: string) => setValue('recurrence_preset', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select interval" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(RECURRENCE_PRESETS).map(([key, preset]) => (
                    <SelectItem key={key} value={key}>{preset.label}</SelectItem>
                  ))}
                  <SelectItem value="custom">Custom…</SelectItem>
                </SelectContent>
              </Select>

              {isCustomRecurrence && (
                <div className="grid grid-cols-[1fr_2fr] gap-2 pt-1">
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    className="no-spinner"
                    {...register('recurrence_value', { valueAsNumber: true, min: 1 })}
                    placeholder="e.g. 10"
                  />
                  <Select
                    value={watch('recurrence_unit')}
                    onValueChange={(v: RecurrenceUnit) => setValue('recurrence_unit', v)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="day">Days</SelectItem>
                      <SelectItem value="week">Weeks</SelectItem>
                      <SelectItem value="month">Months</SelectItem>
                      <SelectItem value="year">Years</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
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
