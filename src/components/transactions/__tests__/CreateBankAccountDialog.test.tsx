import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { CreateBankAccountDialog } from '../CreateBankAccountDialog';
import { toTechnicalDisplay } from '@/lib/bankDisplay';

const createSavedMock = vi.fn();
const setNicknameMock = vi.fn();
const deleteFromSaved = vi.fn();
const toastMock = vi.fn();

vi.mock('@/hooks/useBankAccounts', () => ({
  useCreateSavedBankAccount: () => ({ mutateAsync: createSavedMock }),
  useSetBankAccountNickname: () => ({ mutateAsync: setNicknameMock }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      delete: () => ({ eq: deleteFromSaved }),
    }),
  },
}));

function wrap(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{ui}</QueryClientProvider>;
}

describe('toTechnicalDisplay', () => {
  it('formats bank + last4 as "Bank ••1234"', () => {
    expect(toTechnicalDisplay('HDFC', '1234')).toBe('HDFC ••1234');
  });
  it('falls back to bank-only when no last4', () => {
    expect(toTechnicalDisplay('HDFC', '')).toBe('HDFC');
  });
  it('falls back to last4-only when no bank', () => {
    expect(toTechnicalDisplay('', '1234')).toBe('••1234');
  });
  it('returns empty string when both blank', () => {
    expect(toTechnicalDisplay('', '')).toBe('');
  });
});

describe('CreateBankAccountDialog — rollback on nickname failure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes the saved_bank_accounts row and surfaces an error if the nickname insert fails', async () => {
    createSavedMock.mockResolvedValue({ id: 'saved-1', bank_name: 'HDFC', account_last4: '1234' });
    setNicknameMock.mockRejectedValue(new Error('duplicate key'));
    deleteFromSaved.mockResolvedValue({ error: null });

    const onCreated = vi.fn();
    const onOpenChange = vi.fn();

    render(
      wrap(
        <CreateBankAccountDialog
          open
          onOpenChange={onOpenChange}
          onCreated={onCreated}
        />
      )
    );

    fireEvent.change(screen.getByLabelText(/bank name/i), { target: { value: 'HDFC' } });
    fireEvent.change(screen.getByLabelText(/last 4/i), { target: { value: '1234' } });
    fireEvent.change(screen.getByLabelText(/nickname/i), { target: { value: 'Salary' } });
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));

    await waitFor(() => {
      expect(setNicknameMock).toHaveBeenCalled();
    });

    expect(deleteFromSaved).toHaveBeenCalledWith('id', 'saved-1');
    expect(onCreated).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive' })
    );
  });

  it('commits cleanly when nickname insert succeeds', async () => {
    createSavedMock.mockResolvedValue({ id: 'saved-2', bank_name: 'ICICI', account_last4: '5678' });
    setNicknameMock.mockResolvedValue({});

    const onCreated = vi.fn();
    const onOpenChange = vi.fn();

    render(
      wrap(
        <CreateBankAccountDialog
          open
          onOpenChange={onOpenChange}
          onCreated={onCreated}
        />
      )
    );

    fireEvent.change(screen.getByLabelText(/bank name/i), { target: { value: 'ICICI' } });
    fireEvent.change(screen.getByLabelText(/last 4/i), { target: { value: '5678' } });
    fireEvent.change(screen.getByLabelText(/nickname/i), { target: { value: 'Rent' } });
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith('ICICI ••5678');
    });

    expect(deleteFromSaved).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('skips the nickname path entirely when no nickname is provided', async () => {
    createSavedMock.mockResolvedValue({ id: 'saved-3', bank_name: 'SBI', account_last4: '' });

    const onCreated = vi.fn();

    render(
      wrap(
        <CreateBankAccountDialog
          open
          onOpenChange={vi.fn()}
          onCreated={onCreated}
        />
      )
    );

    fireEvent.change(screen.getByLabelText(/bank name/i), { target: { value: 'SBI' } });
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith('SBI');
    });

    expect(setNicknameMock).not.toHaveBeenCalled();
    expect(deleteFromSaved).not.toHaveBeenCalled();
  });
});
