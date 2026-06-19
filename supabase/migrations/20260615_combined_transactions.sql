-- Combined transactions (split-tender grouping overlay).
-- One real purchase paid across multiple instruments produces several
-- transaction rows. This table links them under a shared combine_id so the
-- activity list can render them as a single collapsible parent.
--
-- DISPLAY-ONLY: this table never alters amount / direction / is_expense /
-- is_income on transactions, so every aggregate (insights, home, donut,
-- month summary) keeps counting each leg individually. Deleting all rows
-- here fully reverts the feature with zero data loss.

create table if not exists public.combined_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  combine_id uuid not null,
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  created_at timestamptz not null default now(),
  -- A transaction belongs to at most one combine. Enables upsert-on-conflict.
  unique (transaction_id)
);

create index if not exists combined_transactions_user_combine_idx
  on public.combined_transactions (user_id, combine_id);

alter table public.combined_transactions enable row level security;

create policy "Users manage their own combined_transactions"
  on public.combined_transactions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
