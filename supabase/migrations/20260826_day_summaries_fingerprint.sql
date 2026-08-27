-- Staleness signal for day summaries.
--
-- Notes get edited after the fact. Without a fingerprint of the notes a day is
-- summarised once and then never revisited, so the line silently describes an
-- older version of the day. The nightly run compares this against the payload's
-- notes_fingerprint and rewrites the day when it differs.
--
-- Null on the rows seeded by hand, which is correct: those carry model =
-- 'manual' and are never overwritten by a run anyway.

alter table public.day_summaries
  add column if not exists notes_fingerprint text;
