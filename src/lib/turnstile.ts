/**
 * Cloudflare Turnstile server-side check.
 * If TURNSTILE_SECRET_KEY is not set yet, verification is skipped (and logged) so the
 * forms keep working before launch. Comments still wait for moderation either way.
 */
export async function verifyTurnstile(env: Pick<Env, 'TURNSTILE_SECRET_KEY'>, token: unknown, ip: string | null): Promise<{ ok: boolean; skipped?: boolean }> {
  const secret = env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.warn('TURNSTILE_SECRET_KEY not set: skipping Turnstile verification');
    return { ok: true, skipped: true };
  }
  if (typeof token !== 'string' || !token) return { ok: false };
  const body = new FormData();
  body.append('secret', secret);
  body.append('response', token);
  if (ip) body.append('remoteip', ip);
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
    const data = (await res.json()) as { success?: boolean };
    return { ok: !!data.success };
  } catch {
    return { ok: false };
  }
}
