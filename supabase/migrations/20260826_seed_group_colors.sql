-- Group identity colours (DESIGN.md).
--
-- Eight of the nine groups shared #8B5CF6: CreateGroupDialog defaulted to it and
-- the picker was never touched, so in the combined allocation view the #2 and #3
-- largest items rendered identically. Groups and categories appear side by side
-- in that list, so these hues are placed in the widest gaps of the category ring.
-- Groups also sit at lower lightness and saturation than categories, so the class
-- reads as a family rather than as more categories.

BEGIN;

WITH palette(grp_name, hex) AS (VALUES
  ('Bareilly trip', '#9BC841'),
  ('Fixed', '#C5C841'),
  ('Gifting', '#71C841'),
  ('Gym', '#C85841'),
  ('Health insurance', '#C84152'),
  ('Iphone', '#4197C8'),
  ('Meghalaya trip', '#414BC8'),
  ('Muskan Bday', '#41BFC8'),
  ('Parents', '#C87F41')
)
UPDATE transaction_groups g
   SET color = p.hex, updated_at = now()
  FROM palette p
 WHERE g.name = p.grp_name
   AND g.user_id = 'b9a63ab5-008d-4afc-966f-bdff975862d5';

COMMIT;

-- Expect 9 rows, n = 1 on every line.
SELECT color, count(*) AS n, string_agg(name, ', ') AS groups
  FROM transaction_groups
 WHERE user_id = 'b9a63ab5-008d-4afc-966f-bdff975862d5'
 GROUP BY color ORDER BY n DESC, color;
