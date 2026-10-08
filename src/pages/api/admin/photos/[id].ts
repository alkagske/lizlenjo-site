import type { APIRoute } from 'astro';
import { bad, json, readBody } from '../../../../lib/http';
import { intParam } from '../../../../lib/admin';
import { LOOKBOOK_COLLECTIONS } from '../../../../content/site';
export const prerender = false;

export const PUT: APIRoute = async ({ params, locals, request }) => {
  const id = intParam(params.id);
  if (!id) return bad('Not found', 404);
  const b = await readBody(request);
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (typeof b.caption === 'string') { sets.push('caption = ?'); vals.push(b.caption.slice(0, 200)); }
  if (typeof b.alt === 'string') { sets.push('alt = ?'); vals.push(b.alt.slice(0, 300)); }
  if ((LOOKBOOK_COLLECTIONS as readonly string[]).includes(String(b.collection))) { sets.push('collection = ?'); vals.push(b.collection); }
  if (typeof b.published === 'boolean') { sets.push('published = ?'); vals.push(b.published ? 1 : 0); }
  if (typeof b.object_position === 'string' && /^\d{1,3}% \d{1,3}%$/.test(b.object_position)) { sets.push('object_position = ?'); vals.push(b.object_position); }
  if (!sets.length) return bad('Nothing to update');
  await locals.runtime.env.DB.prepare(`UPDATE photos SET ${sets.join(', ')} WHERE id = ?`).bind(...vals, id).run();
  return json({ ok: true });
};

/** Uploaded photos are deleted from R2 too. Built-in photos can only be hidden. */
export const DELETE: APIRoute = async ({ params, locals }) => {
  const id = intParam(params.id);
  if (!id) return bad('Not found', 404);
  const env = locals.runtime.env;
  const row = await env.DB.prepare(`SELECT r2_key FROM photos WHERE id = ?`).bind(id).first<{ r2_key: string }>();
  if (!row) return bad('Not found', 404);
  if (row.r2_key.startsWith('static/')) return bad('Built-in photos can be hidden, not deleted.');
  await env.MEDIA.delete(row.r2_key);
  await env.DB.prepare(`DELETE FROM photos WHERE id = ?`).bind(id).run();
  return json({ ok: true });
};
