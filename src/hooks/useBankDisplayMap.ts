import { useMemo } from 'react';
import { useBankAccounts } from './useBankAccounts';

function makeKey(bankName: string | null | undefined, last4: string | null | undefined) {
  return `${bankName ?? ''}|${last4 ?? ''}`;
}

/**
 * Maps every raw `(bank_name, account_last4)` combination on transactions to
 * the string that should render under the amount:
 *   - the user's nickname, if set
 *   - otherwise a compact technical name like "HDFC ••1234"
 *
 * Built from useBankAccounts() once, so cards never call it per-row.
 */
export function useBankDisplayMap(): Map<string, string> {
  const { data: accounts = [] } = useBankAccounts();

  return useMemo(() => {
    const map = new Map<string, string>();
    for (const acc of accounts) {
      for (const raw of acc.rawAccounts) {
        map.set(makeKey(raw.bankName, raw.accountLast4), acc.display);
      }
    }
    return map;
  }, [accounts]);
}

export function lookupBankDisplay(
  map: Map<string, string>,
  bankName: string | null | undefined,
  last4: string | null | undefined,
): string | undefined {
  if (!bankName && !last4) return undefined;
  return map.get(makeKey(bankName, last4));
}
