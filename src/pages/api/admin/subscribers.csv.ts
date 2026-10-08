import type { APIRoute } from 'astro';
export const prerender = false;

const cell = (v: unknown) => {
  const s = v == null ? '' : String(v);
  // Quote, and neutralise spreadsheet formulas.
  return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
};

export const GET: APIRoute = async ({ locals }) => {
  const { results } = await locals.runtime.env.DB
    .prepare(`SELECT s.email, s.confirmed, s.source, p.title AS post, s.created_at, s.confirmed_at FROM subscribers s LEFT JOIN posts p ON p.id = s.source_post_id ORDER BY s.created_at`)
    .all();
  const rows = [['email', 'confirmed', 'source', 'signed_up_from_post', 'created_at', 'confirmed_at'], ...results.map((r) => [r.email, r.confirmed ? 'yes' : 'no', r.source, r.post, r.created_at, r.confirmed_at])];
  return new Response(rows.map((r) => r.map(cell).join(',')).join('\r\n'), {
    headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="liz-notes-subscribers-${new Date().toISOString().slice(0, 10)}.csv"` },
  });
};
