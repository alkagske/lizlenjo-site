// Build step: makes WebP sizes of the photos built into the site for the Lookbook
// (public/lookbook/<name>-<width>.webp). Runs before `astro build` (npm "prebuild").
// The Home slider is optimised separately by Astro's <Picture> at build time.
import { mkdirSync, existsSync, statSync } from 'node:fs';
import sharp from 'sharp';

const SRC = {
  advocate: 'src/assets/slides/advocate.png',
  lecturer: 'src/assets/slides/lecturer.png',
  fashion: 'src/assets/slides/fashion.png',
  model: 'src/assets/slides/model.png',
  reflection: 'src/assets/photos/reflection-1920.jpg',
  piano: 'src/assets/photos/piano-1920.jpg',
  'red-twirl': 'src/assets/photos/red-twirl-1920.jpg',
};
const WIDTHS = [480, 960, 1600];
mkdirSync('public/lookbook', { recursive: true });
let made = 0;
for (const [name, file] of Object.entries(SRC)) {
  for (const w of WIDTHS) {
    const out = `public/lookbook/${name}-${w}.webp`;
    if (existsSync(out) && statSync(out).mtimeMs > statSync(file).mtimeMs) continue;
    await sharp(file).resize({ width: w, withoutEnlargement: true }).webp({ quality: 78 }).toFile(out);
    made++;
  }
}
console.log(`lookbook: ${made} image(s) generated`);
