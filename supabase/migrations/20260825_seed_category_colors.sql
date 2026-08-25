-- Seed category colours onto the Bahi-Khata Noir palette (DESIGN.md).
--
-- Eight categories own an identity colour; everything else renders as the muted
-- long tail. Assignment is FROZEN once applied: colours that follow spend rank
-- would reshuffle monthly and destroy the learnability the cap exists to create.
--
-- Seven slots went to all-time expense leaders. Subscription is reserved out of
-- rank (#20, Rs6,118) because it owns a whole surface and needs a stable identity.
-- Unknown (Rs50,443, #7 by spend) is a data-quality bucket, not a category, so it
-- stays muted deliberately.
--
-- MUST run as service role (Supabase SQL editor). 15 of the 27 rows are
-- is_system = true with user_id IS NULL; RLS blocks the authenticated path there,
-- and PostgREST reports 204 success while affecting zero rows.

BEGIN;

WITH palette(cat_name, hex) AS (VALUES
  ('Bills & Utilities', '#3BD0C5'),  -- teal
  ('Shopping',          '#FF7A9E'),  -- bazaar rose
  ('Food & Dining',     '#FFAE33'),  -- marigold
  ('Health',            '#E8D44D'),  -- turmeric
  ('Home Spend',        '#7FCF6B'),  -- mandi green
  ('Gifting',           '#D983FF'),  -- orchid
  ('Cat',               '#55A9FF'),  -- rickshaw blue
  ('Subscription',      '#8F86FF')   -- indigo, reserved out of rank
)
UPDATE categories c
   SET color = p.hex, updated_at = now()
  FROM palette p
 WHERE c.name = p.cat_name
   AND (c.user_id = 'b9a63ab5-008d-4afc-966f-bdff975862d5' OR c.user_id IS NULL);

UPDATE categories
   SET color = '#8E8574', updated_at = now()
 WHERE (user_id = 'b9a63ab5-008d-4afc-966f-bdff975862d5' OR user_id IS NULL)
   AND name NOT IN (
     'Bills & Utilities', 'Shopping', 'Food & Dining', 'Health',
     'Home Spend', 'Gifting', 'Cat', 'Subscription'
   );

COMMIT;

-- Expect: 8 identity colours (1 row each) + 19 rows on #8E8574.
SELECT color, count(*) AS n, string_agg(name, ', ' ORDER BY name) AS categories
  FROM categories
 WHERE (user_id = 'b9a63ab5-008d-4afc-966f-bdff975862d5' OR user_id IS NULL)
 GROUP BY color
 ORDER BY n DESC, color;
