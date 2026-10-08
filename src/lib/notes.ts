import type { Post } from './db';
import { longDate } from './format';
import { readLabel } from './readtime';
import { mediaUrl } from './media';
import type { IndexPost } from '../islands/NotesIndex';

/** Published parts of each series, in order. */
export function seriesParts(posts: Post[]): Map<number, Post[]> {
  const map = new Map<number, Post[]>();
  for (const p of posts) {
    if (p.series_id == null) continue;
    if (!map.has(p.series_id)) map.set(p.series_id, []);
    map.get(p.series_id)!.push(p);
  }
  for (const list of map.values()) list.sort((a, b) => (a.series_order ?? 999) - (b.series_order ?? 999) || (a.published_at ?? '').localeCompare(b.published_at ?? ''));
  return map;
}

export function partLabel(p: Post, parts: Map<number, Post[]>): string | null {
  const list = p.series_id != null ? parts.get(p.series_id) : undefined;
  if (!list || list.length < 2) return null;
  return `Part ${list.findIndex((x) => x.id === p.id) + 1} of ${list.length}`;
}

export function coverUrl(p: Pick<Post, 'cover_key'>, width: number, transforms: boolean): string | null {
  return p.cover_key ? mediaUrl(p.cover_key, width, transforms) : null;
}

export function toIndexPost(p: Post, parts: Map<number, Post[]>, transforms: boolean): IndexPost {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt,
    category: p.category,
    tags: p.tags,
    date: p.published_at ?? p.created_at,
    dateLabel: longDate(p.published_at),
    read: readLabel(p.word_count),
    partLabel: partLabel(p, parts),
    cover: coverUrl(p, 960, transforms),
    coverAlt: p.cover_alt || '',
    search: [p.title, p.excerpt, p.category, p.tags.join(' '), p.body_text.slice(0, 20000)].join(' ').toLowerCase(),
  };
}
