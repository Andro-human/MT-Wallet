import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement, ReactNode } from 'react';

import { BulkEditDialog } from '../BulkEditDialog';

const toastMock = vi.fn();
const updates: { patch: Record<string, unknown>; ids: string[] }[] = [];

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: toastMock }) }));
vi.mock('@/hooks/useCategories', () => ({
  useCategories: () => ({ data: [{ id: 'cat-food', name: 'Food & Dining', icon: '🍽️' }] }),
}));
vi.mock('@/hooks/useTransactionGroups', () => ({
  useTransactionGroups: () => ({
    data: [
      { id: 'g-goa', name: 'Goa trip', icon: '🏖️', archived_at: null },
      { id: 'g-old', name: 'Old trip', icon: '🧳', archived_at: '2026-01-01' },
    ],
  }),
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      update: (patch: Record<string, unknown>) => ({
        in: (_col: string, ids: string[]) => ({
          eq: async () => {
            updates.push({ patch, ids });
            return { error: null };
          },
        }),
      }),
    }),
  },
}));

const debit = {
  id: 'd1', direction: 'debit' as const, category_id: 'cat-food', group_id: null,
  merchant: 'Zomato', is_expense: true, is_income: false, cashback_month: null,
};
const credit = {
  id: 'c1', direction: 'credit' as const, category_id: null, group_id: null,
  merchant: 'HSBC', is_expense: false, is_income: false, cashback_month: '2026-09-01',
};

function wrap(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{ui}</QueryClientProvider>;
}

describe('BulkEditDialog', () => {
  beforeEach(() => {
    updates.length = 0;
    toastMock.mockReset();
  });

  it('applies only the chosen fields, per direction, and undo restores each row', async () => {
    const onApplied = vi.fn();
    render(wrap(<BulkEditDialog open onOpenChange={() => {}} transactions={[debit, credit]} onApplied={onApplied} />));

    expect(screen.getByRole('button', { name: 'Apply to 2' })).toBeDisabled();

    fireEvent.click(screen.getAllByRole('button', { name: /Keep as is/ })[1]);
    expect(screen.queryByText('Old trip')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Goa trip'));
    fireEvent.click(screen.getByRole('radio', { name: 'Not counted' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply to 2' }));

    await waitFor(() => expect(onApplied).toHaveBeenCalled());
    expect(updates).toEqual([
      { patch: { group_id: 'g-goa', is_expense: false }, ids: ['d1'] },
      { patch: { group_id: 'g-goa', is_income: false, cashback_month: null }, ids: ['c1'] },
    ]);

    updates.length = 0;
    const { action } = toastMock.mock.calls[0][0] as { action: ReactElement<{ onClick: () => Promise<void> }> };
    await action.props.onClick();
    expect(updates).toEqual([
      { patch: { group_id: null, is_expense: true }, ids: ['d1'] },
      { patch: { group_id: null, is_income: false, cashback_month: '2026-09-01' }, ids: ['c1'] },
    ]);
  });
});
