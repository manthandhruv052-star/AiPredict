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
import { SCENARIOS, type Scenario } from './scenarios.ts';
import { generateScenarios } from './generate.ts';

/** How many signals the seeded feed should contain. */
const TARGET_SIGNALS = 260;

/**
 * Documents in the ingestion corpus. Seeded until the pipeline runs, at which
 * point this is computed from the raw store rather than declared here.
 */
const CORPUS_DOCUMENTS = 450_000;

const OUT = join(process.cwd(), 'site', 'src', 'data');

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function entityId(name: string, kind: EntityKind): string {
  return `${kind}:${slugify(name)}`;
}

const NOW = new Date('2026-09-15T12:00:00Z');

const guardFailures: string[] = [];

function buildSignal(sc: Scenario, idx: number): Signal {
  const ts = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

  const sources: Source[] = sc.sources.map(([outlet, domain, tier, isPrimary], i) => ({
    url: `https://${domain}/`,
    canonical_url: `https://${domain}/`,
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
  if (!guard.passed) guardFailures.push(sc.title);

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
    // Some signals are genuinely entity-less (a general research result, an
    // industry-wide campaign). Empty string means "no entity page owns this".
    primary_entity_id: subject?.id ?? '',
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

const allScenarios = generateScenarios(SCENARIOS, TARGET_SIGNALS);
const signals = allScenarios
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
  corpus_documents: CORPUS_DOCUMENTS,
  source_feeds: 312,
  source: 'seed',
}, null, 2));

const bands = signals.reduce<Record<string, number>>((a, s) => {
  a[s.confidence.band] = (a[s.confidence.band] ?? 0) + 1; return a;
}, {});

console.log(`  ${signals.length} signals, ${entities.length} entities`);
console.log(`  confidence bands:`, bands);
console.log(`  guard passed: ${signals.filter((s) => s.quality.hallucination_guard_passed).length}/${signals.length}`);
if (guardFailures.length) {
  console.log(`  quarantined (${guardFailures.length}):`);
  for (const t of guardFailures.slice(0, 5)) console.log(`    - ${t.slice(0, 68)}`);
}
console.log(`\n  written to site/src/data/`);
