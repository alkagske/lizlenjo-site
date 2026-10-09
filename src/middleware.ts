import { defineMiddleware } from 'astro:middleware';
import { devBypassAllowed, isProtectedPath, verifyAccessJwt } from './lib/access';
import { sameOrigin } from './lib/http';
import wpRedirects from './content/wp-redirects.json';

const WP: Record<string, string> = wpRedirects;

/**
 * Runs for on-demand routes only (prerendered pages are plain files).
 * - www → apex redirect for anything that reaches the Worker.
 * - /workroom* and /api/admin/*: verify the Cloudflare Access JWT.
 * - Security headers on every SSR response.
 */
export const onRequest = defineMiddleware(async (context, next) => {
  const url = context.url;
  if (url.hostname.startsWith('www.')) {
    return context.redirect(`${url.protocol}//${url.hostname.slice(4)}${url.pathname}${url.search}`, 301);
  }

  // Old WordPress URLs (posts were at /<slug>/, plus category, tag and date archives).
  const legacy = legacyRedirect(url.pathname);
  if (legacy) return context.redirect(legacy, 301);

  if (isProtectedPath(url.pathname)) {
    if (!['GET', 'HEAD'].includes(context.request.method) && !sameOrigin(context.request)) {
      return new Response(JSON.stringify({ ok: false, error: 'Bad origin' }), { status: 403, headers: { 'content-type': 'application/json' } });
    }
    const env = context.locals.runtime?.env;
    if (env && devBypassAllowed(url, env.DEV_ACCESS_BYPASS)) {
      context.locals.user = { email: 'dev@localhost', dev: true };
    } else {
      const token = context.request.headers.get('cf-access-jwt-assertion') ?? context.cookies.get('CF_Authorization')?.value;
      const result = env
        ? await verifyAccessJwt(token, {
            teamDomain: env.ACCESS_TEAM_DOMAIN,
            aud: env.ACCESS_AUD,
            allowedEmails: (env.ADMIN_EMAILS || '').split(','),
          })
        : ({ ok: false, reason: 'no runtime' } as const);
      if (!result.ok) {
        const api = url.pathname.startsWith('/api/');
        const body = api
          ? JSON.stringify({ ok: false, error: 'Not authorised' })
          : `<!doctype html><meta charset="utf-8"><title>Workroom</title><body style="font-family:Georgia,serif;background:#2f4a3f;color:#fbfaf7;display:grid;place-items:center;min-height:100vh;margin:0"><div style="max-width:440px;padding:24px;text-align:center"><p style="font-family:monospace;letter-spacing:.14em;font-size:11px;text-transform:uppercase;color:#cfe0d6">Workroom</p><h1 style="font-weight:400">This room is locked.</h1><p>Sign in through Cloudflare Access to continue.</p><p style="font-size:12px;color:#cfe0d6">(${result.reason})</p><p><a style="color:#8fc3e0" href="/">Back to lizlenjo.com</a></p></div>`;
        return new Response(body, { status: api ? 401 : 403, headers: { 'content-type': api ? 'application/json' : 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
      }
      context.locals.user = { email: result.identity.email };
    }
  }

  const res = await next();
  const h = res.headers;
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  h.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (isProtectedPath(url.pathname)) {
    h.set('Cache-Control', 'no-store');
    h.set('X-Robots-Tag', 'noindex, nofollow');
    h.set('X-Frame-Options', 'DENY');
  } else {
    h.set('X-Frame-Options', 'SAMEORIGIN');
  }
  return res;
});

/** Where an old WordPress address should go now, or null. */
export function legacyRedirect(pathname: string): string | null {
  let p: string;
  try {
    p = decodeURIComponent(pathname).toLowerCase().replace(/\/+$/, '') || '/';
  } catch {
    return null;
  }
  if (WP[p]) return WP[p]!;
  if (/^\/(category|tag|author)\/./.test(p) || /^\/\d{4}(\/\d{2}){0,2}$/.test(p) || p === '/page' || /^\/page\/\d+$/.test(p)) return '/notes';
  if (/^\/[a-z0-9-]+\/(feed|amp)$/.test(p)) {
    const base = WP[p.replace(/\/(feed|amp)$/, '')];
    if (base) return base;
  }
  return null;
}
