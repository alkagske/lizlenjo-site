/** Article reading tools: minutes left, contents, text size, sharing, highlight-to-quote, comments, read beacons. */
import { armTurnstile, postJson, resetTurnstile, turnstileToken } from './site';
import { minutesLeft } from '../lib/readtime';

const art = document.querySelector<HTMLElement>('[data-article]');
if (art) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const total = Number(art.dataset.minutes || 1);
  const url = art.dataset.url!;
  const slug = art.dataset.slug!;
  const body = art.querySelector<HTMLElement>('[data-article-body]')!;
  const minEl = art.querySelector('[data-min-left]');
  const tocBtns = [...art.querySelectorAll<HTMLButtonElement>('[data-toc]')];
  const heads = tocBtns.map((b) => document.getElementById(b.dataset.toc!)).filter(Boolean) as HTMLElement[];

  // Minutes left + active heading, driven by the shared progress event from site.ts.
  document.addEventListener('ll:progress', (e) => {
    const p = (e as CustomEvent<number>).detail;
    if (minEl) minEl.textContent = String(minutesLeft(total, p));
    let active: string | null = null;
    for (const h of heads) if (h.getBoundingClientRect().top < 170) active = h.id;
    tocBtns.forEach((b) => b.setAttribute('aria-current', String(b.dataset.toc === active)));
  });
  tocBtns.forEach((b) =>
    b.addEventListener('click', () => {
      const el = document.getElementById(b.dataset.toc!);
      if (!el) return;
      scrollTo({ top: el.getBoundingClientRect().top + scrollY - 110, behavior: reduce ? 'auto' : 'smooth' });
      el.setAttribute('tabindex', '-1');
      el.focus({ preventScroll: true });
    }),
  );

  // Text size, remembered in localStorage.
  const sizes = [...art.querySelectorAll<HTMLButtonElement>('[data-size]')];
  const setSize = (v: number) => {
    body.style.setProperty('--fs', `${v}px`);
    sizes.forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.size) === v)));
  };
  try {
    const saved = Number(localStorage.getItem('ll-notes-fs'));
    if ([15, 17, 20].includes(saved)) setSize(saved);
  } catch { /* storage blocked */ }
  sizes.forEach((b) =>
    b.addEventListener('click', () => {
      const v = Number(b.dataset.size);
      setSize(v);
      try { localStorage.setItem('ll-notes-fs', String(v)); } catch { /* ignore */ }
    }),
  );

  // Copy link.
  const copyBtn = art.querySelector<HTMLButtonElement>('[data-copy-link]');
  copyBtn?.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(url); } catch { /* ignore */ }
    copyBtn.textContent = 'Link copied';
    setTimeout(() => (copyBtn.textContent = 'Copy link'), 1800);
  });

  // Highlight to share.
  const bar = document.querySelector<HTMLElement>('[data-hl]')!;
  let quote = '';
  const hide = () => { bar.hidden = true; };
  const quoteText = () => `“${quote}” — Liz Lenjo, Liz Notes`;
  body.addEventListener('mouseup', () =>
    setTimeout(() => {
      const sel = getSelection();
      const txt = sel?.toString().trim().replace(/\s+/g, ' ') ?? '';
      if (sel && txt.length > 8 && sel.rangeCount && body.contains(sel.anchorNode)) {
        const r = sel.getRangeAt(0).getBoundingClientRect();
        quote = txt.slice(0, 260);
        bar.style.left = `${Math.max(150, Math.min(innerWidth - 150, r.left + r.width / 2))}px`;
        bar.style.top = `${Math.max(60, r.top)}px`;
        bar.hidden = false;
        (bar.querySelector('[data-hl-copy]') as HTMLElement).textContent = 'Copy quote';
      } else hide();
    }, 10),
  );
  addEventListener('scroll', hide, { passive: true });
  document.addEventListener('selectionchange', () => { if (!getSelection()?.toString().trim()) hide(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
  bar.addEventListener('mousedown', (e) => e.preventDefault()); // keep the selection
  bar.querySelector('[data-hl-li]')!.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(`${quoteText()} ${url}`); } catch { /* ignore */ }
    open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, '_blank', 'noopener');
    hide();
  });
  bar.querySelector('[data-hl-x]')!.addEventListener('click', () => {
    open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(quoteText())}&url=${encodeURIComponent(url)}`, '_blank', 'noopener');
    hide();
  });
  const copyQ = bar.querySelector<HTMLElement>('[data-hl-copy]')!;
  copyQ.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(quoteText()); } catch { /* ignore */ }
    copyQ.textContent = 'Copied';
    setTimeout(hide, 1200);
  });

  // Comments.
  const form = art.querySelector<HTMLFormElement>('form[data-comment]');
  if (form) {
    const msg = form.querySelector<HTMLElement>('[data-msg]')!;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      msg.textContent = '';
      msg.classList.remove('err');
      if (!form.reportValidity()) return;
      const btn = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
      btn.disabled = true;
      await armTurnstile(form);
      const fd = Object.fromEntries(new FormData(form).entries());
      const res = await postJson('/api/comment', { ...fd, postId: Number(fd.postId), token: turnstileToken(form) });
      btn.disabled = false;
      if (res.ok) {
        form.hidden = true;
        (art.querySelector('[data-comment-done]') as HTMLElement).hidden = false;
      } else {
        msg.textContent = res.error ?? 'Something went wrong. Please try again.';
        msg.classList.add('err');
        resetTurnstile(form);
      }
    });
  }

  // Read beacons: a "read" after 15 seconds on the page, "complete" once the end of the body is passed.
  const beacon = (event: 'read' | 'complete') => {
    const data = JSON.stringify({ slug, event });
    if (!navigator.sendBeacon?.('/api/beacon', new Blob([data], { type: 'application/json' }))) {
      fetch('/api/beacon', { method: 'POST', body: data, headers: { 'content-type': 'application/json' }, keepalive: true }).catch(() => {});
    }
  };
  const key = `ll-read-${slug}`;
  let seen = '';
  try { seen = sessionStorage.getItem(key) ?? ''; } catch { /* ignore */ }
  const mark = (v: string) => { seen = v; try { sessionStorage.setItem(key, v); } catch { /* ignore */ } };
  if (!seen) setTimeout(() => { if (!document.hidden && !seen) { beacon('read'); mark('read'); } }, 15000);
  const end = art.querySelector('[data-article-end]');
  if (end && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      if (entries.some((x) => x.isIntersecting) && seen !== 'complete') {
        if (!seen) beacon('read');
        beacon('complete');
        mark('complete');
        io.disconnect();
      }
    });
    io.observe(end);
  }
}
