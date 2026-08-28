-- Who decided how much of a transaction counts toward a subscription.
--
-- The nightly routine is about to set bundled orders down to the subscription's
-- typical cost. Without this column it cannot tell a row nobody has touched from
-- one where the user deliberately said "no, count the whole charge": both look
-- like a full attribution, so the routine would overrule that choice every night.
--
-- null   = nobody has decided, the full charge was copied in at link time
-- manual = the user set it, never to be overwritten by the routine
-- routine = the nightly pass estimated it, the user may still change it

alter table public.subscription_transactions
  add column if not exists attribution_set_by text
  check (attribution_set_by in ('manual', 'routine'));
