import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Category } from '@/types/database';

export function useCategories() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['categories', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data as Category[];
    },
    enabled: !!user,
  });
}

/**
 * Get transaction count per category for the current user
 */
export function useCategoryTransactionCounts() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['category-transaction-counts', user?.id],
    queryFn: async () => {
      if (!user) return {};

      const { data, error } = await supabase
        .from('transactions')
        .select('category_id')
        .eq('user_id', user.id)
        .not('category_id', 'is', null);

      if (error) throw error;

      const counts: Record<string, number> = {};
      data.forEach(t => {
        if (t.category_id) {
          counts[t.category_id] = (counts[t.category_id] || 0) + 1;
        }
      });
      return counts;
    },
    enabled: !!user,
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (category: Pick<Category, 'name' | 'slug' | 'icon' | 'color'>) => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('categories')
        .insert({
          ...category,
          user_id: user.id,
          is_system: false,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

/**
 * Update a category's name, icon, or color.
 */
export function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Pick<Category, 'name' | 'slug' | 'icon' | 'color'>> }) => {
      const { data, error } = await supabase
        .from('categories')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

/**
 * Delete a category: sets category_id = null on all linked transactions, then deletes the category row.
 * Only runs when user explicitly confirms.
 */
export function useDeleteCategory() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (categoryId: string) => {
      if (!user) throw new Error('Not authenticated');

      // First, unlink all transactions from this category
      const { error: unlinkError } = await supabase
        .from('transactions')
        .update({ category_id: null })
        .eq('user_id', user.id)
        .eq('category_id', categoryId);

      if (unlinkError) throw unlinkError;

      // Then delete the category (RLS only allows deleting user-owned, non-system categories)
      const { error: deleteError } = await supabase
        .from('categories')
        .delete()
        .eq('id', categoryId)
        .eq('is_system', false);

      if (deleteError) throw deleteError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['category-transaction-counts'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}
