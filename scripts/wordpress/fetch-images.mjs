// Downloads the images used by the imported posts from the old WordPress site into
// public/wp-content/uploads/ (same paths as before, so old image links keep working).
// Large photos are resized to 1600 px wide and recompressed. Already-downloaded files are skipped.
//
//   node scripts/wordpress/fetch-images.mjs            images used by posts (committed to the repo)
//   node scripts/wordpress/fetch-images.mjs --all DIR  every attachment, untouched originals, into DIR (backup)
//
// Must run while lizlenjo.com still points at the WordPress host.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import sharp from 'sharp';

const ROOT = new URL('../../', import.meta.url);
const data = (f) => JSON.parse(readFileSync(new URL(`data/${f}`, import.meta.url), 'utf8'));
const MAX_W = 1600;

async function get(url) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'lizlenjo.com migration (owner)' }, redirect: 'follow' });
      if (res.ok) return Buffer.from(await res.arrayBuffer());
      if (res.status === 404) return { status: 404 };
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 1000 * attempt));
  }
  return { status: 'error' };
}

async function optimise(buf, key) {
  const ext = key.split('.').pop().toLowerCase();
  if (ext === 'gif' || ext === 'svg') return buf;
  try {
    const img = sharp(buf, { failOn: 'none' }).rotate();
    const meta = await img.metadata();
    const resized = meta.width && meta.width > MAX_W ? img.resize({ width: MAX_W }) : img;
    const out = ext === 'png' ? await resized.png({ compressionLevel: 9, palette: true, quality: 90 }).toBuffer()
      : ext === 'webp' ? await resized.webp({ quality: 82 }).toBuffer()
      : await resized.jpeg({ quality: 82, mozjpeg: true }).toBuffer();
    return out.length < buf.length ? out : buf;
  } catch {
    return buf;
  }
}

const [flag, dir] = process.argv.slice(2);
const report = { ok: 0, skipped: 0, missing: [], failed: [], bytes: 0 };

if (flag === '--all') {
  const { attachments } = data('wordpress.json');
  for (const url of Object.values(attachments)) {
    const path = new URL(url).pathname.replace(/^\//, '');
    const dest = `${dir}/${decodeURIComponent(path)}`;
    if (existsSync(dest)) { report.skipped++; continue; }
    const r = await get(url);
    if (!Buffer.isBuffer(r)) { (r.status === 404 ? report.missing : report.failed).push(url); continue; }
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, r);
    report.ok++;
    report.bytes += r.length;
  }
} else {
  const { images } = data('images.json');
  for (const { key, url } of images) {
    const dest = new URL(`public/${key}`, ROOT);
    if (existsSync(dest)) { report.skipped++; continue; }
    const r = await get(url);
    if (!Buffer.isBuffer(r)) { (r.status === 404 ? report.missing : report.failed).push(key); continue; }
    const out = await optimise(r, key);
    mkdirSync(dirname(dest.pathname), { recursive: true });
    writeFileSync(dest, out);
    report.ok++;
    report.bytes += out.length;
  }
  writeFileSync(new URL('data/images-report.json', import.meta.url), JSON.stringify({ when: new Date().toISOString(), ...report }, null, 1) + '\n');
}
console.log(`downloaded ${report.ok}, already had ${report.skipped}, missing (404) ${report.missing.length}, failed ${report.failed.length}, ${(report.bytes / 1048576).toFixed(1)} MB`);
report.missing.forEach((x) => console.log(`  404: ${x}`));
report.failed.forEach((x) => console.log(`  failed: ${x}`));
if (report.failed.length) process.exitCode = 1;
