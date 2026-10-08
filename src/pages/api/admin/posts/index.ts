import type { APIRoute } from 'astro';
import { json } from '../../../../lib/http';
import { listAllPosts } from '../../../../lib/db';
export const prerender = false;

export const GET: APIRoute = async ({ locals }) => json({ ok: true, posts: await listAllPosts(locals.runtime.env.DB) });

/** Create an empty draft. Form posts (the "New post" button) are redirected into the editor. */
export const POST: APIRoute = async ({ locals, request, redirect }) => {
  const db = locals.runtime.env.DB;
  const slug = `untitled-${Date.now().toString(36)}`;
  const r = await db.prepare(`INSERT INTO posts (slug, title, status) VALUES (?, '', 'draft') RETURNING id`).bind(slug).first<{ id: number }>();
  if (!r) return json({ ok: false, error: 'Could not create post' }, 500);
  if ((request.headers.get('content-type') ?? '').includes('form')) return redirect(`/workroom/editor/${r.id}`, 303);
  return json({ ok: true, id: r.id });
};
