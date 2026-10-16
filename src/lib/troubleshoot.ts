import type { KnowledgeArticle } from '../types';

export interface Recommendation {
  article: KnowledgeArticle;
  score: number; // 0..1
  confidence: 'High' | 'Medium' | 'Low';
  exactCode: boolean;
  matchedTerms: string[];
}

const STOP = new Set(['the', 'a', 'an', 'of', 'to', 'in', 'on', 'at', 'is', 'are', 'and', 'or', 'for', 'with', 'not', 'no', 'from', 'by', 'it', 'be', 'after', 'while', 'when', 'cannot', 'can', 'since', 'this', 'that']);
const tokens = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter((t) => t.length > 2 && !STOP.has(t)).map((t) => t.replace(/(ing|ed|es|s)$/, ''));

const MIN_SCORE = 0.18; // below this we do NOT show a recommendation

/**
 * Transparent keyword retrieval over APPROVED knowledge articles only. No generation: every step
 * shown to the user is copied verbatim from an article, so nothing can be invented.
 */
export function recommend(errorCode: string, description: string, kb: KnowledgeArticle[]): Recommendation[] {
  const code = errorCode.trim().toUpperCase();
  const q = new Set(tokens(description));
  const out: Recommendation[] = [];
  for (const a of kb) {
    if (!a.approved) continue;
    const exactCode = !!code && a.errorCode.toUpperCase() === code;
    const bag = new Set(tokens([a.title, a.symptoms, a.tags.join(' '), a.rootCause].join(' ')));
    const matched = [...q].filter((t) => bag.has(t));
    const overlap = q.size ? matched.length / Math.min(q.size, 6) : 0;
    const score = Math.min(1, (exactCode ? 0.6 : 0) + Math.min(overlap, 1) * 0.4);
    if (score >= MIN_SCORE && (exactCode || matched.length >= 2)) {
      out.push({ article: a, score, exactCode, matchedTerms: matched, confidence: score >= 0.75 ? 'High' : score >= 0.4 ? 'Medium' : 'Low' });
    }
  }
  return out.sort((x, y) => y.score - x.score).slice(0, 3);
}
