import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { Bell, Plus, Check, Clock, AlertTriangle, RefreshCw, Trash2, Pencil, MoreVertical, SkipForward, Ban, CalendarIcon } from 'lucide-react';
import { format, isPast, isToday, differenceInDays, addDays, addWeeks, addMonths, addYears } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { useReminders, useUpdateReminder, useInsertReminderCompletion } from '@/hooks/useReminders';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useForm } from 'react-hook-form';
import type { RecurrenceInterval, RecurrenceUnit } from '@/types/database';

function formatINR(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

function advanceDateBy(date: Date, value: number, unit: RecurrenceUnit): Date {
  switch (unit) {
    case 'day':   return addDays(date, value);
    case 'week':  return addWeeks(date, value);
    case 'month': return addMonths(date, value);
    case 'year':  return addYears(date, value);
  }
}

// Resolve a reminder's recurrence to (value, unit). Prefers the new columns;
// falls back to the legacy enum so older rows still advance correctly until
// the backfilled column is fully verified and old column dropped.
function resolveRecurrence(r: Reminder): { value: number; unit: RecurrenceUnit } | null {
  if (r.recurrence_value && r.recurrence_unit) {
    return { value: r.recurrence_value, unit: r.recurrence_unit };
  }
  switch (r.recurrence_interval) {
    case 'weekly':  return { value: 1, unit: 'week' };
    case 'monthly': return { value: 1, unit: 'month' };
    case 'yearly':  return { value: 1, unit: 'year' };
    default: return null;
  }
}

const RECURRENCE_ELIGIBLE: ReadonlyArray<ReminderType> = ['subscription', 'emi', 'custom'];

// Preset cadences. 'custom' is the escape hatch — user picks value + unit explicitly.
const RECURRENCE_PRESETS: Record<string, { value: number; unit: RecurrenceUnit; label: string }> = {
  weekly:  { value: 1, unit: 'week',  label: 'Weekly' },
  monthly: { value: 1, unit: 'month', label: 'Monthly' },
};

// Resolve the badge label for a reminder's type. For 'custom' with a
// user-typed label, show that label; otherwise use the enum mapping.
function displayTypeLabel(r: Pick<Reminder, 'type' | 'custom_type_label'>): string {
  if (r.type === 'custom' && r.custom_type_label?.trim()) {
    return r.custom_type_label.trim();
  }
  return typeLabels[r.type];
}

function presetKeyFor(value: number, unit: RecurrenceUnit): string {
  for (const [key, preset] of Object.entries(RECURRENCE_PRESETS)) {
    if (preset.value === value && preset.unit === unit) return key;
  }
  return 'custom';
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
      merchant: '',
      amount: '',
      type: 'subscription' as ReminderType,
      custom_type_label: '',
      due_date: format(new Date(), 'yyyy-MM-dd'),
      is_recurring: true,
      recurrence_preset: 'monthly',
      recurrence_value: 1,
      recurrence_unit: 'month' as RecurrenceUnit,
    },
  });

  const [datePickerOpen, setDatePickerOpen] = useState(false);

  useEffect(() => {
    if (open) {
      const initialRec = editingReminder ? resolveRecurrence(editingReminder) : null;
      const initialValue = initialRec?.value ?? 1;
      const initialUnit = initialRec?.unit ?? 'month';
      reset({
        title: editingReminder?.title || '',
        merchant: editingReminder?.merchant || '',
        amount: editingReminder ? String(editingReminder.amount) : '',
        type: (editingReminder?.type || 'subscription') as ReminderType,
        custom_type_label: editingReminder?.custom_type_label || '',
        due_date: editingReminder
          ? format(new Date(editingReminder.due_date), 'yyyy-MM-dd')
          : format(new Date(), 'yyyy-MM-dd'),
        is_recurring: editingReminder?.is_recurring ?? true,
        recurrence_preset: presetKeyFor(initialValue, initialUnit),
        recurrence_value: initialValue,
        recurrence_unit: initialUnit,
      });
    }
  }, [open, editingReminder, reset]);

  const typeValue = watch('type');
  const typeAllowsRecurring = RECURRENCE_ELIGIBLE.includes(typeValue);
  const isRecurring = watch('is_recurring') && typeAllowsRecurring;
  const recurrencePreset = watch('recurrence_preset');
  const isCustomRecurrence = recurrencePreset === 'custom';

  const onSubmit = async (data: any) => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      const amountNum = parseFloat(data.amount);
      if (isNaN(amountNum) || amountNum <= 0) throw new Error('Invalid amount');

      const localDate = new Date(data.due_date);
      localDate.setHours(12, 0, 0, 0);

      const allowRecurring = RECURRENCE_ELIGIBLE.includes(data.type);
      const effectiveRecurring = allowRecurring && data.is_recurring;

      // Derive (value, unit) from preset, or use the explicit fields for 'custom'
      let recurrenceValue: number | null = null;
      let recurrenceUnit: RecurrenceUnit | null = null;
      if (effectiveRecurring) {
        if (data.recurrence_preset === 'custom') {
          const v = Number(data.recurrence_value);
          if (!Number.isFinite(v) || v < 1) throw new Error('Custom recurrence value must be a positive number');
          recurrenceValue = Math.floor(v);
          recurrenceUnit = data.recurrence_unit as RecurrenceUnit;
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

      if (isEdit) {
        updateReminder.mutate({
          id: editingReminder!.id,
          updates: {
            title: data.title,
            merchant: trimmedMerchant || null,
            amount: amountNum,
            type: data.type,
            custom_type_label: customTypeLabel,
            due_date: localDate.toISOString(),
            is_recurring: effectiveRecurring,
            recurrence_value: recurrenceValue,
            recurrence_unit: recurrenceUnit,
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
            merchant: trimmedMerchant || null,
            amount: amountNum,
            currency: 'INR',
            type: data.type,
            custom_type_label: customTypeLabel,
            due_date: localDate.toISOString(),
            is_recurring: effectiveRecurring,
            recurrence_value: recurrenceValue,
            recurrence_unit: recurrenceUnit,
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
            <Input id="r-title" {...register('title', { required: true })} placeholder="e.g. Ketchup" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="r-merchant">Merchant</Label>
            <Input
              id="r-merchant"
              {...register('merchant')}
              placeholder="e.g. Amazon"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="r-amount">Amount (₹)</Label>
              <Input
                id="r-amount"
                type="number"
                step="0.01"
                className="no-spinner"
                {...register('amount', { required: true })}
              />
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
            {typeValue === 'custom' && (
              <Input
                placeholder="Name this type (e.g. Membership, Donation)"
                {...register('custom_type_label')}
              />
            )}
          </div>
          {typeAllowsRecurring && (
            <div className="flex items-center gap-2">
              <input type="checkbox" id="r-recurring" className="rounded" {...register('is_recurring')} />
              <Label htmlFor="r-recurring" className="font-normal cursor-pointer flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" /> Recurring
              </Label>
            </div>
          )}
          {isRecurring && (
            <div className="space-y-2 animate-in fade-in">
              <Label>Interval</Label>
              <Select
                value={recurrencePreset}
                onValueChange={(v: string) => setValue('recurrence_preset', v)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
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

interface CompletedGroup {
  kind: 'done' | 'cancelled';
  reminders: Reminder[];
}

export default function RemindersPage() {
  const { data: reminders = [], isLoading } = useReminders();
  const updateReminder = useUpdateReminder();
  const insertCompletion = useInsertReminderCompletion();
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

  const completedGroups = useMemo<CompletedGroup[]>(() => {
    if (filter !== 'completed') return [];
    const done = filtered.filter(r => !r.is_recurring);
    const cancelled = filtered.filter(r => r.is_recurring);
    return [
      ...(done.length ? [{ kind: 'done' as const, reminders: done }] : []),
      ...(cancelled.length ? [{ kind: 'cancelled' as const, reminders: cancelled }] : []),
    ];
  }, [filtered, filter]);

  const handleMarkPaid = async (reminder: Reminder) => {
    const rec = reminder.is_recurring ? resolveRecurrence(reminder) : null;
    if (rec) {
      const next = advanceDateBy(new Date(reminder.due_date), rec.value, rec.unit);
      next.setHours(12, 0, 0, 0);
      // History row is the source of truth for "what was paid". Only
      // advance the reminder once the completion is durably recorded —
      // otherwise a failed insert would silently leave the reminder
      // looking paid with no backing history.
      try {
        await insertCompletion.mutateAsync({
          reminderId: reminder.id,
          cycleDate: reminder.due_date,
          paidAmount: reminder.amount,
        });
      } catch {
        // Hook already surfaced the error via toast; abort the advance.
        return;
      }
      updateReminder.mutate({
        id: reminder.id,
        updates: { due_date: next.toISOString() },
      }, {
        onSuccess: () => toast({ title: 'Marked paid' }),
      });
    } else {
      updateReminder.mutate({
        id: reminder.id,
        updates: { is_completed: true },
      }, {
        onSuccess: () => toast({ title: 'Marked complete' }),
      });
    }
  };

  const handleSkipCycle = async (reminder: Reminder) => {
    const rec = reminder.is_recurring ? resolveRecurrence(reminder) : null;
    if (!rec) return;
    const next = advanceDateBy(new Date(reminder.due_date), rec.value, rec.unit);
    next.setHours(12, 0, 0, 0);
    updateReminder.mutate({
      id: reminder.id,
      updates: { due_date: next.toISOString() },
    }, {
      onSuccess: () => toast({ title: 'Skipped to next cycle' }),
    });
  };

  const handleCancel = async (reminder: Reminder) => {
    updateReminder.mutate({
      id: reminder.id,
      updates: { is_completed: true },
    }, {
      onSuccess: () => toast({ title: 'Reminder cancelled' }),
    });
  };

  const handleReactivate = async (reminder: Reminder) => {
    updateReminder.mutate({
      id: reminder.id,
      updates: { is_completed: false },
    }, {
      onSuccess: () => toast({ title: 'Reminder reactivated' }),
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
      {/* Sticky page header — matches Bank Accounts / Categories pattern */}
      <div className="sticky top-0 z-10 backdrop-blur-xl bg-background/80 border-b border-border/30 safe-area-top">
        <div className="flex items-center gap-3 px-5 py-3">
          <h1 className="text-lg font-semibold text-foreground flex-1">Reminders</h1>
        </div>
      </div>

      <div className="px-5 pb-24 py-6">
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

        {/* List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">Loading...</div>
        ) : (filter === 'completed' ? completedGroups.length : groupedByType.length) === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Bell className="w-12 h-12 mb-4 opacity-30" />
            <p className="text-lg font-medium">No {filter} reminders</p>
            <p className="text-sm mt-1">Tap + to add one.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {(filter === 'completed'
              ? completedGroups.map(g => ({
                  key: g.kind,
                  label: g.kind === 'done' ? 'Done' : 'Cancelled',
                  icon: g.kind === 'done' ? '✅' : '🚫',
                  reminders: g.reminders,
                }))
              : groupedByType.map(g => ({
                  key: g.type,
                  label: typeLabels[g.type],
                  icon: typeIcons[g.type],
                  reminders: g.reminders,
                }))
            ).map(({ key, label, icon, reminders: typeReminders }) => (
              <div key={key}>
                <div className="flex items-center gap-2 mb-3 px-1">
                  <span className="text-base">{icon}</span>
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {label}
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
                                  {displayTypeLabel(r)}
                                </span>
                                {r.is_recurring && (() => {
                                  const rec = resolveRecurrence(r);
                                  if (!rec) return null;
                                  const presetKey = presetKeyFor(rec.value, rec.unit);
                                  const label = presetKey === 'custom'
                                    ? `Every ${rec.value} ${rec.unit}${rec.value > 1 ? 's' : ''}`
                                    : RECURRENCE_PRESETS[presetKey].label;
                                  return (
                                    <span className="text-xs text-muted-foreground flex items-center gap-0.5 flex-shrink-0">
                                      <RefreshCw className="w-3 h-3" /> {label}
                                    </span>
                                  );
                                })()}
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
                                  onClick={() => handleMarkPaid(r)}
                                  title={r.is_recurring ? 'Mark paid (advance cycle)' : 'Mark complete'}
                                >
                                  <Check className="w-4 h-4" />
                                </Button>
                              )}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                  >
                                    <MoreVertical className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleEdit(r)}>
                                    <Pencil className="w-4 h-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                  {!r.is_completed && r.is_recurring && (
                                    <DropdownMenuItem onClick={() => handleSkipCycle(r)}>
                                      <SkipForward className="w-4 h-4 mr-2" />
                                      Skip cycle
                                    </DropdownMenuItem>
                                  )}
                                  {!r.is_completed && r.is_recurring && (
                                    <DropdownMenuItem onClick={() => handleCancel(r)}>
                                      <Ban className="w-4 h-4 mr-2" />
                                      Cancel reminder
                                    </DropdownMenuItem>
                                  )}
                                  {r.is_completed && r.is_recurring && (
                                    <DropdownMenuItem onClick={() => handleReactivate(r)}>
                                      <RefreshCw className="w-4 h-4 mr-2" />
                                      Reactivate
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => handleDelete(r.id)}
                                    className="text-red-400 focus:text-red-400"
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
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
