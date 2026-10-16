import type { APIRoute } from 'astro';
import { createSession, deleteSession, getSession, GoogleAuthError, googleConfigured, seconds } from '../../../../lib/google-photos';
import { json } from '../../../../lib/http';
export const prerender = false;

const needAuth = () => json({ ok: false, needAuth: true, error: 'Sign in to Google Photos first.' }, 401);

/** Start a picking session. Returns the Google picker address to open. */
export const POST: APIRoute = async ({ locals, cookies }) => {
  if (!googleConfigured(locals.runtime.env)) return json({ ok: false, notConfigured: true, error: 'Google Photos is not set up yet. See README → Google Photos.' }, 400);
  const token = cookies.get('ll_g_token')?.value;
  if (!token) return needAuth();
  try {
    const s = await createSession(token);
    return json({ ok: true, id: s.id, pickerUri: `${s.pickerUri.replace(/\/$/, '')}/autoclose`, pollEvery: seconds(s.pollingConfig?.pollInterval, 3), timeout: seconds(s.pollingConfig?.timeoutIn, 1800) });
  } catch (e) {
    if (e instanceof GoogleAuthError) return needAuth();
    console.error(e);
    return json({ ok: false, error: 'Google Photos did not respond. Please try again.' }, 502);
  }
};

/** Has Liz finished picking? */
export const GET: APIRoute = async ({ cookies, url }) => {
  const token = cookies.get('ll_g_token')?.value;
  const id = url.searchParams.get('id');
  if (!token) return needAuth();
  if (!id) return json({ ok: false, error: 'id required' }, 400);
  try {
    const s = await getSession(token, id);
    return json({ ok: true, done: !!s.mediaItemsSet });
  } catch (e) {
    if (e instanceof GoogleAuthError) return needAuth();
    return json({ ok: false, error: 'Could not check the Google Photos window.' }, 502);
  }
};

export const DELETE: APIRoute = async ({ cookies, url }) => {
  const token = cookies.get('ll_g_token')?.value;
  const id = url.searchParams.get('id');
  if (token && id) await deleteSession(token, id);
  return json({ ok: true });
};
