import { describe, expect, it, vi } from 'vitest';
import { combineScores, heuristicScore, isLikelySpam, parseModelScore, scoreComment, SPAM_THRESHOLD, verdict } from '../../src/lib/spam';

describe('spam threshold', () => {
  it('flags at 0.6 and above', () => {
    expect(SPAM_THRESHOLD).toBe(0.6);
    expect(isLikelySpam(0.59)).toBe(false);
    expect(isLikelySpam(0.6)).toBe(true);
    expect(isLikelySpam(0.94)).toBe(true);
  });
  it('words the verdict like the design', () => {
    expect(verdict(0.94).label).toBe('Likely spam · 94%');
    expect(verdict(0.06).label).toBe('Looks genuine · 6% spam');
    expect(verdict(5).percent).toBe(100);
    expect(verdict(-1).percent).toBe(0);
  });
});

describe('heuristics', () => {
  it('scores the prototype spam example as likely spam', () => {
    const h = heuristicScore({ name: 'best-deals-4u', email: 'x@y.z', text: 'Great post!! Check out cheap followers at our site, limited offer' });
    expect(h.score).toBeGreaterThanOrEqual(SPAM_THRESHOLD);
  });
  it('leaves a genuine question alone', () => {
    const h = heuristicScore({ name: 'Amina K.', email: 'a@b.co', text: 'Is there a filing fee for bringing a matter to the Tribunal?' });
    expect(h.score).toBeLessThan(0.2);
  });
  it('raises the score for many links', () => {
    expect(heuristicScore({ name: 'A', email: '', text: 'see https://a.com https://b.com www.c.com' }).score).toBeGreaterThanOrEqual(0.5);
  });
});

describe('model parsing and blending', () => {
  it('parses JSON, percentages and bare numbers', () => {
    expect(parseModelScore({ response: '{"spam": 0.91}' })).toBe(0.91);
    expect(parseModelScore('Score: {"spam":12}')).toBe(0.12);
    expect(parseModelScore({ response: '0.3' })).toBe(0.3);
    expect(parseModelScore({ response: 'no idea' })).toBeNull();
    expect(parseModelScore(undefined)).toBeNull();
  });
  it('falls back to heuristics without a model score', () => {
    expect(combineScores(null, 0.4)).toBe(0.4);
  });
  it('lets strong heuristics override a lenient model', () => {
    expect(combineScores(0.1, 0.9)).toBeGreaterThanOrEqual(SPAM_THRESHOLD);
  });
  it('keeps a confident model score', () => {
    expect(combineScores(0.95, 0)).toBe(0.95);
  });
  it('survives a Workers AI failure', async () => {
    const ai = { run: vi.fn().mockRejectedValue(new Error('down')) };
    const r = await scoreComment(ai, { name: 'Peter N.', email: 'p@n.ke', text: 'Brilliant piece.', postTitle: 'T' });
    expect(r.score).toBeLessThan(SPAM_THRESHOLD);
    expect(r.reason).toContain('heuristics only');
  });
  it('uses the model when it answers', async () => {
    const ai = { run: vi.fn().mockResolvedValue({ response: '{"spam":0.97}' }) };
    const r = await scoreComment(ai, { name: 'x', email: 'x@x.x', text: 'hello', postTitle: 'T' });
    expect(r.score).toBe(0.97);
    expect(ai.run).toHaveBeenCalledOnce();
  });
});
