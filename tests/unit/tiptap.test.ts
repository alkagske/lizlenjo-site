import { describe, expect, it } from 'vitest';
import { parseDoc, renderDoc, type TNode } from '../../src/lib/tiptap';
import { slugify } from '../../src/lib/slug';

const p = (text: string): TNode => ({ type: 'paragraph', content: [{ type: 'text', text }] });

describe('renderDoc', () => {
  const doc: TNode = {
    type: 'doc',
    content: [
      p('Fashion has always borrowed.'),
      { type: 'marginNote', attrs: { kind: 'note' }, content: [{ type: 'text', text: 'the whole question' }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Why it falls short' }] },
      p('Second <b>para</b>.'),
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Why it falls short' }] },
      { type: 'blockquote', content: [p('A pattern can belong to a people.')] },
      { type: 'horizontalRule' },
      { type: 'figure', attrs: { key: 'covers/a.jpg', caption: 'Look book' } },
    ],
  };
  const r = renderDoc(doc, { mediaUrl: (k) => `/media/${k}` });

  it('gives the first paragraph a drop cap and attaches margin notes', () => {
    expect(r.rows[0]!.html).toContain('class="dropcap"');
    expect(r.rows[0]!.note).toBe('the whole question');
  });
  it('escapes text', () => {
    expect(r.rows.find((x) => x.html.includes('Second'))!.html).toContain('&lt;b&gt;');
  });
  it('builds a contents list with unique ids', () => {
    expect(r.toc.map((t) => t.id)).toEqual(['why-it-falls-short', 'why-it-falls-short-2']);
  });
  it('renders pull quotes, stitch dividers and figures', () => {
    const html = r.rows.map((x) => x.html).join('');
    expect(html).toContain('<blockquote class="pull">');
    expect(html).toContain('class="stitch"');
    expect(html).toContain('src="/media/covers/a.jpg"');
    expect(html).toContain('<figcaption>Look book</figcaption>');
  });
  it('counts words including notes and captions', () => {
    expect(r.words).toBeGreaterThan(15);
  });
  it('drops unsafe links', () => {
    const d: TNode = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] }] };
    expect(renderDoc(d).rows[0]!.html).not.toContain('javascript');
  });
  it('survives bad JSON', () => {
    expect(parseDoc('{nope').type).toBe('doc');
    expect(renderDoc(parseDoc(null)).rows).toEqual([]);
  });
});

describe('slugify', () => {
  it('cuts at a word boundary', () => {
    expect(slugify('Inspiration versus exploitation: traditional cultural expressions in fashion')).toBe('inspiration-versus-exploitation-traditional-cultural');
    expect(slugify('Café & Co.')).toBe('cafe-co');
    expect(slugify('!!!')).toBe('untitled');
  });
});
