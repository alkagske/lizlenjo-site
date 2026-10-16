/** Workroom → Lookbook: upload photos, caption them, choose a collection, reorder, hide or delete. */
import { useEffect, useState } from 'preact/hooks';

export interface MPhoto { id: number; r2_key: string; caption: string; alt: string; collection: string; shape: string; published: number; thumb: string }
const SHAPES = [['auto', 'Natural shape'], ['tall', 'Tall 2:3'], ['portrait', 'Portrait 3:4'], ['square', 'Square'], ['wide', 'Wide 16:9']] as const;
interface Props { photos: MPhoto[]; collections: string[]; googleReady: boolean }

const dims = (file: File) => new Promise<{ width: number; height: number }>((resolve) => {
  const img = new Image();
  img.onload = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(img.src); };
  img.onerror = () => resolve({ width: 0, height: 0 });
  img.src = URL.createObjectURL(file);
});

export default function LookbookManager({ photos: initial, collections, googleReady }: Props) {
  const [photos, setPhotos] = useState(initial);
  const [busy, setBusy] = useState('');
  const [gp, setGp] = useState<{ step: 'idle' | 'picking' | 'importing'; msg?: string }>({ step: 'idle' });
  const [coll, setColl] = useState(collections[3] ?? collections[0]!);

  const put = (id: number, patch: Partial<Omit<MPhoto, 'published'>> & { published?: boolean }) =>
    fetch(`/api/admin/photos/${id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(patch) });
  const saveOrder = (list: MPhoto[]) =>
    fetch('/api/admin/photos', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ids: list.map((p) => p.id) }) });

  const uploadFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const added: MPhoto[] = [];
    for (const [i, file] of [...files].entries()) {
      setBusy(`Uploading ${i + 1} of ${files.length}…`);
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', 'photos');
      const up = await fetch('/api/admin/upload', { method: 'POST', body: fd }).then((r) => r.json<any>()).catch(() => ({ ok: false }));
      if (!up.ok) { alert(`${file.name}: ${up.error ?? 'upload failed'}`); continue; }
      const { width, height } = await dims(file);
      const caption = file.name.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ');
      const r = await fetch('/api/admin/photos', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: up.key, collection: coll, caption, alt: '', width, height }) }).then((x) => x.json<any>());
      if (r.ok) added.push({ ...r.photo, thumb: up.url });
    }
    setPhotos((list) => [...list, ...added]);
    setBusy('');
  };

  // ---------- Google Photos (Picker API) ----------
  const fromGoogle = async (auto = false) => {
    // Open the window during the click so the browser does not block it as a pop-up.
    const win = auto ? null : window.open('about:blank', 'gphotos', 'width=1100,height=800');
    const r = await fetch('/api/admin/google/session', { method: 'POST' }).then((x) => x.json<any>()).catch(() => ({ ok: false, error: 'Network error' }));
    if (!r.ok) {
      win?.close();
      if (r.needAuth) { location.href = '/api/admin/google/start'; return; }
      setGp({ step: 'idle', msg: r.error });
      return;
    }
    const picker = win ?? window.open(r.pickerUri, 'gphotos', 'width=1100,height=800');
    if (win) win.location.href = r.pickerUri;
    if (!picker) { setGp({ step: 'idle', msg: 'Your browser blocked the Google Photos window. Click the button again.' }); return; }
    setGp({ step: 'picking', msg: 'Choose photos in the Google Photos window, then click Done there.' });
    const started = Date.now();
    while (Date.now() - started < r.timeout * 1000) {
      await new Promise((ok) => setTimeout(ok, r.pollEvery * 1000));
      const s = await fetch(`/api/admin/google/session?id=${encodeURIComponent(r.id)}`).then((x) => x.json<any>()).catch(() => ({ ok: false }));
      if (s.ok && s.done) break;
      if (s.needAuth) { location.href = '/api/admin/google/start'; return; }
      if (picker.closed && !(s.ok && s.done)) {
        // The window closes itself when Liz clicks Done; check once more before giving up.
        const again = await fetch(`/api/admin/google/session?id=${encodeURIComponent(r.id)}`).then((x) => x.json<any>()).catch(() => ({}));
        if (again.done) break;
        setGp({ step: 'idle', msg: 'No photos were chosen.' });
        fetch(`/api/admin/google/session?id=${encodeURIComponent(r.id)}`, { method: 'DELETE' });
        return;
      }
    }
    let pageToken: string | null = null;
    let total = 0;
    do {
      setGp({ step: 'importing', msg: `Copying photos from Google Photos… ${total} so far` });
      const res: any = await fetch('/api/admin/google/import', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId: r.id, pageToken, collection: coll }) }).then((x) => x.json<any>()).catch(() => ({ ok: false, error: 'Network error' }));
      if (!res.ok) { setGp({ step: 'idle', msg: res.error ?? 'Import stopped.' }); break; }
      total += res.added.length;
      setPhotos((list) => [...list, ...res.added]);
      pageToken = res.nextPageToken;
    } while (pageToken);
    fetch(`/api/admin/google/session?id=${encodeURIComponent(r.id)}`, { method: 'DELETE' });
    setGp({ step: 'idle', msg: total ? `Added ${total} photo${total === 1 ? '' : 's'} from Google Photos to ${coll}. Add captions below.` : 'No photos were added.' });
  };
  // Back from Google sign-in: carry straight on to picking.
  useEffect(() => {
    const q = new URLSearchParams(location.search).get('google');
    if (!q) return;
    history.replaceState(null, '', location.pathname);
    if (q === 'ready') setGp({ step: 'idle', msg: 'Signed in to Google Photos. Click “Add from Google Photos” to choose photos.' });
    else if (q === 'not-configured') setGp({ step: 'idle', msg: 'Google Photos is not set up yet. See README → Google Photos.' });
    else if (q === 'cancelled') setGp({ step: 'idle', msg: 'Google sign-in was cancelled.' });
    else setGp({ step: 'idle', msg: 'Google sign-in did not work. Please try again.' });
  }, []);

  const update = (id: number, patch: Partial<MPhoto>) => setPhotos((list) => list.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const shift = (k: number, d: number) => {
    const j = k + d;
    if (j < 0 || j >= photos.length) return;
    const list = [...photos];
    [list[k], list[j]] = [list[j]!, list[k]!];
    setPhotos(list);
    saveOrder(list);
  };
  const remove = async (p: MPhoto) => {
    if (!confirm('Delete this photo from the Lookbook and from storage?')) return;
    const r = await fetch(`/api/admin/photos/${p.id}`, { method: 'DELETE' }).then((x) => x.json<any>());
    if (r.ok) setPhotos((list) => list.filter((x) => x.id !== p.id));
    else alert(r.error ?? 'Could not delete.');
  };

  return (
    <>
      <div class="wr-head">
        <div><div class="wr-kicker">Workroom</div><h1 class="wr-h1">Lookbook</h1></div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <label class="sr-only" for="lb-coll">Collection for new uploads</label>
          <select id="lb-coll" class="wr-select" style="width:auto" value={coll} onChange={(e) => setColl((e.target as HTMLSelectElement).value)}>{collections.map((c) => <option value={c} selected={c === coll}>{c}</option>)}</select>
          <button type="button" class="wr-btn light" disabled={gp.step !== 'idle'} title={googleReady ? 'Choose photos from Google Photos' : 'Needs the Google Photos setup in the README'} onClick={() => fromGoogle()}>{gp.step === 'idle' ? 'Add from Google Photos' : gp.step === 'picking' ? 'Waiting for Google Photos…' : 'Copying…'}</button>
          <label class="wr-btn primary" style="cursor:pointer">Upload photos<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple class="sr-only" onChange={(e) => uploadFiles((e.target as HTMLInputElement).files)} /></label>
        </div>
      </div>
      {gp.msg && <p class="wr-note" role="status" style="color:var(--paper)">{gp.msg}</p>}
      <p class="wr-note">{busy || 'Photos appear on lizlenjo.com/lookbook in this order. Captions show under each photo; alt text describes it for screen readers. Built-in photos can be hidden but not deleted.'}</p>
      <ul class="lbm" role="list">
        {photos.map((p, k) => (
          <li class="wr-card lbm-item" style={{ opacity: p.published ? 1 : 0.55 }}>
            <img src={p.thumb} alt="" loading="lazy" />
            <div class="lbm-fields">
              <input class="wr-input" value={p.caption} placeholder="Caption" aria-label="Caption" onChange={(e) => { const caption = (e.target as HTMLInputElement).value; update(p.id, { caption }); put(p.id, { caption }); }} />
              <input class="wr-input" value={p.alt} placeholder="Alt text (describe the photo)" aria-label="Alt text" onChange={(e) => { const alt = (e.target as HTMLInputElement).value; update(p.id, { alt }); put(p.id, { alt }); }} />
              <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
                <select class="wr-select" style="width:auto" value={p.collection} aria-label="Collection" onChange={(e) => { const collection = (e.target as HTMLSelectElement).value; update(p.id, { collection }); put(p.id, { collection }); }}>{collections.map((c) => <option value={c} selected={c === p.collection}>{c}</option>)}</select>
                <select class="wr-select" style="width:auto" value={p.shape} aria-label="Shape on the Lookbook wall" onChange={(e) => { const shape = (e.target as HTMLSelectElement).value; update(p.id, { shape }); put(p.id, { shape }); }}>{SHAPES.map(([v, l]) => <option value={v} selected={v === p.shape}>{l}</option>)}</select>
                <button type="button" class="wr-btn" aria-label="Move earlier" disabled={k === 0} onClick={() => shift(k, -1)}>↑</button>
                <button type="button" class="wr-btn" aria-label="Move later" disabled={k === photos.length - 1} onClick={() => shift(k, 1)}>↓</button>
                <button type="button" class="wr-btn" onClick={() => { const published = !p.published; update(p.id, { published: published ? 1 : 0 }); put(p.id, { published }); }}>{p.published ? 'Hide' : 'Show'}</button>
                {!p.r2_key.startsWith('static/') && <button type="button" class="wr-btn ghost" onClick={() => remove(p)}>Delete</button>}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
