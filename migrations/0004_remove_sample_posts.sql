-- Remove the design prototype's sample posts (seeded as drafts in 0002) now that Liz's real
-- posts have been imported. Their versions are removed by ON DELETE CASCADE.
DELETE FROM comments WHERE post_id IN (SELECT id FROM posts WHERE is_sample = 1);
DELETE FROM post_versions WHERE post_id IN (SELECT id FROM posts WHERE is_sample = 1);
DELETE FROM posts WHERE is_sample = 1;
DELETE FROM series WHERE id NOT IN (SELECT series_id FROM posts WHERE series_id IS NOT NULL);
