/** Workroom → Lookbook: upload photos, caption them, choose a collection, reorder, hide or delete. */
import { useState } from 'preact/hooks';

export interface MPhoto { id: number; r2_key: string; caption: string; alt: string; collection: string; published: number; thumb: string }
interface Props { photos: MPhoto[]; collections: string[] }

const dims = (file: File) => new Promise<{ width: number; height: number }>((resolve) => {
  const img = new Image();
  img.onload = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(img.src); };
  img.onerror = () => resolve({ width: 0, height: 0 });
  img.src = URL.createObjectURL(file);
});

export default function LookbookManager({ photos: initial, collections }: Props) {
  const [photos, setPhotos] = useState(initial);
  const [busy, setBusy] = useState('');
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
          <select id="lb-coll" class="wr-select" style="width:auto" value={coll} onChange={(e) => setColl((e.target as HTMLSelectElement).value)}>{collections.map((c) => <option>{c}</option>)}</select>
          <label class="wr-btn primary" style="cursor:pointer">Upload photos<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple class="sr-only" onChange={(e) => uploadFiles((e.target as HTMLInputElement).files)} /></label>
        </div>
      </div>
      <p class="wr-note">{busy || 'Photos appear on lizlenjo.com/lookbook in this order. Captions show under each photo; alt text describes it for screen readers. Built-in photos can be hidden but not deleted.'}</p>
      <ul class="lbm" role="list">
        {photos.map((p, k) => (
          <li class="wr-card lbm-item" style={{ opacity: p.published ? 1 : 0.55 }}>
            <img src={p.thumb} alt="" loading="lazy" />
            <div class="lbm-fields">
              <input class="wr-input" value={p.caption} placeholder="Caption" aria-label="Caption" onChange={(e) => { const caption = (e.target as HTMLInputElement).value; update(p.id, { caption }); put(p.id, { caption }); }} />
              <input class="wr-input" value={p.alt} placeholder="Alt text (describe the photo)" aria-label="Alt text" onChange={(e) => { const alt = (e.target as HTMLInputElement).value; update(p.id, { alt }); put(p.id, { alt }); }} />
              <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
                <select class="wr-select" style="width:auto" value={p.collection} aria-label="Collection" onChange={(e) => { const collection = (e.target as HTMLSelectElement).value; update(p.id, { collection }); put(p.id, { collection }); }}>{collections.map((c) => <option>{c}</option>)}</select>
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
