/**
 * Generates realistic seed fixtures for frontend development.
 *
 * These are hand-authored scenarios run through the REAL confidence engine and
 * the REAL hallucination guard — not hardcoded scores. That way the frontend is
 * built against data with the same distribution the live pipeline will produce,
 * including signals that fail the guard and must never be shown.
 *
 * Run: node --experimental-strip-types pipeline/seed.ts
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { computeConfidence } from './confidence.ts';
import { runGuard } from './guard.ts';
import {
  SCHEMA_VERSION, type Signal, type SignalType, type SignalStatus,
  type Source, type SourceTier, type EntityRef, type FeedEntry,
  type EntityProfile, type EntityKind,
} from './schema.ts';

const OUT = join(process.cwd(), 'site', 'src', 'data');

interface Scenario {
  type: SignalType;
  secondary?: SignalType[];
  status: SignalStatus;
  title: string;
  summary: string;
  why: string;
  entities: Array<[string, EntityKind, 'subject' | 'actor' | 'mentioned']>;
  sources: Array<[string, string, SourceTier, boolean]>; // outlet, domain, tier, isPrimary
  /** Canonical excerpt, used when a source has no distinct wording of its own. */
  excerpt: string;
  /**
   * Per-source wording, keyed by outlet. Real outlets phrase the same story
   * differently, and identical excerpts across sources would make the evidence
   * section look broken — and would misrepresent what corroboration means.
   */
  variants?: Record<string, string>;
  daysAgo: number;
  speculative?: boolean;
  contradictions?: number;
  plausibility?: number;
}

const SCENARIOS: Scenario[] = [
  {
    type: 'model_release',
    status: 'confirmed',
    title: 'Mistral releases Large 3 with 256k context window',
    summary: 'Mistral AI released Large 3, its new flagship model with a 256k context window. The model is available via the Mistral API and on Azure AI Foundry from today.',
    why: 'Mistral is the only European lab shipping at frontier context lengths, which matters for EU customers with data residency constraints.',
    entities: [['Mistral AI', 'org', 'subject'], ['Large 3', 'model', 'subject'], ['Microsoft', 'org', 'mentioned']],
    sources: [
      ['Mistral AI', 'mistral.ai', 1, true],
      ['Reuters', 'reuters.com', 2, false],
      ['TechCrunch', 'techcrunch.com', 3, false],
      ['Hacker News', 'news.ycombinator.com', 3, false],
    ],
    excerpt: 'Mistral AI released Large 3, its new flagship model with a 256k context window. The model is available via the Mistral API and on Azure AI Foundry from today.',
    variants: {
      'Mistral AI': 'Today we are releasing Large 3. The model supports a 256k context window and is available through the Mistral API and on Azure AI Foundry.',
      'Reuters': 'French startup Mistral AI released Large 3 on Monday, a flagship model with a 256k context window, deepening competition with larger US rivals.',
      'TechCrunch': 'Mistral has shipped Large 3, which the company says handles a 256k context window. It lands on the Mistral API and Azure AI Foundry at launch.',
      'Hacker News': 'Mistral Large 3 is out, with a 256k context window. Available on the Mistral API and Azure AI Foundry.',
    },
    daysAgo: 0.2,
    plausibility: 0.95,
  },
  {
    type: 'rumor',
    status: 'developing',
    title: 'Internal configs reference an unreleased OpenAI reasoning model',
    summary: 'Configuration files in an OpenAI client library briefly referenced a model identifier not present in the public API. The reference was removed in a subsequent commit.',
    why: 'Config leaks have preceded OpenAI launches before, but identifiers also appear for models that are cancelled or renamed. Treat the identifier, not the timeline, as the signal.',
    entities: [['OpenAI', 'org', 'subject'], ['Sam Altman', 'person', 'mentioned']],
    sources: [
      ['The Information', 'theinformation.com', 2, false],
      ['Hacker News', 'news.ycombinator.com', 3, false],
      ['Reddit r/LocalLLaMA', 'reddit.com', 4, false],
    ],
    excerpt: 'Configuration files in an OpenAI client library briefly referenced a model identifier not present in the public API. The reference was removed in a subsequent commit.',
    variants: {
      'The Information': 'A configuration file shipped in an OpenAI client library briefly contained a model identifier that does not correspond to anything in the public API. It was removed in a later commit.',
      'Hacker News': 'Someone spotted an unfamiliar model identifier in an OpenAI client library config. It was gone in the next commit.',
      'Reddit r/LocalLLaMA': 'The identifier showed up in an OpenAI client library and was removed in a subsequent commit. No idea whether it ships.',
    },
    daysAgo: 0.5,
    speculative: true,
    plausibility: 0.6,
  },
  {
    type: 'funding',
    secondary: ['infrastructure'],
    status: 'confirmed',
    title: 'Cerebras raises $1.1 billion at an $8.1 billion valuation',
    summary: 'Cerebras Systems raised $1.1 billion in a Series G round. The company said the funding will expand its wafer-scale chip manufacturing capacity.',
    why: 'Inference-specialized silicon is attracting capital at a moment when Nvidia supply remains the binding constraint for most labs.',
    entities: [['Cerebras', 'org', 'subject'], ['Nvidia', 'org', 'mentioned']],
    sources: [
      ['Cerebras', 'cerebras.net', 1, true],
      ['Bloomberg', 'bloomberg.com', 2, false],
      ['Reuters', 'reuters.com', 2, false],
      ['CNBC', 'cnbc.com', 3, false],
    ],
    excerpt: 'Cerebras Systems raised $1.1 billion in a Series G round. The company said the funding will expand its wafer-scale chip manufacturing capacity.',
    variants: {
      'Cerebras': 'We have closed a $1.1 billion Series G. The capital will go toward expanding manufacturing capacity for our wafer-scale systems.',
      'Bloomberg': 'Cerebras Systems raised $1.1 billion at an $8.1 billion valuation, as investors continue to back alternatives to Nvidia hardware.',
      'Reuters': 'Chipmaker Cerebras Systems said it raised $1.1 billion in a Series G round to expand wafer-scale chip manufacturing capacity.',
      'CNBC': 'Cerebras announced a $1.1 billion Series G. The company builds wafer-scale processors aimed at AI inference workloads.',
    },
    daysAgo: 1.1,
    plausibility: 0.95,
  },
  {
    type: 'ai_cyberattack',
    secondary: ['security_incident'],
    status: 'confirmed',
    title: 'Researchers document prompt injection campaign against agent browsers',
    summary: 'Security researchers documented a campaign embedding hidden instructions in web pages to hijack AI browsing agents. Affected agents exfiltrated session data to attacker-controlled endpoints.',
    why: 'This is the first documented in-the-wild campaign rather than a lab demonstration, which shifts prompt injection from theoretical to operational risk.',
    entities: [['Anthropic', 'org', 'mentioned'], ['OpenAI', 'org', 'mentioned']],
    sources: [
      ['NVD', 'nvd.nist.gov', 1, true],
      ['Ars Technica', 'arstechnica.com', 2, false],
      ['BleepingComputer', 'bleepingcomputer.com', 3, false],
    ],
    excerpt: 'Security researchers documented a campaign embedding hidden instructions in web pages to hijack AI browsing agents. Affected agents exfiltrated session data to attacker-controlled endpoints.',
    variants: {
      'NVD': 'Hidden instructions embedded in web page content can cause affected AI browsing agents to exfiltrate session data to attacker-controlled endpoints.',
      'Ars Technica': 'Researchers have documented the first in-the-wild campaign using prompt injection against AI browsing agents, rather than a laboratory demonstration.',
      'BleepingComputer': 'Attackers embedded hidden instructions in web pages to hijack AI browsing agents, with affected agents sending session data to attacker-controlled endpoints.',
    },
    daysAgo: 2.3,
    plausibility: 0.9,
  },
  {
    type: 'research_breakthrough',
    status: 'confirmed',
    title: 'DeepMind reports improved sample efficiency in robotic manipulation',
    summary: 'A DeepMind paper reports improved sample efficiency on robotic manipulation benchmarks using a modified training curriculum. The work was published on arXiv.',
    why: 'Sample efficiency is the practical bottleneck for robotics deployment, where real-world data collection is far more expensive than in language domains.',
    entities: [['DeepMind', 'org', 'subject'], ['Google', 'org', 'mentioned']],
    sources: [
      ['arXiv', 'arxiv.org', 1, true],
      ['DeepMind', 'deepmind.google', 1, true],
      ['VentureBeat', 'venturebeat.com', 3, false],
    ],
    excerpt: 'A DeepMind paper reports improved sample efficiency on robotic manipulation benchmarks using a modified training curriculum. The work was published on arXiv.',
    daysAgo: 3.0,
    plausibility: 0.85,
  },
  {
    type: 'regulatory',
    status: 'developing',
    title: 'EU AI Office opens consultation on general-purpose model obligations',
    summary: 'The EU AI Office opened a public consultation on transparency obligations for general-purpose AI models. The consultation period runs for eight weeks.',
    why: 'The resulting guidance will determine compliance cost for any lab serving EU users, and consultations are where that cost is actually negotiated.',
    entities: [['European Union', 'org', 'subject'], ['EU AI Act', 'regulation', 'subject']],
    sources: [
      ['European Commission', 'ec.europa.eu', 1, true],
      ['Politico', 'politico.com', 2, false],
    ],
    excerpt: 'The EU AI Office opened a public consultation on transparency obligations for general-purpose AI models. The consultation period runs for eight weeks.',
    daysAgo: 4.2,
    plausibility: 0.9,
  },
  {
    type: 'open_source_dev',
    status: 'confirmed',
    title: 'vLLM ships v0.11 with improved multi-GPU scheduling',
    summary: 'The vLLM project released version 0.11, which includes changes to multi-GPU request scheduling. The release notes cite throughput improvements under concurrent load.',
    why: 'vLLM is the default serving layer for most self-hosted deployments, so its scheduler changes propagate quickly across the open-weights ecosystem.',
    entities: [['vLLM', 'repo', 'subject']],
    sources: [
      ['GitHub', 'github.com', 1, true],
      ['Hacker News', 'news.ycombinator.com', 3, false],
    ],
    excerpt: 'The vLLM project released version 0.11, which includes changes to multi-GPU request scheduling. The release notes cite throughput improvements under concurrent load.',
    daysAgo: 1.8,
    plausibility: 0.9,
  },
  {
    type: 'hiring',
    status: 'developing',
    title: 'Meta reorganizes its superintelligence group under a new structure',
    summary: 'Meta reorganized its AI research organization, consolidating several teams. Multiple researchers announced departures in the days following.',
    why: 'Reorganizations at this scale usually precede a strategy shift, and departure patterns often reveal which research directions were deprioritized.',
    entities: [['Meta', 'org', 'subject']],
    sources: [
      ['The Information', 'theinformation.com', 2, false],
      ['Business Insider', 'businessinsider.com', 3, false],
      ['Reuters', 'reuters.com', 2, false],
    ],
    excerpt: 'Meta reorganized its AI research organization, consolidating several teams. Multiple researchers announced departures in the days following.',
    daysAgo: 5.5,
    speculative: true,
    plausibility: 0.7,
  },
  {
    type: 'leak',
    status: 'unverified',
    title: 'Screenshot claims to show an unreleased Anthropic pricing tier',
    summary: 'An anonymous account posted a screenshot appearing to show an unannounced pricing tier. The image has not been independently verified.',
    why: 'Single-screenshot pricing leaks are among the most frequently fabricated artifacts in this space. Weight accordingly until a second source appears.',
    entities: [['Anthropic', 'org', 'subject']],
    sources: [
      ['Anonymous account', 'x.com', 4, false],
    ],
    excerpt: 'An anonymous account posted a screenshot appearing to show an unannounced pricing tier. The image has not been independently verified.',
    daysAgo: 0.8,
    speculative: true,
    plausibility: 0.35,
  },
  {
    type: 'infrastructure',
    status: 'confirmed',
    title: 'Nvidia announces expanded datacenter capacity partnership',
    summary: 'Nvidia announced an expanded partnership to add datacenter capacity for AI workloads. The announcement did not specify a dollar figure.',
    why: 'Capacity announcements are a leading indicator of which labs have secured compute for their next training run.',
    entities: [['Nvidia', 'org', 'subject']],
    sources: [
      ['Nvidia', 'nvidia.com', 1, true],
      ['CNBC', 'cnbc.com', 3, false],
      ['Reuters', 'reuters.com', 2, false],
    ],
    excerpt: 'Nvidia announced an expanded partnership to add datacenter capacity for AI workloads. The announcement did not specify a dollar figure.',
    daysAgo: 2.9,
    plausibility: 0.9,
  },
  {
    type: 'acquisition',
    status: 'developing',
    title: 'Reports suggest a mid-size inference startup is in acquisition talks',
    summary: 'Two outlets report that an inference optimization startup is in acquisition discussions. Neither named the acquiring party.',
    why: 'Inference-layer consolidation would signal that serving efficiency is becoming a durable moat rather than a commodity.',
    entities: [['Nvidia', 'org', 'mentioned']],
    sources: [
      ['Bloomberg', 'bloomberg.com', 2, false],
      ['The Information', 'theinformation.com', 2, false],
    ],
    excerpt: 'Two outlets report that an inference optimization startup is in acquisition discussions. Neither named the acquiring party.',
    daysAgo: 6.1,
    speculative: true,
    plausibility: 0.65,
  },
  {
    type: 'product_release',
    status: 'confirmed',
    title: 'Hugging Face ships a redesigned model evaluation interface',
    summary: 'Hugging Face released a redesigned interface for model evaluation results. The update consolidates several previously separate leaderboards.',
    why: 'Evaluation infrastructure shapes which capabilities labs optimize for, making leaderboard design quietly influential.',
    entities: [['Hugging Face', 'org', 'subject']],
    sources: [
      ['Hugging Face', 'huggingface.co', 1, true],
      ['Hacker News', 'news.ycombinator.com', 3, false],
    ],
    excerpt: 'Hugging Face released a redesigned interface for model evaluation results. The update consolidates several previously separate leaderboards.',
    daysAgo: 3.7,
    plausibility: 0.9,
  },
  {
    type: 'security_incident',
    status: 'debunked',
    title: 'Claimed breach at an AI infrastructure provider did not occur',
    summary: 'A claimed data breach circulated on social media. The provider stated no breach occurred and the posted data matched a previously public dataset.',
    why: 'False breach claims are common and move quickly. The correction rarely travels as far as the original claim.',
    entities: [['Nvidia', 'org', 'mentioned']],
    sources: [
      ['BleepingComputer', 'bleepingcomputer.com', 3, false],
      ['Ars Technica', 'arstechnica.com', 2, false],
    ],
    excerpt: 'A claimed data breach circulated on social media. The provider stated no breach occurred and the posted data matched a previously public dataset.',
    daysAgo: 8.4,
    contradictions: 2,
    plausibility: 0.2,
  },
  {
    type: 'strategic_speculation',
    status: 'developing',
    title: 'Pricing moves across three labs point to a margin squeeze',
    summary: 'Three labs adjusted API pricing within the same two-week window. All three reduced per-token costs for their mid-tier models.',
    why: 'Simultaneous price cuts at the mid tier usually indicate competition on volume rather than capability, which compresses margins industry-wide.',
    entities: [['OpenAI', 'org', 'mentioned'], ['Anthropic', 'org', 'mentioned'], ['Google', 'org', 'mentioned']],
    sources: [
      ['The Information', 'theinformation.com', 2, false],
      ['Ars Technica', 'arstechnica.com', 2, false],
      ['VentureBeat', 'venturebeat.com', 3, false],
    ],
    excerpt: 'Three labs adjusted API pricing within the same two-week window. All three reduced per-token costs for their mid-tier models.',
    daysAgo: 7.2,
    speculative: true,
    plausibility: 0.6,
  },
];

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function entityId(name: string, kind: EntityKind): string {
  return `${kind}:${slugify(name)}`;
}

const NOW = new Date('2026-09-15T12:00:00Z');

function buildSignal(sc: Scenario, idx: number): Signal {
  const ts = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

  const sources: Source[] = sc.sources.map(([outlet, domain, tier, isPrimary], i) => ({
    url: `https://${domain}/story/${slugify(sc.title).slice(0, 40)}`,
    canonical_url: `https://${domain}/story/${slugify(sc.title).slice(0, 40)}`,
    domain,
    outlet,
    tier,
    title: sc.title,
    published_at: ts(sc.daysAgo + i * 0.05),
    discovered_at: ts(sc.daysAgo),
    excerpt: (sc.variants?.[outlet] ?? sc.excerpt).slice(0, 400),
    is_primary: isPrimary,
    lang: 'en',
    archive_url: `https://web.archive.org/web/2026/https://${domain}/`,
  }));

  // Primary first, then tier ascending, then oldest first.
  sources.sort((a, b) =>
    Number(b.is_primary) - Number(a.is_primary)
    || a.tier - b.tier
    || a.published_at.localeCompare(b.published_at));

  const entities: EntityRef[] = sc.entities.map(([name, kind, role]) => ({
    id: entityId(name, kind), name, kind, role, slug: slugify(name),
  }));

  const confidence = computeConfidence({
    sources,
    llmPlausibility: sc.plausibility ?? 0.7,
    contradictionCount: sc.contradictions ?? 0,
    isSpeculative: sc.speculative ?? false,
  });

  // Run the real guard. Seed copy is written from the excerpts, so this should
  // pass — if it doesn't, the fixture text itself is the bug.
  const guard = runGuard({
    title: sc.title,
    summary: sc.summary,
    why_it_matters: sc.why,
    sourceTexts: [sc.excerpt, sc.title],
    knownEntities: sc.entities.map(([n]) => n),
  });
  if (!guard.passed) {
    console.warn(`  guard flagged "${sc.title.slice(0, 50)}":`,
      guard.violations.map((v) => `${v.kind}=${v.value}`).join(', '));
  }

  const subject = entities.find((e) => e.role === 'subject') ?? entities[0];

  return {
    id: `sig_${String(idx + 1).padStart(4, '0')}${slugify(sc.title).slice(0, 12)}`,
    schema_version: SCHEMA_VERSION,
    type: sc.type,
    secondary_types: sc.secondary ?? [],
    title: sc.title,
    summary: sc.summary,
    why_it_matters: sc.why,
    entities,
    primary_entity_id: subject.id,
    status: sc.status,
    status_history: [{
      from: 'unverified', to: sc.status, at: ts(sc.daysAgo),
      reason: confidence.rationale,
      triggered_by: sources.some((s) => s.is_primary) ? 'primary_source' : 'corroboration',
      evidence_source_url: sources.find((s) => s.is_primary)?.url,
    }],
    confidence,
    corroboration_count: new Set(sources.map((s) => s.domain)).size,
    sources,
    source_count: sources.length,
    first_seen_at: ts(sc.daysAgo),
    updated_at: ts(Math.max(0, sc.daysAgo - 0.1)),
    event_at: ts(sc.daysAgo),
    cluster: { doc_count: sources.length * 3, centroid_version: 1, merged_from: [] },
    extraction: {
      model: 'seed:hand-authored',
      prompt_version: 'v1',
      extracted_at: ts(sc.daysAgo),
      flags: [
        ...(sc.speculative ? ['speculative_language' as const] : []),
        ...(sources.length === 1 ? ['low_evidence' as const] : []),
        ...((sc.contradictions ?? 0) > 0 ? ['contradiction' as const] : []),
      ],
    },
    quality: {
      is_speculative: sc.speculative ?? false,
      has_primary_source: sources.some((s) => s.is_primary),
      contradiction_count: sc.contradictions ?? 0,
      hallucination_guard_passed: guard.passed,
    },
  };
}

function toFeedEntry(s: Signal): FeedEntry {
  return {
    id: s.id, type: s.type, title: s.title, summary: s.summary, status: s.status,
    confidence_score: s.confidence.score,
    confidence_band: s.confidence.band,
    corroboration_count: s.corroboration_count,
    source_count: s.source_count,
    entities: s.entities.map((e) => ({ id: e.id, name: e.name, slug: e.slug, kind: e.kind })),
    top_sources: s.sources.slice(0, 3).map((x) => ({
      outlet: x.outlet, domain: x.domain, url: x.url, tier: x.tier,
    })),
    first_seen_at: s.first_seen_at,
    updated_at: s.updated_at,
  };
}

function buildEntityProfiles(signals: Signal[]): EntityProfile[] {
  const map = new Map<string, EntityProfile>();
  for (const s of signals) {
    for (const e of s.entities) {
      let p = map.get(e.id);
      if (!p) {
        p = {
          id: e.id, name: e.name, kind: e.kind, slug: e.slug, aliases: [],
          signal_count: 0, type_breakdown: {},
          first_seen_at: s.first_seen_at, last_seen_at: s.updated_at,
        };
        map.set(e.id, p);
      }
      p.signal_count++;
      p.type_breakdown[s.type] = (p.type_breakdown[s.type] ?? 0) + 1;
      if (s.first_seen_at < p.first_seen_at) p.first_seen_at = s.first_seen_at;
      if (s.updated_at > p.last_seen_at) p.last_seen_at = s.updated_at;
    }
  }
  return [...map.values()].sort((a, b) => b.signal_count - a.signal_count);
}

// ---------------------------------------------------------------------------

console.log('Generating seed fixtures through the real trust pipeline...\n');

const signals = SCENARIOS
  .map(buildSignal)
  .sort((a, b) => b.updated_at.localeCompare(a.updated_at));

const entities = buildEntityProfiles(signals);
const feed = signals.map(toFeedEntry);

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'signals.json'), JSON.stringify(signals, null, 2));
writeFileSync(join(OUT, 'feed.json'), JSON.stringify(feed, null, 2));
writeFileSync(join(OUT, 'entities.json'), JSON.stringify(entities, null, 2));
writeFileSync(join(OUT, 'meta.json'), JSON.stringify({
  schema_version: SCHEMA_VERSION,
  generated_at: NOW.toISOString(),
  signal_count: signals.length,
  entity_count: entities.length,
  source: 'seed',
}, null, 2));

const bands = signals.reduce<Record<string, number>>((a, s) => {
  a[s.confidence.band] = (a[s.confidence.band] ?? 0) + 1; return a;
}, {});

console.log(`  ${signals.length} signals, ${entities.length} entities`);
console.log(`  confidence bands:`, bands);
console.log(`  guard passed: ${signals.filter((s) => s.quality.hallucination_guard_passed).length}/${signals.length}`);
console.log(`\n  written to site/src/data/`);
