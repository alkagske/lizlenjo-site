export const TZ = 'Africa/Nairobi';
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const d = (iso: string | null | undefined) => (iso ? new Date(iso) : null);

/** "18 September 2026" */
export function longDate(iso: string | null | undefined): string {
  const x = d(iso);
  return x ? x.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ }) : '—';
}

/** "14 Nov" */
export function shortDate(iso: string | null | undefined): string {
  const x = d(iso);
  return x ? x.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: TZ }) : '';
}

/** "Goes live 21 Oct, 09:00" */
export function dateTime(iso: string | null | undefined): string {
  const x = d(iso);
  return x ? x.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: TZ }) : '—';
}

/** YYYY-MM-DD in Nairobi time. */
export function nairobiDay(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function relativeTime(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const days = Math.round(h / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return longDate(iso);
}

export const nowIso = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
