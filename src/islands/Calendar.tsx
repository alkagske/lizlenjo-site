/** Workroom calendar: drag a scheduled post to another day, or an unscheduled draft onto a day to schedule it. */
import { useMemo, useState } from 'preact/hooks';

export interface CalPost { id: number; title: string; status: 'draft' | 'scheduled' | 'published'; at: string | null }
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const CHIP = { published: ['#dcebe1', '#1f5b37'], scheduled: ['#d6e7f2', '#0b5a84'], draft: ['#eceae6', '#4a5268'] } as const;
const TZ = 'Africa/Nairobi';
const dayKey = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
const timeOf = (iso: string | null) => (iso ? new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso)) : '09:00');
const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

export default function Calendar({ posts: initial, today }: { posts: CalPost[]; today: string }) {
  const [posts, setPosts] = useState(initial);
  const [ym, setYm] = useState(() => ({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 }));
  const [over, setOver] = useState<string | null>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const cells = useMemo(() => {
    const first = new Date(Date.UTC(ym.y, ym.m, 1));
    const offset = (first.getUTCDay() + 6) % 7;
    const days = new Date(Date.UTC(ym.y, ym.m + 1, 0)).getUTCDate();
    const n = Math.ceil((offset + days) / 7) * 7;
    return Array.from({ length: n }, (_, i) => {
      const d = new Date(Date.UTC(ym.y, ym.m, i - offset + 1));
      return { key: iso(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()), day: d.getUTCDate(), inMonth: d.getUTCMonth() === ym.m };
    });
  }, [ym]);

  const move = async (id: number, key: string) => {
    const p = posts.find((x) => x.id === id);
    if (!p || p.status === 'published') return;
    if (key < today && !confirm('That day is in the past. The post will go live within five minutes. Continue?')) return;
    const local = `${key}T${timeOf(p.at)}`;
    setBusy(true);
    const res = await fetch(`/api/admin/posts/${id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'schedule', publish_at: local }) });
    const data = await res.json<any>().catch(() => ({}));
    setBusy(false);
    if (!res.ok || !data.ok) { alert(data.error ?? 'Could not reschedule.'); return; }
    setPosts((list) => list.map((x) => (x.id === id ? { ...x, status: 'scheduled', at: data.post.publish_at } : x)));
  };

  const drafts = posts.filter((p) => p.status === 'draft');
  const startDrag = (id: number) => (e: DragEvent) => { setDrag(id); e.dataTransfer?.setData('text/plain', String(id)); if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'; };
  const step = (d: number) => setYm(({ y, m }) => { const t = m + d; return { y: y + Math.floor(t / 12), m: ((t % 12) + 12) % 12 }; });

  return (
    <>
      <div class="wr-head">
        <div><div class="wr-kicker">Workroom</div><h1 class="wr-h1">Calendar</h1></div>
        <div style="display:flex;align-items:center;gap:8px;color:var(--paper)">
          <button type="button" class="wr-btn light" style="width:36px;height:36px;padding:0" aria-label="Previous month" onClick={() => step(-1)}>←</button>
          <span style="font-family:var(--serif);font-size:26px;min-width:190px;text-align:center" aria-live="polite">{MONTHS[ym.m]} {ym.y}</span>
          <button type="button" class="wr-btn light" style="width:36px;height:36px;padding:0" aria-label="Next month" onClick={() => step(1)}>→</button>
        </div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:24px;align-items:flex-start">
        <div class="wr-card wr-table" style="flex:999 1 620px;min-width:0" aria-busy={busy}>
          <div style="min-width:620px">
            <div class="cal-week">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((w) => <div>{w}</div>)}</div>
            <div class="cal-grid">
              {cells.map((c) => (
                <div
                  class="cal-cell"
                  data-day={c.key}
                  style={{ background: over === c.key ? '#e6f0f7' : c.inMonth ? '#fff' : '#f7f7f9' }}
                  onDragOver={(e) => { e.preventDefault(); if (over !== c.key) setOver(c.key); }}
                  onDragLeave={() => setOver((o) => (o === c.key ? null : o))}
                  onDrop={(e) => { e.preventDefault(); setOver(null); const id = drag ?? Number(e.dataTransfer?.getData('text/plain')); setDrag(null); if (id) move(id, c.key); }}
                >
                  <span class="cal-num" style={{ color: c.key === today ? '#fff' : c.inMonth ? 'var(--ink)' : 'var(--faint-3)', background: c.key === today ? 'var(--cobalt)' : 'transparent' }}>{c.day}</span>
                  {posts.filter((p) => p.at && p.status !== 'draft' && dayKey(p.at) === c.key).map((p) => (
                    <a
                      href={`/workroom/editor/${p.id}`}
                      class="cal-chip"
                      draggable={p.status !== 'published'}
                      onDragStart={startDrag(p.id)}
                      title={`${p.title || 'Untitled'} · ${p.status === 'scheduled' ? `goes live ${timeOf(p.at)}` : 'published'}`}
                      style={{ background: CHIP[p.status][0], color: CHIP[p.status][1], cursor: p.status === 'published' ? 'pointer' : 'grab' }}
                    >{p.title || 'Untitled'}</a>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style="flex:1 1 240px;display:flex;flex-direction:column;gap:14px">
          <div class="wr-panel" style="gap:10px">
            <div class="k">Unscheduled drafts</div>
            {drafts.map((d) => <a href={`/workroom/editor/${d.id}`} draggable onDragStart={startDrag(d.id)} class="cal-draft">{d.title || 'Untitled'}</a>)}
            {drafts.length === 0 && <span style="font-size:13px;color:var(--muted)">No drafts waiting.</span>}
          </div>
          <div class="wr-chalk" style="transform:rotate(-1.5deg)">drag a draft onto a date to schedule it, or drag a scheduled post to move it</div>
          <div style="display:flex;flex-direction:column;gap:6px;font-size:12px;color:var(--mat-text)">
            <span style="display:flex;gap:8px;align-items:center"><span style="flex:none;width:10px;height:10px;border-radius:3px;background:#dcebe1"></span>Published</span>
            <span style="display:flex;gap:8px;align-items:center"><span style="flex:none;width:10px;height:10px;border-radius:3px;background:#d6e7f2"></span>Scheduled (goes live at the post’s time, Nairobi)</span>
          </div>
        </div>
      </div>
    </>
  );
}
