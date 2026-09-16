/**
 * Volume generator for seed data.
 *
 * The hand-authored scenarios in scenarios.ts are high quality but few. To
 * exercise the feed, pagination, entity pages and category views at realistic
 * scale, this expands them into several hundred signals by varying the subject
 * entity, the specific detail, and the time.
 *
 * Every generated signal still passes through the real confidence engine and
 * the real hallucination guard in seed.ts — nothing here fabricates a score.
 *
 * This exists only until the ingestion pipeline runs. It is deliberately kept
 * separate from scenarios.ts so deleting it is a one-line change.
 */

import type { Scenario } from './scenarios.ts';
import type { SignalType, SourceTier, EntityKind } from './schema.ts';

type Ent = [string, EntityKind, 'subject' | 'actor' | 'mentioned'];
type Src = [string, string, SourceTier, boolean];

/** Labs, with their primary-source domain and the models they ship. */
const LABS: Array<{
  name: string; domain: string; models: string[]; people?: string[];
}> = [
  { name: 'OpenAI', domain: 'openai.com', models: ['GPT-5.5', 'o4-mini', 'GPT-5 Turbo'], people: ['Sam Altman'] },
  { name: 'Anthropic', domain: 'anthropic.com', models: ['Claude 4.6', 'Claude Haiku 4.5'] },
  { name: 'Google', domain: 'blog.google', models: ['Gemini 4', 'Gemini 3.8 Flash', 'Gemma 4'] },
  { name: 'DeepMind', domain: 'deepmind.google', models: ['Gemini 4 Ultra'] },
  { name: 'Meta', domain: 'ai.meta.com', models: ['Llama 5', 'Llama 4.2'] },
  { name: 'Mistral AI', domain: 'mistral.ai', models: ['Large 3', 'Codestral 2'] },
  { name: 'Alibaba', domain: 'qwen.ai', models: ['Qwen 3.5', 'Qwen 3.5 Coder'] },
  { name: 'xAI', domain: 'x.ai', models: ['Grok 5'] },
  { name: 'Cohere', domain: 'cohere.com', models: ['Command R3'] },
  { name: 'Microsoft', domain: 'microsoft.com', models: ['Phi-5'] },
  { name: 'Nvidia', domain: 'nvidia.com', models: ['Nemotron 3'] },
  { name: 'Amazon', domain: 'aboutamazon.com', models: ['Nova 2'] },
  { name: 'Hugging Face', domain: 'huggingface.co', models: [] },
  { name: 'Cerebras', domain: 'cerebras.net', models: [] },
  { name: 'Groq', domain: 'groq.com', models: [] },
  { name: 'Stability AI', domain: 'stability.ai', models: [] },
  { name: 'AI21 Labs', domain: 'ai21.com', models: ['Jamba 2'] },
  { name: 'Perplexity', domain: 'perplexity.ai', models: [] },
];

/** Secondary outlets by tier, used to build corroboration sets. */
const OUTLETS: Array<[string, string, SourceTier]> = [
  ['Reuters', 'reuters.com', 2],
  ['Bloomberg', 'bloomberg.com', 2],
  ['The Information', 'theinformation.com', 2],
  ['Financial Times', 'ft.com', 2],
  ['Ars Technica', 'arstechnica.com', 2],
  ['Wall Street Journal', 'wsj.com', 2],
  ['Politico', 'politico.com', 2],
  ['TechCrunch', 'techcrunch.com', 3],
  ['VentureBeat', 'venturebeat.com', 3],
  ['CNBC', 'cnbc.com', 3],
  ['The Verge', 'theverge.com', 3],
  ['Hacker News', 'news.ycombinator.com', 3],
  ['BleepingComputer', 'bleepingcomputer.com', 3],
  ['Business Insider', 'businessinsider.com', 3],
  ['Reddit r/LocalLLaMA', 'reddit.com', 4],
  ['Reddit r/singularity', 'reddit.com', 4],
  ['Anonymous account', 'x.com', 4],
];

const REPOS = ['vLLM', 'llama.cpp', 'Ollama', 'SGLang', 'TensorRT-LLM', 'LangChain', 'Transformers'];

/** Deterministic PRNG so regenerating seed data produces identical output. */
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

const rng = makeRng(20260915);
const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
const pickN = <T>(arr: T[], n: number): T[] => {
  const pool = [...arr];
  const out: T[] = [];
  while (out.length < n && pool.length) {
    out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  }
  return out;
};

/**
 * Templates. Each produces a complete scenario for a given lab/model.
 * Copy is written so the guard passes: every entity and figure in the title
 * and summary also appears in the excerpt.
 */
type Template = (ctx: {
  lab: typeof LABS[number]; model: string; days: number;
}) => Scenario | null;

const TEMPLATES: Template[] = [
  // --- rumor: config reference
  ({ lab, model, days }) => !model ? null : {
    type: 'rumor', status: 'developing',
    title: `${model} identifiers appear in ${lab.name} client configuration`,
    summary: `Strings referencing ${model} appeared in ${lab.name} client configuration before being removed. ${lab.name} has not commented.`,
    why: 'Configuration references often precede launches, but identifiers also appear for internal builds that never ship under that name.',
    entities: [[lab.name, 'org', 'subject'], [model, 'model', 'subject']] as Ent[],
    sources: buildSources(null, 3, 2),
    excerpt: `Strings referencing ${model} appeared in ${lab.name} client configuration before being removed. ${lab.name} has not commented.`,
    daysAgo: days, speculative: true, plausibility: 0.55 + rng() * 0.15,
  },
  // --- rumor: capability direction (several framings, so the same template
  //     does not produce a page of identical headlines)
  ({ lab, model, days }) => {
    if (!model) return null;
    const angles = [
      {
        t: `${model} said to prioritize longer autonomous task chains`,
        b: `Reports describe ${model} as focused on sustained multi-step execution rather than single-response benchmarks. ${lab.name} declined to comment.`,
        w: 'A shift toward long-horizon reliability matters more for agent products than headline benchmark gains do.',
      },
      {
        t: `${model} reported to cut inference cost rather than raise capability`,
        b: `People familiar with the work say ${model} targets lower serving cost at similar capability. ${lab.name} declined to comment.`,
        w: 'Competing on cost rather than capability suggests the lab sees its current quality as sufficient for the workloads it wants.',
      },
      {
        t: `${model} said to expand multimodal input handling`,
        b: `Reports indicate ${model} widens supported input types beyond text. ${lab.name} has not commented.`,
        w: 'Input breadth determines which enterprise workflows a model can enter without a separate preprocessing stack.',
      },
      {
        t: `${lab.name} reported to be testing ${model} with enterprise customers`,
        b: `Reports indicate ${lab.name} has shared ${model} with a limited set of enterprise customers under agreement.`,
        w: 'Limited enterprise testing usually precedes general availability by weeks, making this a timing signal.',
      },
      {
        t: `${model} release timing said to have slipped`,
        b: `Reports suggest the timeline for ${model} has moved later than originally planned. ${lab.name} declined to comment.`,
        w: 'Slipped timelines are more often safety review or capacity constraints than capability problems.',
      },
    ];
    const a = pick(angles);
    return {
      type: 'rumor' as const, status: 'developing' as const,
      title: a.t, summary: a.b, why: a.w,
      entities: [[lab.name, 'org', 'subject'], [model, 'model', 'subject']] as Ent[],
      sources: buildSources(null, 2, 2),
      excerpt: a.b,
      daysAgo: days, speculative: true, plausibility: 0.5 + rng() * 0.2,
    };
  },
  // --- leak: unverified spec claim
  ({ lab, model, days }) => !model ? null : {
    type: 'leak', status: 'unverified',
    title: `Unverified post claims context window details for ${model}`,
    summary: `An unattributed account posted context window details attributed to ${model}. No other source has reported the same figures.`,
    why: 'Specification claims are easy to fabricate and hard to check, which is why a single anonymous source cannot move confidence far.',
    entities: [[lab.name, 'org', 'subject'], [model, 'model', 'subject']] as Ent[],
    sources: [['Anonymous account', 'x.com', 4, false]] as Src[],
    excerpt: `An unattributed account posted context window details attributed to ${model}. No other source has reported the same figures.`,
    daysAgo: days, speculative: true, plausibility: 0.2 + rng() * 0.15,
  },
  // --- model release
  ({ lab, model, days }) => !model ? null : {
    type: 'model_release', status: 'confirmed',
    title: `${lab.name} releases ${model}`,
    summary: `${lab.name} released ${model}. The company said the model is available through its API from today.`,
    why: 'Each frontier release resets the reference point competitors are measured against, whatever the benchmark deltas turn out to be.',
    entities: [[lab.name, 'org', 'subject'], [model, 'model', 'subject']] as Ent[],
    sources: buildSources([lab.name, lab.domain, 1, true], 3, 2),
    excerpt: `${lab.name} released ${model}. The company said the model is available through its API from today.`,
    daysAgo: days, plausibility: 0.88 + rng() * 0.1,
  },
  // --- product release
  ({ lab, days }) => ({
    type: 'product_release', status: 'confirmed',
    title: `${lab.name} expands API rate limits for production customers`,
    summary: `${lab.name} raised API rate limits for production customers, citing added serving capacity.`,
    why: 'Rate limit increases are a capacity signal: labs raise them when they have headroom, not when they are constrained.',
    entities: [[lab.name, 'org', 'subject']] as Ent[],
    sources: buildSources([lab.name, lab.domain, 1, true], 2, 1),
    excerpt: `${lab.name} raised API rate limits for production customers, citing added serving capacity.`,
    daysAgo: days, plausibility: 0.85 + rng() * 0.1,
  }),
  // --- funding
  ({ lab, days }) => {
    const amt = [120, 200, 340, 450, 600, 850][Math.floor(rng() * 6)];
    return {
      type: 'funding', status: 'confirmed',
      title: `${lab.name} raises $${amt} million in new funding`,
      summary: `${lab.name} raised $${amt} million. The company said the funding will expand capacity and hiring.`,
      why: 'Round sizes at this level are underwritten by compute commitments, so they read as capacity announcements as much as equity events.',
      entities: [[lab.name, 'org', 'subject']] as Ent[],
      sources: buildSources([lab.name, lab.domain, 1, true], 3, 2),
      excerpt: `${lab.name} raised $${amt} million. The company said the funding will expand capacity and hiring.`,
      daysAgo: days, plausibility: 0.88 + rng() * 0.1,
    };
  },
  // --- infrastructure
  ({ lab, days }) => ({
    type: 'infrastructure', status: 'confirmed',
    title: `${lab.name} adds serving capacity in additional regions`,
    summary: `${lab.name} said it added serving capacity in additional regions, citing customer demand for lower latency.`,
    why: 'Regional capacity is how latency-sensitive workloads get won, and it is expensive enough to signal real committed demand.',
    entities: [[lab.name, 'org', 'subject'], ['Nvidia', 'org', 'mentioned']] as Ent[],
    sources: buildSources([lab.name, lab.domain, 1, true], 2, 2),
    excerpt: `${lab.name} said it added serving capacity in additional regions, citing customer demand for lower latency.`,
    daysAgo: days, plausibility: 0.85 + rng() * 0.1,
  }),
  // --- hiring
  ({ lab, days }) => ({
    type: 'hiring', status: 'developing',
    title: `Researchers depart ${lab.name} for a new venture`,
    summary: `Several researchers left ${lab.name} to start a new company. The venture has not announced funding.`,
    why: 'Departures in clusters are the earliest visible signal of where the next competitor forms.',
    entities: [[lab.name, 'org', 'subject']] as Ent[],
    sources: buildSources(null, 2, 2),
    excerpt: `Several researchers left ${lab.name} to start a new company. The venture has not announced funding.`,
    daysAgo: days, speculative: true, plausibility: 0.6 + rng() * 0.15,
  }),
  // --- acquisition
  ({ lab, days }) => ({
    type: 'acquisition', status: 'developing',
    title: `${lab.name} reported to be in acquisition talks with a tooling startup`,
    summary: `Reports indicate ${lab.name} is in acquisition discussions with a developer tooling company. Terms were not disclosed.`,
    why: 'Tooling acquisitions buy distribution into existing developer workflows, which is harder to build than the underlying capability.',
    entities: [[lab.name, 'org', 'subject']] as Ent[],
    sources: buildSources(null, 2, 2),
    excerpt: `Reports indicate ${lab.name} is in acquisition discussions with a developer tooling company. Terms were not disclosed.`,
    daysAgo: days, speculative: true, plausibility: 0.55 + rng() * 0.15,
  }),
  // --- open source
  ({ days }) => {
    const repo = pick(REPOS);
    const minor = Math.floor(rng() * 40);
    return {
      type: 'open_source_dev', status: 'confirmed',
      title: `${repo} ships v0.${minor} with ${pick(['scheduling', 'memory', 'batching', 'quantization', 'tokenizer'])} improvements`,
      summary: `The ${repo} project released v0.${minor}. Release notes cite ${pick(['throughput improvements under concurrent load', 'reduced memory use on long contexts', 'faster cold starts', 'broader hardware support'])}.`,
      why: 'Serving-layer projects propagate changes across the entire self-hosted ecosystem within weeks.',
      entities: [[repo, 'repo', 'subject']] as Ent[],
      sources: buildSources(['GitHub', 'github.com', 1, true], 2, 1),
      excerpt: `The ${repo} project released v0.${minor}.`,
      daysAgo: days, plausibility: 0.85 + rng() * 0.1,
    };
  },
  // --- research
  ({ days }) => ({
    type: 'research_breakthrough', status: 'confirmed',
    title: 'Paper reports inference cost reduction on long-context workloads',
    summary: 'An arXiv paper describes a method reducing inference cost on long-context workloads without accuracy loss.',
    why: 'Long-context cost is the binding constraint on agent products, so reductions there change which products are economic.',
    entities: [] as Ent[],
    sources: buildSources(['arXiv', 'arxiv.org', 1, true], 2, 1),
    excerpt: 'An arXiv paper describes a method reducing inference cost on long-context workloads without accuracy loss.',
    daysAgo: days, plausibility: 0.8 + rng() * 0.12,
  }),
  // --- security
  ({ days }) => {
    const repo = pick(REPOS);
    return {
      type: 'security_incident', status: 'confirmed',
      title: `Vulnerability disclosed in ${repo}`,
      summary: `A vulnerability was disclosed in ${repo}. A patched release is available.`,
      why: 'Serving components sit at the network edge, so flaws there are directly reachable rather than requiring prior access.',
      entities: [[repo, 'repo', 'subject']] as Ent[],
      sources: buildSources(['NVD', 'nvd.nist.gov', 1, true], 2, 1),
      excerpt: `A vulnerability was disclosed in ${repo}. A patched release is available.`,
      daysAgo: days, plausibility: 0.85 + rng() * 0.1,
    };
  },
  // --- ai cyberattack
  ({ days }) => ({
    type: 'ai_cyberattack', status: 'developing',
    title: 'Prompt injection campaign observed against browsing agents',
    summary: 'Researchers observed a campaign embedding hidden instructions in pages to redirect AI browsing agents.',
    why: 'Injection moving from demonstration to observed campaign changes it from a research concern to an operational one.',
    entities: [] as Ent[],
    sources: buildSources(null, 2, 2),
    excerpt: 'Researchers observed a campaign embedding hidden instructions in pages to redirect AI browsing agents.',
    daysAgo: days, speculative: true, plausibility: 0.65 + rng() * 0.15,
  }),
  // --- regulatory
  ({ days }) => ({
    type: 'regulatory', status: 'developing',
    title: 'Regulator opens consultation on model transparency obligations',
    summary: 'A regulator opened a consultation on transparency obligations for general-purpose models.',
    why: 'Consultations are where compliance cost is actually negotiated, well before any rule takes effect.',
    entities: [['European Union', 'org', 'subject'], ['EU AI Act', 'regulation', 'mentioned']] as Ent[],
    sources: buildSources(['European Commission', 'ec.europa.eu', 1, true], 2, 1),
    excerpt: 'A regulator opened a consultation on transparency obligations for general-purpose models.',
    daysAgo: days, plausibility: 0.82 + rng() * 0.12,
  }),
  // --- strategic
  ({ lab, days }) => ({
    type: 'strategic_speculation', status: 'developing',
    title: `${lab.name} pricing changes point to volume competition`,
    summary: `${lab.name} adjusted pricing on mid-tier models, reducing per-token cost for high-volume customers.`,
    why: 'Mid-tier price movement signals competition on volume rather than capability, which compresses margins across the sector.',
    entities: [[lab.name, 'org', 'subject']] as Ent[],
    sources: buildSources(null, 2, 2),
    excerpt: `${lab.name} adjusted pricing on mid-tier models, reducing per-token cost for high-volume customers.`,
    daysAgo: days, speculative: true, plausibility: 0.55 + rng() * 0.15,
  }),
];

/**
 * Builds a source list.
 *
 * `mid`/`low` are upper bounds, not fixed counts. Real coverage is heavily
 * long-tailed: most stories are carried by one or two outlets and only the
 * biggest get broad pickup. Emitting the maximum every time produced a feed
 * where 46% of signals scored 90+, which is not what an honest distribution
 * looks like and would make the confidence score meaningless as a filter.
 *
 * A primary source is also withheld most of the time — companies do not put
 * out a statement for every rumor written about them.
 */
function buildSources(primary: Src | null, mid: number, low: number): Src[] {
  const out: Src[] = [];

  // Primary sources are the exception, not the rule.
  if (primary && rng() < 0.55) out.push(primary);

  // Long-tailed pickup: usually 1, occasionally the full spread.
  const r = rng();
  const midCount = r < 0.45 ? 1 : r < 0.78 ? Math.min(2, mid) : mid;
  const lowCount = rng() < 0.6 ? 0 : low;

  const midPool = OUTLETS.filter((o) => o[2] <= 3);
  const lowPool = OUTLETS.filter((o) => o[2] >= 3);
  for (const [n, d, t] of pickN(midPool, midCount)) out.push([n, d, t, false]);
  for (const [n, d, t] of pickN(lowPool, lowCount)) {
    if (!out.some((s) => s[1] === d)) out.push([n, d, t, false]);
  }

  // Never emit a sourceless signal.
  if (!out.length) out.push(['Hacker News', 'news.ycombinator.com', 3, false]);
  return out;
}

/**
 * Expands the hand-authored set to `target` total signals.
 * Hand-authored scenarios always come first so the freshest, best-written
 * material sits at the top of the feed.
 */
export function generateScenarios(base: Scenario[], target: number): Scenario[] {
  const out = [...base];
  let guard = 0;

  while (out.length < target && guard < target * 20) {
    guard++;
    const lab = pick(LABS);
    const model = lab.models.length ? pick(lab.models) : '';
    // Spread across ~120 days, weighted toward recent so the feed looks live.
    const days = 0.3 + Math.pow(rng(), 1.7) * 120;
    const tpl = pick(TEMPLATES);
    const sc = tpl({ lab, model, days });
    if (!sc) continue;
    // Avoid exact duplicate headlines.
    if (out.some((x) => x.title === sc.title)) continue;
    out.push(sc);
  }
  return out;
}
