import type { APIRoute } from 'astro';
import { bad, json, readBody, str } from '../../../../lib/http';
import { listPhotos } from '../../../../lib/db';
import { LOOKBOOK_COLLECTIONS } from '../../../../content/site';
export const prerender = false;

export const GET: APIRoute = async ({ locals }) => json({ ok: true, photos: await listPhotos(locals.runtime.env.DB, true) });

/** Register an uploaded image (already in R2) as a Lookbook photo. */
export const POST: APIRoute = async ({ locals, request }) => {
  const b = await readBody(request);
  const key = str(b.key, 300);
  if (!key.startsWith('photos/')) return bad('Upload the image first.');
  const collection = (LOOKBOOK_COLLECTIONS as readonly string[]).includes(String(b.collection)) ? String(b.collection) : 'Editorial';
  const db = locals.runtime.env.DB;
  const max = await db.prepare(`SELECT COALESCE(MAX(sort), 0) AS m FROM photos`).first<{ m: number }>();
  const row = await db
    .prepare(`INSERT INTO photos (r2_key, caption, alt, collection, sort, width, height) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *`)
    .bind(key, str(b.caption, 200), str(b.alt, 300), collection, (max?.m ?? 0) + 10, Number(b.width) || 0, Number(b.height) || 0)
    .first();
  return json({ ok: true, photo: row });
};

/** Reorder: body { ids: number[] } in display order. */
export const PUT: APIRoute = async ({ locals, request }) => {
  const { ids } = await readBody(request);
  if (!Array.isArray(ids) || !ids.every((x) => Number.isInteger(x))) return bad('ids required');
  const db = locals.runtime.env.DB;
  await db.batch((ids as number[]).map((id, i) => db.prepare(`UPDATE photos SET sort = ? WHERE id = ?`).bind((i + 1) * 10, id)));
  return json({ ok: true });
};
