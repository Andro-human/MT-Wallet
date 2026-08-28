import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface RecordRepaymentInput {
  loanTransactionId: string;
  /** Who paid it back. Becomes the credit's merchant. */
  counterparty: string;
  amount: number;
  /** yyyy-MM-dd, as the date input gives it. */
  date: string;
  note: string | null;
}

/** Record money coming back on a loan: create the credit, then link it.
 *
 *  The link is what shrinks the outstanding figure, since the Debt page reads
 *  repaid from refund_links rather than from the credit itself.
 *
 *  Booked as neither income nor expense, mirroring the loan: a manually recorded
 *  loan goes out with is_expense false, so counting the return as income would
 *  book it on the way back having never booked it on the way out. For a loan
 *  marked on a real expense, the link still does the right thing by netting the
 *  original debit down.
 */
export function useRecordRepayment() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: RecordRepaymentInput) => {
      if (!user) throw new Error('Not authenticated');
      if (!(input.amount > 0)) throw new Error('Enter an amount above zero');

      const transactedAt = new Date(`${input.date}T12:00:00`).toISOString();

      const { data, error } = await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          merchant: input.counterparty,
          amount: input.amount,
          direction: 'credit',
          transacted_at: transactedAt,
          notes: input.note,
          is_income: false,
          is_expense: false,
        } as any)
        .select('id')
        .single();
      if (error) throw error;

      const refundTransactionId = (data as { id: string }).id;

      const { error: linkError } = await (supabase as any).from('refund_links').insert({
        user_id: user.id,
        original_transaction_id: input.loanTransactionId,
        refund_transaction_id: refundTransactionId,
        linked_amount: input.amount,
      });

      if (linkError) {
        // Undo the credit rather than leave one that repays nothing: it would
        // sit in Activity unexplained while the loan still read as fully
        // outstanding, which is worse than the write having failed outright.
        await supabase.from('transactions').delete().eq('id', refundTransactionId);
        throw linkError;
      }

      return { refundTransactionId };
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({ queryKey: ['refund-links-all'] });
      queryClient.invalidateQueries({
        queryKey: ['refund-links-for-original', input.loanTransactionId],
      });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transaction', input.loanTransactionId] });
      queryClient.invalidateQueries({ queryKey: ['debt-transactions'] });
    },
  });
}
