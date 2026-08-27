-- The SMS parser wrote the literal string 'null' into
-- bank_account_aliases.source_account_last4 for two rows, which rendered as
-- "Amazon Pay ••null" on the bank accounts page. Once the placeholder is
-- treated as absent, both rows alias an account onto itself, so they do
-- nothing but clutter the "merged in" list.
--
-- No transaction carries account_last4 = 'null', so no spend figure or count
-- depends on these rows. Verified before writing this file.

begin;

-- What is about to go. Expect exactly 2 rows:
--   Amazon Pay / null -> Amazon Pay /
--   PhonePe    / null -> PhonePe    /
select
  id,
  source_bank_name,
  source_account_last4,
  target_bank_name,
  target_account_last4
from bank_account_aliases
where lower(btrim(coalesce(source_account_last4, ''))) in ('null', 'undefined', 'none', 'nan');

-- Safety net: refuse to run if a transaction somehow depends on one of these
-- source accounts, in which case the alias is load-bearing and deleting it
-- would silently move that account's spend.
do $$
declare
  offending int;
begin
  select count(*) into offending
  from transactions
  where lower(btrim(coalesce(account_last4, ''))) in ('null', 'undefined', 'none', 'nan');

  if offending > 0 then
    raise exception
      'Aborting: % transaction row(s) carry a placeholder account_last4. Clean those first.',
      offending;
  end if;
end $$;

delete from bank_account_aliases
where lower(btrim(coalesce(source_account_last4, ''))) in ('null', 'undefined', 'none', 'nan');

commit;
