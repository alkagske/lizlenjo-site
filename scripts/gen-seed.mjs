// One-off generator for migrations/0002_seed_samples.sql.
// Converts the prototype's sample posts into TipTap JSON. Every post is seeded as a DRAFT
// with is_sample = 1 so nothing from the prototype is ever published by accident.
import { writeFileSync } from 'node:fs';

const SEED = [
  { id: 1, cat: 'Fashion law', title: 'Inspiration versus exploitation: traditional cultural expressions in fashion', excerpt: 'Where borrowing from a community’s heritage becomes taking, and what the law can do about it.', tags: ['Fashion law', 'TCEs'], body: ['Fashion has always borrowed. The question is when borrowing becomes taking, and who gets a say.', '^the whole question, really', '#Why the existing tools fall short', 'Copyright protects original works by identifiable authors for a limited term. Traditional cultural expressions are often collective, intergenerational and living, which makes them a poor fit.', '^See the Swakopmund Protocol (2010) on TCEs', '>A pattern can belong to a people long before it belongs to a label.', '#Where the practical work is happening', 'Sui generis frameworks, community protocols and fair attribution clauses in design contracts are where the practical work is now happening.', '^more on attribution clauses in a follow-up'] },
  { id: 2, cat: 'Copyright', title: 'What the Copyright Tribunal does, and when to bring a dispute', excerpt: 'A plain guide to Kenya’s specialised forum for licensing and rights disputes.', tags: ['Copyright', 'Tribunal'], body: ['The Copyright Tribunal is constituted under Section 48 of the Copyright Act (CAP 130).', '^CAP 130, s.48', '#Matters the Tribunal hears', 'Disputes over licensing schemes, royalty rates and the conduct of collective management organisations are its core work.'] },
  { id: 3, cat: 'Entertainment', title: 'Licensing music for film and digital platforms in Kenya', excerpt: 'Sync, master and performance rights, and the order to clear them in.', tags: ['Music', 'Licensing'], body: ['Every piece of music in a film carries at least two sets of rights: the composition and the recording.', '#Clear early', 'Licences negotiated after the edit is locked are licences negotiated without leverage.', '^ask me how I know'] },
  { id: 4, cat: 'Trademarks', title: 'Counterfeits, supply chains and cross-border enforcement', excerpt: 'Why the fight against fakes now runs through logistics data.', tags: ['Anti-counterfeiting', 'Design'], body: ['Counterfeit goods move through the same ports and platforms as genuine ones.', '#Working with customs', 'Recordal of marks with customs authorities remains one of the most cost-effective tools available to brand owners.', '^Anti-Counterfeit Act, 2008'] },
  { id: 5, cat: 'Governance', title: 'What boards in regulated industries should ask about intangible assets', excerpt: 'Five questions for the audit committee.', tags: ['Governance'], body: ['Intangible assets rarely appear on the agenda until something goes wrong.', '#Start with an inventory', 'A board cannot oversee what it has not listed.'] },
  { id: 6, cat: 'Fashion law', title: 'Protecting a design collection before the runway', excerpt: 'Registration, confidentiality and timing for emerging designers.', tags: ['Design', 'Fashion law'], body: ['Showing a collection publicly can affect whether its designs can later be registered.', '#Timing matters', 'File first, then show.', '^the single most useful line in this post', '---', '!Look book pages marked up before filing'] },
  { id: 7, cat: 'Copyright', title: 'AI training data and copyright: a view from Nairobi', excerpt: '', tags: ['AI'], body: ['Draft in progress.'] },
  { id: 8, cat: 'Entertainment', title: 'Image rights for athletes and performers', excerpt: '', tags: [], body: [] },
  { id: 9, cat: 'Fashion law', title: 'Fashion week contracts: a checklist for designers', excerpt: 'What to agree before the lights come on.', tags: ['Design'], body: ['Draft in progress.'] },
];
const SERIES = { name: 'Protecting African design', ids: [6, 4, 1] };

const t = (text) => (text ? [{ type: 'text', text }] : []);
const toDoc = (body) => ({
  type: 'doc',
  content: body.length
    ? body.map((b) => {
        if (b.startsWith('#')) return { type: 'heading', attrs: { level: 2 }, content: t(b.slice(1)) };
        if (b.startsWith('>')) return { type: 'blockquote', content: [{ type: 'paragraph', content: t(b.slice(1)) }] };
        if (b.startsWith('^')) return { type: 'marginNote', attrs: { kind: b.slice(1).startsWith('See ') ? 'cite' : 'note' }, content: t(b.slice(1)) };
        if (b.startsWith('!')) return { type: 'figure', attrs: { src: null, key: null, alt: '', caption: b.slice(1) } };
        if (b === '---') return { type: 'horizontalRule' };
        return { type: 'paragraph', content: t(b) };
      })
    : [{ type: 'paragraph' }],
});
const text = (body) => body.map((b) => (b === '---' ? '' : b.replace(/^[#>^!]/, ''))).join('\n').trim();
// Same rules as src/lib/slug.ts: lower-case, hyphenated, cut at a word boundary at or under 60 characters.
const slug = (s) => {
  const full = s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (full.length <= 60) return full;
  const cut = full.slice(0, 61);
  return cut.slice(0, cut.lastIndexOf('-') > 20 ? cut.lastIndexOf('-') : 60);
};
const q = (s) => (s == null ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`);

let sql = `-- Sample posts from the design prototype. Seeded as DRAFTS ONLY (is_sample = 1).
-- Liz can edit, publish or delete them in /workroom. Real posts replace these.
-- Generated by scripts/gen-seed.mjs.

INSERT INTO series (id, name) VALUES (1, ${q(SERIES.name)});
`;
for (const p of SEED) {
  const words = text(p.body).split(/\s+/).filter(Boolean).length;
  const order = SERIES.ids.indexOf(p.id);
  sql += `
INSERT INTO posts (id, slug, title, excerpt, category, tags, body_json, body_text, word_count, status, series_id, series_order, is_sample)
VALUES (${p.id}, ${q(slug(p.title))}, ${q(p.title)}, ${q(p.excerpt)}, ${q(p.cat)}, ${q(JSON.stringify(p.tags))}, ${q(JSON.stringify(toDoc(p.body)))}, ${q(text(p.body))}, ${words}, 'draft', ${order >= 0 ? 1 : 'NULL'}, ${order >= 0 ? order + 1 : 'NULL'}, 1);`;
}

// Photos built into the site appear in the Lookbook until Liz hides or replaces them.
const PHOTOS = [
  ['static/advocate', 'Advocate of the High Court of Kenya', 'Liz Lenjo in court robes', 'Advocate', 1280, 720, '50% 12%'],
  ['static/lecturer', 'Lecturer, Strathmore University Law School', 'Liz Lenjo lecturing', 'Lecturer', 1280, 720, '50% 12%'],
  ['static/fashion', 'Kenya Fashion Council', 'Liz Lenjo in a tailored outfit', 'Fashion', 1280, 720, '50% 12%'],
  ['static/model', 'On the runway', 'Liz Lenjo modelling', 'Fashion', 1280, 720, '50% 12%'],
  ['static/reflection', 'Portrait', 'Liz Lenjo, portrait', 'Editorial', 1920, 1280, '50% 30%'],
  ['static/piano', 'At the piano', 'Liz Lenjo at the piano', 'Editorial', 1920, 1280, '62% 40%'],
  ['static/red-twirl', 'In red', 'Liz Lenjo in a red gown', 'Editorial', 1920, 1280, '50% 45%'],
];
sql += '\n';
PHOTOS.forEach(([key, caption, alt, coll, w, h, pos], i) => {
  sql += `\nINSERT INTO photos (r2_key, caption, alt, collection, sort, width, height, object_position) VALUES (${q(key)}, ${q(caption)}, ${q(alt)}, ${q(coll)}, ${(i + 1) * 10}, ${w}, ${h}, ${q(pos)});`;
});
writeFileSync(new URL('../migrations/0002_seed_samples.sql', import.meta.url), sql + '\n');
console.log('wrote migrations/0002_seed_samples.sql');
