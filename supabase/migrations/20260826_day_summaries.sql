-- One line per day describing where that day's money went.
--
-- Written by the nightly routine going forward; the August 2026 rows below were
-- authored by hand to seed the surface, and carry model = 'manual' so a later
-- run can tell them apart (same convention as manual txn_enrichment edits).
--
-- DISPLAY-ONLY. Nothing here feeds a total. Every number in a summary is
-- derived from transactions that COUNT: not a confirmed duplicate, marked
-- is_expense / is_income, and still positive after refund links are netted
-- off. That is the same rule classifyTransaction() applies in the client, so a
-- summary can never disagree with the day total rendered beside it.

create table if not exists public.day_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  summary text not null,
  model text not null default 'manual',
  generated_at timestamptz not null default now(),
  -- one summary per day, so the nightly job can upsert on conflict
  unique (user_id, day)
);

create index if not exists day_summaries_user_day_idx
  on public.day_summaries (user_id, day desc);

alter table public.day_summaries enable row level security;

create policy "Users manage their own day_summaries"
  on public.day_summaries
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

insert into public.day_summaries (user_id, day, summary, model) values
  ('b9a63ab5-008d-4afc-966f-bdff975862d5', '2026-08-01', 'Monthly milk ₹1,944. Theatre outing ₹690: pizza and parking. Salary credited.', 'manual'),
  ('b9a63ab5-008d-4afc-966f-bdff975862d5', '2026-08-02', 'Pantry ₹1,007 on mustard oil. Food delivery ₹936 across three orders. Tinder ₹319. PNB charge ₹295.', 'manual'),
  ('b9a63ab5-008d-4afc-966f-bdff975862d5', '2026-08-04', 'Food delivery ₹482. Country Delight milk ₹300.', 'manual'),
  ('b9a63ab5-008d-4afc-966f-bdff975862d5', '2026-08-05', 'Bumble ₹1,999. Food delivery ₹336.', 'manual'),
  ('b9a63ab5-008d-4afc-966f-bdff975862d5', '2026-08-06', 'All food delivery, ₹792 across two orders.', 'manual'),
  ('b9a63ab5-008d-4afc-966f-bdff975862d5', '2026-08-07', 'Food delivery ₹518 across two orders. CIBIL score subscription ₹399.', 'manual'),
  ('b9a63ab5-008d-4afc-966f-bdff975862d5', '2026-08-08', 'Food delivery ₹274. Milk ₹100.', 'manual'),
  ('b9a63ab5-008d-4afc-966f-bdff975862d5', '2026-08-09', 'Ear cleaner ₹1,499. YouTube Premium ₹105.', 'manual'),
  ('b9a63ab5-008d-4afc-966f-bdff975862d5', '2026-08-10', 'Life insurance ₹1,308. Food delivery ₹273. Sabji ₹92.', 'manual'),
  ('b9a63ab5-008d-4afc-966f-bdff975862d5', '2026-08-11', 'Bike petrol ₹512. Food delivery ₹284.', 'manual'),
  ('b9a63ab5-008d-4afc-966f-bdff975862d5', '2026-08-12', 'Ice cream run ₹413.', 'manual'),
  ('b9a63ab5-008d-4afc-966f-bdff975862d5', '2026-08-13', 'Preply English lessons ₹829. Food delivery ₹407 across two orders.', 'manual'),
  ('b9a63ab5-008d-4afc-966f-bdff975862d5', '2026-08-14', 'Amazon order ₹2,919: helmet, earphone cover, ketchup. Groceries ₹215.', 'manual'),
  ('b9a63ab5-008d-4afc-966f-bdff975862d5', '2026-08-15', 'Whey protein ₹1,799. Food delivery ₹196.', 'manual'),
  ('b9a63ab5-008d-4afc-966f-bdff975862d5', '2026-08-16', 'Food delivery ₹698 across two orders. Groceries ₹437: cheese, bread, milk.', 'manual'),
  ('b9a63ab5-008d-4afc-966f-bdff975862d5', '2026-08-17', 'One delivery order, ₹182.', 'manual'),
  ('b9a63ab5-008d-4afc-966f-bdff975862d5', '2026-08-18', 'Food delivery ₹360. Paneer and matar ₹260.', 'manual'),
  ('b9a63ab5-008d-4afc-966f-bdff975862d5', '2026-08-19', 'Groceries ₹202: egg and milk.', 'manual'),
  ('b9a63ab5-008d-4afc-966f-bdff975862d5', '2026-08-20', 'Food delivery ₹738 across four orders. Groceries ₹692 including cat food. Maid ₹100.', 'manual'),
  ('b9a63ab5-008d-4afc-966f-bdff975862d5', '2026-08-21', 'One delivery order, ₹249.', 'manual'),
  ('b9a63ab5-008d-4afc-966f-bdff975862d5', '2026-08-22', 'Amazon Premium ₹399. Milk ₹72.', 'manual'),
  ('b9a63ab5-008d-4afc-966f-bdff975862d5', '2026-08-23', 'One delivery order, ₹462.', 'manual'),
  ('b9a63ab5-008d-4afc-966f-bdff975862d5', '2026-08-25', 'Cat litter ₹2,507.', 'manual')
on conflict (user_id, day) do update
  set summary = excluded.summary,
      model = excluded.model,
      generated_at = now();

-- Expect 23 rows.
select count(*) as day_summaries, min(day) as first_day, max(day) as last_day
  from public.day_summaries
 where user_id = 'b9a63ab5-008d-4afc-966f-bdff975862d5';
