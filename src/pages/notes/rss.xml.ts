import type { APIRoute } from 'astro';
import { listPublished } from '../../lib/db';
import { esc } from '../../lib/tiptap';
import { SITE } from '../../content/site';
export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  const posts = await listPublished(locals.runtime.env.DB).catch(() => []);
  const items = posts
    .slice(0, 30)
    .map((p) => `<item><title>${esc(p.title)}</title><link>${SITE.url}/notes/${p.slug}</link><guid isPermaLink="true">${SITE.url}/notes/${p.slug}</guid><pubDate>${new Date(p.published_at ?? p.created_at).toUTCString()}</pubDate><category>${esc(p.category)}</category><description>${esc(p.excerpt)}</description></item>`)
    .join('');
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>Liz Notes</title><link>${SITE.url}/notes</link><atom:link href="${SITE.url}/notes/rss.xml" rel="self" type="application/rss+xml"/><description>Notes on entertainment, fashion and intellectual property law by Liz Lenjo.</description><language>en-gb</language>${items}</channel></rss>`;
  return new Response(xml, { headers: { 'content-type': 'application/rss+xml; charset=utf-8', 'cache-control': 'public, max-age=0, s-maxage=600' } });
};
