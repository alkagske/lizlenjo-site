import type { APIRoute } from 'astro';
import { bad, json, readBody } from '../../../../../lib/http';
import { getPost } from '../../../../../lib/db';
import { intParam, savePost, type PostPatch } from '../../../../../lib/admin';
export const prerender = false;

export const GET: APIRoute = async ({ params, locals }) => {
  const id = intParam(params.id);
  const post = id ? await getPost(locals.runtime.env.DB, id) : null;
  return post ? json({ ok: true, post }) : bad('Not found', 404);
};

export const PUT: APIRoute = async ({ params, locals, request }) => {
  const id = intParam(params.id);
  if (!id) return bad('Not found', 404);
  const res = await savePost(locals.runtime.env.DB, id, (await readBody(request)) as PostPatch);
  return json(res, res.ok ? 200 : 400);
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  const id = intParam(params.id);
  if (!id) return bad('Not found', 404);
  await locals.runtime.env.DB.prepare(`DELETE FROM posts WHERE id = ?`).bind(id).run();
  return json({ ok: true });
};
