-- LOCAL TEST DATA ONLY (applied by playwright.config.ts to the local D1, never to production).
-- Publishes the prototype sample posts so the reader pages can be smoke-tested.
UPDATE posts SET status = 'published', published_at = CASE id
  WHEN 1 THEN '2026-09-18T06:00:00Z' WHEN 2 THEN '2026-08-30T06:00:00Z' WHEN 3 THEN '2026-08-02T06:00:00Z'
  WHEN 4 THEN '2026-07-11T06:00:00Z' WHEN 5 THEN '2026-06-20T06:00:00Z' WHEN 6 THEN '2025-11-14T06:00:00Z' END
WHERE id IN (1, 2, 3, 4, 5, 6);
UPDATE posts SET status = 'scheduled', publish_at = '2030-10-21T06:00:00Z' WHERE id = 7;
