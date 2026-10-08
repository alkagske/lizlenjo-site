/** TipTap node set for Liz Notes. Must match the server renderer in src/lib/tiptap.ts. */
import { Node, mergeAttributes } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';

/** Chalk aside in the margin. Attaches to the block before it when rendered. kind "cite" = case citation. */
export const MarginNote = Node.create({
  name: 'marginNote',
  group: 'block',
  content: 'inline*',
  marks: 'italic link',
  defining: true,
  addAttributes() {
    return { kind: { default: 'note', parseHTML: (el) => el.getAttribute('data-kind') ?? 'note', renderHTML: (a) => ({ 'data-kind': a.kind }) } };
  },
  parseHTML() {
    return [{ tag: 'aside[data-margin-note]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['aside', mergeAttributes(HTMLAttributes, { 'data-margin-note': '', class: 'ed-note' }), 0];
  },
});

/** Full-width image with a caption. The image lives in R2 (attr "key"). */
export const Figure = Node.create({
  name: 'figure',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return { key: { default: null }, src: { default: null }, alt: { default: '' }, caption: { default: '' } };
  },
  parseHTML() {
    return [{ tag: 'figure[data-figure]', getAttrs: (el) => ({ key: (el as HTMLElement).dataset.key ?? null, caption: el.querySelector('figcaption')?.textContent ?? '' }) }];
  },
  renderHTML({ node }) {
    return ['figure', { 'data-figure': '', 'data-key': node.attrs.key ?? '' }, ['figcaption', {}, node.attrs.caption ?? '']];
  },
  addNodeView() {
    return ({ node, getPos, editor }) => {
      let current = node;
      const dom = document.createElement('figure');
      dom.className = 'ed-figure';
      dom.contentEditable = 'false';
      const media = document.createElement('div');
      media.className = 'ed-figure-media';
      const cap = document.createElement('input');
      cap.className = 'ed-figure-cap';
      cap.placeholder = 'Add a caption';
      const alt = document.createElement('input');
      alt.className = 'ed-figure-cap ed-figure-alt';
      alt.placeholder = 'Describe the image for screen readers (alt text)';
      const paint = () => {
        media.innerHTML = '';
        const src = current.attrs.key ? `/media/${current.attrs.key}` : current.attrs.src;
        if (src) {
          const img = document.createElement('img');
          img.src = src;
          img.alt = current.attrs.alt || '';
          media.appendChild(img);
        } else media.textContent = 'Image · uploading or missing';
        if (document.activeElement !== cap) cap.value = current.attrs.caption ?? '';
        if (document.activeElement !== alt) alt.value = current.attrs.alt ?? '';
      };
      const commit = (attr: 'caption' | 'alt', value: string) => {
        const pos = typeof getPos === 'function' ? getPos() : null;
        if (pos == null) return;
        editor.view.dispatch(editor.view.state.tr.setNodeMarkup(pos, undefined, { ...current.attrs, [attr]: value }));
      };
      cap.addEventListener('input', () => commit('caption', cap.value));
      alt.addEventListener('input', () => commit('alt', alt.value));
      dom.appendChild(media);
      dom.appendChild(cap);
      dom.appendChild(alt);
      paint();
      return {
        dom,
        update: (n) => { if (n.type.name !== 'figure') return false; current = n; paint(); return true; },
        stopEvent: (e) => e.target === cap || e.target === alt,
        ignoreMutation: () => true,
      };
    };
  },
});

export const extensions = (placeholder = 'Start writing. Type / for headings, notes, citations…') => [
  StarterKit.configure({ heading: { levels: [2, 3] }, codeBlock: false, link: false, underline: false }),
  Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer' } }),
  Placeholder.configure({ placeholder: ({ node }) => (node.type.name === 'marginNote' ? 'Margin note…' : placeholder) }),
  MarginNote,
  Figure,
];
