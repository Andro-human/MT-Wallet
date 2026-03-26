import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { Bell, Plus, Check, Clock, AlertTriangle, RefreshCw, Trash2, Pencil } from 'lucide-react';
import { format, isPast, isToday, differenceInDays } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { useReminders, useUpdateReminder } from '@/hooks/useReminders';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Reminder, ReminderType } from '@/types/database';


import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import type { RecurrenceInterval } from '@/types/database';

function formatINR(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

const typeLabels: Record<ReminderType, string> = {
  subscription: 'Subscription',
  emi: 'EMI',
  lent: 'Lent',
  borrowed: 'Borrowed',
  custom: 'Custom',
};

const typeColors: Record<ReminderType, string> = {
  subscription: 'bg-blue-500/10 text-blue-400',
  emi: 'bg-amber-500/10 text-amber-400',
  lent: 'bg-green-500/10 text-green-400',
  borrowed: 'bg-red-500/10 text-red-400',
  custom: 'bg-purple-500/10 text-purple-400',
};

function ReminderFormDialog({
  open,
  onOpenChange,
  editingReminder,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingReminder?: Reminder;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateReminder = useUpdateReminder();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEdit = !!editingReminder;

  const { register, handleSubmit, watch, setValue, reset } = useForm({
    defaultValues: {
      title: '',
      amount: '',
      type: 'subscription' as ReminderType,
      due_date: format(new Date(), 'yyyy-MM-dd'),
      is_recurring: true,
      recurrence_interval: 'monthly' as RecurrenceInterval,
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        title: editingReminder?.title || '',
        amount: editingReminder ? String(editingReminder.amount) : '',
        type: (editingReminder?.type || 'subscription') as ReminderType,
        due_date: editingReminder
          ? format(new Date(editingReminder.due_date), 'yyyy-MM-dd')
          : format(new Date(), 'yyyy-MM-dd'),
        is_recurring: editingReminder?.is_recurring ?? true,
        recurrence_interval: (editingReminder?.recurrence_interval || 'monthly') as RecurrenceInterval,
      });
    }
  }, [open, editingReminder, reset]);

  const isRecurring = watch('is_recurring');
  const typeValue = watch('type');

  const onSubmit = async (data: any) => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      const amountNum = parseFloat(data.amount);
      if (isNaN(amountNum) || amountNum <= 0) throw new Error('Invalid amount');

      const localDate = new Date(data.due_date);
      localDate.setHours(12, 0, 0, 0);

      if (isEdit) {
        updateReminder.mutate({
          id: editingReminder!.id,
          updates: {
            title: data.title,
            amount: amountNum,
            type: data.type,
            due_date: localDate.toISOString(),
            is_recurring: data.is_recurring,
            recurrence_interval: data.is_recurring ? data.recurrence_interval : null,
          },
        }, {
          onSuccess: () => {
            toast({ title: 'Reminder Updated' });
            onOpenChange(false);
          },
        });
      } else {
        const { error } = await supabase
          .from('reminders')
          .insert({
            user_id: user.id,
            title: data.title,
            amount: amountNum,
            currency: 'INR',
            type: data.type,
            due_date: localDate.toISOString(),
            is_recurring: data.is_recurring,
            recurrence_interval: data.is_recurring ? data.recurrence_interval : null,
            is_completed: false,
          } as any);

        if (error) throw error;

        toast({ title: 'Reminder Created', description: `Reminder for ${data.title} created.` });
        queryClient.invalidateQueries({ queryKey: ['reminders'] });
        reset();
        onOpenChange(false);
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || `Failed to ${isEdit ? 'update' : 'create'} reminder`, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-[425px] max-h-[90vh] overflow-y-auto rounded-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Reminder' : 'Add Reminder'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="r-title">Title</Label>
            <Input id="r-title" {...register('title', { required: true })} placeholder="e.g. Netflix" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="r-amount">Amount (₹)</Label>
              <Input id="r-amount" type="number" step="0.01" {...register('amount', { required: true })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="r-due">Due Date</Label>
              <Input
                id="r-due"
                type="date"
                {...register('due_date', { required: true })}
                className="w-full text-foreground"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={typeValue} onValueChange={(v: ReminderType) => setValue('type', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="subscription">Subscription</SelectItem>
                <SelectItem value="emi">EMI</SelectItem>
                <SelectItem value="lent">Lent</SelectItem>
                <SelectItem value="borrowed">Borrowed</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="r-recurring" className="rounded" {...register('is_recurring')} />
            <Label htmlFor="r-recurring" className="font-normal cursor-pointer flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" /> Recurring
            </Label>
          </div>
          {isRecurring && (
            <div className="space-y-2 animate-in fade-in">
              <Label>Interval</Label>
              <Select value={watch('recurrence_interval')} onValueChange={(v: RecurrenceInterval) => setValue('recurrence_interval', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex flex-col-reverse sm:flex-row gap-2 pt-4">
            <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto sm:flex-1">
              {isSubmitting ? (isEdit ? 'Saving...' : 'Creating...') : (isEdit ? 'Save' : 'Create')}
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto sm:flex-1">
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function RemindersPage() {
  const { data: reminders = [], isLoading } = useReminders();
  const updateReminder = useUpdateReminder();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | undefined>(undefined);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = searchParams.get('filter') || 'pending';

  const filtered = useMemo(() => {
    if (filter === 'completed') return reminders.filter(r => r.is_completed);
    return reminders.filter(r => !r.is_completed);
  }, [reminders, filter]);

  const groupedByType = useMemo(() => {
    const typeOrder: ReminderType[] = ['subscription', 'emi', 'lent', 'borrowed', 'custom'];
    const groups: Record<ReminderType, Reminder[]> = {
      subscription: [], emi: [], lent: [], borrowed: [], custom: [],
    };
    filtered.forEach(r => {
      groups[r.type].push(r);
    });
    return typeOrder
      .filter(type => groups[type].length > 0)
      .map(type => ({ type, reminders: groups[type] }));
  }, [filtered]);

  const handleMarkComplete = async (reminder: Reminder) => {
    updateReminder.mutate({
      id: reminder.id,
      updates: { is_completed: true },
    });
  };

  const handleEdit = (reminder: Reminder) => {
    setEditingReminder(reminder);
    setShowEditDialog(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('reminders').delete().eq('id', id) as any;
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      toast({ title: 'Deleted', description: 'Reminder removed.' });
    } catch {
      toast({ title: 'Error', description: 'Failed to delete.', variant: 'destructive' });
    }
  };

  const typeIcons: Record<ReminderType, string> = {
    subscription: '🔄',
    emi: '🏦',
    lent: '💸',
    borrowed: '🤝',
    custom: '📌',
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 pb-24 pt-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Reminders</h1>
            <p className="text-sm text-muted-foreground mt-1">Track subscriptions, EMIs & dues</p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {(['pending', 'completed'] as const).map(f => (
            <Button
              key={f}
              variant={filter === f ? 'default' : 'outline'}
              size="sm"
              className="capitalize flex-shrink-0"
              onClick={() => setSearchParams({ filter: f }, { replace: true })}
            >
              {f === 'pending' ? <Clock className="w-3.5 h-3.5 mr-1.5" /> : <Check className="w-3.5 h-3.5 mr-1.5" />}
              {f} ({reminders.filter(r => f === 'completed' ? r.is_completed : !r.is_completed).length})
            </Button>
          ))}
        </div>

        {/* List grouped by type */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">Loading...</div>
        ) : groupedByType.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Bell className="w-12 h-12 mb-4 opacity-30" />
            <p className="text-lg font-medium">No {filter} reminders</p>
            <p className="text-sm mt-1">Tap + to add one.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedByType.map(({ type, reminders: typeReminders }) => (
              <div key={type}>
                <div className="flex items-center gap-2 mb-3 px-1">
                  <span className="text-base">{typeIcons[type]}</span>
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {typeLabels[type]}
                  </h2>
                  <span className="text-xs text-muted-foreground/60">({typeReminders.length})</span>
                </div>
                <AnimatePresence mode="popLayout">
                  <div className="space-y-3">
                    {typeReminders.map((r, i) => {
                      const dueDate = new Date(r.due_date);
                      const overdue = !r.is_completed && isPast(dueDate) && !isToday(dueDate);
                      const dueToday = isToday(dueDate);
                      const daysUntil = differenceInDays(dueDate, new Date());

                      return (
                        <motion.div
                          key={r.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -100 }}
                          transition={{ delay: i * 0.05 }}
                          className={cn(
                            'neo-card p-4 rounded-xl border transition-all',
                            overdue && 'border-red-500/30 bg-red-500/5',
                            dueToday && 'border-amber-500/30 bg-amber-500/5',
                            r.is_completed && 'opacity-60',
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleEdit(r)}>
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0', typeColors[r.type])}>
                                  {typeLabels[r.type]}
                                </span>
                                {r.is_recurring && (
                                  <span className="text-xs text-muted-foreground flex items-center gap-0.5 flex-shrink-0">
                                    <RefreshCw className="w-3 h-3" /> {r.recurrence_interval}
                                  </span>
                                )}
                              </div>
                              <h3 className="font-semibold text-base truncate">{r.title}</h3>
                              <p className="text-lg font-bold text-foreground">{formatINR(r.amount)}</p>
                              <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                                {overdue ? (
                                  <span className="text-red-400 flex items-center gap-0.5">
                                    <AlertTriangle className="w-3 h-3" /> Overdue by {Math.abs(daysUntil)} days
                                  </span>
                                ) : dueToday ? (
                                  <span className="text-amber-400 font-medium">Due Today</span>
                                ) : (
                                  <span>Due {format(dueDate, 'MMM d, yyyy')} ({daysUntil}d)</span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1 flex-shrink-0">
                              {!r.is_completed && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-green-400 hover:text-green-300 hover:bg-green-500/10"
                                  onClick={() => handleMarkComplete(r)}
                                >
                                  <Check className="w-4 h-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                                onClick={() => handleEdit(r)}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                                onClick={() => handleDelete(r.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </AnimatePresence>
              </div>
            ))}
          </div>
        )}

        {/* FAB */}
        <motion.button
          className="fixed bottom-24 right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-xl flex items-center justify-center"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowAddDialog(true)}
        >
          <Plus className="w-6 h-6" />
        </motion.button>

        <ReminderFormDialog open={showAddDialog} onOpenChange={setShowAddDialog} />
        <ReminderFormDialog
          open={showEditDialog}
          onOpenChange={(open) => {
            setShowEditDialog(open);
            if (!open) setEditingReminder(undefined);
          }}
          editingReminder={editingReminder}
        />
      </div>
    </AppLayout>
  );
}
