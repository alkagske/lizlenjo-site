/**
 * Server-side rendering of TipTap JSON for Liz Notes.
 * Runs in the Worker without a DOM. The node set matches the Workroom editor
 * (src/islands/editor/schema.ts): paragraph, heading, blockquote (pull quote),
 * bullet/ordered lists, horizontalRule (stitch divider), marginNote, figure, hardBreak.
 */
import { slugify } from './slug';
import { countWords } from './readtime';

export interface TNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
}

export interface Row {
  /** HTML of one body block. */
  html: string;
  /** Margin note attached to this block, already escaped. */
  note?: string;
  noteKind?: 'note' | 'cite';
  kind: 'p' | 'h' | 'quote' | 'list' | 'hr' | 'figure';
}

export interface TocEntry {
  id: string;
  text: string;
}

export interface Rendered {
  rows: Row[];
  toc: TocEntry[];
  text: string;
  words: number;
}

export interface RenderOptions {
  /** Resolve an R2 key to a public URL. */
  mediaUrl?: (key: string, width?: number) => string;
}

export const EMPTY_DOC: TNode = { type: 'doc', content: [{ type: 'paragraph' }] };

export function parseDoc(json: string | null | undefined): TNode {
  if (!json) return EMPTY_DOC;
  try {
    const d = JSON.parse(json);
    return d && d.type === 'doc' ? d : EMPTY_DOC;
  } catch {
    return EMPTY_DOC;
  }
}

export const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function safeHref(href: unknown): string | null {
  if (typeof href !== 'string') return null;
  const h = href.trim();
  if (/^(https?:|mailto:|\/|#)/i.test(h)) return h;
  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(h)) return 'https://' + h;
  return null;
}

function inline(nodes: TNode[] | undefined): string {
  if (!nodes) return '';
  return nodes
    .map((n) => {
      if (n.type === 'hardBreak') return '<br>';
      if (n.type !== 'text' || !n.text) return '';
      let out = esc(n.text);
      for (const m of n.marks ?? []) {
        if (m.type === 'bold') out = `<strong>${out}</strong>`;
        else if (m.type === 'italic') out = `<em>${out}</em>`;
        else if (m.type === 'strike') out = `<s>${out}</s>`;
        else if (m.type === 'code') out = `<code>${out}</code>`;
        else if (m.type === 'link') {
          const href = safeHref(m.attrs?.href);
          if (href) {
            const ext = /^https?:/i.test(href) && !/^https?:\/\/(www\.)?lizlenjo\.com/i.test(href);
            out = `<a href="${esc(href)}"${ext ? ' target="_blank" rel="noopener noreferrer"' : ''}>${out}</a>`;
          }
        }
      }
      return out;
    })
    .join('');
}

/** Plain text of a node tree. */
export function textOf(node: TNode | undefined): string {
  if (!node) return '';
  if (node.type === 'text') return node.text ?? '';
  if (node.type === 'hardBreak') return '\n';
  if (node.type === 'figure') return String(node.attrs?.caption ?? '');
  const inner = (node.content ?? []).map(textOf);
  const block = ['paragraph', 'heading', 'listItem', 'marginNote', 'blockquote'].includes(node.type);
  return inner.join(block ? '' : '\n') + (block ? '\n' : '');
}

function list(node: TNode): string {
  const tag = node.type === 'orderedList' ? 'ol' : 'ul';
  const items = (node.content ?? [])
    .map((li) => `<li>${(li.content ?? []).map((c) => (c.type === 'paragraph' ? inline(c.content) : c.type.endsWith('List') ? list(c) : '')).join('')}</li>`)
    .join('');
  return `<${tag}>${items}</${tag}>`;
}

export function renderDoc(doc: TNode, opts: RenderOptions = {}): Rendered {
  const rows: Row[] = [];
  const toc: TocEntry[] = [];
  const used = new Set<string>();
  let firstParagraphDone = false;

  for (const node of doc.content ?? []) {
    switch (node.type) {
      case 'paragraph': {
        const html = inline(node.content);
        if (!html.trim()) break;
        if (!firstParagraphDone && rows.length === 0) {
          firstParagraphDone = true;
          rows.push({ kind: 'p', html: `<p class="dropcap">${html}</p>` });
        } else {
          rows.push({ kind: 'p', html: `<p>${html}</p>` });
        }
        break;
      }
      case 'heading': {
        const text = textOf(node).trim();
        if (!text) break;
        let id = slugify(text, 48);
        for (let i = 2; used.has(id); i++) id = `${slugify(text, 44)}-${i}`;
        used.add(id);
        const level = node.attrs?.level === 3 ? 3 : 2;
        if (level === 2) toc.push({ id, text });
        rows.push({ kind: 'h', html: `<h${level} id="${id}" data-h>${inline(node.content)}</h${level}>` });
        break;
      }
      case 'blockquote': {
        const inner = (node.content ?? []).map((c) => inline(c.content)).filter(Boolean).join('<br>');
        if (inner) rows.push({ kind: 'quote', html: `<blockquote class="pull">${inner}</blockquote>` });
        break;
      }
      case 'bulletList':
      case 'orderedList':
        rows.push({ kind: 'list', html: list(node) });
        break;
      case 'horizontalRule':
        rows.push({ kind: 'hr', html: '<div class="stitch" role="separator"><span aria-hidden="true">✂</span><span class="stitch-line"></span></div>' });
        break;
      case 'figure':
      case 'image': {
        const a = node.attrs ?? {};
        const key = typeof a.key === 'string' ? a.key : null;
        const src = key && opts.mediaUrl ? opts.mediaUrl(key, 1280) : safeHref(a.src);
        const caption = typeof a.caption === 'string' ? a.caption : typeof a.title === 'string' ? a.title : '';
        const alt = typeof a.alt === 'string' ? a.alt : caption;
        const media = src
          ? `<img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" decoding="async">`
          : '<div class="figure-blank" aria-hidden="true"></div>';
        rows.push({ kind: 'figure', html: `<figure>${media}${caption ? `<figcaption>${esc(caption)}</figcaption>` : ''}</figure>` });
        break;
      }
      case 'marginNote': {
        const text = textOf(node).trim();
        if (!text) break;
        const prev = rows[rows.length - 1];
        const kind = node.attrs?.kind === 'cite' ? 'cite' : 'note';
        if (prev && !prev.note) {
          prev.note = inline(node.content);
          prev.noteKind = kind;
        } else {
          // A note with nothing to hang on: show it as its own row.
          rows.push({ kind: 'p', html: '', note: inline(node.content), noteKind: kind });
        }
        break;
      }
      default:
        if (node.content) {
          const html = inline(node.content);
          if (html) rows.push({ kind: 'p', html: `<p>${html}</p>` });
        }
    }
  }

  const text = textOf(doc).replace(/\n{2,}/g, '\n').trim();
  return { rows, toc, text, words: countWords(text) };
}

/** Text and word count only, for saving posts. */
export function docStats(doc: TNode): { text: string; words: number } {
  const text = textOf(doc).replace(/\n{2,}/g, '\n').trim();
  return { text, words: countWords(text) };
}

/** First image key in the doc, used as a fallback cover. */
export function firstImageKey(doc: TNode): string | null {
  for (const n of doc.content ?? []) if (n.type === 'figure' && typeof n.attrs?.key === 'string') return n.attrs.key;
  return null;
}
