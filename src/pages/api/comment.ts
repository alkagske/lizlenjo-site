import type { APIRoute } from 'astro';
import { bad, isEmail, json, readBody, sameOrigin, sha256Hex, str } from '../../lib/http';
import { verifyTurnstile } from '../../lib/turnstile';
import { scoreComment } from '../../lib/spam';
export const prerender = false;

/** New comments always wait for moderation. The spam score orders the Workroom queue. */
export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;
  if (!sameOrigin(request)) return bad('Bad origin', 403);
  const b = await readBody(request);
  if (str(b.website, 10)) return json({ ok: true }); // honeypot
  const postId = Number(b.postId);
  const name = str(b.name, 80);
  const email = str(b.email, 254);
  const text = str(b.text, 4000);
  if (!Number.isInteger(postId) || postId <= 0) return bad('Unknown post.');
  if (!name) return bad('Please add your name.');
  if (!isEmail(email)) return bad('Please add a valid email address.');
  if (text.length < 2) return bad('Please write a comment.');

  const post = await env.DB.prepare(`SELECT id, title FROM posts WHERE id = ? AND status = 'published'`).bind(postId).first<{ id: number; title: string }>();
  if (!post) return bad('Unknown post.', 404);

  const ip = request.headers.get('cf-connecting-ip');
  const ts = await verifyTurnstile(env, b.token, ip);
  if (!ts.ok) return bad('Please complete the spam check and try again.', 403);

  const { score, reason } = await scoreComment(env.AI, { name, email, text, postTitle: post.title });
  const ipHash = ip ? (await sha256Hex(`${ip}:${new Date().toISOString().slice(0, 10)}`)).slice(0, 16) : '';
  await env.DB.prepare(`INSERT INTO comments (post_id, name, email, text, status, spam_score, spam_reason, ip_hash) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)`)
    .bind(postId, name, email, text, score, reason, ipHash)
    .run();
  return json({ ok: true });
};
