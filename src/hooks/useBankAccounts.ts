import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { BankAccountAlias, BankAccountNickname } from '@/types/database';

export interface BankAccountInfo {
  /** Display name shown in UI — nickname if set, otherwise "HDFC ••1234" */
  display: string;
  /** The raw technical display "HDFC ••1234" (always available, even when nickname is set) */
  technicalDisplay: string;
  /** User-set nickname, or empty string if none */
  nickname: string;
  /** Nickname row id, if one exists (for updates/deletes) */
  nicknameId: string | null;
  /** Primary bank name for this group */
  bankName: string;
  /** Primary account last 4 for this group */
  accountLast4: string;
  /** Total transactions (including aliased accounts) */
  transactionCount: number;
  /** Raw accounts that map to this group (including itself) */
  rawAccounts: { bankName: string; accountLast4: string }[];
  /** Set when this row exists only as a saved preset (no transactions yet) */
  savedAccountId: string | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeKey(bankName: string, accountLast4: string) {
  return `${bankName}|${accountLast4}`;
}

function makeDisplay(bankName: string, accountLast4: string) {
  if (bankName && accountLast4) return `${bankName} ••${accountLast4}`;
  if (bankName) return bankName;
  if (accountLast4) return `••${accountLast4}`;
  return '';
}

interface BankSummaryRow {
  bank_name: string | null;
  account_last4: string | null;
  txn_count: number;
}

async function fetchBankSummaryRows(userId: string): Promise<BankSummaryRow[]> {
  const { data, error } = await (supabase as any)
    .from('user_bank_accounts_summary')
    .select('bank_name, account_last4, txn_count')
    .eq('user_id', userId);

  if (error) throw error;
  return (data ?? []) as BankSummaryRow[];
}

// ─── Aliases ────────────────────────────────────────────────────────────────

/** Fetch all bank account aliases for the current user */
export function useBankAccountAliases() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['bank-account-aliases', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('bank_account_aliases')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;
      return data as BankAccountAlias[];
    },
    enabled: !!user,
  });
}

/** Create an alias: source account will appear under target account in the UI */
export function useCreateBankAccountAlias() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      source,
      target,
    }: {
      source: { bankName: string; accountLast4: string };
      target: { bankName: string; accountLast4: string };
    }) => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('bank_account_aliases')
        .insert({
          user_id: user.id,
          source_bank_name: source.bankName,
          source_account_last4: source.accountLast4,
          target_bank_name: target.bankName,
          target_account_last4: target.accountLast4,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-account-aliases'] });
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
    },
  });
}

/** Delete an alias — the source account will reappear as its own entry */
export function useDeleteBankAccountAlias() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (aliasId: string) => {
      const { error } = await supabase
        .from('bank_account_aliases')
        .delete()
        .eq('id', aliasId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-account-aliases'] });
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
    },
  });
}

// ─── Nicknames ──────────────────────────────────────────────────────────────

/** Fetch all bank account nicknames for the current user */
export function useBankAccountNicknames() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['bank-account-nicknames', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('bank_account_nicknames')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;
      return data as BankAccountNickname[];
    },
    enabled: !!user,
  });
}

/** Set or update a nickname for a bank account (upsert) */
export function useSetBankAccountNickname() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      bankName,
      accountLast4,
      nickname,
    }: {
      bankName: string;
      accountLast4: string;
      nickname: string;
    }) => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('bank_account_nicknames')
        .upsert(
          {
            user_id: user.id,
            bank_name: bankName,
            account_last4: accountLast4,
            nickname: nickname.trim(),
          },
          { onConflict: 'user_id,bank_name,account_last4' }
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-account-nicknames'] });
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
    },
  });
}

/** Remove a nickname — reverts to the technical display */
export function useDeleteBankAccountNickname() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (nicknameId: string) => {
      const { error } = await supabase
        .from('bank_account_nicknames')
        .delete()
        .eq('id', nicknameId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-account-nicknames'] });
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
    },
  });
}

/** Create a saved bank account preset (shows in lists before any transaction uses it) */
export function useCreateSavedBankAccount() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      bankName,
      accountLast4,
    }: {
      bankName: string;
      accountLast4: string;
    }) => {
      if (!user) throw new Error('Not authenticated');

      const trimmedName = bankName.trim();
      if (!trimmedName) throw new Error('Bank name is required');

      const digits = (accountLast4 || '').replace(/\D/g, '').slice(0, 4);

      const { data, error } = await supabase
        .from('saved_bank_accounts')
        .insert({
          user_id: user.id,
          bank_name: trimmedName,
          account_last4: digits,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
    },
  });
}

/** Remove a saved preset (no effect on transactions) */
export function useDeleteSavedBankAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('saved_bank_accounts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
    },
  });
}

// ─── Bank Accounts (alias + nickname aware) ─────────────────────────────────

/**
 * Returns bank accounts grouped by alias, with nicknames applied.
 * DB data is never modified — this is purely a UI-level grouping + naming.
 */
export function useBankAccounts() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['bank-accounts', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const [bankRows, aliasResult, nicknameResult, savedResult] = await Promise.all([
        fetchBankSummaryRows(user.id),
        supabase
          .from('bank_account_aliases')
          .select('*')
          .eq('user_id', user.id),
        supabase
          .from('bank_account_nicknames')
          .select('*')
          .eq('user_id', user.id),
        supabase
          .from('saved_bank_accounts')
          .select('*')
          .eq('user_id', user.id),
      ]);

      if (aliasResult.error) throw aliasResult.error;
      if (nicknameResult.error) throw nicknameResult.error;

      const savedRows =
        savedResult.error != null ? [] : (savedResult.data ?? []);
      if (savedResult.error != null) {
        console.warn('saved_bank_accounts:', savedResult.error.message);
      }

      const aliases = aliasResult.data as BankAccountAlias[];
      const nicknames = nicknameResult.data as BankAccountNickname[];

      // Build alias lookup: source key → target
      const aliasMap = new Map<string, { bankName: string; accountLast4: string }>();
      for (const a of aliases) {
        const srcKey = makeKey(a.source_bank_name, a.source_account_last4);
        aliasMap.set(srcKey, {
          bankName: a.target_bank_name,
          accountLast4: a.target_account_last4,
        });
      }

      // Build nickname lookup: key → nickname row
      const nicknameMap = new Map<string, BankAccountNickname>();
      for (const n of nicknames) {
        nicknameMap.set(makeKey(n.bank_name, n.account_last4), n);
      }

      // Resolve an account to its final target (follow alias chain, max 5 hops)
      function resolve(bankName: string, accountLast4: string) {
        let key = makeKey(bankName, accountLast4);
        let current = { bankName, accountLast4 };
        for (let i = 0; i < 5; i++) {
          const target = aliasMap.get(key);
          if (!target) break;
          current = target;
          key = makeKey(current.bankName, current.accountLast4);
        }
        return current;
      }

      // Group transactions by resolved account
      const groupMap = new Map<
        string,
        {
          bankName: string;
          accountLast4: string;
          count: number;
          rawAccounts: Set<string>;
          savedAccountId: string | null;
        }
      >();

      for (const row of bankRows) {
        if (!row.bank_name && !row.account_last4) continue;

        const rawBankName = row.bank_name || '';
        const rawLast4 = row.account_last4 || '';
        const rawKey = makeKey(rawBankName, rawLast4);

        const resolved = resolve(rawBankName, rawLast4);
        const resolvedKey = makeKey(resolved.bankName, resolved.accountLast4);

        const txnCount = Number(row.txn_count ?? 0);
        const existing = groupMap.get(resolvedKey);
        if (existing) {
          existing.count += txnCount;
          existing.rawAccounts.add(rawKey);
        } else {
          groupMap.set(resolvedKey, {
            bankName: resolved.bankName,
            accountLast4: resolved.accountLast4,
            count: txnCount,
            rawAccounts: new Set([rawKey]),
            savedAccountId: null,
          });
        }
      }

      // Saved presets that do not yet appear in transactions (same resolved key)
      for (const row of savedRows) {
        const bn = row.bank_name ?? '';
        const l4 = row.account_last4 ?? '';
        const resolved = resolve(bn, l4);
        const resolvedKey = makeKey(resolved.bankName, resolved.accountLast4);
        if (groupMap.has(resolvedKey)) continue;

        groupMap.set(resolvedKey, {
          bankName: resolved.bankName,
          accountLast4: resolved.accountLast4,
          count: 0,
          rawAccounts: new Set([makeKey(bn, l4)]),
          savedAccountId: row.id,
        });
      }

      const accounts: BankAccountInfo[] = [];
      groupMap.forEach(({ bankName, accountLast4, count, rawAccounts, savedAccountId }) => {
        const technicalDisplay = makeDisplay(bankName, accountLast4);
        if (!technicalDisplay) return;

        const key = makeKey(bankName, accountLast4);
        const nicknameRow = nicknameMap.get(key);
        const nickname = nicknameRow?.nickname || '';

        accounts.push({
          display: nickname || technicalDisplay,
          technicalDisplay,
          nickname,
          nicknameId: nicknameRow?.id || null,
          bankName,
          accountLast4,
          transactionCount: count,
          rawAccounts: Array.from(rawAccounts).map((k) => {
            const [bn, al4] = k.split('|');
            return { bankName: bn, accountLast4: al4 };
          }),
          savedAccountId,
        });
      });

      return accounts;
    },
    enabled: !!user,
  });
}

// ─── Parse display string ───────────────────────────────────────────────────

export function parseBankAccount(display: string): { bankName: string; accountLast4: string } {
  if (!display) return { bankName: '', accountLast4: '' };

  const match = display.match(/^(.+?)\s*••(\d{1,4})$/);
  if (match) return { bankName: match[1].trim(), accountLast4: match[2] };

  const accountOnly = display.match(/^••(\d{1,4})$/);
  if (accountOnly) return { bankName: '', accountLast4: accountOnly[1] };

  return { bankName: display, accountLast4: '' };
}

// ─── Remove bank account (null out in DB) ───────────────────────────────────

/**
 * Remove a bank account from all transactions (sets bank_name and account_last4 to null).
 * Only runs when user explicitly clicks "Remove" and confirms the prompt.
 */
export function useRemoveBankAccount() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ bankName, accountLast4 }: { bankName: string; accountLast4: string }) => {
      if (!user) throw new Error('Not authenticated');

      let query = supabase
        .from('transactions')
        .update({ bank_name: null, account_last4: null })
        .eq('user_id', user.id);

      if (bankName) {
        query = query.eq('bank_name', bankName);
      } else {
        query = query.is('bank_name', null);
      }

      if (accountLast4) {
        query = query.eq('account_last4', accountLast4);
      } else {
        query = query.is('account_last4', null);
      }

      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}
