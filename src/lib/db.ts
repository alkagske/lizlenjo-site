/** D1 access. All SQL lives here. */

export type Status = 'draft' | 'scheduled' | 'published';

export interface PostRow {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  tags: string;
  body_json: string;
  body_text: string;
  word_count: number;
  cover_key: string | null;
  cover_alt: string;
  status: Status;
  publish_at: string | null;
  published_at: string | null;
  series_id: number | null;
  series_order: number | null;
  is_sample: number;
  created_at: string;
  updated_at: string;
}

export interface Post extends Omit<PostRow, 'tags'> {
  tags: string[];
  series_name?: string | null;
}

export interface CommentRow {
  id: number;
  post_id: number;
  name: string;
  email: string;
  text: string;
  status: 'pending' | 'approved';
  spam_score: number;
  spam_reason: string;
  created_at: string;
}

export interface PhotoRow {
  id: number;
  r2_key: string;
  caption: string;
  alt: string;
  collection: 'Advocate' | 'Lecturer' | 'Fashion' | 'Editorial';
  sort: number;
  width: number;
  height: number;
  object_position: string;
  published: number;
}

export interface VersionRow {
  id: number;
  post_id: number;
  title: string;
  excerpt: string;
  body_json: string;
  word_count: number;
  kind: 'autosave' | 'published';
  created_at: string;
}

export function toPost(r: PostRow & { series_name?: string | null }): Post {
  let tags: string[] = [];
  try {
    const t = JSON.parse(r.tags);
    if (Array.isArray(t)) tags = t.map(String);
  } catch { /* keep empty */ }
  return { ...r, tags };
}

const POST_COLS = `p.*, s.name AS series_name`;
const FROM = `FROM posts p LEFT JOIN series s ON s.id = p.series_id`;

/** Published posts, newest first. Excludes the body for list views unless asked. */
export async function listPublished(db: D1Database, opts: { withBody?: boolean } = {}): Promise<Post[]> {
  const cols = opts.withBody ? POST_COLS : `p.id, p.slug, p.title, p.excerpt, p.category, p.tags, '' AS body_json, p.body_text, p.word_count, p.cover_key, p.cover_alt, p.status, p.publish_at, p.published_at, p.series_id, p.series_order, p.is_sample, p.created_at, p.updated_at, s.name AS series_name`;
  const { results } = await db.prepare(`SELECT ${cols} ${FROM} WHERE p.status = 'published' ORDER BY p.published_at DESC`).all<PostRow & { series_name: string | null }>();
  return results.map(toPost);
}

export async function getPublishedBySlug(db: D1Database, slug: string): Promise<Post | null> {
  const r = await db.prepare(`SELECT ${POST_COLS} ${FROM} WHERE p.slug = ? AND p.status = 'published'`).bind(slug).first<PostRow & { series_name: string | null }>();
  return r ? toPost(r) : null;
}

export async function getPost(db: D1Database, id: number): Promise<Post | null> {
  const r = await db.prepare(`SELECT ${POST_COLS} ${FROM} WHERE p.id = ?`).bind(id).first<PostRow & { series_name: string | null }>();
  return r ? toPost(r) : null;
}

export async function listAllPosts(db: D1Database): Promise<Post[]> {
  const { results } = await db
    .prepare(`SELECT ${POST_COLS} ${FROM} ORDER BY CASE p.status WHEN 'scheduled' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END, COALESCE(p.publish_at, p.published_at, p.updated_at) DESC`)
    .all<PostRow & { series_name: string | null }>();
  return results.map(toPost);
}

export async function listSeries(db: D1Database): Promise<{ id: number; name: string }[]> {
  const { results } = await db.prepare(`SELECT id, name FROM series ORDER BY name`).all<{ id: number; name: string }>();
  return results;
}

export async function approvedComments(db: D1Database, postId: number): Promise<CommentRow[]> {
  const { results } = await db.prepare(`SELECT * FROM comments WHERE post_id = ? AND status = 'approved' ORDER BY created_at ASC`).bind(postId).all<CommentRow>();
  return results;
}

export async function pendingCount(db: D1Database): Promise<number> {
  const r = await db.prepare(`SELECT COUNT(*) AS n FROM comments WHERE status = 'pending'`).first<{ n: number }>();
  return r?.n ?? 0;
}

/** Flip scheduled posts whose time has come. Returns how many went live. */
export async function publishDue(db: D1Database, now: string): Promise<number> {
  const { results } = await db.prepare(`SELECT id, title, excerpt, body_json, word_count FROM posts WHERE status = 'scheduled' AND publish_at IS NOT NULL AND publish_at <= ?`).bind(now).all<{ id: number; title: string; excerpt: string; body_json: string; word_count: number }>();
  if (!results.length) return 0;
  const stmts = results.flatMap((p) => [
    db.prepare(`UPDATE posts SET status = 'published', published_at = COALESCE(publish_at, ?), updated_at = ? WHERE id = ?`).bind(now, now, p.id),
    db.prepare(`INSERT INTO post_versions (post_id, title, excerpt, body_json, word_count, kind, created_at) VALUES (?, ?, ?, ?, ?, 'published', ?)`).bind(p.id, p.title, p.excerpt, p.body_json, p.word_count, now),
  ]);
  await db.batch(stmts);
  return results.length;
}

export async function listPhotos(db: D1Database, includeHidden = false): Promise<PhotoRow[]> {
  const { results } = await db.prepare(`SELECT * FROM photos ${includeHidden ? '' : 'WHERE published = 1'} ORDER BY sort ASC, id ASC`).all<PhotoRow>();
  return results;
}

/** Record a reader event for today's stats row. */
export async function bumpStat(db: D1Database, postId: number, day: string, field: 'reads' | 'completions' | 'signups'): Promise<void> {
  await db
    .prepare(`INSERT INTO post_stats_daily (post_id, date, ${field}) VALUES (?, ?, 1) ON CONFLICT (post_id, date) DO UPDATE SET ${field} = ${field} + 1`)
    .bind(postId, day)
    .run();
}
