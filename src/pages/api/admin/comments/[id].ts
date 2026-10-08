import type { APIRoute } from 'astro';
import { bad, json, readBody } from '../../../../lib/http';
import { intParam } from '../../../../lib/admin';
export const prerender = false;

export const POST: APIRoute = async ({ params, locals, request }) => {
  const id = intParam(params.id);
  if (!id) return bad('Not found', 404);
  const { action } = await readBody(request);
  const db = locals.runtime.env.DB;
  if (action === 'approve') await db.prepare(`UPDATE comments SET status = 'approved' WHERE id = ?`).bind(id).run();
  else if (action === 'delete') await db.prepare(`DELETE FROM comments WHERE id = ?`).bind(id).run();
  else return bad('Unknown action');
  return json({ ok: true });
};
