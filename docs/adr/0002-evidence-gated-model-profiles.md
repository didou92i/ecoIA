# ADR 0002 — Evidence-gated model profiles

- Status: Accepted
- Date: 2026-07-19

## Context

The model label exposed by an assistant UI is untrusted and can contain provider prefixes, dates,
deployment suffixes, product editions or runtime modes. A substring match can therefore apply a
published coefficient to a different model. That creates false precision in environmental figures
whose evidence already has material uncertainty.

Examples include Gemini Apps versus Gemini 2.5 Pro, plain Claude 3.7 Sonnet versus Claude 3.7
Sonnet ET, and dated Claude 3.5 releases. The primary sources do not establish that those variants
have interchangeable operational impacts.

## Decision

A model-specific profile is evidence-gated to the exact model variant named by its primary source.
Each profile declares structured aliases and optional provider prefixes. Resolution normalizes the
label, then accepts only:

1. an exact alias; or
2. one approved provider prefix followed by an exact alias.

Substring, suffix and fuzzy matching are prohibited. A detected label that does not meet the rule
fails closed to the generic profile and displays that no documented profile exists for the model.
Manual model choices use a closed, reviewed product catalog and cannot introduce an arbitrary
label. Every catalog entry must still resolve to an evidence-gated impact profile; recognizing a
current product name does not create model-specific environmental evidence. The separation between
the volatile catalog and dated impact profiles is defined in
[ADR 0003](0003-separate-model-catalog-from-impact-evidence.md).

The v6 *How Hungry is AI?* table supports exact profiles for GPT-4o, GPT-4.1, Claude 3.7 Sonnet,
Claude 3.5 Sonnet and Claude 3.5 Haiku. It does not support Claude 3.7 Sonnet ET, dated or suffixed
Claude variants. Google's product-level median supports Gemini Apps, not Gemini 2.5 Pro or Gemini
2.5 Flash. Those unsupported variants therefore use the generic profile.

## Alternatives considered

- Substring matching: rejected because a nearby name is not evidence of the same model or runtime.
- Provider-family inheritance: rejected because model generations and serving modes can differ
  materially.
- Blocking all estimates for unknown labels: rejected because a broad, explicitly disclosed generic
  estimate remains useful and does not claim model specificity.

## Consequences

- Newly released or renamed variants remain generic until a primary source and exact alias are
  reviewed.
- Tests must cover accepted aliases, provider-prefixed aliases, and plausible dated, suffixed or
  Extended Thinking variants that must fail closed.
- The interface may show a lower-confidence generic estimate more often; this is the intended
  security and scientific-integrity trade-off.
- Adding a profile requires updating the source inventory, methodology, registry tests and model
  selection tests.

## Revisit conditions

Revisit only if a primary source publishes a mapping or measurements that explicitly cover several
model labels or runtime variants. Any broader matcher must remain deterministic, auditable and
covered by negative tests.
