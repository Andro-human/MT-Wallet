-- Charges and contributions are both linked to a subscription, and only one of
-- them is a cost.
--
-- A family plan is reimbursed by the other members, irregularly and in amounts
-- that match no single charge (₹450 against a ₹299 monthly). Those credits were
-- being linked as occurrences, so on Youtube Premium the range read ₹1 to ₹450
-- with the top of it being money that came IN, last_amount was the credit, and
-- predicted_next was computed across a 3-day charge-to-credit gap in a monthly
-- series. The credit also counted as income while the charge counted as spend,
-- so the same ₹450 was double counted in opposite directions.
--
-- Backfilled from direction, which is exactly what the distinction is.

alter table public.subscription_transactions
  add column if not exists kind text not null default 'charge'
  check (kind in ('charge', 'contribution'));

update public.subscription_transactions st
set kind = 'contribution'
from public.transactions t
where t.id = st.transaction_id
  and t.direction = 'credit'
  and st.kind <> 'contribution';

create index if not exists subscription_transactions_kind_idx
  on public.subscription_transactions (subscription_id, kind);

-- Money coming back is not income, the same call already made for loan
-- repayments. Left as a charge it would inflate income for a month in which
-- nothing was earned.
update public.transactions t
set is_income = false
from public.subscription_transactions st
where st.transaction_id = t.id
  and st.kind = 'contribution'
  and t.is_income = true;
