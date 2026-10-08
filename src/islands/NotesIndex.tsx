/** Liz Notes index: search (press "/"), multi-select categories, sort, Grid/Archive. Server-rendered, then hydrated. */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

export interface IndexPost {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  tags: string[];
  date: string; // ISO
  dateLabel: string;
  read: string;
  partLabel: string | null;
  cover: string | null;
  coverAlt: string;
  search: string; // lower-cased title, excerpt, tags and body text
}

interface Props {
  posts: IndexPost[];
  categories: string[];
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const nairobi = (iso: string) => {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Nairobi', year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(new Date(iso));
  const get = (t: string) => Number(p.find((x) => x.type === t)?.value);
  return { y: get('year'), m: get('month') - 1, d: get('day') };
};

function Cover({ p, label }: { p: IndexPost; label: string }) {
  return p.cover ? (
    <div class="cover"><img src={p.cover} alt={p.coverAlt} loading="lazy" decoding="async" /></div>
  ) : (
    <div class="cover cover-blank" aria-hidden="true">{label}</div>
  );
}

export default function NotesIndex({ posts, categories }: Props) {
  const [q, setQ] = useState('');
  const [cats, setCats] = useState<string[]>([]);
  const [sort, setSort] = useState<'new' | 'old'>('new');
  const [layout, setLayout] = useState<'grid' | 'archive'>('grid');
  const search = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = document.activeElement as HTMLElement | null;
      const typing = t && (/INPUT|TEXTAREA|SELECT/.test(t.tagName) || t.isContentEditable);
      if (e.key === '/' && !typing) {
        e.preventDefault();
        search.current?.focus();
      }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const words = needle.split(/\s+/).filter(Boolean);
    return posts
      .filter((p) => (!cats.length || cats.includes(p.category)) && words.every((w) => p.search.includes(w)))
      .sort((a, b) => (sort === 'old' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)));
  }, [posts, q, cats, sort]);

  const archive = useMemo(() => {
    const byYear = new Map<number, Map<number, (IndexPost & { day: number })[]>>();
    for (const p of filtered) {
      const { y, m, d } = nairobi(p.date);
      if (!byYear.has(y)) byYear.set(y, new Map());
      const months = byYear.get(y)!;
      if (!months.has(m)) months.set(m, []);
      months.get(m)!.push({ ...p, day: d });
    }
    return [...byYear.entries()];
  }, [filtered]);

  const toggleCat = (c: string) => setCats((cur) => (c === 'All' ? [] : cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));
  const filtersOn = cats.length > 0 || q.trim() !== '';
  const [featured, ...rest] = filtered;

  return (
    <>
      <div class="two-col" style="gap:40px;align-items:end">
        <div style="display:flex;flex-direction:column;gap:18px">
          <div class="label">Pattern book — Liz Notes</div>
          <h1 class="notes-h1">Notes on entertainment, fashion and <span class="it">intellectual property law.</span></h1>
        </div>
        <div style="display:flex;flex-direction:column;gap:16px">
          <div class="search" role="search">
            <label for="notes-q" class="sr-only">Search Liz Notes</label>
            <input id="notes-q" ref={search} type="search" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} placeholder="Search Liz Notes" autocomplete="off" />
            <span class="kbd" aria-hidden="true">/</span>
            <span class="count" aria-live="polite">{filtered.length} {filtered.length === 1 ? 'note' : 'notes'}</span>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap" role="group" aria-label="Categories">
            {['All', ...categories].map((c) => (
              <button type="button" class="cat-chip" aria-pressed={c === 'All' ? !cats.length : cats.includes(c)} onClick={() => toggleCat(c)}>{c}</button>
            ))}
          </div>
          <div class="toolbar">
            <div style="display:flex;gap:14px;align-items:center" role="group" aria-label="Sort">
              <span>Sort</span>
              <button type="button" class="sort-btn" aria-pressed={sort === 'new'} onClick={() => setSort('new')}>Newest</button>
              <button type="button" class="sort-btn" aria-pressed={sort === 'old'} onClick={() => setSort('old')}>Oldest</button>
              {filtersOn && <button type="button" class="clear-btn" onClick={() => { setCats([]); setQ(''); }}>Clear ×</button>}
            </div>
            <div class="seg" role="group" aria-label="Layout">
              <button type="button" aria-pressed={layout === 'grid'} onClick={() => setLayout('grid')}>Grid</button>
              <button type="button" aria-pressed={layout === 'archive'} onClick={() => setLayout('archive')}>Archive</button>
            </div>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p class="empty-note">{posts.length ? 'Nothing matches that search yet.' : 'The first notes are still on the cutting table.'}</p>
      ) : layout === 'grid' ? (
        <>
          {featured && (
            <a href={`/notes/${featured.slug}`} class="featured">
              <Cover p={featured} label="cover image" />
              <div style="display:flex;flex-direction:column;gap:18px">
                <div class="meta"><span style="color:var(--cobalt)">Latest</span><span>{featured.category}</span><span>{featured.dateLabel}</span></div>
                <div class="chalk" aria-hidden="true" style="font-size:26px;transform:rotate(-2deg);transform-origin:0 50%;line-height:1.1;margin-top:14px">fresh off the cutting table ↓</div>
                <h2 style="margin:0;font-family:var(--serif);font-weight:400;font-size:clamp(30px,3.4vw,46px);line-height:1.08;text-wrap:pretty">{featured.title}</h2>
                <p style="margin:0;color:var(--text-2);max-width:520px">{featured.excerpt}</p>
                {featured.partLabel && <span class="series-chip">Pattern set · {featured.partLabel}</span>}
                <div class="read-line">Read · {featured.read}</div>
              </div>
            </a>
          )}
          {rest.length > 0 && (
            <div class="cards">
              {rest.map((p) => (
                <a href={`/notes/${p.slug}`} class="card">
                  <Cover p={p} label={`PIECE ${String(p.id).padStart(2, '0')} · cover image`} />
                  <div class="meta" style="justify-content:space-between;gap:12px;letter-spacing:.14em"><span>{p.category}</span><span>{p.dateLabel}</span></div>
                  <h2 class="t" style="margin:0;font-weight:400">{p.title}</h2>
                  <div class="x">{p.excerpt}</div>
                  {p.partLabel && <span class="series-chip">Pattern set · {p.partLabel}</span>}
                </a>
              ))}
            </div>
          )}
        </>
      ) : (
        <div class="archive">
          {archive.map(([y, months]) => {
            const n = [...months.values()].reduce((t, x) => t + x.length, 0);
            return (
              <section class="archive-year" aria-label={String(y)}>
                <div style="display:flex;flex-direction:column;gap:4px">
                  <span class="y">{y}</span>
                  <span class="count" style="padding:0">{n} {n === 1 ? 'note' : 'notes'}</span>
                </div>
                <div class="archive-months">
                  {[...months.entries()].map(([m, list]) => (
                    <div style="display:flex;flex-direction:column">
                      <h2 class="label" style="margin:0;padding-bottom:6px;font-weight:400">{MONTHS[m]}</h2>
                      {list.map((p) => (
                        <a href={`/notes/${p.slug}`} class="archive-row">
                          <span class="t">{p.title}</span>
                          <span class="m">{p.category} · {p.day} {MONTHS[m]!.slice(0, 3)}</span>
                        </a>
                      ))}
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
