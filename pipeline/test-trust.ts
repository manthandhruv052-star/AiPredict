/**
 * Adversarial tests for the trust layer.
 *
 * These encode the failure modes that would kill the product's credibility:
 * a fabricated leak getting published, or a persuasive LLM inflating a weak
 * claim into a confident one. Run with: node --experimental-strip-types
 */

import { computeConfidence, nextStatus, countIndependentSources } from './confidence.ts';
import { runGuard } from './guard.ts';
import type { Source } from './schema.ts';

let passed = 0;
let failed = 0;

function check(name: string, cond: boolean, detail = '') {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`); }
}

function src(p: Partial<Source>): Source {
  return {
    url: 'https://example.com/a', canonical_url: 'https://example.com/a',
    domain: 'example.com', outlet: 'Example', tier: 3, title: 't',
    published_at: '2026-09-10T00:00:00Z', discovered_at: '2026-09-10T00:00:00Z',
    excerpt: '', is_primary: false, lang: 'en', ...p,
  };
}

console.log('\n=== CONFIDENCE: an LLM must not be able to inflate a weak claim ===');
{
  const leak = computeConfidence({
    sources: [src({ tier: 4, domain: 'anon-leaks.xyz' })],
    llmPlausibility: 1.0,          // model is maximally convinced
    contradictionCount: 0,
    isSpeculative: true,
  });
  check('lone tier-4 leak + max LLM confidence stays below `high`',
    leak.band === 'low' || leak.band === 'moderate', `got ${leak.score} (${leak.band})`);
  check('LLM contribution capped at 15', leak.components.llm_assessment <= 15);
  console.log(`        score=${leak.score} band=${leak.band} :: ${leak.rationale}`);
}
{
  const confirmed = computeConfidence({
    sources: [
      src({ tier: 1, domain: 'openai.com', is_primary: true }),
      src({ tier: 2, domain: 'reuters.com' }),
      src({ tier: 2, domain: 'bloomberg.com' }),
      src({ tier: 3, domain: 'techcrunch.com' }),
    ],
    llmPlausibility: 0.8, contradictionCount: 0, isSpeculative: false,
  });
  check('primary + 3 established outlets reaches `verified`',
    confirmed.band === 'verified', `got ${confirmed.score} (${confirmed.band})`);
  console.log(`        score=${confirmed.score} band=${confirmed.band} :: ${confirmed.rationale}`);
}
{
  const zeroLlm = computeConfidence({
    sources: [src({ tier: 1, domain: 'openai.com', is_primary: true }),
              src({ tier: 2, domain: 'reuters.com' }),
              src({ tier: 2, domain: 'bloomberg.com' })],
    llmPlausibility: 0, contradictionCount: 0, isSpeculative: false,
  });
  check('a well-sourced claim still scores high with LLM at zero',
    zeroLlm.score >= 60, `got ${zeroLlm.score}`);
}

console.log('\n=== CORROBORATION: syndication must not count as independence ===');
{
  const syndicated = [
    src({ domain: 'theverge.com' }), src({ domain: 'vox.com' }),
    src({ domain: 'wired.com' }), src({ domain: 'arstechnica.com' }),
  ];
  check('4 outlets under 2 owners count as 2 independent sources',
    countIndependentSources(syndicated) === 2,
    `got ${countIndependentSources(syndicated)}`);

  const genuine = [
    src({ domain: 'reuters.com' }), src({ domain: 'bloomberg.com' }),
    src({ domain: 'ft.com' }), src({ domain: 'theinformation.com' }),
  ];
  check('4 genuinely independent outlets count as 4',
    countIndependentSources(genuine) === 4);
}

console.log('\n=== CONTRADICTION: disputed claims must lose confidence ===');
{
  const disputed = computeConfidence({
    sources: [src({ tier: 2, domain: 'reuters.com' }), src({ tier: 2, domain: 'bloomberg.com' })],
    llmPlausibility: 0.9, contradictionCount: 2, isSpeculative: false,
  });
  check('two contradictions zero out the consistency component',
    disputed.components.consistency === 0, `got ${disputed.components.consistency}`);
}

console.log('\n=== STATUS TRANSITIONS: rule-based, never LLM-decided ===');
{
  const now = new Date('2026-09-15T00:00:00Z');
  const t1 = nextStatus({
    current: 'unverified',
    sources: [src({ tier: 1, domain: 'openai.com', is_primary: true })],
    contradictionCount: 0, lastActivityAt: '2026-09-14T00:00:00Z', now,
  });
  check('primary source promotes straight to confirmed', t1?.to === 'confirmed');
  check('confirmed transition cites its evidence', !!t1?.evidence_source_url);

  const t2 = nextStatus({
    current: 'unverified', sources: [src({ tier: 4, domain: 'anon.xyz' })],
    contradictionCount: 0, lastActivityAt: '2026-08-01T00:00:00Z', now,
  });
  check('uncorroborated 45-day-old rumor goes stale', t2?.to === 'stale');

  const t3 = nextStatus({
    current: 'developing',
    sources: [src({ tier: 2, domain: 'reuters.com' })],
    contradictionCount: 1, contradictingSourceUrl: 'https://reuters.com/x',
    lastActivityAt: '2026-09-14T00:00:00Z', now,
  });
  check('a credible contradiction debunks', t3?.to === 'debunked');

  const t4 = nextStatus({
    current: 'debunked', sources: [src({ tier: 1, is_primary: true })],
    contradictionCount: 0, lastActivityAt: '2026-09-14T00:00:00Z', now,
  });
  check('debunked is terminal (never silently un-debunked)', t4 === null);

  const t5 = nextStatus({
    current: 'unverified', sources: [src({ tier: 4 }), src({ tier: 4, domain: 'b.xyz' })],
    contradictionCount: 0, lastActivityAt: '2026-09-14T00:00:00Z', now,
  });
  check('2 independent low-tier sources reach developing, not confirmed',
    t5?.to === 'developing', `got ${t5?.to}`);
}

console.log('\n=== HALLUCINATION GUARD: fabrications must be quarantined ===');
const SOURCES = [
  'OpenAI today announced GPT-5.5, a new flagship model with improved reasoning. ' +
  'The company said it will be available to ChatGPT Plus subscribers starting next week.',
  'OpenAI has released GPT-5.5. CEO Sam Altman said the model represents "a real step forward".',
];
const ENTITIES = ['OpenAI', 'GPT-5.5', 'ChatGPT', 'Sam Altman'];
{
  const ok = runGuard({
    title: 'OpenAI releases GPT-5.5 with improved reasoning',
    summary: 'OpenAI announced GPT-5.5, a flagship model with improved reasoning. It will reach ChatGPT Plus subscribers next week.',
    why_it_matters: 'This tightens the competitive gap at the frontier.',
    sourceTexts: SOURCES, knownEntities: ENTITIES,
  });
  check('a faithful extraction passes', ok.passed,
    JSON.stringify(ok.violations));
}
{
  const fabricatedEntity = runGuard({
    title: 'OpenAI releases GPT-5.5, beating Anthropic Claude 6',
    summary: 'OpenAI announced GPT-5.5. Anthropic responded with Claude 6.',
    why_it_matters: 'Competition intensifies.',
    sourceTexts: SOURCES, knownEntities: ENTITIES,
  });
  check('fabricated competitor entity is caught', !fabricatedEntity.passed);
  check('  and is reported as ungrounded_entity',
    fabricatedEntity.violations.some((v) => v.kind === 'ungrounded_entity'
      && /Anthropic|Claude/.test(v.value)));
}
{
  const fabricatedNumber = runGuard({
    title: 'OpenAI releases GPT-5.5',
    summary: 'OpenAI announced GPT-5.5, trained on 50 trillion tokens at a cost of $4.2 billion.',
    why_it_matters: 'Scale economics are shifting.',
    sourceTexts: SOURCES, knownEntities: ENTITIES,
  });
  check('fabricated figures are caught', !fabricatedNumber.passed);
  check('  and flagged as ungrounded_number',
    fabricatedNumber.violations.some((v) => v.kind === 'ungrounded_number'));
  console.log('        caught:', fabricatedNumber.violations.map(v => v.value).join(', '));
}
{
  const fabricatedQuote = runGuard({
    title: 'OpenAI releases GPT-5.5',
    summary: 'OpenAI announced GPT-5.5. Altman said "this changes everything for humanity".',
    why_it_matters: 'Bold framing from leadership.',
    sourceTexts: SOURCES, knownEntities: ENTITIES,
  });
  check('fabricated quotation is caught', !fabricatedQuote.passed);
  check('  and flagged as fabricated_quote',
    fabricatedQuote.violations.some((v) => v.kind === 'fabricated_quote'));
}
{
  const realQuote = runGuard({
    title: 'OpenAI releases GPT-5.5',
    summary: 'Altman called it "a real step forward".',
    why_it_matters: 'Leadership is signaling confidence.',
    sourceTexts: SOURCES, knownEntities: ENTITIES,
  });
  check('a genuine quotation passes', realQuote.passed,
    JSON.stringify(realQuote.violations));
}
{
  // why_it_matters is analysis: it may reason beyond the text, but may not
  // invent quotations or facts attributed to sources.
  const analysis = runGuard({
    title: 'OpenAI releases GPT-5.5',
    summary: 'OpenAI announced GPT-5.5 with improved reasoning.',
    why_it_matters: 'Rivals will likely respond with accelerated timelines and deeper discounting.',
    sourceTexts: SOURCES, knownEntities: ENTITIES,
  });
  check('speculative analysis in why_it_matters is permitted', analysis.passed,
    JSON.stringify(analysis.violations));
}

console.log(`\n${'='.repeat(60)}`);
console.log(`  ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));
process.exit(failed > 0 ? 1 : 0);
