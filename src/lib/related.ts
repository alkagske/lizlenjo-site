export interface RelatedCandidate {
  id: number;
  category: string;
  tags: string[];
  seriesId: number | null;
  publishedAt: string | null;
}

export interface RelatedResult<T extends RelatedCandidate> {
  post: T;
  score: number;
  /** Short reader-facing reason, e.g. "Same pattern set". */
  why: string;
}

/** Scoring weights from the design: series +3, same category +2, each shared tag +1. */
export const WEIGHTS = { series: 3, category: 2, tag: 1 } as const;

const norm = (t: string) => t.trim().toLowerCase();

export function scoreRelated<T extends RelatedCandidate>(current: RelatedCandidate, pool: T[], limit = 3): RelatedResult<T>[] {
  const curTags = new Set(current.tags.map(norm));
  return pool
    .filter((p) => p.id !== current.id)
    .map((post) => {
      const sameSeries = current.seriesId != null && post.seriesId === current.seriesId;
      const sameCat = post.category === current.category;
      const shared = post.tags.filter((t) => curTags.has(norm(t)));
      const score = (sameSeries ? WEIGHTS.series : 0) + (sameCat ? WEIGHTS.category : 0) + shared.length * WEIGHTS.tag;
      const why = sameSeries
        ? 'Same pattern set'
        : sameCat
          ? `Also in ${post.category}`
          : shared.length
            ? `Also tagged ${shared[0]}`
            : post.category;
      return { post, score, why };
    })
    .sort((a, b) => b.score - a.score || (b.post.publishedAt ?? '').localeCompare(a.post.publishedAt ?? ''))
    .slice(0, limit);
}
