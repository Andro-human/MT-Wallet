-- item_label is being retired. It was a coarse per-transaction theme label that
-- no surface ever rendered; service_identity replaced its one real consumer
-- (subscription note-clustering).
--
-- Dropping NOT NULL first, in its own migration, because the column cannot be
-- dropped safely yet: the deployed frontend still names it in the enrichment
-- select, and a missing column makes PostgREST reject the whole select (42703),
-- which would empty the Debt page and subscription detection rather than degrade
-- one feature. This step is enough to unblock POST /api/enrichment/submit, which
-- does not write item_label and would otherwise fail the not-null check on the
-- first new row. The DROP COLUMN follows once the new frontend is live.

alter table public.txn_enrichment
  alter column item_label drop not null;
