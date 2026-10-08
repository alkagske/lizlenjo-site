export const json = (data: unknown, status = 200, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });

export const bad = (message: string, status = 400) => json({ ok: false, error: message }, status);

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
export const isEmail = (s: unknown): s is string => typeof s === 'string' && s.length <= 254 && EMAIL.test(s.trim());

export function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

/** Read JSON or form bodies into a plain object. */
export async function readBody(request: Request): Promise<Record<string, unknown>> {
  const type = request.headers.get('content-type') ?? '';
  try {
    if (type.includes('application/json')) return ((await request.json()) as Record<string, unknown>) ?? {};
    if (type.includes('form')) return Object.fromEntries((await request.formData()).entries());
  } catch {
    return {};
  }
  return {};
}

/** Same-origin check for state-changing public endpoints. */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true; // non-browser clients and same-origin navigations may omit it
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function randomToken(bytes = 24): string {
  const a = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** The prerendered 404 page, served with a 404 status from an on-demand route. */
export async function notFound(env: { ASSETS: { fetch: (r: Request | string) => Promise<Response> } }, url: URL): Promise<Response> {
  try {
    const page = await env.ASSETS.fetch(new Request(new URL('/404.html', url)));
    return new Response(page.body, { status: 404, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
