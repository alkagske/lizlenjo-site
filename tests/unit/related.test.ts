import { describe, expect, it } from 'vitest';
import { scoreRelated, WEIGHTS, type RelatedCandidate } from '../../src/lib/related';

const p = (id: number, category: string, tags: string[], seriesId: number | null = null, publishedAt = `2026-0${id}-01`): RelatedCandidate => ({ id, category, tags, seriesId, publishedAt });

describe('scoreRelated', () => {
  const cur = p(1, 'Fashion law', ['Design', 'TCEs'], 7);

  it('uses series +3, category +2, tag +1', () => {
    expect(WEIGHTS).toEqual({ series: 3, category: 2, tag: 1 });
    const pool = [p(2, 'Fashion law', ['Design'], 7), p(3, 'Copyright', [], 7), p(4, 'Fashion law', []), p(5, 'Trademarks', ['design', 'TCEs'])];
    const r = scoreRelated(cur, pool, 10);
    const byId = Object.fromEntries(r.map((x) => [x.post.id, x.score]));
    expect(byId).toEqual({ 2: 6, 3: 3, 4: 2, 5: 2 });
  });

  it('excludes the current post and caps the list', () => {
    const r = scoreRelated(cur, [cur as RelatedCandidate, p(2, 'A', []), p(3, 'B', []), p(4, 'C', []), p(5, 'D', [])]);
    expect(r).toHaveLength(3);
    expect(r.map((x) => x.post.id)).not.toContain(1);
  });

  it('labels the strongest reason', () => {
    const r = scoreRelated(cur, [p(2, 'Copyright', ['Design'], 7), p(3, 'Fashion law', []), p(4, 'Copyright', ['TCEs']), p(5, 'Governance', [])], 4);
    expect(r.map((x) => x.why)).toEqual(['Same pattern set', 'Also in Fashion law', 'Also tagged TCEs', 'Governance']);
  });

  it('breaks ties by newest first', () => {
    const r = scoreRelated(cur, [p(2, 'X', [], null, '2026-01-01'), p(3, 'Y', [], null, '2026-05-01')]);
    expect(r[0]!.post.id).toBe(3);
  });

  it('does not treat two posts with no series as the same set', () => {
    const r = scoreRelated(p(1, 'A', []), [p(2, 'B', [])]);
    expect(r[0]!.score).toBe(0);
  });
});
