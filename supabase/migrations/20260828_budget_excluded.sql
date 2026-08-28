-- Mark a transaction as a one-off that no budget should count.
--
-- Carry is symmetric now: overspend follows you into next month, floored at one
-- month's base. That is right for a Rs 493 grocery overshoot and wrong for a
-- laptop or a big trip, which are not overspending against a monthly rhythm at
-- all. Rather than guess with an amount threshold, which would silently drop a
-- large grocery run and quietly disagree with the spend total, the user marks
-- the transaction.
--
-- Excluded transactions still count in total spend everywhere else. Only budget
-- attribution skips them, and the budgets page reports the excluded total so the
-- money is never silently missing.

alter table public.txn_enrichment
  add column if not exists budget_excluded boolean not null default false;

create index if not exists txn_enrichment_budget_excluded_idx
  on public.txn_enrichment (user_id)
  where budget_excluded;
