export interface BankAccountAlias {
  id: string;
  user_id: string;
  source_bank_name: string;
  source_account_last4: string;
  target_bank_name: string;
  target_account_last4: string;
  created_at: string;
}

export interface BankAccountNickname {
  id: string;
  user_id: string;
  bank_name: string;
  account_last4: string;
  nickname: string;
  created_at: string;
}

export interface Category {
  id: string;
  user_id: string | null;
  name: string;
  slug: string;
  icon: string;
  color: string;
  is_system: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  amount: number;
  direction: 'credit' | 'debit';
  transacted_at: string;
  merchant: string | null;
  merchant_normalized: string | null;
  payment_method: string | null;
  account_last4: string | null;
  bank_name: string | null;
  category_id: string | null;
  group_id: string | null;
  raw_sms: string | null;
  notes: string | null;
  is_expense: boolean;
  is_income: boolean;
  created_at: string;
  updated_at: string;
  category?: Category;
}

export interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  api_key: string | null;
  monthly_budget: number;
  created_at: string;
  updated_at: string;
}

export interface CategorizationRule {
  id: string;
  user_id: string | null;
  merchant_pattern: string;
  category_id: string;
  merchant_normalized: string | null;
  priority: number;
  created_at: string;
}

export interface TransactionWithCategory extends Transaction {
  categories: Category | null;
}
