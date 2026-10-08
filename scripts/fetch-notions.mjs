// Downloads the public-domain Pearson Scott Foresman line-art "notions" from Wikimedia Commons
// into public/notions/, replacing the hand-drawn placeholders.
// Run once on a machine with internet access:  npm run notions:fetch   then commit public/notions/.
// PNG originals are wrapped in an SVG so the file names (and the site code) stay the same.
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
  let svg;
  if (name.endsWith('.svg')) {
    svg = buf.toString('utf8');
  } else {
    const { default: sharp } = await import('sharp');
    const meta = await sharp(buf).metadata();
    svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${meta.width} ${meta.height}"><title>${name.replace(/\.png$/, '')} — Pearson Scott Foresman, public domain</title><image width="${meta.width}" height="${meta.height}" href="data:image/png;base64,${buf.toString('base64')}"/></svg>`;
  }
  writeFileSync(new URL(`../public/notions/${out}`, import.meta.url), svg);
  console.log(`✓ ${name} → public/notions/${out}`);
}
