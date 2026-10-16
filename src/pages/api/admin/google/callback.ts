import type { APIRoute } from 'astro';
import { exchangeCode } from '../../../../lib/google-photos';
export const prerender = false;

/** Step 2: Google returns here. The short-lived access token is kept in an HttpOnly cookie scoped to this API. */
export const GET: APIRoute = async ({ locals, url, cookies, redirect }) => {
  const env = locals.runtime.env;
  const state = cookies.get('ll_g_state')?.value;
  cookies.delete('ll_g_state', { path: '/api/admin/google' });
  if (url.searchParams.get('error')) return redirect('/workroom/lookbook?google=cancelled', 302);
  const code = url.searchParams.get('code');
  if (!code || !state || state !== url.searchParams.get('state')) return redirect('/workroom/lookbook?google=failed', 302);
  try {
    const { accessToken, expiresIn } = await exchangeCode({ clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET }, url.origin, code);
    cookies.set('ll_g_token', accessToken, { path: '/api/admin/google', httpOnly: true, secure: url.protocol === 'https:', sameSite: 'strict', maxAge: Math.max(60, expiresIn - 120) });
    return redirect('/workroom/lookbook?google=ready', 302);
  } catch (e) {
    console.error(e);
    return redirect('/workroom/lookbook?google=failed', 302);
  }
};
