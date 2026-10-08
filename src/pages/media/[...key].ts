import type { APIRoute } from 'astro';
export const prerender = false;

/** Serves R2 objects (covers, inline images, Lookbook uploads) with long-lived caching. */
export const GET: APIRoute = async ({ params, locals, request }) => {
  const key = params.key ?? '';
  if (!key || key.includes('..')) return new Response('Not found', { status: 404 });
  const bucket = locals.runtime.env.MEDIA;
  const obj = await bucket.get(key, { onlyIf: request.headers, range: request.headers });
  if (!obj) return new Response('Not found', { status: 404 });
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('etag', obj.httpEtag);
  headers.set('cache-control', 'public, max-age=31536000, immutable');
  headers.set('x-content-type-options', 'nosniff');
  if (!('body' in obj) || !obj.body) return new Response(null, { status: 304, headers });
  return new Response(obj.body, { headers, status: obj.range ? 206 : 200 });
};
