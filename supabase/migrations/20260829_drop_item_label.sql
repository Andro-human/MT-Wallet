-- Second half of retiring item_label. Run this only after the frontend that no
-- longer selects the column is deployed and verified live, otherwise a client
-- still asking for it gets 42703 on the whole enrichment select.
--
-- No view or index depended on the column (checked pg_depend), and no UI ever
-- rendered it, so the 93 distinct labels are not lost information — they are
-- unread information.

alter table public.txn_enrichment
  drop column if exists item_label;
