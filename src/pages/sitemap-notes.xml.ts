import type { APIRoute } from 'astro';
import { listPublished } from '../lib/db';
import { SITE } from '../content/site';
export const prerender = false;

/** Liz Notes pages are rendered on demand, so they get their own sitemap. */
export const GET: APIRoute = async ({ locals }) => {
  const posts = await listPublished(locals.runtime.env.DB).catch(() => []);
  const urls = [`<url><loc>${SITE.url}/notes</loc>${posts[0] ? `<lastmod>${posts[0].updated_at}</lastmod>` : ''}</url>`, `<url><loc>${SITE.url}/lookbook</loc></url>`, ...posts.map((p) => `<url><loc>${SITE.url}/notes/${p.slug}</loc><lastmod>${p.updated_at}</lastmod></url>`)];
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>`, {
    headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=0, s-maxage=3600' },
  });
};
