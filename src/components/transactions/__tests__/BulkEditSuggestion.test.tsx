import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { BulkEditSuggestion } from '../BulkEditSuggestion';

const toastMock = vi.fn();
const updateEq = vi.fn();
const insertMock = vi.fn();
const mappingsMock = vi.fn();

vi.mock('@/hooks/useMerchantMappings', () => ({
  useMerchantMappings: () => mappingsMock(),
}));

vi.mock('@/hooks/useTransactions', () => ({
  useTransactions: () => ({ data: [] }),
  useUpdateTransaction: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      update: (payload: unknown) => ({ eq: (_c: string, id: string) => updateEq(payload, id) }),
      insert: (payload: unknown) => insertMock(payload),
    }),
  },
}));

const RULE = {
  id: 'rule-1',
  user_id: 'user-1',
  raw_merchant: 'animesh sinha',
  mapped_merchant: 'animesh sinha',
  default_category_id: null,
  default_is_expense: false,
  default_is_income: null,
};

function wrap(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{ui}</QueryClientProvider>;
}

const props = {
  merchantName: 'animesh sinha',
  currentTransactionId: 'txn-1',
  field: 'is_expense' as const,
  newValue: true,
  changeLabel: 'Count as Expense',
};

describe('BulkEditSuggestion — a merchant that already has a rule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateEq.mockResolvedValue({ error: null });
    insertMock.mockResolvedValue({ error: null });
  });

  it('stays open once the mappings query lands, instead of closing itself', async () => {
    // The bug: mappings arrive after first paint, so the dialog rendered and was
    // then closed from inside render. Nothing the user could act on.
    mappingsMock.mockReturnValue({ data: [RULE] });
    const onOpenChange = vi.fn();
    render(wrap(<BulkEditSuggestion open onOpenChange={onOpenChange} {...props} />));

    await waitFor(() => expect(screen.getByText(/automation rule|similar transactions/i)).toBeTruthy());
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('says what the existing rule reads, so an overwrite is not silent', async () => {
    mappingsMock.mockReturnValue({ data: [RULE] });
    render(wrap(<BulkEditSuggestion open onOpenChange={vi.fn()} {...props} />));

    await waitFor(() =>
      expect(screen.getByText(/should/i).textContent).toMatch(/not count as expense/i),
    );
    expect(screen.getByText(/Update the saved rule/i)).toBeTruthy();
  });

  it('updates that rule rather than inserting a second one for the same merchant', async () => {
    mappingsMock.mockReturnValue({ data: [RULE] });
    render(wrap(<BulkEditSuggestion open onOpenChange={vi.fn()} {...props} />));

    fireEvent.click(await screen.findByLabelText(/Update the saved rule/i));
    fireEvent.click(screen.getByRole('button', { name: /Save Rule Only/i }));

    await waitFor(() => expect(updateEq).toHaveBeenCalled());
    expect(updateEq.mock.calls[0][0]).toMatchObject({ default_is_expense: true });
    expect(updateEq.mock.calls[0][1]).toBe('rule-1');
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('picks the row that actually sets the field when a merchant has two rules', async () => {
    const other = { ...RULE, id: 'rule-0', default_is_expense: null, default_is_income: false };
    mappingsMock.mockReturnValue({ data: [other, RULE] });
    render(wrap(<BulkEditSuggestion open onOpenChange={vi.fn()} {...props} />));

    fireEvent.click(await screen.findByLabelText(/Update the saved rule/i));
    fireEvent.click(screen.getByRole('button', { name: /Save Rule Only/i }));

    await waitFor(() => expect(updateEq).toHaveBeenCalled());
    expect(updateEq.mock.calls[0][1]).toBe('rule-1');
  });

  it('inserts when the merchant has no rule at all', async () => {
    mappingsMock.mockReturnValue({ data: [] });
    render(wrap(<BulkEditSuggestion open onOpenChange={vi.fn()} {...props} />));

    fireEvent.click(await screen.findByLabelText(/Remember this for all future/i));
    fireEvent.click(screen.getByRole('button', { name: /Save Rule Only/i }));

    await waitFor(() => expect(insertMock).toHaveBeenCalled());
    expect(insertMock.mock.calls[0][0]).toMatchObject({
      raw_merchant: 'animesh sinha',
      default_is_expense: true,
      user_id: 'user-1',
    });
    expect(updateEq).not.toHaveBeenCalled();
  });
});
