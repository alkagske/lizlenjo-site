// Downloads the public-domain Pearson Scott Foresman line-art "notions" from Wikimedia Commons
// into public/notions/, replacing the hand-drawn placeholders.
// Run once on a machine with internet access:  npm run notions:fetch   then commit public/notions/.
// Each drawing is stored as a small transparent PNG wrapped in an SVG, so file names stay the same.
import { writeFileSync } from 'node:fs';

const FILES = [
  ['Scissors3 (PSF).svg', 'scissors.svg'],
  ['Spool (PSF).png', 'spool.svg'],
  ['Thimble (PSF).png', 'thimble.svg'],
  ['Needle (PSF).png', 'needle.svg'],
  ['Safety Pins(PSF).png', 'safety-pins.svg'],
];

for (const [name, out] of FILES) {
  const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(name)}${name.endsWith('.png') ? '?width=500' : ''}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'lizlenjo.com build (https://lizlenjo.com)' }, redirect: 'follow' });
  if (!res.ok) { console.error(`✗ ${name}: HTTP ${res.status}`); process.exitCode = 1; continue; }
  const buf = Buffer.from(await res.arrayBuffer());
  // Rasterise to 400px, then turn white paper into transparency so the lines sit on any background
  // (the safety pins are inverted to white on the denim section).
  const { default: sharp } = await import('sharp');
  const { data, info } = await sharp(buf, { density: 144 }).resize({ width: 400, withoutEnlargement: true }).flatten({ background: '#ffffff' }).greyscale().raw().toBuffer({ resolveWithObject: true });
  const rgba = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0; i < info.width * info.height; i++) {
    rgba.set([26, 26, 26, 255 - data[i * info.channels]], i * 4);
  }
  const png = await sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } }).png({ palette: true, colours: 16, compressionLevel: 9 }).toBuffer();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${info.width} ${info.height}"><title>${name.replace(/\.(png|svg)$/, '')} — Pearson Scott Foresman, public domain</title><image width="${info.width}" height="${info.height}" href="data:image/png;base64,${png.toString('base64')}"/></svg>`;
  writeFileSync(new URL(`../public/notions/${out}`, import.meta.url), svg);
  console.log(`✓ ${name} → public/notions/${out}`);
}
