import type { APIRoute } from 'astro';
import { json } from '../../lib/http';
export const prerender = false;

/** Public, non-secret settings the browser needs (the Turnstile site key). */
export const GET: APIRoute = ({ locals }) =>
  json({ turnstileSiteKey: locals.runtime.env.TURNSTILE_SITE_KEY || '' }, 200, { 'cache-control': 'public, max-age=300' });
