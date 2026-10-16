import type { APIRoute } from 'astro';
import { authUrl, googleConfigured } from '../../../../lib/google-photos';
import { randomToken } from '../../../../lib/http';
export const prerender = false;

/** Step 1: send Liz to Google to allow "pick photos". Comes back to /api/admin/google/callback. */
export const GET: APIRoute = ({ locals, url, cookies, redirect }) => {
  const env = locals.runtime.env;
  if (!googleConfigured(env)) return redirect('/workroom/lookbook?google=not-configured', 302);
  const state = randomToken(16);
  cookies.set('ll_g_state', state, { path: '/api/admin/google', httpOnly: true, secure: url.protocol === 'https:', sameSite: 'lax', maxAge: 600 });
  return redirect(authUrl({ clientId: env.GOOGLE_CLIENT_ID }, url.origin, state), 302);
};
