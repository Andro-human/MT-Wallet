-- A cashback is a credit that lowers spending instead of counting as income.
--
-- It is earned by a statement's worth of spending rather than one purchase, so
-- a refund link (which nets a credit against a single debit) cannot express it.
-- cashback_month is the month whose spending it lowers, stored as the first of
-- that month; null means the credit is not a cashback. It usually arrives the
-- month after the spending that earned it, so it cannot be read off
-- transacted_at. It lowers the month's total only, never a category.
--
-- A cashback row is written with is_income and is_expense both false. Readers
-- still give cashback_month precedence over is_income, because flag writers
-- that predate it (merchant bulk edits, duplicate unmarking) can set is_income
-- back on, and a row counted as income and as a cashback would count twice.

alter table public.transactions
  add column if not exists cashback_month date
  check (
    cashback_month is null
    or (direction = 'credit' and cashback_month = date_trunc('month', cashback_month)::date)
  );

create index if not exists transactions_cashback_month_idx
  on public.transactions (user_id, cashback_month)
  where cashback_month is not null;

-- month_summary gains a cashback column, so it must be dropped and recreated.
-- spent is now net of the cashback attributed to the range's months, matching
-- the client-side total it is compared against.
drop function if exists public.month_summary(timestamptz, timestamptz);

create function public.month_summary(p_start timestamptz, p_end timestamptz)
returns table(spent numeric, income numeric, txn_count integer, cashback numeric)
language sql
stable
set search_path to 'public'
as $function$
  with enriched as (
    select
      t.id,
      t.amount,
      t.is_expense,
      t.is_income and t.cashback_month is null as is_income,
      coalesce((
        select sum(linked_amount) from public.refund_links rl
        where rl.original_transaction_id = t.id
      ), 0) as refund_total,
      coalesce((
        select sum(linked_amount) from public.refund_links rl
        where rl.refund_transaction_id = t.id
      ), 0) as allocation_total,
      exists (
        select 1 from public.duplicate_links dl
        where dl.duplicate_transaction_id = t.id
      ) as is_duplicate
    from public.transactions t
    where t.user_id = auth.uid()
      and t.transacted_at >= p_start
      and t.transacted_at <= p_end
  ),
  totals as (
    select
      coalesce(sum(
        case when is_expense and not is_duplicate
          then greatest(amount - refund_total, 0)
          else 0
        end
      ), 0)::numeric as gross_spent,
      coalesce(sum(
        case when is_income and not is_duplicate
          then greatest(amount - allocation_total, 0)
          else 0
        end
      ), 0)::numeric as income,
      count(*) filter (where not is_duplicate)::int as txn_count
    from enriched
  ),
  cashback as (
    select coalesce(sum(t.amount), 0)::numeric as total
    from public.transactions t
    where t.user_id = auth.uid()
      and t.cashback_month >= (p_start at time zone 'Asia/Kolkata')::date
      and t.cashback_month <= (p_end at time zone 'Asia/Kolkata')::date
      and not exists (
        select 1 from public.duplicate_links dl
        where dl.duplicate_transaction_id = t.id
      )
  )
  select
    greatest(totals.gross_spent - cashback.total, 0) as spent,
    totals.income,
    totals.txn_count,
    cashback.total as cashback
  from totals, cashback;
$function$;
