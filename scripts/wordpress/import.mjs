// WordPress → lizlenjo.com importer.
//
//   node scripts/wordpress/import.mjs extract <export.xml>
//       Reads the WordPress export (WXR) and writes scripts/wordpress/data/wordpress.json.
//       The JSON keeps only what the site needs and is safe to commit to a public repository:
//       no commenter emails or IP addresses, no theme demo content.
//
//   node scripts/wordpress/import.mjs build
//       Converts wordpress.json into
//         migrations/0003_wordpress_import.sql   posts (TipTap JSON), tags, comments
//         src/content/wp-redirects.json          old WordPress URLs → new URLs (used by middleware)
//         scripts/wordpress/data/images.json     images to download (used by the GitHub Action)
//
// Images are downloaded by .github/workflows/wordpress-images.yml (GitHub's runners can reach the
// old site) into public/wp-content/uploads/, so old image URLs keep working after the move.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { XMLParser } from 'fast-xml-parser';
import { parse as parseHtml, NodeType } from 'node-html-parser';

const DATA = new URL('./data/', import.meta.url);
const ROOT = new URL('../../', import.meta.url);
const OLD_HOSTS = /https?:\/\/(?:www\.)?lizlenjo\.(?:com|test)/gi;
const DEMO = /lorem ipsum|cum sociis|natoque|themeforest|dream-theme|consectetur adipiscing/i;

// ---------------------------------------------------------------- extract
function extract(xmlPath) {
  const xml = readFileSync(xmlPath, 'utf8');
  const doc = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@', cdataPropName: false, processEntities: true, htmlEntities: true, isArray: (n) => ['item', 'category', 'wp:postmeta', 'wp:comment'].includes(n) }).parse(xml);
  const items = doc.rss.channel.item;
  const s = (v) => (v == null ? '' : String(v));
  const meta = (it, key) => (it['wp:postmeta'] ?? []).find((m) => s(m['wp:meta_key']) === key)?.['wp:meta_value'];

  const attachments = {};
  for (const it of items) if (s(it['wp:post_type']) === 'attachment') attachments[s(it['wp:post_id'])] = s(it['wp:attachment_url']).replace(OLD_HOSTS, 'https://lizlenjo.com');

  const posts = [];
  const skipped = [];
  for (const it of items) {
    if (s(it['wp:post_type']) !== 'post') continue;
    const content = s(it['content:encoded']);
    const title = s(it.title);
    const status = s(it['wp:status']);
    const words = content.replace(/<[^>]+>|\[[^\]]+\]/g, ' ').split(/\s+/).filter(Boolean).length;
    if (DEMO.test(content)) { skipped.push({ title, reason: 'theme demo content' }); continue; }
    if (!title.trim() && words < 30) { skipped.push({ title: '(untitled)', reason: 'empty draft' }); continue; }
    if (!['publish', 'draft'].includes(status)) { skipped.push({ title, reason: `status ${status}` }); continue; }
    const cats = (it.category ?? []).filter((c) => c['@domain'] === 'category').map((c) => s(c['#text']));
    const tags = (it.category ?? []).filter((c) => c['@domain'] === 'post_tag').map((c) => s(c['#text']));
    const thumb = meta(it, '_thumbnail_id');
    posts.push({
      wp_id: Number(it['wp:post_id']),
      slug: decodeURIComponent(s(it['wp:post_name'])),
      title,
      status,
      date_gmt: s(it['wp:post_date_gmt']) !== '0000-00-00 00:00:00' ? s(it['wp:post_date_gmt']) : s(it['wp:post_date']),
      modified_gmt: s(it['wp:post_modified_gmt']),
      link: s(it.link).replace(OLD_HOSTS, 'https://lizlenjo.com'),
      excerpt: s(it['excerpt:encoded']),
      content,
      categories: cats,
      tags,
      featured: thumb ? attachments[s(thumb)] ?? null : null,
      comments: (it['wp:comment'] ?? [])
        .filter((c) => s(c['wp:comment_approved']) === '1' && !['pingback', 'trackback'].includes(s(c['wp:comment_type'])))
        .map((c) => ({ id: Number(c['wp:comment_id']), parent: Number(c['wp:comment_parent']) || 0, name: s(c['wp:comment_author']).slice(0, 80), date_gmt: s(c['wp:comment_date_gmt']), text: s(c['wp:comment_content']) })),
    });
  }
  posts.sort((a, b) => a.date_gmt.localeCompare(b.date_gmt));
  mkdirSync(DATA, { recursive: true });
  writeFileSync(new URL('wordpress.json', DATA), JSON.stringify({ source: 'lizlenjo.com WordPress export, 2026-10-07', attachments, posts, skipped }, null, 1));
  console.log(`extract: ${posts.length} posts (${posts.filter((p) => p.status === 'publish').length} published), ${posts.reduce((t, p) => t + p.comments.length, 0)} comments; skipped ${skipped.length}`);
  skipped.forEach((x) => console.log(`  skipped: ${x.title} (${x.reason})`));
}

// ---------------------------------------------------------------- helpers
const decode = (str) => parseHtml(`<x>${str}</x>`).text;
const uploadsPath = (url) => {
  const m = /\/wp-content\/uploads\/(.+)$/.exec(url.replace(OLD_HOSTS, '').split('?')[0]);
  return m ? `wp-content/uploads/${decodeURIComponent(m[1])}` : null;
};
/** "photo-300x200.jpg" → "photo.jpg" when the original exists among the attachments. */
function originalOf(url, originals) {
  const p = uploadsPath(url);
  if (!p) return null;
  if (originals.has(p)) return p;
  const o = p.replace(/-\d+x\d+(\.[a-z0-9]+)$/i, '$1');
  if (originals.has(o)) return o;
  const scaled = p.replace(/-scaled(\.[a-z0-9]+)$/i, '$1');
  if (originals.has(scaled)) return scaled;
  return p; // not in the export: try the URL as written
}

// Category: the site has six. WordPress had eight overlapping ones.
const CATEGORY_ORDER = [
  [/fashion/i, 'Fashion law'],
  [/entertainment/i, 'Entertainment'],
  [/ip law/i, null], // resolved to Copyright or Trademarks below
  [/life|lifestyle|motherhood|uncategorized/i, 'Life & Times'],
];
function category(p) {
  for (const [re, cat] of CATEGORY_ORDER) {
    if (!p.categories.some((c) => re.test(decode(c)))) continue;
    if (cat) return cat;
    const hay = `${p.title} ${p.tags.join(' ')}`;
    return /trade ?mark|brand|counterfeit|passing off/i.test(hay) ? 'Trademarks' : 'Copyright';
  }
  return 'Life & Times';
}
function cleanTags(tags) {
  const seen = new Set();
  const out = [];
  for (const raw of tags) {
    const t = decode(raw).trim().replace(/[.,;:!]+$/, '').replace(/\s+/g, ' ');
    if (!t || t.length > 40) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out.slice(0, 8);
}

// ---------------------------------------------------------------- HTML → TipTap
const BLOCK = new Set(['p', 'div', 'section', 'article', 'figure', 'blockquote', 'ul', 'ol', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'table', 'pre', 'iframe', 'center']);

/** WordPress's wpautop, simplified: blank lines become paragraphs, single newlines become <br>. */
function autop(html) {
  if (/<p[\s>]/i.test(html)) return html;
  return html
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => (/^<(h[1-6]|ul|ol|blockquote|figure|div|table|hr|iframe|pre)/i.test(chunk) ? chunk : `<p>${chunk.replace(/\n/g, '<br>')}</p>`))
    .join('\n');
}

function preprocess(html, ctx) {
  let h = html.replace(/<!--[\s\S]*?-->/g, '').replace(/\r/g, '');
  // [caption]<img> text[/caption] → <figure><img><figcaption>text</figcaption></figure>
  h = h.replace(/\[caption[^\]]*\]([\s\S]*?)\[\/caption\]/gi, (_, inner) => {
    const img = /(<a[^>]*>\s*)?<img[^>]*>(\s*<\/a>)?/i.exec(inner);
    const cap = inner.replace(img ? img[0] : '', '').trim();
    return `\n\n<figure>${img ? img[0] : ''}<figcaption>${cap}</figcaption></figure>\n\n`;
  });
  // Visual Composer single image by attachment id
  h = h.replace(/\[vc_single_image[^\]]*image="(\d+)"[^\]]*\]/gi, (_, id) => (ctx.attachments[id] ? `\n\n<figure><img src="${ctx.attachments[id]}" alt=""></figure>\n\n` : ''));
  // YouTube embeds as bare URLs on their own line
  h = h.replace(/^\s*(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+[^\s<]*)\s*$/gim, '<p><a href="$1">Watch the video on YouTube ↗</a></p>');
  // Strip remaining theme shortcodes but keep their text
  h = h.replace(/\[\/?(vc_|dt_|et_|fusion_|av_)[^\]]*\]/gi, '\n\n').replace(/\[\/?(embed|gallery|audio|video|playlist)[^\]]*\]/gi, '');
  return autop(h.replace(OLD_HOSTS, 'https://lizlenjo.com'));
}

function convert(html, ctx) {
  const root = parseHtml(preprocess(html, ctx), { blockTextElements: { script: false, style: false, pre: true } });
  const blocks = [];
  let inlineBuf = [];
  const flush = () => {
    const content = trimInline(inlineBuf);
    if (content.length) blocks.push({ type: 'paragraph', content });
    inlineBuf = [];
  };

  const figure = (img, caption = '') => {
    const src = img.getAttribute('src') ?? '';
    if (!src || /^data:/.test(src)) return null;
    const key = originalOf(src, ctx.originals);
    const alt = decode(img.getAttribute('alt') ?? '').trim();
    if (key) ctx.images.add(key);
    else if (/^https?:/.test(src)) ctx.external.add(src);
    return { type: 'figure', attrs: { key: key ?? null, src: key ? null : src, alt, caption: caption.trim() } };
  };

  function inline(node, marks = []) {
    const out = [];
    for (const n of node.childNodes) {
      if (n.nodeType === NodeType.TEXT_NODE) {
        const text = n.text.replace(/\s+/g, ' ');
        if (text) out.push(marks.length ? { type: 'text', text, marks } : { type: 'text', text });
        continue;
      }
      if (n.nodeType !== NodeType.ELEMENT_NODE) continue;
      const tag = n.rawTagName?.toLowerCase();
      if (tag === 'br') out.push({ type: 'hardBreak' });
      else if (tag === 'img') out.push({ type: '__img', node: n });
      else if (tag === 'strong' || tag === 'b') out.push(...inline(n, addMark(marks, { type: 'bold' })));
      else if (tag === 'em' || tag === 'i' || tag === 'cite') out.push(...inline(n, addMark(marks, { type: 'italic' })));
      else if (tag === 's' || tag === 'del' || tag === 'strike') out.push(...inline(n, addMark(marks, { type: 'strike' })));
      else if (tag === 'code') out.push(...inline(n, addMark(marks, { type: 'code' })));
      else if (tag === 'a') {
        const href = rewriteHref(n.getAttribute('href') ?? '', ctx);
        out.push(...inline(n, href ? addMark(marks, { type: 'link', attrs: { href } }) : marks));
      } else if (tag === 'script' || tag === 'style') continue;
      else out.push(...inline(n, marks));
    }
    return out;
  }

  function emitInline(parts) {
    for (const part of parts) {
      if (part.type === '__img') {
        flush();
        const f = figure(part.node);
        if (f) blocks.push(f);
      } else inlineBuf.push(part);
    }
  }

  function walk(node) {
    for (const n of node.childNodes) {
      if (n.nodeType === NodeType.TEXT_NODE) {
        emitInline(inline({ childNodes: [n] }));
        continue;
      }
      if (n.nodeType !== NodeType.ELEMENT_NODE) continue;
      const tag = n.rawTagName?.toLowerCase();
      if (!BLOCK.has(tag)) { emitInline(inline({ childNodes: [n] })); continue; }
      flush();
      if (tag === 'p' || tag === 'center') { emitInline(inline(n)); flush(); }
      else if (/^h[1-6]$/.test(tag)) {
        const content = trimInline(inline(n).filter((x) => x.type !== '__img'));
        if (content.length) blocks.push({ type: 'heading', attrs: { level: Number(tag[1]) <= 2 ? 2 : 3 }, content });
      } else if (tag === 'blockquote') {
        const paras = [];
        const ps = n.querySelectorAll('p');
        for (const p of ps.length ? ps : [n]) {
          const content = trimInline(inline(p).filter((x) => x.type !== '__img'));
          if (content.length) paras.push({ type: 'paragraph', content });
        }
        if (paras.length) blocks.push({ type: 'blockquote', content: paras });
      } else if (tag === 'ul' || tag === 'ol') {
        const items = n.childNodes.filter((c) => c.rawTagName?.toLowerCase() === 'li').map((li) => ({ type: 'listItem', content: [{ type: 'paragraph', content: trimInline(inline(li).filter((x) => x.type !== '__img')) }] })).filter((li) => li.content[0].content.length);
        if (items.length) blocks.push({ type: tag === 'ol' ? 'orderedList' : 'bulletList', content: items });
      } else if (tag === 'figure') {
        const quote = n.querySelector('blockquote');
        if (quote) { walk({ childNodes: [quote] }); continue; }
        const caption = n.querySelector('figcaption')?.text ?? '';
        const imgs = n.querySelectorAll('img');
        imgs.forEach((img, i) => { const f = figure(img, imgs.length === 1 || i === imgs.length - 1 ? caption : ''); if (f) blocks.push(f); });
        if (!imgs.length) walk(n);
      } else if (tag === 'hr') blocks.push({ type: 'horizontalRule' });
      else if (tag === 'iframe') {
        const src = n.getAttribute('src') ?? '';
        const yt = /youtube(?:-nocookie)?\.com\/embed\/([\w-]+)/.exec(src);
        const href = yt ? `https://www.youtube.com/watch?v=${yt[1]}` : src;
        if (href) blocks.push({ type: 'paragraph', content: [{ type: 'text', text: yt ? 'Watch the video on YouTube ↗' : 'Open the embedded content ↗', marks: [{ type: 'link', attrs: { href } }] }] });
      } else if (tag === 'pre') {
        const text = n.text.trim();
        if (text) blocks.push({ type: 'paragraph', content: [{ type: 'text', text, marks: [{ type: 'code' }] }] });
      } else walk(n); // div, section, article, table
      flush();
    }
  }
  walk(root);
  flush();
  // Drop leading/trailing empties and collapse runs of figures with identical keys.
  return { type: 'doc', content: blocks.length ? blocks.filter((b, i, a) => !(b.type === 'figure' && a[i - 1]?.type === 'figure' && a[i - 1].attrs.key && a[i - 1].attrs.key === b.attrs.key)) : [{ type: 'paragraph' }] };
}

function addMark(marks, m) {
  return marks.some((x) => x.type === m.type) ? marks : [...marks, m];
}
function trimInline(parts) {
  const out = parts.filter((p) => p.type !== 'text' || p.text.length);
  while (out.length && (out[0].type === 'hardBreak' || (out[0].type === 'text' && !out[0].text.trim()))) out.shift();
  while (out.length && (out.at(-1).type === 'hardBreak' || (out.at(-1).type === 'text' && !out.at(-1).text.trim()))) out.pop();
  if (out[0]?.type === 'text') out[0] = { ...out[0], text: out[0].text.replace(/^\s+/, '') };
  const last = out.at(-1);
  if (last?.type === 'text') out[out.length - 1] = { ...last, text: last.text.replace(/\s+$/, '') };
  // merge adjacent text nodes with identical marks
  const merged = [];
  for (const p of out) {
    const prev = merged.at(-1);
    if (prev && prev.type === 'text' && p.type === 'text' && JSON.stringify(prev.marks ?? []) === JSON.stringify(p.marks ?? [])) merged[merged.length - 1] = { ...prev, text: prev.text + p.text };
    else merged.push(p);
  }
  return merged.filter((p) => p.type !== 'text' || p.text.length);
}
function rewriteHref(href, ctx) {
  const h = href.trim().replace(OLD_HOSTS, 'https://lizlenjo.com');
  if (!h || /^javascript:/i.test(h)) return null;
  if (/attachment_id=|\/attachment\//.test(h)) return null; // attachment pages no longer exist
  const up = uploadsPath(h);
  if (up) { const key = originalOf(h, ctx.originals); ctx.images.add(key); return `/${key}`; }
  const m = /^https:\/\/lizlenjo\.com\/([^/?#]+)\/?(?:[?#].*)?$/.exec(h);
  if (m && ctx.slugs.has(decodeURIComponent(m[1]))) return `/notes/${decodeURIComponent(m[1])}`;
  return h;
}

// ---------------------------------------------------------------- text helpers
function textOf(node) {
  if (!node) return '';
  if (node.type === 'text') return node.text;
  if (node.type === 'hardBreak') return '\n';
  if (node.type === 'figure') return node.attrs.caption || '';
  const inner = (node.content ?? []).map(textOf).join('');
  return ['paragraph', 'heading', 'listItem', 'blockquote'].includes(node.type) ? `${inner}\n` : inner;
}
const sentenceExcerpt = (text, max = 220) => {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '));
  return end > 80 ? cut.slice(0, end + 1) : `${cut.slice(0, cut.lastIndexOf(' '))}…`;
};
const iso = (wpDate) => (wpDate ? `${wpDate.replace(' ', 'T')}Z` : null);
const q = (v) => (v == null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
const commentText = (html) => parseHtml(html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')).text.replace(/\n{3,}/g, '\n\n').trim().slice(0, 4000);

// ---------------------------------------------------------------- build
function build() {
  const data = JSON.parse(readFileSync(new URL('wordpress.json', DATA), 'utf8'));
  const originals = new Set(Object.values(data.attachments).map(uploadsPath).filter(Boolean));
  const slugs = new Set(data.posts.map((p) => p.slug).filter(Boolean));
  const allImages = new Set();
  const allExternal = new Set();
  const redirects = {};
  const rows = [];

  for (const p of data.posts) {
    const ctx = { attachments: data.attachments, originals, slugs, images: new Set(), external: new Set() };
    const doc = convert(p.content, ctx);
    const text = textOf(doc).replace(/\n{2,}/g, '\n').trim();
    const words = text ? text.split(/\s+/).length : 0;
    let cover = p.featured ? originalOf(p.featured, originals) : null;
    if (!cover) cover = doc.content.find((b) => b.type === 'figure' && b.attrs.key)?.attrs.key ?? null;
    if (cover) ctx.images.add(cover);
    const title = decode(p.title).trim().replace(OLD_HOSTS, 'lizlenjo.com').replace(/lizlenjo\.test/gi, 'lizlenjo.com') || 'Untitled';
    const slug = (p.slug || `wp-${p.wp_id}`).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
    const excerptSrc = decode(p.excerpt).trim() || sentenceExcerpt(text);
    ctx.images.forEach((x) => allImages.add(x));
    ctx.external.forEach((x) => allExternal.add(x));
    if (p.status === 'publish') {
      redirects[`/${slug}`] = `/notes/${slug}`;
      if (p.slug && p.slug !== slug) redirects[`/${encodeURIComponent(p.slug)}`] = `/notes/${slug}`;
    }
    rows.push({ p, slug, title, excerpt: excerptSrc.slice(0, 600), category: category(p), tags: cleanTags(p.tags), doc, text, words, cover });
  }

  // Old site pages and archives.
  Object.assign(redirects, {
    '/blog': '/notes',
    '/about-liz': '/about',
    '/left-menu': '/about',
    '/kikao-ip': '/about',
    '/feed': '/notes/rss.xml',
    '/comments/feed': '/notes/rss.xml',
  });

  let sql = `-- Liz's posts imported from the old WordPress site (export of 2026-10-07).
-- Generated by: node scripts/wordpress/import.mjs build   (do not edit by hand)
-- ${rows.length} posts, ${rows.reduce((t, r) => t + r.p.comments.length, 0)} approved comments. Commenter emails were not imported.

`;
  for (const r of rows) {
    const published = r.p.status === 'publish';
    const date = iso(r.p.date_gmt);
    sql += `INSERT INTO posts (slug, title, excerpt, category, tags, body_json, body_text, word_count, cover_key, cover_alt, status, published_at, created_at, updated_at, is_sample)
VALUES (${q(r.slug)}, ${q(r.title)}, ${q(r.excerpt)}, ${q(r.category)}, ${q(JSON.stringify(r.tags))}, ${q(JSON.stringify(r.doc))}, ${q(r.text)}, ${r.words}, ${q(r.cover)}, '', ${q(published ? 'published' : 'draft')}, ${published ? q(date) : 'NULL'}, ${q(date)}, ${q(iso(r.p.modified_gmt) ?? date)}, 0)
ON CONFLICT (slug) DO NOTHING;\n`;
    for (const c of r.p.comments) {
      const text = commentText(c.text);
      if (!text) continue;
      sql += `INSERT INTO comments (post_id, name, email, text, status, spam_score, spam_reason, created_at) SELECT id, ${q(c.name || 'Reader')}, '', ${q(text)}, 'approved', 0, 'imported from WordPress', ${q(iso(c.date_gmt))} FROM posts WHERE slug = ${q(r.slug)};\n`;
    }
    sql += '\n';
  }
  writeFileSync(new URL('migrations/0003_wordpress_import.sql', ROOT), sql);
  writeFileSync(new URL('src/content/wp-redirects.json', ROOT), JSON.stringify(redirects, null, 1) + '\n');
  const images = [...allImages].sort().map((key) => ({ key, url: `https://lizlenjo.com/${key.split('/').map(encodeURIComponent).join('/')}` }));
  writeFileSync(new URL('images.json', DATA), JSON.stringify({ note: 'Images used by the imported posts. Downloaded by .github/workflows/wordpress-images.yml into public/.', images, external: [...allExternal].sort() }, null, 1) + '\n');

  const cats = rows.reduce((m, r) => ((m[r.category] = (m[r.category] ?? 0) + 1), m), {});
  console.log(`build: ${rows.length} posts → migrations/0003_wordpress_import.sql`);
  console.log(`       categories ${JSON.stringify(cats)}`);
  console.log(`       ${images.length} images to fetch, ${allExternal.size} external, ${Object.keys(redirects).length} redirects`);
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === 'extract' && arg) extract(arg);
else if (cmd === 'build') build();
else {
  console.log('Usage: node scripts/wordpress/import.mjs extract <export.xml> | build');
  process.exit(1);
}
