import type { APIRoute } from 'astro';
export const prerender = false;

export const GET: APIRoute = async ({ url, locals, redirect }) => {
  const token = url.searchParams.get('token') ?? '';
  if (token) {
    await locals.runtime.env.DB.prepare(`UPDATE subscribers SET confirmed = 1, confirmed_at = ? WHERE token = ? AND confirmed = 0`)
      .bind(new Date().toISOString(), token)
      .run();
  }
  return redirect('/notes?subscribed=1', 303);
};
