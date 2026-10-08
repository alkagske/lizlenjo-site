import type { APIRoute } from 'astro';
import { bumpStat } from '../../lib/db';
import { nairobiDay } from '../../lib/format';
export const prerender = false;

/** Cookieless reading counter: "read" and "complete" (scrolled past the final paragraph). */
export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;
  let b: { slug?: unknown; event?: unknown } = {};
  try { b = JSON.parse(await request.text()); } catch { return new Response(null, { status: 204 }); }
  const slug = typeof b.slug === 'string' ? b.slug.slice(0, 80) : '';
  const event = b.event === 'complete' ? 'completions' : b.event === 'read' ? 'reads' : null;
  if (!slug || !event) return new Response(null, { status: 204 });
  const ua = request.headers.get('user-agent') ?? '';
  if (/bot|crawl|spider|preview|headless/i.test(ua)) return new Response(null, { status: 204 });
  const post = await env.DB.prepare(`SELECT id FROM posts WHERE slug = ? AND status = 'published'`).bind(slug).first<{ id: number }>();
  if (post) await bumpStat(env.DB, post.id, nairobiDay(), event);
  return new Response(null, { status: 204 });
};
