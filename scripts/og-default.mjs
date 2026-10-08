// Renders public/og-default.png (1200×630) with the site fonts, using Playwright's Chromium.
// Run: node scripts/og-default.mjs   (only needed if the default share image should change)
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import sharp from 'sharp';

const font = (p) => `data:font/woff2;base64,${readFileSync(`node_modules/@fontsource/${p}`).toString('base64')}`;
const logo = `data:image/webp;base64,${readFileSync('public/logo-9.webp').toString('base64')}`;
const html = `<!doctype html><html><head><style>
@font-face{font-family:IS;src:url(${font('instrument-serif/files/instrument-serif-latin-400-normal.woff2')})}
@font-face{font-family:IS;font-style:italic;src:url(${font('instrument-serif/files/instrument-serif-latin-400-italic.woff2')})}
@font-face{font-family:PM;src:url(${font('ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2')})}
@font-face{font-family:CV;src:url(${font('caveat/files/caveat-latin-500-normal.woff2')})}
*{margin:0;box-sizing:border-box}
body{width:1200px;height:630px;background-color:#fbfaf7;background-image:linear-gradient(#ebe8f0 1px,transparent 1px),linear-gradient(90deg,#ebe8f0 1px,transparent 1px);background-size:32px 32px;color:#14213d;position:relative;overflow:hidden;font-family:IS}
.k{position:absolute;left:72px;top:112px;font:20px PM;letter-spacing:.16em;color:#0c6b9d}
h1{position:absolute;left:72px;top:156px;width:850px;font-weight:400;font-size:72px;line-height:1.02}
em{color:#0c6b9d;background:linear-gradient(transparent 82%,rgba(196,55,44,.35) 82%,rgba(196,55,44,.35) 90%,transparent 90%)}
.chalk{position:absolute;left:560px;top:96px;font:30px CV;color:#c4372c;transform:rotate(-4deg)}
.n{position:absolute;left:72px;top:418px;font-size:42px}
.r{position:absolute;left:72px;top:474px;font:16px PM;letter-spacing:.16em;color:#6a7186}
img{position:absolute;right:60px;top:100px;height:170px}
.label{position:absolute;right:56px;bottom:84px;border:1px solid #14213d;outline:1px dashed #14213d;outline-offset:-6px;padding:14px 22px;font:13px PM;letter-spacing:.24em;background:#fff}
.tape{position:absolute;left:0;right:0;bottom:30px;height:10px;border-top:1px solid #14213d;background:repeating-linear-gradient(90deg,#14213d 0 1px,transparent 1px 8px) 0 0/100% 4px no-repeat,repeating-linear-gradient(90deg,#14213d 0 1px,transparent 1px 40px) 0 0/100% 9px no-repeat}
.tape i{position:absolute;inset:0;width:38%;background:#0c6b9d;opacity:.9;mix-blend-mode:multiply}
</style></head><body>
<div class="k">PATTERN NO. 01 — THE ADVOCATE</div>
<div class="chalk">bespoke, never off the rack ↘</div>
<h1>Law, cut to measure for Africa’s <em>creative industries.</em></h1>
<div class="n">Liz Lenjo, Esq.</div>
<div class="r">ADVOCATE · CHAIRPERSON, COPYRIGHT TRIBUNAL · MYIP LEGAL STUDIO</div>
<img src="${logo}" alt="">
<div class="label">MADE IN KENYA</div>
<div class="tape"><i></i></div>
</body></html>`;

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
await p.setContent(html, { waitUntil: 'networkidle' });
await p.evaluate(() => document.fonts.ready);
const png = await p.screenshot({ type: 'png' });
await b.close();
await sharp(png).png({ compressionLevel: 9, palette: true, colours: 160 }).toFile('public/og-default.png');
console.log('wrote public/og-default.png');
