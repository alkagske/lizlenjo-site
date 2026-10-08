/**
 * URLs for media stored in R2 (served by /media/[...key]) and for photos built into the site.
 * When IMAGE_TRANSFORMS is "on" (Cloudflare Images transformations enabled on the zone),
 * R2 images are resized on the fly through /cdn-cgi/image/.
 */
export const LOOKBOOK_WIDTHS = [480, 960, 1600] as const;

export function mediaUrl(key: string, width?: number, transforms = false): string {
  if (key.startsWith('static/')) {
    const name = key.slice('static/'.length);
    const w = LOOKBOOK_WIDTHS.find((x) => x >= (width ?? 960)) ?? 1600;
    return `/lookbook/${name}-${w}.webp`;
  }
  const path = `/media/${key.split('/').map(encodeURIComponent).join('/')}`;
  if (!transforms || !width) return path;
  return `/cdn-cgi/image/width=${width},quality=82,format=auto,fit=scale-down${path}`;
}

export function srcset(key: string, transforms = false): string {
  if (key.startsWith('static/') || transforms) return LOOKBOOK_WIDTHS.map((w) => `${mediaUrl(key, w, transforms)} ${w}w`).join(', ');
  return '';
}

export const transformsOn = (env: Partial<Pick<Env, 'IMAGE_TRANSFORMS'>>) => env.IMAGE_TRANSFORMS === 'on';
