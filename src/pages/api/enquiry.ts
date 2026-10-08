import type { APIRoute } from 'astro';
import { bad, isEmail, json, readBody, sameOrigin, str } from '../../lib/http';
import { verifyTurnstile } from '../../lib/turnstile';
import { mailShell, sendMail } from '../../lib/email';
import { esc } from '../../lib/tiptap';
import { ENQUIRY_KINDS } from '../../content/site';
export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;
  if (!sameOrigin(request)) return bad('Bad origin', 403);
  const b = await readBody(request);
  if (str(b.website, 10)) return json({ ok: true }); // honeypot: pretend success
  const name = str(b.name, 120);
  const email = str(b.email, 254);
  const event = str(b.event, 500);
  const type = (ENQUIRY_KINDS as readonly string[]).includes(String(b.type)) ? String(b.type) : 'Keynote';
  if (!name) return bad('Please add your name.');
  if (!isEmail(email)) return bad('Please add a valid email address.');

  const ts = await verifyTurnstile(env, b.token, request.headers.get('cf-connecting-ip'));
  if (!ts.ok) return bad('Please complete the spam check and try again.', 403);

  const year = new Date().getFullYear();
  const row = await env.DB.prepare(`SELECT COUNT(*) AS n FROM enquiries WHERE ref LIKE ?`).bind(`LL-${year}-%`).first<{ n: number }>();
  const ref = `LL-${year}-${String((row?.n ?? 0) + 1).padStart(4, '0')}`;
  await env.DB.prepare(`INSERT INTO enquiries (ref, type, name, email, event) VALUES (?, ?, ?, ?, ?)`).bind(ref, type, name, email, event).run();

  if (env.ENQUIRY_TO) {
    const sent = await sendMail(env, {
      to: env.ENQUIRY_TO.split(',').map((s) => s.trim()).filter(Boolean),
      replyTo: email,
      subject: `${type} enquiry ${ref} from ${name}`,
      text: `New enquiry ${ref}\n\nType: ${type}\nName: ${name}\nEmail: ${email}\nEvent, date and city: ${event || '—'}\n`,
      html: mailShell(`<h1 style="font-weight:400;font-size:26px;margin:0 0 16px">${esc(type)} enquiry</h1>
<table style="font-size:15px;line-height:1.6;border-collapse:collapse">
<tr><td style="padding:4px 16px 4px 0;color:#6a7186">Ref</td><td>${ref}</td></tr>
<tr><td style="padding:4px 16px 4px 0;color:#6a7186">Name</td><td>${esc(name)}</td></tr>
<tr><td style="padding:4px 16px 4px 0;color:#6a7186">Email</td><td><a href="mailto:${esc(email)}">${esc(email)}</a></td></tr>
<tr><td style="padding:4px 16px 4px 0;color:#6a7186;vertical-align:top">Event</td><td>${esc(event || '—')}</td></tr></table>
<p style="font-size:13px;color:#6a7186;margin-top:24px">Reply to this email to answer ${esc(name)} directly.</p>`),
    });
    if (sent) await env.DB.prepare(`UPDATE enquiries SET emailed = 1 WHERE ref = ?`).bind(ref).run();
  }
  return json({ ok: true, ref });
};
