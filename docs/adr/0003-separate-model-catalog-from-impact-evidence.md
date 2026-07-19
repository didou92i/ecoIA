# ADR 0003 — Separate current model catalog from impact evidence

- Status: Accepted
- Date: 2026-07-19

## Context

Assistant products rename, add and retire model choices faster than environmental studies publish
model-specific measurements. Treating a current product label as an impact source would make the
interface look up to date while silently assigning coefficients measured for a different model.

For ChatGPT, the sources reviewed on 2026-07-19 document GPT-5.6 Sol, GPT-5.6 Sol Pro, GPT-5.5
Instant, GPT-5.4 Thinking, GPT-5.3 Instant and o3. Those pages document product availability and
names only; they do not publish model-specific electricity, water or carbon coefficients. Some
entries already have an announced end or retirement date earlier than the global review window.

## Options considered

- Keep product names inside the impact-profile registry: rejected because catalog maintenance could
  be mistaken for new environmental evidence.
- Hide every current model without primary impact data: rejected because exact recognition still
  improves diagnosis and manual correction.
- Maintain separate registries joined by an explicit profile identifier: selected because it keeps
  the user-facing catalog current without weakening evidence requirements.

## Decision

`data/model-catalog.json` is the closed catalog of current product labels and exact observed aliases.
`data/impact-profiles.json` remains the independent registry of dated environmental coefficients.
Every catalog choice must reference a compatible impact profile; a catalog source can never supply
an environmental coefficient.

The current ChatGPT choices map to `openai-generic-v1`. This profile is a widened proxy based on the
dated GPT-4o line from *How Hungry is AI?* and has grade D for electricity, water and carbon. The UI
must identify it as a proxy and explain the missing model-specific evidence. GPT-4o and GPT-4.1
remain scientific source profiles, but are not presented as current ChatGPT product choices.

Catalog sources are listed in `data/source-inventory.json` under `domains.modelCatalog`. Their
freshness limit is 90 days, compared with 366 days for stable impact, equivalence and token sources.
An entry with an earlier `reviewBy` deadline is removed from current choices at that boundary and
fails the freshness gate until reviewed. Catalog updates do not change the methodology version
unless coefficients, calculations or impact scope change.

## Consequences

- Product-name detection can be updated independently without inventing model-specific precision.
- Users can distinguish “model recognized” from “environmental impact measured”.
- Current choices may share the same grade-D estimate until primary evidence becomes available.
- Tests must validate closed aliases, compatible profile targets, grade D for proxy targets, source
  linkage, the 90-day freshness rule and any earlier per-choice review deadline.
- Maintaining two registries adds a small review step but makes their different evidence claims
  explicit and auditable.

## Revisit conditions

Revisit a mapping when a primary source publishes model-specific environmental coefficients with a
clear date, scope, units and reproducible method. Revisit the 90-day catalog window if observed
product churn or maintenance burden provides evidence for a different interval.
