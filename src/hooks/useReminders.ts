import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/components/ui/use-toast';
import { Reminder } from '@/types/database';

export interface ReminderCompletionInput {
  reminderId: string;
  cycleDate: string;       // ISO; the due_date that was just paid
  paidAmount: number | null;
  transactionId?: string | null;
}

export function useReminders() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['reminders', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('reminders')
        .select('*')
        .eq('user_id', user.id)
        .order('due_date', { ascending: true });
        
      if (error) throw error;
      return data as Reminder[];
    },
    enabled: !!user,
  });
}

export function useUpdateReminder() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Reminder> }) => {
      const { data, error } = await supabase
        .from('reminders')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to update reminder.',
        variant: 'destructive',
      });
    }
  });
}

export function useInsertReminderCompletion() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: ReminderCompletionInput) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await (supabase as any)
        .from('reminder_completions')
        .insert({
          user_id: user.id,
          reminder_id: input.reminderId,
          cycle_date: input.cycleDate,
          paid_amount: input.paidAmount,
          transaction_id: input.transactionId ?? null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminder-completions'] });
    },
    onError: (err: any) => {
      console.error('[reminder_completions] insert failed:', err);
      toast({
        title: 'Failed to record payment history',
        description: err?.message || 'Unknown error',
        variant: 'destructive',
      });
    },
  });
}
