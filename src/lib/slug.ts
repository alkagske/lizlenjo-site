/** Lower-case, hyphenated slug, cut at a word boundary at or under `max` characters. */
export function slugify(input: string, max = 60): string {
  const full = input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  if (full.length <= max) return full || 'untitled';
  const cut = full.slice(0, max + 1);
  const at = cut.lastIndexOf('-');
  return cut.slice(0, at > 20 ? at : max);
}
