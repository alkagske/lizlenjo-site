import { defineMiddleware } from 'astro:middleware';
import { devBypassAllowed, isProtectedPath, verifyAccessJwt } from './lib/access';
import { sameOrigin } from './lib/http';

/** Shown when a Workroom page is reached without a valid sign-in. Styled like the sign-in page at /workroom. */
function lockedPage(reason: string): string {
  const wrongAccount = reason === 'email not allowed';
  const message = wrongAccount
    ? 'This Google account is not on the Workroom list. Sign out, then choose the account Liz invited.'
    : 'Please sign in to continue.';
  const action = wrongAccount
    ? '<a class="b" href="/cdn-cgi/access/logout">Sign out and try another account</a>'
    : '<a class="b" href="/workroom">Sign in →</a>';
  return `<!doctype html><html lang="en-GB"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>Workroom · Liz Lenjo</title><link rel="icon" href="/favicon.png" type="image/png"><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#fbfaf7;color:#14213d;font-family:Georgia,'Times New Roman',serif}main{max-width:480px;padding:32px 16px;display:flex;flex-direction:column;gap:18px}img{height:64px;width:auto;align-self:flex-start}.k{font-family:ui-monospace,monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#0c6b9d}h1{margin:0;font-weight:400;font-size:clamp(34px,6vw,48px);line-height:1.05}p{margin:0;color:#1f2a44;font-family:system-ui,sans-serif;line-height:1.5}.b{align-self:flex-start;background:#14213d;color:#fff;text-decoration:none;font-family:ui-monospace,monospace;font-size:12px;letter-spacing:.12em;text-transform:uppercase;padding:14px 22px;border-radius:6px}.b:hover{background:#0c6b9d}.r{font-family:ui-monospace,monospace;font-size:11px;color:#6a7186}a.h{color:#6a7186;font-family:system-ui,sans-serif;font-size:14px}</style><main><a href="/"><img src="/logo-9.webp" alt="Liz Lenjo" width="101" height="92"></a><div class="k">The Workroom</div><h1>This room is locked.</h1><p>${message}</p>${action}<p class="r">(${reason})</p><a class="h" href="/">← Back to lizlenjo.com</a></main></html>`;
}

/**
 * Runs for on-demand routes only (prerendered pages are plain files).
 * - www → apex redirect for anything that reaches the Worker.
 * - /workroom/* and /api/admin/*: verify the Cloudflare Access JWT (/workroom itself is the sign-in page).
 * - Security headers on every SSR response.
 */
export const onRequest = defineMiddleware(async (context, next) => {
  const url = context.url;
  if (url.hostname.startsWith('www.')) {
    return context.redirect(`${url.protocol}//${url.hostname.slice(4)}${url.pathname}${url.search}`, 301);
  }

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
        const body = api ? JSON.stringify({ ok: false, error: 'Not authorised' }) : lockedPage(result.reason);
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

