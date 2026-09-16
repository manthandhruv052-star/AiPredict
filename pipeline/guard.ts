/**
 * The hallucination guard.
 *
 * The single highest-value safeguard in the platform. After the LLM writes a
 * title/summary/why_it_matters, we deterministically verify that every claim
 * it makes is traceable to the source text it was given. Nothing here calls a
 * model — if it did, it would inherit the failure mode it exists to catch.
 *
 * What gets checked:
 *   - named entities (orgs, models, people)
 *   - numbers, money amounts, percentages
 *   - dates and version strings
 *   - quoted phrases
 *
 * Anything asserted but not present in the sources fails the signal into
 * quarantine. Quarantined signals are never published.
 *
 * `why_it_matters` is exempt from entity/number grounding because it is
 * explicitly analysis rather than reporting — but it is still checked for
 * fabricated quotes, which are never legitimate.
 */

const MONEY_RE = /\$\s?\d[\d,.]*\s?(?:billion|million|bn|m|k|trillion)?/gi;
const PERCENT_RE = /\b\d+(?:\.\d+)?\s?%/g;
const VERSION_RE = /\b(?:v)?\d+(?:\.\d+){1,3}\b/gi;
const PLAIN_NUMBER_RE = /\b\d[\d,]*(?:\.\d+)?\b/g;
const QUOTE_RE = /[""]([^""]{8,200})[""]|"([^"]{8,200})"/g;
const DATE_RE =
  /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/gi;

/**
 * Numbers that carry no factual weight on their own. Requiring these to appear
 * verbatim produces false quarantines (e.g. a summary saying "the first model"
 * when the source writes "1st").
 */
const TRIVIAL_NUMBERS = new Set(['1', '2', '3', '0', '100', '10']);

export interface GuardInput {
  title: string;
  summary: string;
  why_it_matters: string;
  /** Every excerpt the model was shown, plus source titles. */
  sourceTexts: string[];
  /** Entity surface forms the gazetteer matched in the source docs. */
  knownEntities: string[];
}

export type GuardViolationKind =
  | 'ungrounded_entity'
  | 'ungrounded_number'
  | 'ungrounded_date'
  | 'fabricated_quote';

export interface GuardViolation {
  kind: GuardViolationKind;
  value: string;
  field: 'title' | 'summary' | 'why_it_matters';
}

export interface GuardResult {
  passed: boolean;
  violations: GuardViolation[];
  /** Fraction of checked claims that were grounded. Tracked over time. */
  groundingRate: number;
}

/** Normalize for comparison: casefold, strip punctuation, collapse whitespace. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^a-z0-9$%.,'"\-\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Numbers match on digits alone, so "$4.5 billion" finds "4,500,000,000"-free text. */
function normNumber(s: string): string {
  return s.toLowerCase().replace(/[,\s]/g, '').replace(/^\$/, '');
}

function containsNumber(haystack: string, value: string): boolean {
  const v = normNumber(value);
  if (!v) return true;
  const bare = v.replace(/[^0-9.]/g, '');
  if (!bare) return true;
  // Match the digit core, so "$4.5 billion" is satisfied by "4.5bn" in source.
  return haystack.includes(bare);
}

/**
 * Entity check is morphology-tolerant: "OpenAI's" grounds against "OpenAI",
 * and multi-word names ground if every significant token appears.
 */
function entityGrounded(haystack: string, entity: string): boolean {
  const e = norm(entity).replace(/'s\b/g, '');
  if (!e) return true;
  if (haystack.includes(e)) return true;
  const tokens = e.split(' ').filter((t) => t.length > 2);
  return tokens.length > 0 && tokens.every((t) => haystack.includes(t));
}

/** Candidate entity mentions: capitalized runs and model-like identifiers. */
function extractEntityMentions(text: string): string[] {
  const out = new Set<string>();

  // Capitalized sequences, e.g. "OpenAI", "Mistral AI", "Sam Altman".
  // Sentence-initial position is skipped for single words: capitalization
  // there is grammar, not evidence of a proper noun. Multi-word runs and
  // internally-capitalized words (OpenAI, arXiv) are still caught anywhere.
  for (const m of text.matchAll(/\b[A-Z][A-Za-z0-9]*(?:\s+[A-Z][A-Za-z0-9]*)*\b/g)) {
    const v = m[0].trim();
    if (v.length < 3) continue;

    const at = m.index ?? 0;
    const before = text.slice(0, at).trimEnd();
    const sentenceInitial = at === 0 || /[.!?:]$/.test(before);
    const singleWord = !/\s/.test(v);
    const internallyCapped = /[a-z][A-Z]/.test(v) || /^[a-z]+[A-Z]/.test(v);

    if (sentenceInitial && singleWord && !internallyCapped) continue;
    out.add(v);
  }
  // Model identifiers: GPT-5, Claude 4.5, Llama-3.1, Gemini 2.
  for (const m of text.matchAll(
    /\b(?:GPT|Claude|Gemini|Llama|Mistral|Grok|Qwen|Phi|Command|Titan|Nova)[-\s]?\d+(?:\.\d+)?\b/gi,
  )) {
    out.add(m[0].trim());
  }
  return [...out];
}

/** Words that look like entities at sentence start but aren't. */
const ENTITY_STOPWORDS = new Set([
  'The', 'A', 'An', 'This', 'That', 'These', 'Those', 'It', 'Its', 'They',
  'According', 'Following', 'After', 'Before', 'During', 'While', 'Meanwhile',
  'However', 'Although', 'Because', 'Since', 'When', 'Where', 'What', 'Why',
  'New', 'Now', 'Both', 'Several', 'Multiple', 'Many', 'Some', 'One', 'Two',
  'Analysis', 'Reportedly', 'Sources', 'Industry', 'Company', 'Researchers',
  'If', 'In', 'On', 'At', 'For', 'To', 'By', 'With', 'From', 'As', 'But',
  // Sentence-initial nouns that routinely open a summary sentence. Without
  // these the guard quarantines valid copy — a false positive is nearly as
  // damaging as a miss, because it silently drops real signals.
  'Details', 'Terms', 'Neither', 'Reports', 'Security', 'Investors',
  'Release', 'Configuration', 'Model', 'Recent', 'Three', 'Each', 'Every',
  'People', 'Researcher', 'Users', 'Customers', 'Enterprise', 'Open',
  'Its', 'Their', 'His', 'Her', 'Our', 'Your', 'No', 'Not', 'Only', 'Also',
]);

export function runGuard(input: GuardInput): GuardResult {
  const haystack = norm(
    input.sourceTexts.join('\n') + '\n' + input.knownEntities.join('\n'),
  );
  const violations: GuardViolation[] = [];
  let checked = 0;

  const reportingFields: Array<['title' | 'summary', string]> = [
    ['title', input.title],
    ['summary', input.summary],
  ];

  for (const [field, text] of reportingFields) {
    if (!text) continue;

    for (const raw of extractEntityMentions(text)) {
      const first = raw.split(/\s+/)[0];
      if (ENTITY_STOPWORDS.has(first) && raw.split(/\s+/).length === 1) continue;
      checked++;
      if (!entityGrounded(haystack, raw)) {
        violations.push({ kind: 'ungrounded_entity', value: raw, field });
      }
    }

    // Money, percentages and versions are high-risk: a wrong figure is a
    // factual error even when the surrounding sentence is true.
    for (const re of [MONEY_RE, PERCENT_RE, VERSION_RE]) {
      for (const m of text.matchAll(re)) {
        checked++;
        if (!containsNumber(haystack, m[0])) {
          violations.push({ kind: 'ungrounded_number', value: m[0], field });
        }
      }
    }

    for (const m of text.matchAll(PLAIN_NUMBER_RE)) {
      const v = normNumber(m[0]);
      if (TRIVIAL_NUMBERS.has(v)) continue;
      checked++;
      if (!containsNumber(haystack, m[0])) {
        violations.push({ kind: 'ungrounded_number', value: m[0], field });
      }
    }

    for (const m of text.matchAll(DATE_RE)) {
      checked++;
      if (!haystack.includes(norm(m[0]))) {
        violations.push({ kind: 'ungrounded_date', value: m[0], field });
      }
    }
  }

  // Quotes are checked everywhere, analysis included. A fabricated quotation
  // is never acceptable, even inside commentary.
  const allFields: Array<['title' | 'summary' | 'why_it_matters', string]> = [
    ['title', input.title],
    ['summary', input.summary],
    ['why_it_matters', input.why_it_matters],
  ];
  for (const [field, text] of allFields) {
    if (!text) continue;
    for (const m of text.matchAll(QUOTE_RE)) {
      const quoted = (m[1] ?? m[2] ?? '').trim();
      if (quoted.length < 8) continue;
      checked++;
      if (!haystack.includes(norm(quoted))) {
        violations.push({ kind: 'fabricated_quote', value: quoted, field });
      }
    }
  }

  return {
    passed: violations.length === 0,
    violations,
    groundingRate: checked === 0 ? 1 : (checked - violations.length) / checked,
  };
}
