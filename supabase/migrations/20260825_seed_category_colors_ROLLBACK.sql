-- Restores the pre-seed category colours captured 2026-08-25.
-- Run as service role; covers is_system rows (user_id IS NULL) too.
BEGIN;
UPDATE categories SET color = CASE name
  WHEN 'Bills & Utilities' THEN '#EF4444' WHEN 'Cat'          THEN '#FB923C'
  WHEN 'Celebration'       THEN '#F43F5E' WHEN 'Charity'      THEN '#14B8A6'
  WHEN 'Credit'            THEN '#16A34A' WHEN 'Education'    THEN '#F97316'
  WHEN 'Entertainment'     THEN '#8B5CF6' WHEN 'Food & Dining' THEN '#F59E0B'
  WHEN 'Fuel'              THEN '#EAB308' WHEN 'Gifting'      THEN '#EC4899'
  WHEN 'Groceries'         THEN '#22C55E' WHEN 'Health'       THEN '#10B981'
  WHEN 'Home Spend'        THEN '#8B5CF6' WHEN 'Investment'   THEN '#059669'
  WHEN 'Junk Food'         THEN '#F97316' WHEN 'Lent'         THEN '#6366F1'
  WHEN 'Misc'              THEN '#78716C' WHEN 'Recurring'    THEN '#6366F1'
  WHEN 'Refund'            THEN '#2563EB' WHEN 'Salary'       THEN '#15803D'
  WHEN 'Shopping'          THEN '#EC4899' WHEN 'Subscription' THEN '#8B5CF6'
  WHEN 'Transfer'          THEN '#6B7280' WHEN 'Transport'    THEN '#3B82F6'
  WHEN 'Travel'            THEN '#06B6D4' WHEN 'Trip'         THEN '#0EA5E9'
  WHEN 'Unknown'           THEN '#A1A1AA' ELSE color END
WHERE (user_id = 'b9a63ab5-008d-4afc-966f-bdff975862d5' OR user_id IS NULL);
COMMIT;
