-- Stable per-category identity colours (DESIGN.md, revised 2026-08-25).
--
-- Every category owns a permanent colour. The eight-colour cap is NOT enforced
-- here: it is a RENDERING decision made per view, so the categories that lead
-- spending in whatever range you are looking at light up and the rest grey out.
-- Freezing membership in the database made off-peak months render their own
-- biggest slices grey, which is the opposite of useful.
--
-- Hues are spaced around the wheel with alternating lightness so any eight shown
-- together stay distinguishable. Income categories (Salary, Credit, Refund) sit
-- in the gold family per the income-is-gold rule. Unknown stays near-neutral: it
-- is a data-quality bucket, not a category.
--
-- Run as service role: 15 rows are is_system with user_id IS NULL.

BEGIN;

WITH palette(cat_name, hex) AS (VALUES
  ('Bills & Utilities', '#3BD0C5'),
  ('Cat', '#55A9FF'),
  ('Celebration', '#CFDF86'),
  ('Charity', '#5AE29B'),
  ('Credit', '#D9B25C'),
  ('Education', '#9FE25A'),
  ('Entertainment', '#DF86CC'),
  ('Food & Dining', '#FFAE33'),
  ('Fuel', '#E25AA2'),
  ('Gifting', '#D983FF'),
  ('Groceries', '#86DF9C'),
  ('Health', '#E8D44D'),
  ('Home Spend', '#7FCF6B'),
  ('Investment', '#DF8886'),
  ('Junk Food', '#E2855A'),
  ('Lent', '#5AE25E'),
  ('Misc', '#9F86DF'),
  ('Recurring', '#9C5AE2'),
  ('Refund', '#C79A45'),
  ('Salary', '#E9C46A'),
  ('Shopping', '#FF7A9E'),
  ('Subscription', '#8F86FF'),
  ('Transfer', '#86CCDF'),
  ('Transport', '#5A77E2'),
  ('Travel', '#86DFC4'),
  ('Trip', '#DB5AE2'),
  ('Unknown', '#93858F')
)
UPDATE categories c
   SET color = p.hex, updated_at = now()
  FROM palette p
 WHERE c.name = p.cat_name
   AND (c.user_id = 'b9a63ab5-008d-4afc-966f-bdff975862d5' OR c.user_id IS NULL);

COMMIT;

-- Expect 27 rows, every colour distinct (count = 1 on every line).
SELECT color, count(*) AS n, string_agg(name, ', ') AS categories
  FROM categories
 WHERE (user_id = 'b9a63ab5-008d-4afc-966f-bdff975862d5' OR user_id IS NULL)
 GROUP BY color ORDER BY n DESC, color;
