# ecoIA Precision and Credibility V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer une V2 locale et pédagogique qui permet de corriger le modèle de la conversation active, représente honnêtement le contexte visible, explique la qualité des données et affiche un diagnostic non sensible.

**Architecture:** Les adaptateurs distinguent les modèles réellement observés des libellés de repli et lisent, à la demande, le contexte antérieur visible le plus récent dans une limite stricte de 2 097 152 octets UTF-8. Le contrôleur convertit immédiatement toutes les chaînes en plages numériques, résout un profil embarqué selon un ordre déterministe, puis transmet au widget un modèle de vue déjà filtré. Le service worker continue de recevoir uniquement des événements numériques et aucun backend, appel réseau ou stockage de conversation n’est ajouté.

**Tech Stack:** TypeScript 7.0.2, WebExtensions Manifest V3, Web Component natif avec Shadow DOM, esbuild 0.28.1, Vitest 4.1.10, jsdom 29.1.1, Playwright 1.61.1 et Biome 2.5.4. Aucune dépendance JavaScript à l’exécution.

## Global Constraints

- Préserver les modifications V1.1 déjà présentes dans le worktree et ne jamais ajouter `.vscode/`.
- Ne jamais stocker, journaliser, hacher ou envoyer un prompt, une réponse, un extrait de contexte, une URL, un marqueur de conversation ou un identifiant d’onglet lisible.
- Ne demander aucune permission supplémentaire et ne créer aucune requête réseau, télémétrie, synchronisation ou dépendance runtime.
- Limiter toute sélection manuelle aux identifiants présents dans le registre validé et compatibles avec la plateforme active.
- Conserver le choix manuel uniquement dans la mémoire du content script et uniquement pour la conversation active.
- Lire le contexte antérieur au plus une fois par ancre utilisateur, effacer sa chaîne après conversion et ne mettre en cache que sa plage numérique.
- Conserver `low <= central <= high`, garder la valeur centrale fondée sur le prompt courant et ajouter le contexte uniquement à la borne haute.
- Construire le widget à partir de données numériques, d’énumérations fermées et de chaînes du registre validé; tout libellé de page est écrit avec `textContent`.
- Respecter WCAG 2.2 AA, `prefers-reduced-motion`, les thèmes clair et sombre, un maximum de deux rendus par seconde en streaming et une archive de moins de 153 600 octets par navigateur.
- Chaque tâche suit le cycle test rouge, implémentation minimale, test vert, inspection du diff et commit local ciblé. Aucun push, merge ou déploiement n’est autorisé par ce plan.

---

## Task 0: Preserve and record the verified V1.1 baseline

**Files:**

- Modify and commit only the currently changed V1.1 files reported by `git status --short`
- Include: `tests/e2e/extension-reload.spec.ts`
- Exclude: `docs/superpowers/plans/2026-07-19-ecoia-precision-credibility.md`
- Exclude: every `.vscode/` path

- [ ] Run `git status --short` and save the exact allowlist of current V1.1 files before touching feature code.
- [ ] Run `npm run verify`; expect PASS for formatting, lint, type checking, unit tests, browser builds and package size.
- [ ] Run `npm run e2e`; expect PASS for the extension-loaded Chromium suite, including extension reload recovery.
- [ ] Run `npm run audit`; expect PASS with no runtime dependency vulnerability because the package has no runtime dependencies.
- [ ] Inspect `git diff --check` and `git diff --stat`; expect no whitespace error and no unrelated path.
- [ ] Stage the exact V1.1 allowlist with explicit paths, verify it with `git diff --cached --name-only`, and commit with `feat: improve estimates and reload resilience`.

## Task 1: Distinguish observed models and resolve allowlisted profiles

**Files:**

- Create: `src/impact/model-selection.ts`
- Create: `tests/unit/model-selection.test.ts`
- Modify: `data/impact-profiles.json`
- Modify: `src/impact/profile-registry.ts`
- Modify: `src/adapters/adapter-contract.ts`
- Modify: `src/adapters/semantic-adapter.ts`
- Modify: `tests/adapters/adapter-test-helpers.ts`
- Modify: `tests/adapters/chatgpt-adapter.test.ts`
- Modify: `tests/adapters/claude-adapter.test.ts`
- Modify: `tests/adapters/gemini-adapter.test.ts`
- Modify: `tests/adapters/mistral-adapter.test.ts`
- Modify: `tests/adapters/perplexity-adapter.test.ts`
- Modify: `tests/unit/profile-registry.test.ts`

Public contracts:

```ts
export interface DetectedModel {
  label: string;
  observed: boolean;
}

export type ModelResolutionSource = "automatic" | "manual" | "generic";

export interface ModelProfileOption {
  id: string;
  label: string;
  isGeneric: boolean;
}

export interface ModelResolution {
  profileId: string;
  effectiveLabel: string;
  detectedLabel: string;
  source: ModelResolutionSource;
  modelObserved: boolean;
}

export function getModelProfileOptions(platform: PlatformId): ModelProfileOption[];

export function resolveModelProfile(input: {
  platform: PlatformId;
  detected: DetectedModel;
  manualProfileId: string | null;
}): ModelResolution;
```

- [ ] Write failing tests proving that an actual model element returns `{ label: "GPT-4o", observed: true }` while missing markup returns the existing platform fallback label with `observed: false`.
- [ ] Write failing tests proving that `getModelProfileOptions("chatgpt")` contains only ChatGPT-compatible profiles, contains the platform generic profile marked `isGeneric: true`, omits the cross-platform internal profile `generic-assistant-v1`, and never returns duplicate IDs.
- [ ] Write failing resolution tests for the exact precedence: compatible manual profile, recognized observed label, then platform fallback. Add rejection cases for unknown IDs and profiles belonging to another platform.
- [ ] Write a failing registry test proving every platform fallback has grade D for electricity, water and carbon. Gemini must use a new `google-generic-v1` proxy profile rather than the grade-A Gemini Apps prompt median when no model is observed.
- [ ] Run `npm test -- tests/unit/model-selection.test.ts tests/adapters`; expect failures caused by the missing module and missing `observed` property.
- [ ] Add `matchImpactProfileId(platform, modelLabel): string | null` to `profile-registry.ts`. Keep `resolveImpactProfileId` backward compatible by returning the match or the existing platform fallback.
- [ ] Add `google-generic-v1` as a Gemini-compatible model-proxy profile whose three indicators resolve to the grade-D generic assistant profile, then make it the Gemini platform fallback. Keep the documented Gemini Apps median available as a specific manual or observed option.
- [ ] Implement `getModelProfileOptions` from the validated bundled registry. Include platform-specific documented profiles and the platform fallback, sort specific profiles before the generic profile, and derive every label from `displayName`.
- [ ] Implement `resolveModelProfile` without accepting free text. A manual ID wins only when it is present in the current option list; an observed direct match is `automatic`; every fallback is `generic`.
- [ ] Update `createSemanticAdapter.detectModel` so only a non-empty matching DOM node sets `observed: true`; default labels remain visible but are explicitly marked unobserved.
- [ ] Run `npm test -- tests/unit/model-selection.test.ts tests/adapters`; expect PASS.
- [ ] Run `npm run typecheck` and `npm run lint`; expect PASS.
- [ ] Inspect the diff and commit with `feat: resolve documented model profiles`.

## Task 2: Read the most recent visible context within a strict byte budget

**Files:**

- Create: `src/adapters/visible-context.ts`
- Create: `tests/unit/visible-context.test.ts`
- Modify: `src/adapters/adapter-contract.ts`
- Modify: `src/adapters/semantic-adapter.ts`
- Modify: `tests/adapters/adapter-test-helpers.ts`
- Modify: `tests/unit/content-controller.test.ts`

Adapter boundary:

```ts
export type ContextCoverage = "complete" | "partial";

export interface VisibleContextSnapshot {
  text: string;
  coverage: ContextCoverage;
}

export interface PlatformAdapter {
  readonly platform: PlatformId;
  detectModel(root: ParentNode): DetectedModel;
  findConversationRoot(document: Document): HTMLElement | null;
  readLatestTurn(root: HTMLElement): VisibleTurnSnapshot | null;
  readVisibleContext(root: HTMLElement, turnElement: Element): VisibleContextSnapshot;
  getConversationMarker(document: Document): string | null;
  subscribe(root: HTMLElement, listener: () => void): () => void;
}
```

- [ ] Write failing pure tests for `selectRecentUtf8Context`: empty input, preserved reading order, newest fragments retained first, exact UTF-8 byte limit, multibyte characters, separator bytes, and a latest fragment larger than the entire budget.
- [ ] Assert that a truncated result uses a valid Unicode suffix, never exceeds `tokenCalibration.maximumUtf8Bytes`, and reports `coverage: "partial"`.
- [ ] Extend the adapter contract tests with two completed prior turns and assert that only user and assistant text before the current user anchor is returned. Assert that excluded controls and the current prompt/response are absent.
- [ ] Run `npm test -- tests/unit/visible-context.test.ts tests/adapters`; expect failures because the reader is absent.
- [ ] Implement a deterministic UTF-8 suffix helper using `TextEncoder`, binary search on code-point boundaries and a caller-provided byte budget. Never split a surrogate pair or emit invalid UTF-8.
- [ ] Implement `selectRecentUtf8Context(fragments, maximumUtf8Bytes)` by walking non-empty fragments from newest to oldest, accounting for one ASCII space between fragments, then restoring the selected fragments to reading order.
- [ ] Implement `readVisibleContext` in the semantic adapter by merging visible user and assistant elements before `turnElement`, deduplicating and sorting them with the same scoped DOM helpers already used by `readLatestTurn`.
- [ ] Use the existing validated limit `tokenCalibration.maximumUtf8Bytes`; do not introduce a second magic constant.
- [ ] Update all fake adapters with an explicit empty context result so TypeScript makes future privacy-sensitive readers visible in tests.
- [ ] Run `npm test -- tests/unit/visible-context.test.ts tests/adapters tests/unit/content-controller.test.ts`; expect PASS.
- [ ] Run `npm run typecheck` and `npm run lint`; expect PASS.
- [ ] Inspect the diff and commit with `feat: bound visible conversation context`.

## Task 3: Build the input envelope and transparent data-quality disclosure

**Files:**

- Create: `src/token/context-envelope.ts`
- Create: `tests/unit/context-envelope.test.ts`
- Create: `src/impact/impact-disclosure.ts`
- Create: `tests/unit/impact-disclosure.test.ts`

Numeric and disclosure contracts:

```ts
export interface ContextTokenEstimate {
  tokens: EstimateRange;
  coverage: "none" | ContextCoverage;
  hasContext: boolean;
}

export function createInputEnvelope(
  prompt: EstimateRange,
  context: ContextTokenEstimate,
): EstimateRange;

export interface IndicatorQualityDisclosure {
  key: "energy" | "water" | "carbon";
  label: string;
  grade: ConfidenceGrade;
  explanation: string;
  sourceId: string;
}

export interface DisclosureSource {
  id: string;
  title: string;
  url: string;
  publicationDate: string;
  scope: string;
  primaryLimitation: string;
}

export interface DataQualityDisclosure {
  overallGrade: ConfidenceGrade;
  overallLabel: string;
  overallExplanation: string;
  indicators: IndicatorQualityDisclosure[];
  sources: DisclosureSource[];
  limitations: string[];
}

export function buildImpactDisclosure(impact: ImpactEstimate): DataQualityDisclosure;
```

- [ ] Write failing envelope tests proving that absent context returns the prompt unchanged, present context leaves `low` and `central` unchanged, adds only `context.tokens.high` to `high`, and preserves range invariants for zero and large values.
- [ ] Write failing disclosure tests for the ordered grade severity `A < B < C < D`, the exact four plain-language explanations from the approved design, per-indicator grades, unique sources, publication date, scope, first limitation and profile limitations.
- [ ] Add a mixed-provenance Mistral test proving that water and carbon can remain A while energy and the overall grade are D.
- [ ] Run `npm test -- tests/unit/context-envelope.test.ts tests/unit/impact-disclosure.test.ts`; expect module-not-found failures.
- [ ] Implement `createInputEnvelope` with `createRange(prompt.low, prompt.central, prompt.high + context.tokens.high)` when context exists and finite safe arithmetic validation before range creation.
- [ ] Implement disclosure construction from `ImpactEstimate`, `getImpactProfile` and the validated `impactRegistry`. Deduplicate sources by ID, preserve the indicator order electricity, water, carbon, and return no page-derived value.
- [ ] Use these exact grade meanings in French: A provider-documented comparable data; B published data with limited adaptation; C modeled estimate from published data; D generic proxy with high uncertainty.
- [ ] Bound profile limitations presented to the unique non-empty validated strings already in the selected profile; do not load remote content.
- [ ] Run `npm test -- tests/unit/context-envelope.test.ts tests/unit/impact-disclosure.test.ts`; expect PASS.
- [ ] Run `npm run typecheck` and `npm run lint`; expect PASS.
- [ ] Inspect the diff and commit with `feat: explain uncertainty and context bounds`.

## Task 4: Add a compact pedagogical control surface to the widget

**Atomic execution note:** Task 4 and Task 5 change the same required `WidgetViewModel` contract.
They must be implemented, tested and reviewed by one fresh implementer as a single atomic task. A
standalone Task 4 commit would either fail type checking or expose an interactive model selector
without a working conversation-scoped callback. The combined commit must satisfy both task briefs;
do not create an intermediate production commit between their RED/GREEN cycles.

**Files:**

- Modify: `src/widget/eco-widget.ts`
- Modify: `src/widget/widget-controller.ts`
- Modify: `src/widget/widget-template.ts`
- Modify: `src/widget/widget-styles.ts`
- Modify: `src/widget/format-impact.ts`
- Modify: `tests/unit/widget.test.ts`
- Modify: `tests/unit/format-impact.test.ts`

View-model boundary:

```ts
export type ContextDiagnosticState = "absent" | "complete" | "partial";
export type ResponseDiagnosticState = "waiting" | "streaming" | "complete" | "interrupted";

export interface WidgetViewModel {
  platform: PlatformId;
  state: WidgetMeasurementState;
  modelControl: {
    detectedLabel: string;
    effectiveLabel: string;
    resolution: ModelResolutionSource;
    selectedProfileId: string | null;
    options: ModelProfileOption[];
    warning: string | null;
    selectionError: string | null;
  };
  context: ContextTokenEstimate;
  disclosure: DataQualityDisclosure | null;
  diagnostic: {
    platform: "recognized" | "unsupported";
    conversation: "detected" | "paused";
    model: ModelResolutionSource;
    context: ContextDiagnosticState;
    response: ResponseDiagnosticState;
  };
  current: {
    tokens: VisibleTokenEstimate;
    impact: ImpactEstimate | null;
  };
  session: NumericAggregate | null;
  day: NumericAggregate | null;
}

export interface WidgetConfiguration {
  preferences?: Partial<WidgetPreferences>;
  onPreferencesChange?: (preferences: WidgetPreferences) => void;
  onModelSelectionChange?: (profileId: string | null) => void;
}
```

- [ ] Replace the unit-test fixture with the complete view model above, then write failing tests for the always-present model selector in `Méthode et détails`, automatic option, compatible profile options and selected manual value.
- [ ] Write failing tests for the missing-model alert. Assert that `Choisir le modèle` opens the details element and focuses the selector, while an observed model produces no alert.
- [ ] Write failing tests proving that model/profile labels containing HTML are rendered as text, an injected option ID not present in the supplied allowlist is never emitted, and a valid change emits only its profile ID or `null` for automatic mode.
- [ ] Write failing tests for `contexte visible : jusqu’à ≈ N tokens supplémentaires`, the partial-context explanation, overall data quality, three indicator grades, unique source cards, limitations and the five diagnostic rows.
- [ ] Write failing accessibility tests for native labels, keyboard focus order, `aria-live` selection errors, visible `:focus-visible`, non-color-only warnings, light/dark contrast tokens and reduced motion.
- [ ] Run `npm test -- tests/unit/widget.test.ts tests/unit/format-impact.test.ts`; expect failures for the missing elements and model fields.
- [ ] Extend `createWidgetTemplate` with a compact warning region, a labeled native `<select>`, context explanation, data-quality block, source list and diagnostic list inside the existing details section. Use semantic `button`, `label`, `select`, `details`, `summary`, `ul` and `a` elements.
- [ ] Keep the main panel at 232 px and progressive disclosure inside the existing scrollable area. Avoid animation libraries, icons from packages, remote fonts, graphs and decorative cards.
- [ ] Move all registry lookups out of `eco-widget.ts`; render only the supplied `DataQualityDisclosure` and keep every external source link hidden until disclosure data exists.
- [ ] Update `WidgetController` so the warning action opens details and focuses the select, and so the select callback validates against an internal `Set` derived from the latest supplied `modelControl.options`, never against mutable option elements in the DOM.
- [ ] Preserve the 525 ms streaming render interval and update option nodes only when their platform/profile signature changes.
- [ ] Run `npm test -- tests/unit/widget.test.ts tests/unit/format-impact.test.ts`; expect PASS.
- [ ] Run `npm run typecheck`, `npm run lint` and `npm run build`; expect PASS and no runtime dependency.
- [ ] Inspect the diff and commit with `feat: add pedagogical precision controls`.

## Task 5: Integrate conversation-scoped model choice and numeric context caching

**Execution note:** This is the integration half of the atomic Task 4 + Task 5 change. It is not
dispatched to a second implementer after Task 4; both halves share one implementation report, one
review package and one task-quality gate.

**Files:**

- Modify: `src/content/content-controller.ts`
- Modify: `tests/unit/content-controller.test.ts`
- Modify: `tests/unit/aggregate-store.test.ts`
- Modify: `tests/unit/service-worker.test.ts`

Controller state:

```ts
private manualProfileId: string | null = null;
private contextEstimates = new WeakMap<Element, ContextTokenEstimate>();
private selectionError: string | null = null;
```

- [ ] Update `FakeAdapter` so every `readLatestTurn` call returns fresh prompt and response strings, `detectModel` exposes an `observed` flag, and `readVisibleContext` counts calls and returns a mutable snapshot whose text can be checked after conversion.
- [ ] Write a failing test proving that an observed GPT-4o resolves automatically with no warning and that an unobserved default label uses `openai-generic-v1` with the approved warning.
- [ ] Write a failing test that captures `onModelSelectionChange`, selects `openai-gpt-4-1-v1`, and proves the second numeric event reuses the same `eventId`, increments `sequence`, changes `modelProfileId` and leaves aggregate `interactionCount` equal to one.
- [ ] Write failing tests that reject an incompatible or unknown profile, preserve the previous valid measurement, and expose the bounded accessible `selectionError` without reflecting the rejected ID.
- [ ] Write a failing lifecycle test proving that the manual profile and context cache reset before processing a changed SPA marker, and that no model selection is written to either storage area.
- [ ] Write a failing privacy test proving `readVisibleContext` is called once for repeated streaming refreshes of one anchor, its returned string is emptied, only its numeric range is cached, and no context text or marker occurs in `JSON.stringify(messages)`.
- [ ] Write a failing numeric test proving input central equals the current prompt central, input high increases by context high, and the impact estimate receives the same envelope.
- [ ] Write failing diagnostic tests for waiting, streaming, complete, interrupted, paused, automatic, manual, generic, absent, complete and partial states. Assert serialized diagnostics contain no page text, URL, conversation marker, tab session ID or timestamp.
- [ ] Run `npm test -- tests/unit/content-controller.test.ts tests/unit/aggregate-store.test.ts tests/unit/service-worker.test.ts`; expect failures until integration is complete.
- [ ] Configure the widget callback in `start()`. Validate every requested profile through `getModelProfileOptions` before assigning `manualProfileId`; an invalid request leaves state unchanged and performs no service-worker send.
- [ ] Resolve the model on every refresh with `resolveModelProfile`. Build the warning only when the model is unobserved and the effective resolution is generic.
- [ ] On the first snapshot for an anchor, call `readVisibleContext`, estimate it with the platform tokenizer family, clear `contextSnapshot.text` in a `finally` block, and cache only `ContextTokenEstimate` in the `WeakMap`.
- [ ] Clear prompt, response and context strings in success and error paths. Never attach any of those strings to `WidgetViewModel`, extension messages, exceptions or diagnostics.
- [ ] Build the input envelope before `estimateImpact`, build its disclosure once per rendered impact, and keep the existing event replacement mechanism so manual recalculation does not create an interaction.
- [ ] Reset `manualProfileId`, `selectionError` and `contextEstimates` inside `resetConversation` before the next snapshot is processed. Page reload and tab close reset them naturally because they are fields of the content-script instance.
- [ ] Preserve the existing fail-closed behavior for invalidated extension APIs and unrecognized DOM.
- [ ] Run `npm test -- tests/unit/content-controller.test.ts tests/unit/aggregate-store.test.ts tests/unit/service-worker.test.ts`; expect PASS.
- [ ] Run `npm run typecheck` and `npm run lint`; expect PASS.
- [ ] Inspect messages in the tests, inspect the diff and commit with `feat: scope precision controls to active conversation`.

## Task 6: Add source-freshness enforcement and beginner-facing documentation

**Files:**

- Create: `scripts/check-source-freshness.mjs`
- Create: `tests/unit/source-freshness.test.ts`
- Modify: `package.json`
- Modify: `tests/unit/build-config.test.ts`
- Modify: `README.md`
- Modify: `METHODOLOGY.md`
- Modify: `PRIVACY.md`
- Modify: `docs/adding-an-impact-profile.md`

Freshness boundary:

```js
export function findStaleSources(sources, reviewedAt, maximumAgeDays = 366) {
  return sources
    .filter((source) => reviewedAt.valueOf() - new Date(`${source.accessedDate}T00:00:00Z`).valueOf() > maximumAgeDays * 86_400_000)
    .map((source) => source.id)
    .sort();
}
```

- [ ] Write failing tests for a fresh source, the exact 366-day boundary, a stale source, invalid dates and deterministic sorted IDs.
- [ ] Update the build-configuration test to require a `source-freshness` script and require `verify` to execute it.
- [ ] Run `npm test -- tests/unit/source-freshness.test.ts tests/unit/build-config.test.ts`; expect failures for the absent script.
- [ ] Implement the exported pure function and a CLI entry point that reads only the bundled registry, prints stale source IDs, exits non-zero when review is required, and never modifies coefficients automatically.
- [ ] Add `"source-freshness": "node scripts/check-source-freshness.mjs"` and execute it inside `verify` before the build.
- [ ] Update the README usage section with a beginner sequence: automatic measurement, meaning of `≈`, meaning of the written range, choosing a model, interpreting context, reading grades and using diagnostics. Explicitly say the manual choice disappears on navigation or reload.
- [ ] Update METHODOLOGY with the approved A-to-D wording, the context-envelope formula, source-review policy and the distinction between visible context and actual provider context.
- [ ] Update PRIVACY with one-time prior-context conversion, memory-only manual selection and the exact diagnostic allowlist. Keep the storage section explicit that model selection is not persisted.
- [ ] Update the contributor guide so a new profile must be platform-compatible, sourced, dated, limited and covered by model-option and freshness tests.
- [ ] Run `npm test -- tests/unit/source-freshness.test.ts tests/unit/build-config.test.ts`; expect PASS.
- [ ] Run `npm run source-freshness`, `npm run secrets` and `npm run format:check`; expect PASS.
- [ ] Inspect the diff and commit with `docs: explain precision and source freshness`.

## Task 7: Verify the real browser journeys and privacy boundaries

**Files:**

- Modify: `tests/fixtures/e2e/host.html`
- Create: `tests/e2e/precision-controls.spec.ts`
- Modify: `tests/e2e/widget.spec.ts`
- Modify: `tests/e2e/aggregation.spec.ts`
- Modify: `tests/e2e/network-zero.spec.ts`
- Modify: `tests/e2e/accessibility.spec.ts`
- Modify: `tests/e2e/performance.spec.ts`

- [ ] Extend the local ChatGPT fixture with two synthetic prior turns and a model-observed variant. Keep all fixture content invented and non-personal.
- [ ] Write a failing browser test for automatic GPT-4o resolution with no alert and another for missing model markup with the generic warning.
- [ ] Write a failing browser test that opens `Méthode et détails`, verifies the compatible allowlisted choices, selects GPT-4.1 and observes a changed effective profile without a second interaction.
- [ ] Write a failing browser lifecycle test proving the manual selection returns to automatic after a synthetic SPA conversation-marker change and after page reload.
- [ ] Write a failing context test proving the visible context line appears, the central prompt value is unchanged relative to a no-context fixture, the upper bound grows, and partial context is named when the byte cap is exercised in a unit test rather than by placing 2 MiB in the browser fixture.
- [ ] Extend accessibility coverage to tab through warning, details, select, sources and diagnostics in light and dark themes; verify accessible names, focus visibility and no horizontal overflow at 320 px.
- [ ] Extend privacy/network coverage to assert zero extension-initiated HTTP(S), WebSocket or remote resource requests, and inspect local/session storage for the absence of fixture text, model selection and conversation markers.
- [ ] Keep the performance assertion at no more than two visible renders per second during streaming and verify context reading does not repeat for one interaction through the unit instrumentation from Task 5.
- [ ] Run `npm run e2e`; expect PASS for every extension-loaded Chromium journey.
- [ ] Inspect Playwright console and network failures; fix any observed issue at its source, rerun the targeted spec, then rerun `npm run e2e`.
- [ ] Inspect the diff and commit with `test: cover precision and credibility journeys`.

## Task 8: Complete release-level verification and handoff

**Files:**

- Modify only if verification finds a defect: the smallest source or test file responsible
- Verify generated, untracked output: `dist/chromium`
- Verify generated, untracked output: `dist/firefox`
- Verify generated, untracked output: `dist/packages/ecoia-chromium.zip`
- Verify generated, untracked output: `dist/packages/ecoia-firefox.zip`

- [ ] Run `npm run format:check`; expect PASS.
- [ ] Run `npm run lint`; expect PASS.
- [ ] Run `npm run typecheck`; expect PASS.
- [ ] Run `npm test`; expect PASS and report the exact test count.
- [ ] Run `npm run verify`; expect PASS, including source freshness, Chromium and Firefox builds, and both package-size checks below 153 600 bytes.
- [ ] Run `npm run e2e`; expect PASS and report the exact browser-test count.
- [ ] Run `npm run audit`; expect PASS and report the actual npm result.
- [ ] Run `npm run secrets`; expect PASS and report the number of files considered.
- [ ] Run `git diff --check`; expect PASS.
- [ ] Run `git status --short`, `git diff --stat` and `git log --oneline -10`; confirm no `.vscode/`, generated `dist/`, prompt fixture leak or unrelated user file is staged.
- [ ] Inspect both manifests and archives to confirm unchanged permissions, no remote URL outside explicit source-link data, no runtime dependency and both browser artifacts present.
- [ ] Manually load `dist/chromium` in Chrome when browser control is available; verify model choice, warning, context line, source opening, diagnostic, light/dark mode, drag and collapse. If browser control is unavailable, report this check as NOT RUN rather than inferring success from Playwright.
- [ ] Produce a final French handoff with the local install path, beginner reload instructions, the implemented pedagogical behavior, PASS/FAIL/NOT RUN verification labels and any remaining limitation. Do not push, publish a GitHub release, merge or deploy.
