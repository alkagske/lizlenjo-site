/**
 * Google Photos Picker API (https://developers.google.com/photos/picker).
 * Since March 2025 Google no longer lets apps read albums in the background; instead the user
 * picks photos in a Google-hosted window and the app may then download just those.
 *
 * Flow: OAuth sign-in → create a picking session → open its pickerUri → poll until the user is
 * done → list the picked items page by page → download each photo into R2 → delete the session.
 */

export const SCOPE = 'https://www.googleapis.com/auth/photospicker.mediaitems.readonly';
const API = 'https://photospicker.googleapis.com/v1';
/** Long edge for imported photos: enough for the full-screen lightbox. */
export const IMPORT_SIZE = 2400;

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
}

export const googleConfigured = (env: { GOOGLE_CLIENT_ID?: string; GOOGLE_CLIENT_SECRET?: string }) =>
  !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

export const redirectUri = (origin: string) => `${origin}/api/admin/google/callback`;

export function authUrl(cfg: Pick<GoogleConfig, 'clientId'>, origin: string, state: string): string {
  const q = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: redirectUri(origin),
    response_type: 'code',
    scope: SCOPE,
    state,
    access_type: 'online',
    include_granted_scopes: 'true',
    prompt: 'select_account',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

export async function exchangeCode(cfg: GoogleConfig, origin: string, code: string, fetcher: typeof fetch = fetch): Promise<{ accessToken: string; expiresIn: number }> {
  const res = await fetcher('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: cfg.clientId, client_secret: cfg.clientSecret, redirect_uri: redirectUri(origin), grant_type: 'authorization_code' }),
  });
  const data = (await res.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !data.access_token) throw new Error(`Google sign-in failed: ${data.error ?? res.status}`);
  return { accessToken: data.access_token, expiresIn: data.expires_in ?? 3600 };
}

export class GoogleAuthError extends Error {}

async function api<T>(token: string, path: string, init: RequestInit = {}, fetcher: typeof fetch = fetch): Promise<T> {
  const res = await fetcher(`${API}${path}`, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` } });
  if (res.status === 401 || res.status === 403) throw new GoogleAuthError('Google sign-in expired');
  if (!res.ok) throw new Error(`Google Photos error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (res.status === 204 ? {} : await res.json()) as T;
}

export interface PickerSession {
  id: string;
  pickerUri: string;
  mediaItemsSet?: boolean;
  pollingConfig?: { pollInterval?: string; timeoutIn?: string };
}

export const createSession = (token: string, fetcher?: typeof fetch) =>
  api<PickerSession>(token, '/sessions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }, fetcher);

export const getSession = (token: string, id: string, fetcher?: typeof fetch) => api<PickerSession>(token, `/sessions/${encodeURIComponent(id)}`, {}, fetcher);

export const deleteSession = (token: string, id: string, fetcher?: typeof fetch) =>
  api<unknown>(token, `/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' }, fetcher).catch(() => undefined);

export interface PickedItem {
  id: string;
  createTime?: string;
  type?: 'PHOTO' | 'VIDEO' | 'TYPE_UNSPECIFIED';
  mediaFile?: { baseUrl: string; mimeType?: string; filename?: string; mediaFileMetadata?: { width?: number; height?: number } };
}

export function listItems(token: string, sessionId: string, pageToken?: string, pageSize = 20, fetcher?: typeof fetch) {
  const q = new URLSearchParams({ sessionId, pageSize: String(pageSize) });
  if (pageToken) q.set('pageToken', pageToken);
  return api<{ mediaItems?: PickedItem[]; nextPageToken?: string }>(token, `/mediaItems?${q}`, {}, fetcher);
}

/** "IMG_20240311_142233.jpg" → "" ; "Lagos Fashion Week.jpg" → "Lagos Fashion Week". */
export function captionFromFilename(name: string | undefined): string {
  if (!name) return '';
  const base = name.replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[_-]+/g, ' ').trim();
  if (/^(img|dsc|dscn|pxl|photo|image|screenshot|whatsapp image|mvimg|p)\s?\d/i.test(base) || /^\d[\d\s]*$/.test(base)) return '';
  return base.slice(0, 120);
}

/** Pixel size after Google scales the long edge down to IMPORT_SIZE (it never upscales). */
export function scaledSize(w = 0, h = 0, max = IMPORT_SIZE): { width: number; height: number } {
  if (!w || !h) return { width: 0, height: 0 };
  const k = Math.min(1, max / Math.max(w, h));
  return { width: Math.round(w * k), height: Math.round(h * k) };
}

export const downloadUrl = (item: PickedItem) => `${item.mediaFile!.baseUrl}=w${IMPORT_SIZE}-h${IMPORT_SIZE}`;

export const isPhoto = (item: PickedItem) => item.type !== 'VIDEO' && !!item.mediaFile?.baseUrl && !/^video\//.test(item.mediaFile.mimeType ?? '');

/** Seconds from Google's duration strings such as "5s" or "1.5s". */
export const seconds = (d: string | undefined, fallback: number) => {
  const n = d ? parseFloat(d) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
};
