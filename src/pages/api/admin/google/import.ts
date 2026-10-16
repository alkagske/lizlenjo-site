import type { APIRoute } from 'astro';
import { captionFromFilename, downloadUrl, GoogleAuthError, isPhoto, listItems, scaledSize } from '../../../../lib/google-photos';
import { json, readBody } from '../../../../lib/http';
import { mediaUrl, transformsOn } from '../../../../lib/media';
import { LOOKBOOK_COLLECTIONS } from '../../../../content/site';
export const prerender = false;

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'jpg', 'image/heif': 'jpg', 'image/gif': 'gif' };

/**
 * Import one page (up to 20) of the photos Liz picked. The browser calls this repeatedly with
 * the returned pageToken until done, which keeps every request well inside Workers limits.
 */
export const POST: APIRoute = async ({ locals, cookies, request }) => {
  const env = locals.runtime.env;
  const token = cookies.get('ll_g_token')?.value;
  if (!token) return json({ ok: false, needAuth: true, error: 'Sign in to Google Photos first.' }, 401);
  const b = await readBody(request);
  const sessionId = typeof b.sessionId === 'string' ? b.sessionId : '';
  const pageToken = typeof b.pageToken === 'string' ? b.pageToken : undefined;
  const collection = (LOOKBOOK_COLLECTIONS as readonly string[]).includes(String(b.collection)) ? String(b.collection) : 'Editorial';
  if (!sessionId) return json({ ok: false, error: 'sessionId required' }, 400);

  let page: Awaited<ReturnType<typeof listItems>>;
  try {
    page = await listItems(token, sessionId, pageToken);
  } catch (e) {
    if (e instanceof GoogleAuthError) return json({ ok: false, needAuth: true, error: 'Google sign-in expired. Please sign in again.' }, 401);
    return json({ ok: false, error: 'Could not read the picked photos from Google.' }, 502);
  }

  const max = await env.DB.prepare(`SELECT COALESCE(MAX(sort), 0) AS m FROM photos`).first<{ m: number }>();
  let sort = max?.m ?? 0;
  const added: unknown[] = [];
  let skipped = 0;
  const d = new Date();
  for (const item of page.mediaItems ?? []) {
    if (!isPhoto(item)) { skipped++; continue; }
    const res = await fetch(downloadUrl(item), { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) { skipped++; continue; }
    const type = (res.headers.get('content-type') ?? item.mediaFile?.mimeType ?? 'image/jpeg').split(';')[0]!.trim();
    const ext = EXT[type] ?? 'jpg';
    const key = `photos/${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/gp-${crypto.randomUUID()}.${ext}`;
    const body = await res.arrayBuffer();
    await env.MEDIA.put(key, body, { httpMetadata: { contentType: type === 'image/heic' || type === 'image/heif' ? 'image/jpeg' : type, cacheControl: 'public, max-age=31536000, immutable' }, customMetadata: { source: 'google-photos', name: (item.mediaFile?.filename ?? '').slice(0, 200) } });
    const { width, height } = scaledSize(item.mediaFile?.mediaFileMetadata?.width, item.mediaFile?.mediaFileMetadata?.height);
    sort += 10;
    const row = await env.DB
      .prepare(`INSERT INTO photos (r2_key, caption, alt, collection, sort, width, height, shape) VALUES (?, ?, '', ?, ?, ?, ?, 'auto') RETURNING *`)
      .bind(key, captionFromFilename(item.mediaFile?.filename), collection, sort, width, height)
      .first<{ r2_key: string }>();
    if (row) added.push({ ...row, thumb: mediaUrl(row.r2_key, 480, transformsOn(env)) });
  }
  return json({ ok: true, added, skipped, nextPageToken: page.nextPageToken ?? null });
};
