import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement, ReactNode } from 'react';

import { BulkEditDialog } from '../BulkEditDialog';

const toastMock = vi.fn();
const updates: { patch: Record<string, unknown>; ids: string[] }[] = [];
const ruleWrites: unknown[] = [];
const mappingsMock = vi.fn(() => ({ data: [] as unknown[] }));

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
vi.mock('@/hooks/useMerchantMappings', () => ({ useMerchantMappings: () => mappingsMock() }));
vi.mock('../CreateGroupDialog', () => ({
  CreateGroupDialog: ({ open, onCreated }: { open: boolean; onCreated: (id: string) => void }) =>
    open ? <button onClick={() => onCreated('g-new')}>Save new group</button> : null,
}));
vi.mock('../CreateCategoryDialog', () => ({ CreateCategoryDialog: () => null }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) =>
      table === 'user_merchant_mappings'
        ? {
            update: (values: unknown) => ({
              eq: (_c: string, id: string) => ({
                eq: async () => {
                  ruleWrites.push({ update: id, values });
                  return { error: null };
                },
              }),
            }),
            insert: (values: unknown) => ({
              select: () => ({
                single: async () => {
                  ruleWrites.push({ insert: values });
                  return { data: { id: `new-${ruleWrites.length}` }, error: null };
                },
              }),
            }),
            delete: () => ({
              in: (_c: string, ids: string[]) => ({
                eq: async () => {
                  ruleWrites.push({ delete: ids });
                  return { error: null };
                },
              }),
            }),
          }
        : {
            update: (patch: Record<string, unknown>) => ({
              in: (_col: string, ids: string[]) => ({
                eq: async () => {
                  updates.push({ patch, ids });
                  return { error: null };
                },
              }),
            }),
          },
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
    ruleWrites.length = 0;
    toastMock.mockReset();
    mappingsMock.mockReturnValue({ data: [] });
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

  it('a group created from the panel is selected and applied to every row', async () => {
    const onApplied = vi.fn();
    render(wrap(<BulkEditDialog open onOpenChange={() => {}} transactions={[debit, credit]} onApplied={onApplied} />));

    fireEvent.click(screen.getAllByRole('button', { name: /New/ })[1]);
    fireEvent.click(screen.getByText('Save new group'));
    fireEvent.click(screen.getByRole('button', { name: 'Apply to 2' }));

    await waitFor(() => expect(onApplied).toHaveBeenCalled());
    expect(updates).toEqual([{ patch: { group_id: 'g-new' }, ids: ['d1', 'c1'] }]);
  });

  it('lets each merchant keep, trim or drop its rule before saving, and undo reverses them', async () => {
    mappingsMock.mockReturnValue({
      data: [{
        id: 'rule-zomato', user_id: 'user-1', raw_merchant: 'zomato', mapped_merchant: 'Zomato',
        default_category_id: 'cat-old', default_is_expense: null, default_is_income: null,
        amount_operator: null, amount_threshold: null, date_operator: null, date_threshold: null,
        match_type: 'exact', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
      }],
    });
    const swiggy = { ...debit, id: 's1', merchant: 'Swiggy' };
    const uber = { ...debit, id: 'u1', merchant: 'Uber' };
    const onApplied = vi.fn();
    render(wrap(<BulkEditDialog open onOpenChange={() => {}} transactions={[debit, swiggy, uber]} onApplied={onApplied} />));

    expect(screen.queryByText(/Also apply to future/)).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: /Keep as is/ })[0]);
    fireEvent.click(screen.getByText('Food & Dining'));
    fireEvent.click(screen.getByRole('radio', { name: 'Not counted' }));
    fireEvent.click(screen.getByText(/Also apply to future/));
    fireEvent.click(screen.getByRole('button', { name: 'Apply to 3' }));

    await screen.findByText('Remember for future?');
    expect(onApplied).not.toHaveBeenCalled();
    expect(screen.getByText(/1 selected transaction · updates your existing rule/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Uber' }));
    const swiggyRow = screen.getByText('Swiggy').closest('div.py-3') as HTMLElement;
    fireEvent.click(within(swiggyRow).getByRole('button', { name: /Don’t count as spending/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Save 2 rules' }));

    await waitFor(() => expect(onApplied).toHaveBeenCalled());
    expect(ruleWrites).toEqual([
      {
        insert: {
          raw_merchant: 'Swiggy', match_type: 'exact', mapped_merchant: 'Swiggy',
          default_category_id: 'cat-food', default_is_expense: null, default_is_income: null, user_id: 'user-1',
        },
      },
      { update: 'rule-zomato', values: { default_category_id: 'cat-food', default_is_expense: false } },
    ]);

    ruleWrites.length = 0;
    const ruleToast = toastMock.mock.calls.find(([t]) => String(t.title).startsWith('Saved 2 rules'))![0] as {
      action: ReactElement<{ onClick: () => Promise<void> }>;
    };
    await ruleToast.action.props.onClick();
    expect(ruleWrites).toEqual([
      { update: 'rule-zomato', values: { default_category_id: 'cat-old', default_is_expense: null } },
      { delete: ['new-1'] },
    ]);
  });
});
