/** Workroom editor: TipTap body, slash menu, toolbar, autosave (900 ms), previews and the publishing panel. */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Editor as TEditor } from '@tiptap/core';
import { extensions } from './schema';
import { renderDoc, type TNode } from '../../lib/tiptap';
import { readMinutes } from '../../lib/readtime';
import { slugify } from '../../lib/slug';

export interface EditorPost {
  id: number;
  title: string;
  excerpt: string;
  category: string;
  tags: string[];
  body_json: string;
  slug: string;
  cover_key: string | null;
  cover_alt: string;
  status: 'draft' | 'scheduled' | 'published';
  publish_local: string; // datetime-local in Nairobi time
  published_at: string | null;
  series_id: number | null;
  is_sample: number;
}
interface Version { id: number; title: string; excerpt: string; body_json: string; word_count: number; kind: 'autosave' | 'published'; created_at: string }
interface Props { post: EditorPost; categories: string[]; series: { id: number; name: string }[] }

type Mode = 'draft' | 'now' | 'schedule';
type View = 'write' | 'desktop' | 'mobile' | 'linkedin';

const SLASH = [
  { k: 'h2', label: 'Heading', hint: 'Section title, adds to contents' },
  { k: 'quote', label: 'Pull quote', hint: 'Large italic quote' },
  { k: 'note', label: 'Margin note', hint: 'Chalk aside in the margin' },
  { k: 'cite', label: 'Case citation', hint: 'Margin note starting “See:”' },
  { k: 'img', label: 'Image', hint: 'Full-width image with caption' },
  { k: 'hr', label: 'Stitch divider', hint: 'Dashed break with scissors' },
  { k: 'ul', label: 'List', hint: 'Bulleted list' },
] as const;
type SlashKey = (typeof SLASH)[number]['k'];

/** Auto-size a textarea to its content. */
const grow = (el: HTMLTextAreaElement | null) => { if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; } };
const hhmm = (d = new Date()) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Nairobi' });
const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Nairobi' });
const modeOf = (s: EditorPost['status']): Mode => (s === 'published' ? 'now' : s === 'scheduled' ? 'schedule' : 'draft');

async function api(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json<any>().catch(() => ({}));
  return { ok: res.ok && data.ok !== false, ...data };
}

async function upload(file: File, folder: 'covers' | 'inline'): Promise<{ key: string; url: string } | null> {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('folder', folder);
  const res = await fetch('/api/admin/upload', { method: 'POST', body: fd });
  const data = await res.json<any>().catch(() => ({}));
  if (!res.ok || !data.ok) { alert(data.error ?? 'Upload failed.'); return null; }
  return data;
}

function pickFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const i = document.createElement('input');
    i.type = 'file';
    i.accept = 'image/jpeg,image/png,image/webp,image/avif,image/gif';
    i.onchange = () => resolve(i.files?.[0] ?? null);
    i.click();
  });
}

export default function Editor({ post, categories, series: initialSeries }: Props) {
  const [title, setTitle] = useState(post.title);
  const [excerpt, setExcerpt] = useState(post.excerpt);
  const [category, setCategory] = useState(post.category);
  const [tags, setTags] = useState(post.tags.join(', '));
  const [slug, setSlug] = useState(post.slug.startsWith('untitled-') ? '' : post.slug);
  const [cover, setCover] = useState<{ key: string | null; alt: string }>({ key: post.cover_key, alt: post.cover_alt });
  const [mode, setMode] = useState<Mode>(modeOf(post.status));
  const [whenLocal, setWhenLocal] = useState(post.publish_local);
  const [seriesId, setSeriesId] = useState<number | null>(post.series_id);
  const [series, setSeries] = useState(initialSeries);
  const [status, setStatus] = useState(post.status);
  const [view, setView] = useState<View>('write');
  const [save, setSave] = useState<{ state: 'idle' | 'saving' | 'saved' | 'error'; at?: string; msg?: string }>({ state: 'idle' });
  const [versions, setVersions] = useState<Version[]>([]);
  const [doc, setDoc] = useState<TNode>(() => { try { return JSON.parse(post.body_json); } catch { return { type: 'doc', content: [] }; } });
  const [slash, setSlash] = useState<{ q: string; i: number; x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [, setTick] = useState(0); // re-render toolbar state on selection changes
  const host = useRef<HTMLDivElement>(null);
  const ed = useRef<TEditor | null>(null);
  const slashRef = useRef(slash);
  slashRef.current = slash;
  const timer = useRef<number>(0);
  const pending = useRef<Record<string, unknown>>({});
  const words = useMemo(() => renderDoc(doc).words, [doc]);

  // ---------- Saving ----------
  const loadVersions = async () => {
    const r = await api(`/api/admin/posts/${post.id}/versions`, 'GET');
    if (r.ok) setVersions(r.versions as Version[]);
  };
  const flush = async (extra: Record<string, unknown> = {}) => {
    clearTimeout(timer.current);
    const patch = { ...pending.current, ...extra };
    pending.current = {};
    if (!Object.keys(patch).length) return true;
    setSave({ state: 'saving' });
    const r = await api(`/api/admin/posts/${post.id}`, 'PUT', patch);
    if (!r.ok) { setSave({ state: 'error', msg: (r.error as string) ?? 'Not saved' }); return false; }
    const saved = r.post as { slug: string; status: EditorPost['status'] };
    setStatus(saved.status);
    if (!slug && saved.slug && !saved.slug.startsWith('untitled-')) setSlug(saved.slug);
    setSave({ state: 'saved', at: hhmm() });
    if ('body_json' in patch) loadVersions();
    return true;
  };
  const queue = (patch: Record<string, unknown>) => {
    pending.current = { ...pending.current, ...patch, autosave: true };
    setSave({ state: 'saving' });
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => flush(), 900);
  };

  // ---------- TipTap ----------
  const slashItems = (q: string) => SLASH.filter((s) => !q || s.label.toLowerCase().includes(q) || s.k.includes(q));
  const applySlash = async (k: SlashKey) => {
    const e = ed.current;
    if (!e) return;
    const { $from } = e.state.selection;
    const start = $from.start();
    const chain = e.chain().focus().deleteRange({ from: start, to: $from.pos });
    setSlash(null);
    if (k === 'h2') chain.setNode('heading', { level: 2 }).run();
    else if (k === 'quote') chain.setNode('paragraph').toggleBlockquote().run();
    else if (k === 'note') chain.setNode('marginNote', { kind: 'note' }).run();
    else if (k === 'cite') chain.setNode('marginNote', { kind: 'cite' }).insertContent('See: ').run();
    else if (k === 'hr') chain.setHorizontalRule().run();
    else if (k === 'ul') chain.toggleBulletList().run();
    else if (k === 'img') {
      chain.run();
      const file = await pickFile();
      if (!file) return;
      const up = await upload(file, 'inline');
      if (up) e.chain().focus().insertContent([{ type: 'figure', attrs: { key: up.key, caption: '', alt: '' } }, { type: 'paragraph' }]).run();
    }
  };
  const applyRef = useRef(applySlash);
  applyRef.current = applySlash;

  useEffect(() => {
    if (!host.current) return;
    const e = new TEditor({
      element: host.current,
      extensions: extensions(),
      content: doc,
      editorProps: {
        attributes: { class: 'ed-body body', 'aria-label': 'Post body', spellcheck: 'true' },
        handleKeyDown: (_view, event) => {
          const s = slashRef.current;
          if (!s) return false;
          const list = slashItems(s.q);
          if (event.key === 'ArrowDown') { setSlash({ ...s, i: Math.min(list.length - 1, s.i + 1) }); return true; }
          if (event.key === 'ArrowUp') { setSlash({ ...s, i: Math.max(0, s.i - 1) }); return true; }
          if (event.key === 'Enter') { const it = list[s.i]; if (it) applyRef.current(it.k); else setSlash(null); return true; }
          if (event.key === 'Escape') { setSlash(null); return true; }
          return false;
        },
        handleDrop: (view, event) => {
          const file = event.dataTransfer?.files?.[0];
          if (!file || !file.type.startsWith('image/')) return false;
          event.preventDefault();
          upload(file, 'inline').then((up) => {
            if (!up) return;
            const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos ?? view.state.selection.from;
            ed.current?.chain().focus().insertContentAt(pos, { type: 'figure', attrs: { key: up.key, caption: '', alt: '' } }).run();
          });
          return true;
        },
      },
      onUpdate: ({ editor }) => {
        const json = editor.getJSON() as TNode;
        setDoc(json);
        queue({ body_json: json });
        // Slash menu: an empty block that contains only "/word".
        const { $from, empty } = editor.state.selection;
        const text = $from.parent.textContent;
        if (empty && $from.parent.type.name === 'paragraph' && /^\/[a-z]*$/i.test(text) && $from.parentOffset === text.length) {
          const c = editor.view.coordsAtPos($from.pos);
          const q = text.slice(1).toLowerCase();
          setSlash((cur) => ({ q, i: cur && cur.q === q ? cur.i : 0, x: Math.min(innerWidth - 280, c.left), y: Math.min(innerHeight - 380, c.bottom + 8) }));
        } else if (slashRef.current) setSlash(null);
      },
      onSelectionUpdate: () => setTick((t) => t + 1),
      onBlur: () => setTimeout(() => setSlash(null), 150),
    });
    ed.current = e;
    loadVersions();
    const beforeUnload = (ev: BeforeUnloadEvent) => { if (Object.keys(pending.current).length) { flush(); ev.preventDefault(); } };
    addEventListener('beforeunload', beforeUnload);
    return () => { removeEventListener('beforeunload', beforeUnload); e.destroy(); };
  }, []);

  const run = (fn: (e: TEditor) => void) => (ev: Event) => { ev.preventDefault(); if (ed.current) fn(ed.current); };
  const tools = [
    { label: 'B', title: 'Bold', fn: (e: TEditor) => e.chain().focus().toggleBold().run(), on: 'bold' },
    { label: 'I', title: 'Italic', fn: (e: TEditor) => e.chain().focus().toggleItalic().run(), on: 'italic' },
    { label: 'H', title: 'Heading', fn: (e: TEditor) => e.chain().focus().toggleHeading({ level: 2 }).run(), on: 'heading' },
    { label: '¶', title: 'Paragraph', fn: (e: TEditor) => e.chain().focus().setParagraph().run() },
    { label: '“', title: 'Pull quote', fn: (e: TEditor) => e.chain().focus().toggleBlockquote().run(), on: 'blockquote' },
    { label: '✎', title: 'Margin note', fn: (e: TEditor) => (e.isActive('marginNote') ? e.chain().focus().setParagraph().run() : e.chain().focus().setNode('marginNote', { kind: 'note' }).run()), on: 'marginNote' },
    { label: '•', title: 'List', fn: (e: TEditor) => e.chain().focus().toggleBulletList().run(), on: 'bulletList' },
    { label: '↗', title: 'Link', fn: (e: TEditor) => { const prev = e.getAttributes('link').href as string | undefined; const u = prompt('Link URL (leave empty to remove)', prev ?? 'https://'); if (u === null) return; if (!u || u === 'https://') e.chain().focus().unsetLink().run(); else e.chain().focus().extendMarkRange('link').setLink({ href: u }).run(); } },
  ];

  // ---------- Cover ----------
  const setCoverFile = async (file: File | null) => {
    if (!file) return;
    const up = await upload(file, 'covers');
    if (up) { setCover((c) => ({ ...c, key: up.key })); flush({ cover_key: up.key }); }
  };

  // ---------- Publishing ----------
  const publishLabel = mode === 'now' ? (status === 'published' ? 'Update' : 'Publish') : mode === 'schedule' ? 'Schedule' : 'Save draft';
  const publish = async () => {
    if (mode === 'schedule' && !whenLocal) { alert('Choose a date and time to schedule.'); return; }
    if (mode === 'now' && !title.trim()) { alert('Add a title before publishing.'); return; }
    if (post.is_sample && mode !== 'draft' && !confirm('This is sample content from the design prototype. Publish it anyway?')) return;
    const ok = await flush({ title, excerpt, category, tags: tags.split(',').map((t) => t.trim()).filter(Boolean), body_json: ed.current?.getJSON(), slug: slug || undefined, series_id: seriesId, cover_alt: cover.alt, mode, publish_at: mode === 'schedule' ? whenLocal : null });
    if (ok) location.href = '/workroom';
  };
  const restore = (v: Version) => {
    if (!confirm(`Restore the version from ${when(v.created_at)}? The current text is kept in the history.`)) return;
    try {
      const d = JSON.parse(v.body_json);
      ed.current?.commands.setContent(d, { emitUpdate: false });
      setDoc(d);
      setTitle(v.title);
      setExcerpt(v.excerpt);
      flush({ body_json: d, title: v.title, excerpt: v.excerpt, autosave: true });
    } catch { alert('That version could not be read.'); }
  };
  const addSeries = async () => {
    const name = prompt('Name the new pattern set (series)');
    if (!name?.trim()) return;
    const r = await api('/api/admin/series', 'POST', { name });
    if (r.ok && r.series) {
      const s = r.series as { id: number; name: string };
      setSeries((list) => (list.some((x) => x.id === s.id) ? list : [...list, s]));
      setSeriesId(s.id);
      queue({ series_id: s.id });
    }
  };
  const remove = async () => {
    if (!confirm('Delete this post permanently? This cannot be undone.')) return;
    const r = await api(`/api/admin/posts/${post.id}`, 'DELETE');
    if (r.ok) location.href = '/workroom';
  };

  const previewSlug = slug || slugify(title || 'untitled');
  const preview = useMemo(() => (view === 'write' ? null : renderDoc(doc, { mediaUrl: (k) => `/media/${k}` })), [doc, view]);
  const read = `${readMinutes(words)} min`;
  const coverSrc = cover.key ? `/media/${cover.key}` : null;
  const items = slash ? slashItems(slash.q) : [];

  return (
    <>
      <div class="wr-head" style="align-items:center">
        <a href="/workroom" class="wr-kicker" onClick={() => flush()}>← Posts</a>
        <div style="display:flex;gap:12px 14px;align-items:center;flex-wrap:wrap;justify-content:flex-end;font-size:12px;color:var(--mat-text)">
          <span style="display:flex;align-items:center;gap:8px;white-space:nowrap" role="status" aria-live="polite">
            <span class="dot" style={`background:${save.state === 'saving' ? '#e0a33a' : save.state === 'error' ? 'var(--spam)' : '#7fd19b'}`}></span>
            {save.state === 'saving' ? 'Saving…' : save.state === 'saved' ? `Autosaved · ${save.at}` : save.state === 'error' ? save.msg : 'All changes saved'}
          </span>
          <div class="ed-views" role="group" aria-label="View">
            {(['write', 'desktop', 'mobile', 'linkedin'] as View[]).map((v) => (
              <button type="button" aria-pressed={view === v} onClick={() => { flush(); setView(v); setSlash(null); }}>{v === 'linkedin' ? 'LinkedIn' : v[0]!.toUpperCase() + v.slice(1)}</button>
            ))}
          </div>
          <button type="button" class="wr-btn primary" onClick={publish}>{publishLabel}</button>
        </div>
      </div>

      <div class="ed-layout">
        <div class="ed-main">
          <div class="ed-write" style={{ display: view === 'write' ? 'flex' : 'none' }}>
            {post.is_sample ? <p class="ed-sample">Sample content from the design prototype. Rewrite it, or delete it from the panel on the right.</p> : null}
            <div
              class={`ed-cover cover-blank${dragging ? ' drag' : ''}`}
              role="button"
              tabIndex={0}
              aria-label={coverSrc ? 'Replace cover image' : 'Add cover image'}
              onClick={async () => setCoverFile(await pickFile())}
              onKeyDown={async (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCoverFile(await pickFile()); } }}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); setCoverFile(e.dataTransfer?.files?.[0] ?? null); }}
            >
              {coverSrc ? <img src={coverSrc} alt="" /> : 'drop cover image · or click to choose · stored in Cloudflare R2'}
            </div>
            {coverSrc && (
              <div style="display:flex;gap:10px;align-items:center">
                <input class="wr-input" value={cover.alt} placeholder="Describe the cover for screen readers (alt text)" onInput={(e) => { const alt = (e.target as HTMLInputElement).value; setCover((c) => ({ ...c, alt })); queue({ cover_alt: alt }); }} />
                <button type="button" class="wr-btn ghost" onClick={() => { setCover({ key: null, alt: '' }); flush({ cover_key: null }); }}>Remove</button>
              </div>
            )}
            <label class="sr-only" for="ed-title">Title</label>
            <textarea id="ed-title" class="ed-title" rows={1} value={title} placeholder="Title" ref={grow} onInput={(e) => { const el = e.target as HTMLTextAreaElement; const v = el.value.replace(/\n/g, ' '); setTitle(v); grow(el); queue({ title: v }); }} />
            <label class="sr-only" for="ed-excerpt">Standfirst</label>
            <textarea id="ed-excerpt" class="ed-excerpt" rows={1} value={excerpt} placeholder="A one-line standfirst" ref={grow} onInput={(e) => { const el = e.target as HTMLTextAreaElement; const v = el.value.replace(/\n/g, ' '); setExcerpt(v); grow(el); queue({ excerpt: v }); }} />
            <div class="ed-toolbar">
              <div style="display:flex;gap:2px;flex-wrap:wrap" role="toolbar" aria-label="Formatting">
                {tools.map((t) => (
                  <button type="button" title={t.title} aria-label={t.title} aria-pressed={t.on ? !!ed.current?.isActive(t.on) : undefined} onMouseDown={run(t.fn)}>{t.label}</button>
                ))}
              </div>
              <span class="chalk" style="font-size:20px;padding-right:6px">type / for headings, notes, citations…</span>
            </div>
            <div ref={host} class="ed-host" />
          </div>

          {(view === 'desktop' || view === 'mobile') && preview && (
            <div style="display:flex;justify-content:center">
              <div class={`ed-frame ${view}`}>
                <div class="ed-frame-bar"><span class="lights"><i /><i /><i /></span><span>lizlenjo.com/notes/{previewSlug}</span></div>
                <div class="ed-frame-body">
                  <div class="label" style="text-align:center;font-size:10px">{category} · {read} read</div>
                  <div class="ed-frame-title">{title || 'Untitled'}</div>
                  <div style="font-family:var(--serif);font-style:italic;font-size:19px;line-height:1.4;color:var(--text-2);text-align:center">{excerpt}</div>
                  <div class="ed-frame-cover cover-blank">{coverSrc && <img src={coverSrc} alt="" />}</div>
                  <div class="body" style="--fs:16px">
                    {preview.rows.map((r) => (
                      <div class="blk-row">
                        <div class="blk-main" dangerouslySetInnerHTML={{ __html: r.html }} />
                        {r.note && <div class="blk-note" style={view === 'mobile' ? 'flex-basis:100%' : ''}><aside class="margin-note" dangerouslySetInnerHTML={{ __html: r.note }} /></div>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {view === 'linkedin' && (
            <div style="display:flex;flex-direction:column;align-items:center;gap:16px">
              <div class="ed-li">
                <div style="display:flex;gap:10px;padding:14px 16px 8px"><img src="/lookbook/reflection-480.webp" alt="" style="width:48px;height:48px;border-radius:50%;object-fit:cover;object-position:50% 25%" /><div style="display:flex;flex-direction:column;line-height:1.35"><span style="font-weight:600;font-size:14px">Liz Lenjo</span><span style="font-size:12px;color:#666">Advocate · Chairperson, Copyright Tribunal</span><span style="font-size:12px;color:#666">Now</span></div></div>
                <div style="padding:4px 16px 12px;font-size:14px;line-height:1.5;font-weight:400">New on Liz Notes: {title || 'Untitled'}. {excerpt}</div>
                <div style="background:#f3f2ef">
                  <div class="ed-li-img">{coverSrc ? <img src={coverSrc} alt="" /> : 'cover image · 1200 × 627'}</div>
                  <div style="padding:10px 14px;display:flex;flex-direction:column;gap:2px"><span style="font-weight:600;font-size:14px;line-height:1.35">{title || 'Untitled'}</span><span style="font-size:12px;color:#666">lizlenjo.com · {read} read</span></div>
                </div>
                <div style="display:flex;justify-content:space-around;padding:10px 8px;border-top:1px solid #e8e8e8;font-size:13px;font-weight:600;color:#666"><span>Like</span><span>Comment</span><span>Repost</span><span>Send</span></div>
              </div>
              <div class="wr-chalk" style="text-align:center">keep titles under 70 characters so LinkedIn doesn’t cut them{title.length > 70 ? ` (this one is ${title.length})` : ''}</div>
            </div>
          )}
        </div>

        <div class="ed-side">
          <div class="wr-panel">
            <div class="k">Publishing</div>
            <div style="display:flex;flex-direction:column;gap:8px" role="radiogroup" aria-label="Publishing">
              {([['draft', 'Save as draft'], ['now', status === 'published' ? 'Published' : 'Publish now'], ['schedule', 'Schedule']] as [Mode, string][]).map(([k, label]) => (
                <label class="ed-radio"><input type="radio" name="mode" checked={mode === k} onChange={() => setMode(k)} />{label}</label>
              ))}
            </div>
            {mode === 'schedule' && (
              <label style="display:flex;flex-direction:column;gap:6px">
                <span style="font-size:12px;color:var(--muted)">Goes live (Nairobi time)</span>
                <input class="wr-input" type="datetime-local" value={whenLocal} onInput={(e) => setWhenLocal((e.target as HTMLInputElement).value)} />
              </label>
            )}
            {status === 'published' && mode === 'draft' && <p style="margin:0;font-size:12px;color:var(--chalk)">Saving as a draft will take this post off the site.</p>}
          </div>
          <div class="wr-panel">
            <label class="k" for="ed-cat">Category</label>
            <select id="ed-cat" class="wr-select" value={category} onChange={(e) => { const v = (e.target as HTMLSelectElement).value; setCategory(v); queue({ category: v }); }}>
              {categories.map((c) => <option value={c}>{c}</option>)}
            </select>
            <label class="k" for="ed-series" style="padding-top:6px">Pattern set</label>
            <div style="display:flex;gap:6px">
              <select id="ed-series" class="wr-select" value={seriesId ?? ''} onChange={(e) => { const v = (e.target as HTMLSelectElement).value; const id = v ? Number(v) : null; setSeriesId(id); queue({ series_id: id }); }}>
                <option value="">None</option>
                {series.map((s) => <option value={s.id}>{s.name}</option>)}
              </select>
              <button type="button" class="wr-btn" title="New pattern set" aria-label="New pattern set" onClick={addSeries}>+</button>
            </div>
            <label class="k" for="ed-tags" style="padding-top:6px">Tags</label>
            <input id="ed-tags" class="wr-input" value={tags} placeholder="copyright, licensing" onInput={(e) => { const v = (e.target as HTMLInputElement).value; setTags(v); queue({ tags: v.split(',').map((t) => t.trim()).filter(Boolean) }); }} />
            <label class="k" for="ed-slug" style="padding-top:6px">URL</label>
            <input id="ed-slug" class="wr-input" value={slug} placeholder={slugify(title || 'untitled')} onChange={(e) => { const v = slugify((e.target as HTMLInputElement).value); setSlug(v); flush({ slug: v }); }} />
            <div style="font-size:12px;color:var(--text-3);word-break:break-all">lizlenjo.com/notes/<span style="color:var(--ink)">{previewSlug}</span></div>
            {status === 'published' && <p style="margin:0;font-size:12px;color:var(--muted)">Changing the URL of a published post breaks links already shared.</p>}
          </div>
          <div class="wr-panel">
            <div style="display:flex;justify-content:space-between;gap:10px" class="k"><span>Version history</span><span>{words} words</span></div>
            {versions.length === 0 && <span style="color:var(--muted)">Versions appear as you write.</span>}
            {versions.map((v, k) => (
              <div class="ed-ver">
                <div style="display:flex;flex-direction:column;line-height:1.35"><span>{v.kind === 'published' ? 'Published version' : `Autosave ${when(v.created_at)}`}</span><span style="font-size:11px;color:var(--muted)">{v.kind === 'published' ? when(v.created_at) : `${v.word_count} words`}</span></div>
                {k === 0 ? <span class="ed-current">Current</span> : <button type="button" class="wr-btn" style="padding:5px 9px;font-size:10px" onClick={() => restore(v)}>Restore</button>}
              </div>
            ))}
          </div>
          <button type="button" class="wr-btn light" style="border-style:dashed" onClick={remove}>Delete post</button>
        </div>
      </div>

      {slash && view === 'write' && (
        <div class="ed-slash" style={{ left: `${slash.x}px`, top: `${slash.y}px` }} role="listbox" aria-label="Insert block">
          <div class="k">Insert</div>
          {items.map((it, k) => (
            <button type="button" role="option" aria-selected={slash.i === k} onMouseDown={(e) => { e.preventDefault(); applySlash(it.k); }}>
              <span style="font-size:14px;color:var(--ink);font-weight:400">{it.label}</span><span style="font-size:11px;color:var(--muted)">{it.hint}</span>
            </button>
          ))}
          {items.length === 0 && <div style="padding:8px 10px;font-size:13px;color:var(--muted)">No matching block</div>}
        </div>
      )}
    </>
  );
}
