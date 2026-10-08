import type { APIRoute } from 'astro';
import { bad, json } from '../../../../../lib/http';
import { intParam } from '../../../../../lib/admin';
import type { VersionRow } from '../../../../../lib/db';
export const prerender = false;

export const GET: APIRoute = async ({ params, locals }) => {
  const id = intParam(params.id);
  if (!id) return bad('Not found', 404);
  const { results } = await locals.runtime.env.DB.prepare(`SELECT * FROM post_versions WHERE post_id = ? ORDER BY id DESC LIMIT 30`).bind(id).all<VersionRow>();
  return json({ ok: true, versions: results });
};
