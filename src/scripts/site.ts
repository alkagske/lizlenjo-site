/**
 * Shared behaviour for public pages: header shrink, tape-measure progress, reveal on scroll,
 * back-to-top, Nairobi clock and the enquiry / subscribe forms (with lazy Turnstile).
 */
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- Header + tape ----------
const header = document.querySelector<HTMLElement>('[data-header]');
const tape = document.querySelector<HTMLElement>('[data-tape]');
const floatTop = document.querySelector<HTMLElement>('[data-to-top-float]');
const tapeMode = document.body.dataset.tapeMode ?? 'page'; // 'page' | 'article'
let raf = 0;
function onScroll() {
  if (raf) return;
  raf = requestAnimationFrame(() => {
    raf = 0;
    const y = scrollY;
    const max = document.documentElement.scrollHeight - innerHeight;
    let p = max > 0 ? y / max : 0;
    if (tapeMode === 'article') {
      const art = document.querySelector<HTMLElement>('[data-article-body]');
      if (art) {
        const r = art.getBoundingClientRect();
        const total = r.height - innerHeight * 0.6;
        p = total > 0 ? (-r.top + innerHeight * 0.25) / total : 0;
      }
    }
    if (tapeMode === 'none') p = 0;
    p = Math.min(1, Math.max(0, p));
    if (tape) tape.style.transform = `scaleX(${p})`;
    header?.classList.toggle('is-scrolled', y > 40);
    floatTop?.classList.toggle('show', y > innerHeight * 1.2);
    document.dispatchEvent(new CustomEvent('ll:progress', { detail: p }));
  });
}
addEventListener('scroll', onScroll, { passive: true });
addEventListener('resize', onScroll, { passive: true });
onScroll();

document.querySelectorAll('[data-to-top]').forEach((b) =>
  b.addEventListener('click', () => {
    scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    (document.querySelector('#main') as HTMLElement | null)?.focus({ preventScroll: true });
  }),
);

// ---------- Reveal on scroll ----------
if (!reduce && 'IntersectionObserver' in window) {
  const els = [...document.querySelectorAll<HTMLElement>('[data-reveal]')].filter((el) => el.getBoundingClientRect().top > innerHeight);
  const io = new IntersectionObserver(
    (entries) => entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add('revealed'); io.unobserve(en.target); }
    }),
    { threshold: 0.06, rootMargin: '0px 0px -6% 0px' },
  );
  els.forEach((el) => { el.classList.add('reveal-ready'); io.observe(el); });
}

// ---------- Nairobi clock ----------
const clocks = document.querySelectorAll<HTMLTimeElement>('[data-clock]');
if (clocks.length) {
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Nairobi', hour: '2-digit', minute: '2-digit' });
  const tick = () => clocks.forEach((c) => (c.textContent = fmt.format(new Date())));
  tick();
  setInterval(tick, 30000);
}

// ---------- Turnstile (loaded only when a protected form is first used) ----------
declare global {
  interface Window {
    turnstile?: { render: (el: HTMLElement, opts: Record<string, unknown>) => string; reset: (id?: string) => void; getResponse: (id?: string) => string | undefined };
  }
}
let siteKeyPromise: Promise<string> | null = null;
function siteKey(): Promise<string> {
  siteKeyPromise ??= fetch('/api/config').then((r) => r.json() as Promise<{ turnstileSiteKey?: string }>).then((c) => c.turnstileSiteKey ?? '').catch(() => '');
  return siteKeyPromise;
}
let scriptPromise: Promise<void> | null = null;
function loadTurnstile(): Promise<void> {
  scriptPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('turnstile'));
    document.head.appendChild(s);
  });
  return scriptPromise;
}
const widgets = new WeakMap<HTMLFormElement, string>();
export async function armTurnstile(form: HTMLFormElement) {
  if (widgets.has(form)) return;
  widgets.set(form, '');
  const key = await siteKey();
  const slot = form.querySelector<HTMLElement>('.ts-slot');
  if (!key || !slot) return;
  try {
    await loadTurnstile();
    const id = window.turnstile!.render(slot, { sitekey: key, appearance: 'interaction-only', theme: 'light' });
    widgets.set(form, id);
  } catch { /* the server will reject if a token was required */ }
}
export function turnstileToken(form: HTMLFormElement): string {
  const id = widgets.get(form);
  return (id && window.turnstile?.getResponse(id)) || '';
}
export function resetTurnstile(form: HTMLFormElement) {
  const id = widgets.get(form);
  if (id) window.turnstile?.reset(id);
}
document.querySelectorAll<HTMLFormElement>('form[data-turnstile]').forEach((f) => {
  const arm = () => armTurnstile(f);
  f.addEventListener('focusin', arm, { once: true });
  f.addEventListener('pointerenter', arm, { once: true });
});

export async function postJson(url: string, body: Record<string, unknown>): Promise<{ ok: boolean; error?: string; [k: string]: unknown }> {
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const data = ((await res.json().catch(() => ({}))) ?? {}) as { ok?: boolean; error?: string; [k: string]: unknown };
    return { ok: res.ok && data.ok !== false, ...data };
  } catch {
    return { ok: false, error: 'Network error. Please try again.' };
  }
}

// ---------- Enquiry form ----------
const enquiry = document.querySelector<HTMLFormElement>('form[data-enquiry]');
if (enquiry) {
  const orderNo = enquiry.querySelector('[data-order-no]');
  const now = new Date();
  if (orderNo) orderNo.textContent = `LL-${now.getFullYear()}-0${100 + ((now.getDate() * 7) % 900)}`;
  const typeInput = enquiry.querySelector<HTMLInputElement>('input[name="type"]')!;
  enquiry.querySelectorAll<HTMLButtonElement>('[data-kind]').forEach((b, _, all) =>
    b.addEventListener('click', () => {
      all.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      typeInput.value = b.dataset.kind!;
    }),
  );
  const msg = enquiry.querySelector<HTMLElement>('[data-msg]')!;
  enquiry.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.textContent = '';
    msg.classList.remove('err');
    if (!enquiry.reportValidity()) return;
    const btn = enquiry.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    btn.disabled = true;
    await armTurnstile(enquiry);
    const fd = new FormData(enquiry);
    const res = await postJson('/api/enquiry', { ...Object.fromEntries(fd.entries()), token: turnstileToken(enquiry) });
    btn.disabled = false;
    if (res.ok) {
      enquiry.hidden = true;
      const done = enquiry.parentElement!.querySelector<HTMLElement>('[data-enquiry-done]')!;
      done.hidden = false;
      done.style.display = 'flex';
    } else {
      msg.textContent = res.error ?? 'Something went wrong. Please try again.';
      msg.classList.add('err');
      resetTurnstile(enquiry);
    }
  });
}

// ---------- Subscribe forms ----------
document.querySelectorAll<HTMLFormElement>('form[data-subscribe]').forEach((form) => {
  const msg = form.parentElement!.querySelector<HTMLElement>('[data-msg]');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const email = (form.querySelector('input[type="email"]') as HTMLInputElement).value;
    const res = await postJson('/api/subscribe', { email, source: form.dataset.source, postId: form.dataset.postId ? Number(form.dataset.postId) : undefined });
    if (res.ok) {
      form.hidden = true;
      const done = form.parentElement!.querySelector<HTMLElement>('[data-sub-done]');
      if (done) {
        if (res.confirmed) done.textContent = 'Subscribed. Thank you.';
        done.hidden = false;
      }
      if (msg) msg.textContent = '';
    } else if (msg) {
      msg.textContent = res.error ?? 'Please check the address and try again.';
      msg.classList.add('err');
    }
  });
});
