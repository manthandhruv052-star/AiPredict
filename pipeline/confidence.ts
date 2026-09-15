/**
 * Deterministic confidence scoring and status transitions.
 *
 * The governing constraint: an LLM must not be able to make a weak claim look
 * strong. 85 of the 100 available points come from countable facts about
 * sources; the model's own judgment is capped at 15. A lone anonymous leak
 * cannot exceed the `moderate` band no matter how plausible it sounds.
 */

import type {
  Confidence, ConfidenceBand, Signal, SignalStatus, Source, StatusTransition,
} from './schema.js';

/**
 * Outlets under common ownership don't corroborate each other — one editorial
 * decision produces all of them. Keyed by domain, valued by owner id.
 * Extend as the source list grows.
 */
export const PUBLISHER_OWNERS: Record<string, string> = {
  'theverge.com': 'vox', 'vox.com': 'vox', 'eater.com': 'vox',
  'wired.com': 'conde', 'arstechnica.com': 'conde', 'newyorker.com': 'conde',
  'techcrunch.com': 'yahoo', 'engadget.com': 'yahoo',
  'bloomberg.com': 'bloomberg',
  'reuters.com': 'thomsonreuters',
  'wsj.com': 'newscorp', 'barrons.com': 'newscorp', 'marketwatch.com': 'newscorp',
  'cnbc.com': 'comcast', 'nbcnews.com': 'comcast',
  'businessinsider.com': 'axel', 'politico.com': 'axel',
};

/** Corroboration points by distinct-owner count. Saturates at 6. */
const CORROBORATION_CURVE = [0, 8, 18, 26, 32, 36, 40] as const;

const TIER_POINTS: Record<number, number> = { 1: 35, 2: 26, 3: 15, 4: 5 };

export const MAX_LLM_POINTS = 15;

/**
 * Independent corroboration = distinct publisher owners, not distinct sources.
 * Falls back to the domain when the owner is unknown, so unmapped outlets
 * still count individually.
 */
export function countIndependentSources(sources: Source[]): number {
  const owners = new Set<string>();
  for (const s of sources) {
    const domain = s.domain.toLowerCase().replace(/^www\./, '');
    owners.add(PUBLISHER_OWNERS[domain] ?? domain);
  }
  return owners.size;
}

export function bandFor(score: number): ConfidenceBand {
  if (score >= 85) return 'verified';
  if (score >= 60) return 'high';
  if (score >= 35) return 'moderate';
  return 'low';
}

export interface ScoreInput {
  sources: Source[];
  /** Model plausibility judgment, 0..1. Scaled into at most MAX_LLM_POINTS. */
  llmPlausibility: number;
  contradictionCount: number;
  isSpeculative: boolean;
}

export function computeConfidence(input: ScoreInput): Confidence {
  const { sources, llmPlausibility, contradictionCount, isSpeculative } = input;

  const independent = countIndependentSources(sources);
  const corroboration =
    CORROBORATION_CURVE[Math.min(independent, CORROBORATION_CURVE.length - 1)];

  const hasPrimary = sources.some((s) => s.is_primary);
  const bestTier = sources.length
    ? Math.min(...sources.map((s) => s.tier))
    : 4;
  const source_tier = Math.min(
    35,
    (TIER_POINTS[bestTier] ?? 5) + (hasPrimary ? 5 : 0),
  );

  // Clamped before scaling so a malformed model response cannot inflate this.
  const plaus = Math.max(0, Math.min(1, llmPlausibility));
  const llm_assessment = Math.round(plaus * MAX_LLM_POINTS);

  // Contradictions are heavily penalized: a single credible one halves this
  // component, two eliminate it. A disputed claim should never read as solid.
  let consistency = 10 - contradictionCount * 5;
  if (isSpeculative && !hasPrimary) consistency -= 3;
  consistency = Math.max(0, Math.min(10, consistency));

  const score = Math.max(
    0,
    Math.min(100, corroboration + source_tier + llm_assessment + consistency),
  );

  return {
    score,
    band: bandFor(score),
    components: { corroboration, source_tier, llm_assessment, consistency },
    rationale: buildRationale({
      independent, bestTier, hasPrimary, contradictionCount, isSpeculative,
    }),
  };
}

function buildRationale(f: {
  independent: number;
  bestTier: number;
  hasPrimary: boolean;
  contradictionCount: number;
  isSpeculative: boolean;
}): string {
  const parts: string[] = [];

  parts.push(
    f.independent === 1
      ? 'Single independent source'
      : `${f.independent} independent sources`,
  );

  if (f.hasPrimary) parts.push('including a primary source');
  else if (f.bestTier <= 2) parts.push('from established outlets');
  else if (f.bestTier === 3) parts.push('from aggregators');
  else parts.push('of low-trust provenance');

  if (f.contradictionCount > 0) {
    parts.push(
      `${f.contradictionCount} contradicting report${f.contradictionCount > 1 ? 's' : ''}`,
    );
  }
  if (f.isSpeculative && !f.hasPrimary) parts.push('speculative framing');

  return parts.join(', ') + '.';
}

// ---------------------------------------------------------------------------
// Status transitions — rule-based. The LLM may propose `debunked` but a
// deterministic contradiction check must agree before it is applied.
// ---------------------------------------------------------------------------

const STALE_AFTER_DAYS = 30;

export interface TransitionInput {
  current: SignalStatus;
  sources: Source[];
  contradictionCount: number;
  /** Set only when a tier<=2 source explicitly contradicts. */
  contradictingSourceUrl?: string;
  lastActivityAt: string;
  now: Date;
}

/**
 * Returns the transition to apply, or null to stay put. Terminal states
 * (`debunked`) are never left automatically.
 */
export function nextStatus(input: TransitionInput): StatusTransition | null {
  const { current, sources, contradictionCount, lastActivityAt, now } = input;
  if (current === 'debunked') return null;

  const at = now.toISOString();
  const independent = countIndependentSources(sources);
  const hasPrimary = sources.some((s) => s.is_primary);
  const bestTier = sources.length ? Math.min(...sources.map((s) => s.tier)) : 4;

  // Contradiction outranks everything, but demands citable evidence.
  if (contradictionCount > 0 && input.contradictingSourceUrl) {
    return {
      from: current, to: 'debunked', at,
      reason: 'A credible source explicitly contradicts this claim.',
      triggered_by: 'contradiction',
      evidence_source_url: input.contradictingSourceUrl,
    };
  }

  if (current !== 'confirmed') {
    if (hasPrimary) {
      return {
        from: current, to: 'confirmed', at,
        reason: 'The subject organization confirmed this directly.',
        triggered_by: 'primary_source',
        evidence_source_url: sources.find((s) => s.is_primary)?.url,
      };
    }
    if (independent >= 3 && bestTier <= 2) {
      return {
        from: current, to: 'confirmed', at,
        reason: `Corroborated by ${independent} independent established outlets.`,
        triggered_by: 'corroboration',
      };
    }
  }

  if (current === 'unverified' && independent >= 2) {
    return {
      from: current, to: 'developing', at,
      reason: `Corroborated by ${independent} independent sources.`,
      triggered_by: 'corroboration',
    };
  }

  // Decay: only unverified claims go stale. Anything that reached `developing`
  // earned enough corroboration to stay on the record.
  if (current === 'unverified') {
    const ageDays =
      (now.getTime() - new Date(lastActivityAt).getTime()) / 86_400_000;
    if (ageDays >= STALE_AFTER_DAYS) {
      return {
        from: current, to: 'stale', at,
        reason: `No corroboration in ${STALE_AFTER_DAYS} days.`,
        triggered_by: 'decay',
      };
    }
  }

  return null;
}

/** Signals hidden from the default feed (still reachable by permalink). */
export function isHiddenFromDefaultFeed(s: Signal): boolean {
  return s.status === 'stale'
    || s.status === 'debunked'
    || !s.quality.hallucination_guard_passed;
}
