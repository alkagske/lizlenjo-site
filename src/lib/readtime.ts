/** Average adult reading speed for considered, non-fiction prose. */
export const WORDS_PER_MINUTE = 220;

export function countWords(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

/** Whole minutes to read `words` words. Never less than one minute. */
export function readMinutes(words: number, wpm = WORDS_PER_MINUTE): number {
  if (!Number.isFinite(words) || words <= 0) return 1;
  return Math.max(1, Math.ceil(words / wpm));
}

/** Minutes left given scroll progress 0–1. Reaches 0 only at the end. */
export function minutesLeft(totalMinutes: number, progress: number): number {
  const p = Math.min(1, Math.max(0, progress));
  return Math.max(0, Math.ceil(totalMinutes * (1 - p)));
}

export const readLabel = (words: number) => `${readMinutes(words)} min`;
