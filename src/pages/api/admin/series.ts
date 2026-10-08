import type { APIRoute } from 'astro';
import { bad, json, readBody, str } from '../../../lib/http';
export const prerender = false;

export const POST: APIRoute = async ({ locals, request }) => {
  const name = str((await readBody(request)).name, 120);
  if (!name) return bad('Name the pattern set.');
  const db = locals.runtime.env.DB;
  await db.prepare(`INSERT INTO series (name) VALUES (?) ON CONFLICT (name) DO NOTHING`).bind(name).run();
  const row = await db.prepare(`SELECT id, name FROM series WHERE name = ?`).bind(name).first<{ id: number; name: string }>();
  return json({ ok: true, series: row });
};
