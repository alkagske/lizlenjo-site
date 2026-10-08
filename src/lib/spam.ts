/**
 * Comment spam scoring.
 * Turnstile screens bots first. Each comment then gets a 0–1 spam score from Workers AI,
 * blended with cheap heuristics so a model outage never lets obvious spam through.
 * Every comment waits for Liz's approval. The score only orders the moderation queue.
 */

/** At or above this score the queue shows "Likely spam". */
export const SPAM_THRESHOLD = 0.6;

export const AI_MODEL = '@cf/meta/llama-3.1-8b-instruct';

export interface Verdict {
  likelySpam: boolean;
  percent: number;
  label: string;
}

export function verdict(score: number): Verdict {
  const s = clamp01(score);
  const percent = Math.round(s * 100);
  const likelySpam = s >= SPAM_THRESHOLD;
  return { likelySpam, percent, label: likelySpam ? `Likely spam · ${percent}%` : `Looks genuine · ${percent}% spam` };
}

export const isLikelySpam = (score: number) => clamp01(score) >= SPAM_THRESHOLD;

function clamp01(n: number) {
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
}

const SPAM_WORDS = /\b(viagra|casino|crypto ?(?:signals|giveaway)|forex|bitcoin doubler|cheap followers|buy followers|seo services|backlinks?|loan offer|escort|limited offer|click here|work from home|earn \$?\d+)\b/i;

/** Fast rule-based score, 0–1. Used alone if Workers AI is unavailable. */
export function heuristicScore(input: { name: string; email: string; text: string }): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let s = 0;
  const links = (input.text.match(/https?:\/\/|www\./gi) || []).length;
  if (links >= 3) { s += 0.5; reasons.push('many links'); }
  else if (links > 0) { s += 0.2; reasons.push('link'); }
  if (SPAM_WORDS.test(input.text) || SPAM_WORDS.test(input.name)) { s += 0.55; reasons.push('spam phrase'); }
  if (/[-_]?(deals?|seo|promo|shop|4u)\b/i.test(input.name) || /\d{3,}/.test(input.name)) { s += 0.2; reasons.push('name'); }
  if (/!{2,}/.test(input.text)) { s += 0.1; reasons.push('exclamations'); }
  const letters = input.text.replace(/[^a-z]/gi, '');
  if (letters.length > 20 && letters.replace(/[^A-Z]/g, '').length / letters.length > 0.6) { s += 0.2; reasons.push('shouting'); }
  if (input.text.trim().length < 3) { s += 0.3; reasons.push('empty'); }
  return { score: clamp01(s), reasons };
}

/** Parse the model's reply. Accepts JSON {"spam":0.9} or a bare number. Returns null if unusable. */
export function parseModelScore(reply: unknown): number | null {
  const text = typeof reply === 'string' ? reply : (reply as { response?: unknown })?.response;
  if (typeof text === 'number') return clamp01(text);
  if (typeof text !== 'string') return null;
  const json = text.match(/\{[^}]*\}/);
  if (json) {
    try {
      const v = JSON.parse(json[0]);
      const n = Number(v.spam ?? v.score ?? v.probability);
      if (Number.isFinite(n)) return clamp01(n > 1 ? n / 100 : n);
    } catch { /* fall through */ }
  }
  const num = text.match(/(\d+(?:\.\d+)?)/);
  if (num) {
    const n = Number(num[1]);
    return clamp01(n > 1 ? n / 100 : n);
  }
  return null;
}

/** Combine model and heuristic: the model leads, heuristics can only raise the score. */
export function combineScores(model: number | null, heuristic: number): number {
  if (model == null) return clamp01(heuristic);
  return clamp01(Math.max(model, 0.7 * model + 0.3 * heuristic, heuristic >= 0.75 ? heuristic : 0));
}

interface AiLike {
  run(model: string, input: unknown): Promise<unknown>;
}

export async function scoreComment(ai: AiLike | undefined, input: { name: string; email: string; text: string; postTitle: string }): Promise<{ score: number; reason: string }> {
  const h = heuristicScore(input);
  let model: number | null = null;
  if (ai) {
    try {
      const reply = await ai.run(AI_MODEL, {
        messages: [
          { role: 'system', content: 'You moderate comments on a Kenyan lawyer\'s blog about intellectual property, fashion and entertainment law. Rate how likely the comment is spam, advertising, scams or abuse. Genuine questions, disagreement and short thanks are NOT spam. Reply only with JSON like {"spam":0.12}.' },
          { role: 'user', content: `Post: ${input.postTitle}\nName: ${input.name}\nComment: ${input.text.slice(0, 2000)}` },
        ],
        max_tokens: 20,
        temperature: 0,
      });
      model = parseModelScore(reply);
    } catch {
      model = null;
    }
  }
  return { score: combineScores(model, h.score), reason: [model == null ? 'heuristics only' : 'ai', ...h.reasons].join(', ') };
}
