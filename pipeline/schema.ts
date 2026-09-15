/**
 * The Signal contract.
 *
 * This is the single source of truth for the whole platform. The ingest
 * pipeline produces these, the static build shards them, and the frontend
 * renders them. Change nothing here without bumping SCHEMA_VERSION and
 * regenerating fixtures.
 *
 * Design rule that runs through the entire type: the LLM structures evidence,
 * it never originates facts. Anything the LLM writes is confined to `title`,
 * `summary`, `why_it_matters` and a capped slice of the confidence score.
 * Source excerpts are always verbatim substrings of the source text.
 */

export const SCHEMA_VERSION = 2 as const;

/** The 14 tracked categories. Also the output space of the event-type classifier. */
export type SignalType =
  | 'model_release'          // a confirmed model shipped
  | 'product_release'        // non-model products, APIs, features
  | 'rumor'                  // unconfirmed claims about future moves
  | 'leak'                   // non-public info surfaced without authorization
  | 'research_breakthrough'  // papers, results, benchmarks
  | 'ai_cyberattack'         // AI used as an attack vector or tool
  | 'security_incident'      // breaches, vulns at AI orgs
  | 'open_source_dev'        // notable OSS releases and activity
  | 'funding'
  | 'acquisition'
  | 'hiring'                 // notable moves, team builds, departures
  | 'infrastructure'         // compute, datacenters, chips, supply
  | 'regulatory'
  | 'strategic_speculation'; // analysis of why a company is doing something

export const SIGNAL_TYPES: readonly SignalType[] = [
  'model_release', 'product_release', 'rumor', 'leak', 'research_breakthrough',
  'ai_cyberattack', 'security_incident', 'open_source_dev', 'funding',
  'acquisition', 'hiring', 'infrastructure', 'regulatory', 'strategic_speculation',
] as const;

/** Human-facing labels; keep in sync with SIGNAL_TYPES. */
export const SIGNAL_TYPE_LABELS: Record<SignalType, string> = {
  model_release: 'Model release',
  product_release: 'Product release',
  rumor: 'Rumor',
  leak: 'Leak',
  research_breakthrough: 'Research',
  ai_cyberattack: 'AI attack',
  security_incident: 'Security',
  open_source_dev: 'Open source',
  funding: 'Funding',
  acquisition: 'Acquisition',
  hiring: 'Hiring',
  infrastructure: 'Infrastructure',
  regulatory: 'Regulatory',
  strategic_speculation: 'Analysis',
};

/**
 * Lifecycle. Transitions are rule-based (see confidence.ts) and never decided
 * by the LLM. `stale` exists so unconfirmed rumors decay out of the feed
 * instead of accumulating as permanent noise.
 */
export type SignalStatus =
  | 'unverified'  // single source, uncorroborated
  | 'developing'  // multiple independent sources, facts still moving
  | 'confirmed'   // primary source, or strong multi-source corroboration
  | 'debunked'    // affirmatively contradicted by a credible source
  | 'stale';      // 30d without corroboration, never reached developing

/**
 * Source trust tiers. Drives the largest deterministic component of confidence.
 *   1 primary     — the subject itself speaking, or a system of record
 *   2 established — outlets with a real correction policy and track record
 *   3 aggregator  — trade press and community aggregation
 *   4 low-trust   — anonymous accounts, content farms, unattributed mirrors
 */
export type SourceTier = 1 | 2 | 3 | 4;

export interface Source {
  url: string;
  /** Post-redirect, tracking params stripped. Used for domain-level dedup. */
  canonical_url: string;
  domain: string;
  outlet: string;
  tier: SourceTier;
  title: string;
  author?: string;
  /** ISO 8601 UTC. */
  published_at: string;
  discovered_at: string;
  /**
   * VERBATIM substring of the source, <= 400 chars. Never LLM-generated.
   * This is the evidence a reader checks our claims against.
   */
  excerpt: string;
  /** True when the subject organization is the one speaking. */
  is_primary: boolean;
  lang: string;
  /** Snapshot taken at discovery, so citations survive link rot. */
  archive_url?: string;
}

export type EntityKind =
  | 'org' | 'model' | 'person' | 'product' | 'chip' | 'regulation' | 'repo';

export interface EntityRef {
  /** Namespaced and stable: 'org:openai', 'model:gpt-5', 'person:sam-altman'. */
  id: string;
  name: string;
  kind: EntityKind;
  role: 'subject' | 'actor' | 'mentioned';
  slug: string;
}

export type ConfidenceBand = 'low' | 'moderate' | 'high' | 'verified';

/**
 * Confidence is 85% deterministic by construction. `llm_assessment` is hard
 * capped at 15 so a persuasive hallucination cannot manufacture credibility.
 */
export interface Confidence {
  /** 0-100 integer. */
  score: number;
  band: ConfidenceBand;
  components: {
    corroboration: number;   // 0-40, by distinct domain, same-owner penalized
    source_tier: number;     // 0-35
    llm_assessment: number;  // 0-15  HARD CAP
    consistency: number;     // 0-10, reduced by contradictions
  };
  /** One sentence, shown on hover. Explains the number in plain language. */
  rationale: string;
}

export interface StatusTransition {
  from: SignalStatus;
  to: SignalStatus;
  at: string;
  reason: string;
  triggered_by:
    | 'corroboration' | 'primary_source' | 'contradiction' | 'decay' | 'manual';
  /** Required for transitions into `confirmed` and `debunked`. */
  evidence_source_url?: string;
}

/** Flags raised during extraction; surfaced in the UI where they affect trust. */
export type ExtractionFlag =
  | 'low_evidence'
  | 'contradiction'
  | 'speculative_language'
  | 'entity_uncertain';

export interface Signal {
  /** Permanent. Derived from cluster id, never reused, never renumbered. */
  id: string;
  schema_version: typeof SCHEMA_VERSION;

  type: SignalType;
  /** A funding round at a chip company is both `funding` and `infrastructure`. */
  secondary_types: SignalType[];

  /** <= 110 chars, declarative, no clickbait. LLM-written, guard-verified. */
  title: string;
  /** 2-3 sentences, <= 400 chars. LLM-written, guard-verified. */
  summary: string;
  /**
   * The analytic layer — the one field where inference is legitimate.
   * MUST be rendered visually distinct from reporting. <= 280 chars.
   */
  why_it_matters: string;

  entities: EntityRef[];
  /** Drives entity-page assignment. Must appear in `entities`. */
  primary_entity_id: string;

  status: SignalStatus;
  status_history: StatusTransition[];
  confidence: Confidence;

  /** Distinct DOMAINS, not source count. 50 syndicated copies != 50 sources. */
  corroboration_count: number;
  /** Ordered: primary first, then tier ascending, then date ascending. */
  sources: Source[];
  source_count: number;

  /** Earliest source publication. */
  first_seen_at: string;
  /** Last material change. Drives feed ordering for updated signals. */
  updated_at: string;
  /** When the real-world event happened, when extractable. */
  event_at?: string;

  cluster: {
    doc_count: number;
    centroid_version: number;
    /** Tombstoned ids that now redirect here, so permalinks never 404. */
    merged_from: string[];
  };

  extraction: {
    model: string;
    prompt_version: string;
    extracted_at: string;
    flags: ExtractionFlag[];
  };

  quality: {
    /** The source itself hedges ("reportedly", "sources say"). */
    is_speculative: boolean;
    has_primary_source: boolean;
    contradiction_count: number;
    /**
     * False means every generated entity/number/date was NOT verifiable
     * against source text. Such signals are quarantined, never published.
     */
    hallucination_guard_passed: boolean;
  };
}

/** Denormalized feed row. Carries enough to render without a follow-up fetch. */
export interface FeedEntry {
  id: string;
  type: SignalType;
  title: string;
  summary: string;
  status: SignalStatus;
  confidence_score: number;
  confidence_band: ConfidenceBand;
  corroboration_count: number;
  source_count: number;
  entities: Pick<EntityRef, 'id' | 'name' | 'slug' | 'kind'>[];
  top_sources: Pick<Source, 'outlet' | 'domain' | 'url' | 'tier'>[];
  first_seen_at: string;
  updated_at: string;
}

export interface EntityProfile {
  id: string;
  name: string;
  kind: EntityKind;
  slug: string;
  aliases: string[];
  signal_count: number;
  /** Counts per category, for the entity page's at-a-glance breakdown. */
  type_breakdown: Partial<Record<SignalType, number>>;
  first_seen_at: string;
  last_seen_at: string;
  description?: string;
}
