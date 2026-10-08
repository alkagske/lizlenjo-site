import type { APIRoute } from 'astro';
import { bad, json } from '../../../lib/http';
import { IMAGE_TYPES, MAX_UPLOAD_BYTES } from '../../../lib/admin';
import { mediaUrl, transformsOn } from '../../../lib/media';
export const prerender = false;

/** Upload one image to R2. Form field "file"; optional "folder" (covers | inline | photos). */
export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;
  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!form || !(file instanceof File)) return bad('No file');
  const ext = IMAGE_TYPES[file.type];
  if (!ext) return bad('Please upload a JPEG, PNG, WebP, AVIF or GIF image.');
  if (file.size > MAX_UPLOAD_BYTES) return bad('Images must be under 15 MB.');
  const folder = ['covers', 'inline', 'photos'].includes(String(form.get('folder'))) ? String(form.get('folder')) : 'inline';
  const d = new Date();
  const key = `${folder}/${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${crypto.randomUUID()}.${ext}`;
  await env.MEDIA.put(key, file.stream(), { httpMetadata: { contentType: file.type, cacheControl: 'public, max-age=31536000, immutable' }, customMetadata: { name: file.name.slice(0, 200) } });
  return json({ ok: true, key, url: mediaUrl(key), preview: mediaUrl(key, 1280, transformsOn(env)) });
};
