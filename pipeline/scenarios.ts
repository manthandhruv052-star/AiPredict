/**
 * Seed scenarios.
 *
 * Hand-authored material used to populate the feed before the ingestion
 * pipeline is wired up. Every scenario is run through the real confidence
 * engine and the real hallucination guard by seed.ts — scores are computed,
 * never hardcoded.
 *
 * Sourcing rule: outlet names and domains are real, but `url` points at the
 * outlet's homepage rather than a fabricated article path, so no link on the
 * site 404s and no specific article is misattributed. When the pipeline goes
 * live these are replaced wholesale by ingested documents.
 */

import type {
  SignalType, SignalStatus, SourceTier, EntityKind,
} from './schema.ts';

export interface Scenario {
  type: SignalType;
  secondary?: SignalType[];
  status: SignalStatus;
  title: string;
  summary: string;
  why: string;
  entities: Array<[string, EntityKind, 'subject' | 'actor' | 'mentioned']>;
  sources: Array<[string, string, SourceTier, boolean]>;
  excerpt: string;
  variants?: Record<string, string>;
  daysAgo: number;
  speculative?: boolean;
  contradictions?: number;
  plausibility?: number;
}

export const SCENARIOS: Scenario[] = [
  // ---------------------------------------------------------------- rumors
  {
    type: 'rumor',
    status: 'developing',
    title: 'Gemini 4 appears in Vertex AI configuration strings',
    summary: 'Model identifiers matching an unreleased Gemini version appeared briefly in Vertex AI client configuration. The strings were removed within hours.',
    why: 'Configuration references have preceded Google model launches before, but identifiers also appear for internal evaluation builds that never ship under that name.',
    entities: [['Google', 'org', 'subject'], ['Gemini 4', 'model', 'subject'], ['DeepMind', 'org', 'mentioned']],
    sources: [
      ['The Information', 'theinformation.com', 2, false],
      ['Hacker News', 'news.ycombinator.com', 3, false],
      ['Reddit r/Bard', 'reddit.com', 4, false],
    ],
    excerpt: 'Model identifiers matching an unreleased Gemini version appeared briefly in Vertex AI client configuration before being removed.',
    variants: {
      'The Information': 'Strings referencing an unreleased Gemini version were present in Vertex AI client configuration for several hours before removal.',
      'Hacker News': 'Someone found Gemini 4 identifiers in the Vertex AI config. Gone now.',
      'Reddit r/Bard': 'The identifiers were in Vertex AI config and disappeared within hours. Could be an eval build.',
    },
    daysAgo: 0.15,
    speculative: true,
    plausibility: 0.66,
  },
  {
    type: 'rumor',
    status: 'developing',
    title: 'Gemini 4 said to focus on long-horizon agent tasks',
    summary: 'Multiple reports describe the next Gemini generation as prioritizing sustained multi-step task execution over raw benchmark scores. Google has not commented.',
    why: 'If accurate, this signals the frontier competition shifting from single-response quality to reliability across long chains, where failure compounds.',
    entities: [['Google', 'org', 'subject'], ['Gemini 4', 'model', 'subject']],
    sources: [
      ['The Information', 'theinformation.com', 2, false],
      ['Bloomberg', 'bloomberg.com', 2, false],
      ['VentureBeat', 'venturebeat.com', 3, false],
    ],
    excerpt: 'Reports describe the next Gemini generation as prioritizing sustained multi-step task execution over raw benchmark scores.',
    variants: {
      'The Information': 'People familiar with the work describe a focus on sustained multi-step execution rather than benchmark scores.',
      'Bloomberg': 'The next Gemini generation is said to prioritize long-horizon agent tasks. Google declined to comment.',
      'VentureBeat': 'Sources describe a shift toward multi-step task reliability in the next Gemini generation.',
    },
    daysAgo: 0.9,
    speculative: true,
    plausibility: 0.6,
  },
  {
    type: 'rumor',
    status: 'unverified',
    title: 'Unconfirmed post claims Gemini 4 context window exceeds 4 million tokens',
    summary: 'An unattributed account claimed a context window figure for an unreleased Gemini model. No corroborating source has reported the same number.',
    why: 'Context-window figures are among the most frequently fabricated specs in pre-release chatter, because they are easy to state and impossible to check.',
    entities: [['Google', 'org', 'subject'], ['Gemini 4', 'model', 'subject']],
    sources: [['Anonymous account', 'x.com', 4, false]],
    excerpt: 'An unattributed account claimed a context window figure for an unreleased Gemini model, without evidence.',
    daysAgo: 0.4,
    speculative: true,
    plausibility: 0.28,
  },
  {
    type: 'rumor',
    status: 'developing',
    title: 'OpenAI reasoning model said to enter limited external testing',
    summary: 'Reports indicate a new OpenAI reasoning model has been shared with a small group of external testers under agreement.',
    why: 'External testing rounds typically precede availability by weeks rather than months, making this a timing signal more than a capability one.',
    entities: [['OpenAI', 'org', 'subject'], ['Sam Altman', 'person', 'mentioned']],
    sources: [
      ['The Information', 'theinformation.com', 2, false],
      ['Reuters', 'reuters.com', 2, false],
      ['Hacker News', 'news.ycombinator.com', 3, false],
    ],
    excerpt: 'Reports indicate a new OpenAI reasoning model has been shared with a small group of external testers under agreement.',
    daysAgo: 1.4,
    speculative: true,
    plausibility: 0.64,
  },
  {
    type: 'rumor',
    status: 'developing',
    title: 'Anthropic said to be preparing an enterprise agent product',
    summary: 'Two outlets report Anthropic is developing a product aimed at long-running enterprise workflows. Details on timing were not given.',
    why: 'Enterprise agent tooling is where per-seat pricing becomes defensible, which matters more to margins than model quality alone.',
    entities: [['Anthropic', 'org', 'subject']],
    sources: [
      ['Bloomberg', 'bloomberg.com', 2, false],
      ['The Information', 'theinformation.com', 2, false],
    ],
    excerpt: 'Two outlets report Anthropic is developing a product aimed at long-running enterprise workflows.',
    daysAgo: 2.6,
    speculative: true,
    plausibility: 0.58,
  },
  {
    type: 'rumor',
    status: 'developing',
    title: 'Meta said to be evaluating a licensed model for internal tooling',
    summary: 'Reports suggest Meta has evaluated third-party models for internal developer tooling, alongside its own open-weight work.',
    why: 'A lab licensing outside models for internal use would be a notable admission about where its own capabilities sit.',
    entities: [['Meta', 'org', 'subject']],
    sources: [
      ['The Information', 'theinformation.com', 2, false],
      ['Business Insider', 'businessinsider.com', 3, false],
    ],
    excerpt: 'Reports suggest Meta has evaluated third-party models for internal developer tooling.',
    daysAgo: 4.4,
    speculative: true,
    plausibility: 0.5,
  },

  // ------------------------------------------------------------ model release
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
      'Reuters': 'French startup Mistral AI released Large 3, a flagship model with a 256k context window, deepening competition with larger US rivals.',
      'TechCrunch': 'Mistral has shipped Large 3, which the company says handles a 256k context window. It lands on the Mistral API and Azure AI Foundry at launch.',
      'Hacker News': 'Mistral Large 3 is out, with a 256k context window. Available on the Mistral API and Azure AI Foundry.',
    },
    daysAgo: 0.2,
    plausibility: 0.95,
  },
  {
    type: 'model_release',
    status: 'confirmed',
    title: 'Alibaba releases Qwen 3.5 weights under permissive license',
    summary: 'Alibaba released Qwen 3.5 model weights under a permissive license. The release includes several parameter sizes aimed at self-hosted deployment.',
    why: 'Permissively licensed weights at this capability level put continuous pricing pressure on closed API providers serving similar workloads.',
    entities: [['Alibaba', 'org', 'subject'], ['Qwen 3.5', 'model', 'subject'], ['Hugging Face', 'org', 'mentioned']],
    sources: [
      ['Hugging Face', 'huggingface.co', 1, true],
      ['GitHub', 'github.com', 1, true],
      ['VentureBeat', 'venturebeat.com', 3, false],
      ['Hacker News', 'news.ycombinator.com', 3, false],
    ],
    excerpt: 'Alibaba released Qwen 3.5 model weights under a permissive license, including several parameter sizes aimed at self-hosted deployment.',
    daysAgo: 1.7,
    plausibility: 0.92,
  },
  {
    type: 'model_release',
    status: 'confirmed',
    title: 'Cohere ships an updated retrieval model for enterprise search',
    summary: 'Cohere released an updated retrieval model targeting enterprise search workloads. The company said it improves ranking quality on long documents.',
    why: 'Retrieval quality is the bottleneck in most enterprise deployments, and improvements there move more revenue than headline model upgrades.',
    entities: [['Cohere', 'org', 'subject']],
    sources: [
      ['Cohere', 'cohere.com', 1, true],
      ['VentureBeat', 'venturebeat.com', 3, false],
    ],
    excerpt: 'Cohere released an updated retrieval model targeting enterprise search workloads, which the company said improves ranking quality on long documents.',
    daysAgo: 5.2,
    plausibility: 0.88,
  },

  // --------------------------------------------------------------- releases
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
    type: 'product_release',
    status: 'confirmed',
    title: 'Microsoft adds model routing controls to Azure AI Foundry',
    summary: 'Microsoft added controls letting Azure AI Foundry customers route requests between models based on cost and latency rules.',
    why: 'Routing controls commoditize the underlying models — customers who can switch on price have far more leverage in renewal negotiations.',
    entities: [['Microsoft', 'org', 'subject'], ['Azure AI Foundry', 'product', 'subject']],
    sources: [
      ['Microsoft', 'microsoft.com', 1, true],
      ['CNBC', 'cnbc.com', 3, false],
      ['VentureBeat', 'venturebeat.com', 3, false],
    ],
    excerpt: 'Microsoft added controls letting Azure AI Foundry customers route requests between models based on cost and latency rules.',
    daysAgo: 2.1,
    plausibility: 0.9,
  },
  {
    type: 'product_release',
    status: 'confirmed',
    title: 'OpenAI expands batch processing limits for API customers',
    summary: 'OpenAI raised batch processing limits for API customers. The company said the change targets large offline workloads.',
    why: 'Batch pricing is where inference economics are most visible; raising limits suggests spare capacity rather than scarcity.',
    entities: [['OpenAI', 'org', 'subject']],
    sources: [
      ['OpenAI', 'openai.com', 1, true],
      ['TechCrunch', 'techcrunch.com', 3, false],
    ],
    excerpt: 'OpenAI raised batch processing limits for API customers, targeting large offline workloads.',
    daysAgo: 6.3,
    plausibility: 0.9,
  },

  // ---------------------------------------------------------------- funding
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
    type: 'funding',
    status: 'confirmed',
    title: 'European AI infrastructure startup raises a Series B round',
    summary: 'A European startup building AI inference infrastructure raised a Series B round. Investors cited regional data residency demand.',
    why: 'Data residency requirements are creating a protected market for regional infrastructure that would not survive on price alone.',
    entities: [['European Union', 'org', 'mentioned']],
    sources: [
      ['Reuters', 'reuters.com', 2, false],
      ['TechCrunch', 'techcrunch.com', 3, false],
    ],
    excerpt: 'A European startup building AI inference infrastructure raised a Series B round, with investors citing regional data residency demand.',
    daysAgo: 3.3,
    plausibility: 0.85,
  },
  {
    type: 'funding',
    status: 'developing',
    title: 'Reports point to a large late-stage round for an AI coding startup',
    summary: 'Two outlets report an AI coding assistant company is raising a late-stage round. Terms were not confirmed by the company.',
    why: 'Coding assistants have the clearest retention data in the sector, which is why they keep clearing rounds when other categories stall.',
    entities: [['Microsoft', 'org', 'mentioned']],
    sources: [
      ['Bloomberg', 'bloomberg.com', 2, false],
      ['The Information', 'theinformation.com', 2, false],
    ],
    excerpt: 'Two outlets report an AI coding assistant company is raising a late-stage round. Terms were not confirmed.',
    daysAgo: 7.1,
    speculative: true,
    plausibility: 0.6,
  },

  // --------------------------------------------------------- infrastructure
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
    type: 'infrastructure',
    status: 'confirmed',
    title: 'Google reports expanded TPU capacity across additional regions',
    summary: 'Google said it expanded TPU capacity to additional cloud regions. The company cited demand from training and inference customers.',
    why: 'Regional TPU expansion is how Google converts its silicon advantage into cloud revenue rather than internal cost savings alone.',
    entities: [['Google', 'org', 'subject'], ['DeepMind', 'org', 'mentioned']],
    sources: [
      ['Google', 'cloud.google.com', 1, true],
      ['CNBC', 'cnbc.com', 3, false],
    ],
    excerpt: 'Google said it expanded TPU capacity to additional cloud regions, citing demand from training and inference customers.',
    daysAgo: 4.8,
    plausibility: 0.88,
  },
  {
    type: 'infrastructure',
    status: 'developing',
    title: 'Power constraints reported at several planned AI datacenter sites',
    summary: 'Reports describe grid connection delays affecting planned datacenter sites. Operators have not confirmed specific timelines.',
    why: 'Power, not chips, is becoming the binding constraint on capacity growth — and grid timelines run years, not quarters.',
    entities: [['Nvidia', 'org', 'mentioned'], ['Microsoft', 'org', 'mentioned']],
    sources: [
      ['Reuters', 'reuters.com', 2, false],
      ['Bloomberg', 'bloomberg.com', 2, false],
      ['Ars Technica', 'arstechnica.com', 2, false],
    ],
    excerpt: 'Reports describe grid connection delays affecting planned datacenter sites, with operators declining to confirm timelines.',
    daysAgo: 5.9,
    speculative: true,
    plausibility: 0.72,
  },

  // -------------------------------------------------------------- security
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
    excerpt: 'Security researchers documented a campaign embedding hidden instructions in web pages to hijack AI browsing agents.',
    variants: {
      'NVD': 'Hidden instructions embedded in web page content can cause affected AI browsing agents to exfiltrate session data to attacker-controlled endpoints.',
      'Ars Technica': 'Researchers have documented the first in-the-wild campaign using prompt injection against AI browsing agents, rather than a laboratory demonstration.',
      'BleepingComputer': 'Attackers embedded hidden instructions in web pages to hijack AI browsing agents, with affected agents sending session data to attacker-controlled endpoints.',
    },
    daysAgo: 2.3,
    plausibility: 0.9,
  },
  {
    type: 'security_incident',
    status: 'confirmed',
    title: 'Vulnerability disclosed in a widely used model serving library',
    summary: 'A vulnerability was disclosed in a model serving library used in self-hosted deployments. A patched release is available.',
    why: 'Serving libraries sit at the network edge of most self-hosted stacks, so a flaw there is directly exploitable rather than requiring prior access.',
    entities: [['vLLM', 'repo', 'mentioned']],
    sources: [
      ['NVD', 'nvd.nist.gov', 1, true],
      ['BleepingComputer', 'bleepingcomputer.com', 3, false],
      ['Hacker News', 'news.ycombinator.com', 3, false],
    ],
    excerpt: 'A vulnerability was disclosed in a model serving library used in self-hosted deployments. A patched release is available.',
    daysAgo: 3.1,
    plausibility: 0.9,
  },
  {
    type: 'ai_cyberattack',
    status: 'developing',
    title: 'Phishing campaign observed using model-generated lures at scale',
    summary: 'Researchers report a phishing campaign using generated content to produce large volumes of tailored lures.',
    why: 'Generation cost collapsing changes phishing economics — volume and personalization stop trading off against each other.',
    entities: [],
    sources: [
      ['BleepingComputer', 'bleepingcomputer.com', 3, false],
      ['Ars Technica', 'arstechnica.com', 2, false],
    ],
    excerpt: 'Researchers report a phishing campaign using generated content to produce large volumes of tailored lures.',
    daysAgo: 6.7,
    speculative: true,
    plausibility: 0.7,
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

  // -------------------------------------------------------------- research
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
    excerpt: 'A DeepMind paper reports improved sample efficiency on robotic manipulation benchmarks using a modified training curriculum.',
    daysAgo: 3.0,
    plausibility: 0.85,
  },
  {
    type: 'research_breakthrough',
    status: 'confirmed',
    title: 'Paper reports reduced inference cost through sparse attention routing',
    summary: 'An arXiv paper describes a sparse attention routing method that reduces inference cost on long-context workloads.',
    why: 'Long-context inference cost is what makes agent workloads uneconomic today; methods that cut it change which products are viable.',
    entities: [],
    sources: [
      ['arXiv', 'arxiv.org', 1, true],
      ['Hacker News', 'news.ycombinator.com', 3, false],
    ],
    excerpt: 'An arXiv paper describes a sparse attention routing method that reduces inference cost on long-context workloads.',
    daysAgo: 4.1,
    plausibility: 0.82,
  },
  {
    type: 'research_breakthrough',
    status: 'developing',
    title: 'Replication attempt reports weaker results than original benchmark claim',
    summary: 'A replication attempt reports smaller gains than an earlier benchmark result. The original authors have not yet responded.',
    why: 'Benchmark results that do not replicate are common enough that unreplicated claims should be treated as provisional by default.',
    entities: [],
    sources: [
      ['arXiv', 'arxiv.org', 1, true],
      ['Hacker News', 'news.ycombinator.com', 3, false],
    ],
    excerpt: 'A replication attempt reports smaller gains than an earlier benchmark result. The original authors have not yet responded.',
    daysAgo: 7.8,
    speculative: true,
    plausibility: 0.7,
  },

  // ----------------------------------------------------------- open source
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
    excerpt: 'The vLLM project released version 0.11, which includes changes to multi-GPU request scheduling.',
    daysAgo: 1.8,
    plausibility: 0.9,
  },
  {
    type: 'open_source_dev',
    status: 'confirmed',
    title: 'llama.cpp adds support for an additional quantization format',
    summary: 'The llama.cpp project added support for an additional quantization format, targeting lower memory use on consumer hardware.',
    why: 'Quantization support determines which models run on hardware people already own, which drives open-weight adoption more than licensing does.',
    entities: [['llama.cpp', 'repo', 'subject']],
    sources: [
      ['GitHub', 'github.com', 1, true],
      ['Reddit r/LocalLLaMA', 'reddit.com', 4, false],
    ],
    excerpt: 'The llama.cpp project added support for an additional quantization format, targeting lower memory use on consumer hardware.',
    daysAgo: 2.7,
    plausibility: 0.88,
  },
  {
    type: 'open_source_dev',
    status: 'confirmed',
    title: 'Open-weight model surpasses one million downloads in a week',
    summary: 'A recently released open-weight model passed one million downloads within a week of publication, according to repository statistics.',
    why: 'Download velocity is the closest available proxy for real developer adoption, and it diverges sharply from benchmark rankings.',
    entities: [['Hugging Face', 'org', 'mentioned']],
    sources: [
      ['Hugging Face', 'huggingface.co', 1, true],
      ['VentureBeat', 'venturebeat.com', 3, false],
    ],
    excerpt: 'A recently released open-weight model passed one million downloads within a week of publication, according to repository statistics.',
    daysAgo: 5.5,
    plausibility: 0.85,
  },

  // ------------------------------------------------------------- regulatory
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
    excerpt: 'The EU AI Office opened a public consultation on transparency obligations for general-purpose AI models.',
    daysAgo: 4.2,
    plausibility: 0.9,
  },
  {
    type: 'regulatory',
    status: 'developing',
    title: 'US state legislature advances an AI disclosure bill',
    summary: 'A state legislature advanced a bill requiring disclosure when content is generated by AI systems. The bill has not been enacted.',
    why: 'State-level disclosure rules create a compliance patchwork that is often more burdensome than a single federal standard would be.',
    entities: [],
    sources: [
      ['Politico', 'politico.com', 2, false],
      ['Reuters', 'reuters.com', 2, false],
    ],
    excerpt: 'A state legislature advanced a bill requiring disclosure when content is generated by AI systems.',
    daysAgo: 6.0,
    plausibility: 0.85,
  },
  {
    type: 'regulatory',
    status: 'confirmed',
    title: 'Regulator publishes guidance on automated decision-making appeals',
    summary: 'A regulator published guidance covering appeal rights where automated systems make consequential decisions.',
    why: 'Appeal-rights guidance is where AI regulation becomes operationally expensive, because it requires human capacity rather than a policy document.',
    entities: [['European Union', 'org', 'mentioned']],
    sources: [
      ['European Commission', 'ec.europa.eu', 1, true],
      ['Politico', 'politico.com', 2, false],
    ],
    excerpt: 'A regulator published guidance covering appeal rights where automated systems make consequential decisions.',
    daysAgo: 9.2,
    plausibility: 0.88,
  },

  // ----------------------------------------------------------------- hiring
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
    type: 'hiring',
    status: 'developing',
    title: 'Several researchers depart a frontier lab for a new venture',
    summary: 'A group of researchers left a frontier lab to start a new company. The venture has not announced funding.',
    why: 'Team departures to new ventures are the most reliable early indicator of where the next competitive threat forms.',
    entities: [['OpenAI', 'org', 'mentioned']],
    sources: [
      ['The Information', 'theinformation.com', 2, false],
      ['Bloomberg', 'bloomberg.com', 2, false],
    ],
    excerpt: 'A group of researchers left a frontier lab to start a new company. The venture has not announced funding.',
    daysAgo: 8.1,
    speculative: true,
    plausibility: 0.68,
  },

  // ----------------------------------------------------------- acquisition
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
    type: 'acquisition',
    status: 'confirmed',
    title: 'Data labeling company acquired by an enterprise software vendor',
    summary: 'An enterprise software vendor acquired a data labeling company. Terms were not disclosed.',
    why: 'Labeling businesses are being absorbed into platforms because the data pipeline, not the model, is what enterprises struggle to build.',
    entities: [],
    sources: [
      ['Reuters', 'reuters.com', 2, false],
      ['TechCrunch', 'techcrunch.com', 3, false],
    ],
    excerpt: 'An enterprise software vendor acquired a data labeling company. Terms were not disclosed.',
    daysAgo: 10.4,
    plausibility: 0.85,
  },

  // ----------------------------------------------------------------- leaks
  {
    type: 'leak',
    status: 'unverified',
    title: 'Screenshot claims to show an unreleased Anthropic pricing tier',
    summary: 'An anonymous account posted a screenshot appearing to show an unannounced pricing tier. The image has not been independently verified.',
    why: 'Single-screenshot pricing leaks are among the most frequently fabricated artifacts in this space. Weight accordingly until a second source appears.',
    entities: [['Anthropic', 'org', 'subject']],
    sources: [['Anonymous account', 'x.com', 4, false]],
    excerpt: 'An anonymous account posted a screenshot appearing to show an unannounced pricing tier. The image has not been independently verified.',
    daysAgo: 0.8,
    speculative: true,
    plausibility: 0.35,
  },
  {
    type: 'leak',
    status: 'unverified',
    title: 'Post claims internal benchmark figures for an unreleased model',
    summary: 'An unattributed post listed benchmark figures attributed to an unreleased model. No source has corroborated the numbers.',
    why: 'Leaked benchmark tables are trivially fabricated and disproportionately shared, which is exactly why they need a corroboration floor.',
    entities: [['Google', 'org', 'mentioned']],
    sources: [['Anonymous account', 'x.com', 4, false]],
    excerpt: 'An unattributed post listed benchmark figures attributed to an unreleased model. No source has corroborated the numbers.',
    daysAgo: 1.9,
    speculative: true,
    plausibility: 0.25,
  },

  // ------------------------------------------------------------- strategic
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
  {
    type: 'strategic_speculation',
    status: 'developing',
    title: 'Open-weight releases increasingly target the enterprise middle tier',
    summary: 'Recent open-weight releases cluster around capability levels matching mid-tier commercial APIs rather than frontier models.',
    why: 'Targeting the middle tier attacks the highest-volume revenue segment while avoiding a frontier fight nobody outside three labs can win.',
    entities: [['Meta', 'org', 'mentioned'], ['Mistral AI', 'org', 'mentioned'], ['Alibaba', 'org', 'mentioned']],
    sources: [
      ['Ars Technica', 'arstechnica.com', 2, false],
      ['VentureBeat', 'venturebeat.com', 3, false],
    ],
    excerpt: 'Recent open-weight releases cluster around capability levels matching mid-tier commercial APIs rather than frontier models.',
    daysAgo: 9.7,
    speculative: true,
    plausibility: 0.62,
  },
];
