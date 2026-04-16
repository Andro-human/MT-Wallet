import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useProfile } from './useProfile';
import { ReviewBookmark } from '@/lib/countNewSince';

export function useReviewBookmark(): ReviewBookmark | null {
  const { data: profile } = useProfile();
  if (!profile?.last_reviewed_transacted_at || !profile.last_reviewed_created_at) {
    return null;
  }
  return {
    transactedAt: new Date(profile.last_reviewed_transacted_at),
    createdAt: new Date(profile.last_reviewed_created_at),
  };
}

export function useSetReviewBookmark() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (bookmark: {
      transactionId: string;
      transactedAt: string;
      createdAt: string;
    }) => {
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('profiles')
        .update({
          last_reviewed_transaction_id: bookmark.transactionId,
          last_reviewed_transacted_at: bookmark.transactedAt,
          last_reviewed_created_at: bookmark.createdAt,
        })
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

export function useClearReviewBookmark() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('profiles')
        .update({
          last_reviewed_transaction_id: null,
          last_reviewed_transacted_at: null,
          last_reviewed_created_at: null,
        })
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}
