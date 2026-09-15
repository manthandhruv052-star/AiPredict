# Signal Index

Structured intelligence on what is actually happening in AI.

Not a news site. The pipeline ingests a large volume of public signals — research
papers, GitHub activity, company posts, security advisories, forum discussion,
journalism — and compresses them into deduplicated, corroborated,
confidence-scored **signals** across 14 categories.

The product claim is *collapse*: when fifty outlets report one rumor, this shows
one signal with fifty sources and a confidence score.

## Status

Phase 1 (frontend against seeded data) — the site builds and runs.
The ingestion pipeline is not wired up yet.

## Layout

    pipeline/
      schema.ts       the Signal contract — everything depends on this
      confidence.ts   deterministic scoring + rule-based status transitions
      guard.ts        the hallucination guard
      seed.ts         generates fixtures through the real trust pipeline
      test-trust.ts   adversarial tests for confidence + guard
    site/             Astro static site

## Running

    node --experimental-strip-types pipeline/test-trust.ts   # 22 assertions
    node --experimental-strip-types pipeline/seed.ts         # regenerate fixtures
    cd site && npx astro build

## Trust model

Confidence is 85% deterministic. Corroboration counts distinct publisher
*owners*, not article count, so syndication cannot inflate a score. A language
model's own judgment is capped at 15 of 100 points — a lone anonymous leak
cannot exceed the moderate band however plausible it sounds.

Every generated claim is checked against source text before publication. Any
entity, number, date, or quotation that does not appear in the sources fails the
signal into quarantine. Source excerpts are always verbatim.
