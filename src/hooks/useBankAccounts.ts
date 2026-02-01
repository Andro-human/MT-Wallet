import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

const DEFAULT_PAYMENT_METHODS = ['UPI', 'Card', 'Cash'];

export function usePaymentMethods() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['payment-methods', user?.id],
    queryFn: async () => {
      if (!user) return DEFAULT_PAYMENT_METHODS;

      const { data, error } = await supabase
        .from('transactions')
        .select('payment_method')
        .eq('user_id', user.id)
        .not('payment_method', 'is', null);

      if (error) throw error;

      const userMethods = [...new Set(
        data
          .map(t => t.payment_method)
          .filter((m): m is string => !!m)
      )];

      const allMethods = [...new Set([...DEFAULT_PAYMENT_METHODS, ...userMethods])];
      return allMethods;
    },
    enabled: !!user,
  });
}

// Combined bank name and account last 4 (e.g., "HDFC ••1234")
export function useBankAccounts() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['bank-accounts', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('transactions')
        .select('bank_name, account_last4')
        .eq('user_id', user.id);

      if (error) throw error;

      // Create unique combinations of bank_name + account_last4
      const accountSet = new Set<string>();
      const accounts: { display: string; bankName: string; accountLast4: string }[] = [];

      data.forEach(t => {
        if (t.bank_name || t.account_last4) {
          const bankName = t.bank_name || '';
          const accountLast4 = t.account_last4 || '';
          const key = `${bankName}|${accountLast4}`;
          
          if (!accountSet.has(key)) {
            accountSet.add(key);
            
            let display = '';
            if (bankName && accountLast4) {
              display = `${bankName} ••${accountLast4}`;
            } else if (bankName) {
              display = bankName;
            } else if (accountLast4) {
              display = `••${accountLast4}`;
            }
            
            if (display) {
              accounts.push({ display, bankName, accountLast4 });
            }
          }
        }
      });

      return accounts;
    },
    enabled: !!user,
  });
}

// Parse a combined display string back to bank name and account
export function parseBankAccount(display: string): { bankName: string; accountLast4: string } {
  if (!display) return { bankName: '', accountLast4: '' };
  
  // Check if it matches "BankName ••1234" pattern
  const match = display.match(/^(.+?)\s*••(\d{1,4})$/);
  if (match) {
    return { bankName: match[1].trim(), accountLast4: match[2] };
  }
  
  // Check if it's just "••1234"
  const accountOnly = display.match(/^••(\d{1,4})$/);
  if (accountOnly) {
    return { bankName: '', accountLast4: accountOnly[1] };
  }
  
  // Otherwise treat as bank name only
  return { bankName: display, accountLast4: '' };
}
