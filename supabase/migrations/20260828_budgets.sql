-- Per-category and per-group budgets, replacing the single profiles.monthly_budget
-- as the monthly ceiling. See PLAN-budgets.md for the reasoning.
--
-- A budget spans a SET of categories and/or groups, because real budgets do:
-- "Groceries & Home spend" is one budget over two categories, and "Travel/trip"
-- has to be able to name trip groups or a trip's spend scatters across Food,
-- Transport and the rest.
--
-- DOUBLE COUNTING is prevented by attribution precedence, not by the schema:
-- a transaction counts against its GROUP's budget if that group has one,
-- otherwise its CATEGORY's budget, otherwise the remainder budget. That is the
-- same "groups whole, categories ungrouped-only" split the backend already uses
-- for the Insights combined view, so budget figures agree with Insights by
-- construction.
--
-- CARRY-FORWARD IS NOT STORED HERE. There is deliberately no balance column.
-- Refunds land late in this app, so a stored running balance would be silently
-- corrupted by a refund arriving after a month closed. Carry is derived by
-- walking months from active_from in budgetMath.ts.

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  -- monthly cap
  amount numeric(12,2) not null check (amount >= 0),
  -- optional weekly pacing target. The SAME money viewed at a different
  -- cadence, never an additional allowance, so it is a column and not a second
  -- budget row: two rows would double-count the category in every total.
  weekly_amount numeric(12,2) check (weekly_amount is null or weekly_amount >= 0),
  carryover boolean not null default false,
  -- The "Misc" catch-all: everything no other budget claims. At most one per
  -- user, enforced by the partial unique index below. A new category lands here
  -- automatically instead of silently escaping every budget.
  is_remainder boolean not null default false,
  -- Editing an amount must not rewrite history: carry for earlier months is
  -- computed from the amount that was in force then.
  active_from date not null default date_trunc('month', now())::date,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists budgets_one_remainder_per_user
  on public.budgets (user_id)
  where is_remainder and archived_at is null;

create index if not exists budgets_user_idx
  on public.budgets (user_id, archived_at);

create table if not exists public.budget_categories (
  budget_id uuid not null references public.budgets(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (budget_id, category_id)
);

-- A category in two budgets would double-count its spend and every total would
-- quietly stop reconciling. One budget per category, per user.
create unique index if not exists budget_categories_one_budget_per_category
  on public.budget_categories (user_id, category_id);

create table if not exists public.budget_groups (
  budget_id uuid not null references public.budgets(id) on delete cascade,
  group_id uuid not null references public.transaction_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (budget_id, group_id)
);

create unique index if not exists budget_groups_one_budget_per_group
  on public.budget_groups (user_id, group_id);

alter table public.budgets enable row level security;
alter table public.budget_categories enable row level security;
alter table public.budget_groups enable row level security;

create policy "Users manage their own budgets"
  on public.budgets for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage their own budget_categories"
  on public.budget_categories for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage their own budget_groups"
  on public.budget_groups for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- profiles.monthly_budget is left in place on purpose. While a user has no
-- budgets the app falls back to it, so the Home ring and the Activity strip
-- keep working from the first render instead of showing zero.
