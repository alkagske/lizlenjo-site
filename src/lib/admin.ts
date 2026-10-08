/** Shared logic for the Workroom API. All routes under /api/admin are behind Cloudflare Access (see middleware). */
import { slugify } from './slug';
import { docStats, parseDoc } from './tiptap';
import { nowIso } from './format';
import { CATEGORIES } from '../content/site';
import type { Status } from './db';

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
export const IMAGE_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif', 'image/gif': 'gif' };
export const KEEP_AUTOSAVES = 20;

/** "2026-10-21T09:00" typed in the Workroom is Nairobi time (UTC+3, no daylight saving). */
export function nairobiLocalToIso(local: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number) as number[];
  const t = Date.UTC(y!, mo! - 1, d!, h! - 3, mi!);
  return Number.isFinite(t) ? new Date(t).toISOString().replace(/\.\d{3}Z$/, 'Z') : null;
}

/** Inverse of nairobiLocalToIso, for <input type="datetime-local">. */
export function isoToNairobiLocal(iso: string | null | undefined): string {
  if (!iso) return '';
  const t = new Date(new Date(iso).getTime() + 3 * 3600 * 1000);
  return t.toISOString().slice(0, 16);
}

export async function uniqueSlug(db: D1Database, wanted: string, id: number): Promise<string> {
  const base = slugify(wanted || 'untitled');
  let slug = base;
  for (let i = 2; i < 100; i++) {
    const hit = await db.prepare(`SELECT id FROM posts WHERE slug = ? AND id != ?`).bind(slug, id).first();
    if (!hit) return slug;
    slug = `${base.slice(0, 56)}-${i}`;
  }
  return `${base.slice(0, 50)}-${Date.now().toString(36)}`;
}

export interface PostPatch {
  title?: string;
  excerpt?: string;
  category?: string;
  tags?: string[];
  body_json?: unknown;
  slug?: string;
  cover_key?: string | null;
  cover_alt?: string;
  series_id?: number | null;
  /** draft | now | schedule */
  mode?: 'draft' | 'now' | 'schedule';
  /** datetime-local value in Nairobi time, or ISO */
  publish_at?: string | null;
  autosave?: boolean;
}

export interface SaveResult {
  ok: boolean;
  error?: string;
  post?: { id: number; slug: string; status: Status; publish_at: string | null; published_at: string | null; updated_at: string; word_count: number };
}

/** Apply a partial update from the editor or calendar. */
export async function savePost(db: D1Database, id: number, patch: PostPatch): Promise<SaveResult> {
  const cur = await db.prepare(`SELECT * FROM posts WHERE id = ?`).bind(id).first<Record<string, unknown>>();
  if (!cur) return { ok: false, error: 'Post not found' };
  const now = nowIso();
  const sets: string[] = [];
  const vals: unknown[] = [];
  const set = (col: string, v: unknown) => { sets.push(`${col} = ?`); vals.push(v); };

  if (typeof patch.title === 'string') set('title', patch.title.slice(0, 300));
  if (typeof patch.excerpt === 'string') set('excerpt', patch.excerpt.slice(0, 600));
  if (typeof patch.category === 'string') set('category', (CATEGORIES as readonly string[]).includes(patch.category) ? patch.category : 'Copyright');
  if (Array.isArray(patch.tags)) set('tags', JSON.stringify(patch.tags.map((t) => String(t).trim().slice(0, 40)).filter(Boolean).slice(0, 12)));
  if (typeof patch.cover_alt === 'string') set('cover_alt', patch.cover_alt.slice(0, 300));
  if (patch.cover_key === null || typeof patch.cover_key === 'string') set('cover_key', patch.cover_key);
  if (patch.series_id === null || Number.isInteger(patch.series_id)) {
    set('series_id', patch.series_id);
    if (patch.series_id == null) set('series_order', null);
    else if (patch.series_id !== cur.series_id) {
      const r = await db.prepare(`SELECT COALESCE(MAX(series_order), 0) + 1 AS n FROM posts WHERE series_id = ?`).bind(patch.series_id).first<{ n: number }>();
      set('series_order', r?.n ?? 1);
    }
  }
  let words = Number(cur.word_count) || 0;
  let bodyJson = String(cur.body_json);
  if (patch.body_json !== undefined) {
    const doc = parseDoc(typeof patch.body_json === 'string' ? patch.body_json : JSON.stringify(patch.body_json));
    bodyJson = JSON.stringify(doc);
    const st = docStats(doc);
    words = st.words;
    set('body_json', bodyJson);
    set('body_text', st.text);
    set('word_count', st.words);
  }
  // Slug: explicit, or follow the title while the post has never been published.
  const title = typeof patch.title === 'string' ? patch.title : String(cur.title);
  if (typeof patch.slug === 'string' && patch.slug.trim()) set('slug', await uniqueSlug(db, patch.slug, id));
  else if (typeof patch.title === 'string' && !cur.published_at && String(cur.slug).startsWith('untitled')) set('slug', await uniqueSlug(db, title, id));

  let status = cur.status as Status;
  let publishAt = (cur.publish_at as string | null) ?? null;
  let publishedAt = (cur.published_at as string | null) ?? null;
  let wentLive = false;
  if (patch.mode) {
    if (patch.mode === 'draft') { status = 'draft'; publishAt = null; }
    if (patch.mode === 'now') {
      if (status !== 'published') wentLive = true;
      status = 'published';
      publishedAt = publishedAt ?? now;
      publishAt = null;
    }
    if (patch.mode === 'schedule') {
      const when = patch.publish_at ? (patch.publish_at.endsWith('Z') ? patch.publish_at : nairobiLocalToIso(patch.publish_at)) : null;
      if (!when) return { ok: false, error: 'Choose a date and time to schedule.' };
      status = 'scheduled';
      publishAt = when;
      publishedAt = null;
    }
    set('status', status);
    set('publish_at', publishAt);
    set('published_at', publishedAt);
  }
  set('updated_at', now);
  vals.push(id);
  const stmts = [db.prepare(`UPDATE posts SET ${sets.join(', ')} WHERE id = ?`).bind(...vals)];
  const excerpt = typeof patch.excerpt === 'string' ? patch.excerpt : String(cur.excerpt);
  if (patch.autosave && patch.body_json !== undefined) {
    const last = await db.prepare(`SELECT body_json, title FROM post_versions WHERE post_id = ? ORDER BY id DESC LIMIT 1`).bind(id).first<{ body_json: string; title: string }>();
    if (!last || last.body_json !== bodyJson || last.title !== title) {
      stmts.push(db.prepare(`INSERT INTO post_versions (post_id, title, excerpt, body_json, word_count, kind, created_at) VALUES (?, ?, ?, ?, ?, 'autosave', ?)`).bind(id, title, excerpt, bodyJson, words, now));
      stmts.push(db.prepare(`DELETE FROM post_versions WHERE post_id = ? AND kind = 'autosave' AND id NOT IN (SELECT id FROM post_versions WHERE post_id = ? AND kind = 'autosave' ORDER BY id DESC LIMIT ?)`).bind(id, id, KEEP_AUTOSAVES));
    }
  }
  if (wentLive || (patch.mode === 'now' && patch.body_json !== undefined)) {
    stmts.push(db.prepare(`INSERT INTO post_versions (post_id, title, excerpt, body_json, word_count, kind, created_at) VALUES (?, ?, ?, ?, ?, 'published', ?)`).bind(id, title, excerpt, bodyJson, words, now));
  }
  await db.batch(stmts);
  const after = await db.prepare(`SELECT id, slug, status, publish_at, published_at, updated_at, word_count FROM posts WHERE id = ?`).bind(id).first<NonNullable<SaveResult['post']>>();
  return { ok: true, post: after ?? undefined };
}

export const intParam = (v: string | undefined) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};
