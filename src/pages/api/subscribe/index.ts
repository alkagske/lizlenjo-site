import type { APIRoute } from 'astro';
import { bad, isEmail, json, randomToken, readBody, sameOrigin, str } from '../../../lib/http';
import { mailShell, sendMail } from '../../../lib/email';
import { bumpStat } from '../../../lib/db';
import { nairobiDay } from '../../../lib/format';
export const prerender = false;

/**
 * Newsletter sign-up. Subscribers live in D1.
 * With Resend configured, a confirmation email is sent (double opt-in).
 * Without it, the address is stored as confirmed.
 */
export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;
  if (!sameOrigin(request)) return bad('Bad origin', 403);
  const b = await readBody(request);
  const email = str(b.email, 254).toLowerCase();
  if (!isEmail(email)) return bad('Please add a valid email address.');
  const source = ['home', 'notes', 'post'].includes(String(b.source)) ? String(b.source) : 'site';
  const postId = Number.isInteger(b.postId) ? (b.postId as number) : null;

  const existing = await env.DB.prepare(`SELECT confirmed FROM subscribers WHERE email = ?`).bind(email).first<{ confirmed: number }>();
  if (existing?.confirmed) return json({ ok: true, confirmed: true });

  const token = randomToken();
  const canEmail = !!env.RESEND_API_KEY;
  if (existing) {
    await env.DB.prepare(`UPDATE subscribers SET token = ? WHERE email = ?`).bind(token, email).run();
  } else {
    await env.DB.prepare(`INSERT INTO subscribers (email, confirmed, token, source, source_post_id, confirmed_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(email, canEmail ? 0 : 1, token, source, postId, canEmail ? null : new Date().toISOString())
      .run();
    if (postId) await bumpStat(env.DB, postId, nairobiDay(), 'signups').catch(() => {});
  }

  if (!canEmail) return json({ ok: true, confirmed: true });
  const link = `${env.SITE_URL || new URL(request.url).origin}/api/subscribe/confirm?token=${encodeURIComponent(token)}`;
  await sendMail(env, {
    to: email,
    subject: 'Confirm your subscription to Liz Notes',
    text: `Please confirm you would like Liz Notes by email:\n\n${link}\n\nIf you did not ask for this, ignore this email.`,
    html: mailShell(`<h1 style="font-weight:400;font-size:26px;margin:0 0 12px">One more stitch.</h1>
<p style="font-size:15px;line-height:1.6">Please confirm you would like new Liz Notes by email.</p>
<p><a href="${link}" style="display:inline-block;background:#14213d;color:#fff;text-decoration:none;font-family:monospace;font-size:12px;letter-spacing:.12em;text-transform:uppercase;padding:12px 18px;border-radius:6px">Confirm subscription →</a></p>
<p style="font-size:12px;color:#6a7186">If you did not ask for this, ignore this email.</p>`),
  });
  return json({ ok: true, confirmed: false });
};
