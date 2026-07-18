# ecoIA Browser Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer une extension navigateur locale, open source et installable qui estime en temps réel les tokens visibles et leur impact en eau, électricité et carbone sur ChatGPT, Claude, Gemini, Mistral Le Chat et Perplexity.

**Architecture:** Des content scripts spécifiques à chaque plateforme observent uniquement la conversation active, transforment immédiatement le texte visible en métriques numériques, puis envoient ces métriques à un service worker Manifest V3. Le service worker valide, déduplique et agrège les valeurs de session et du jour. Un widget Web Component isolé par Shadow DOM affiche les résultats, sans framework d’interface ni appel réseau.

**Tech Stack:** TypeScript 7.0.2, esbuild 0.28.1, Vitest 4.1.10, jsdom 29.1.1, Playwright 1.61.1, Biome 2.5.4, WebExtensions Manifest V3, HTML et CSS natifs. Node.js 22 ou supérieur et npm 10.9.3. Aucune dépendance JavaScript à l’exécution.

## Global Constraints

- Le texte d’un prompt ou d’une réponse ne doit jamais être stocké, journalisé, haché ou envoyé dans un message d’extension.
- L’extension ne doit appeler aucun service distant. Toute ouverture d’une source externe exige un clic utilisateur explicite.
- Les permissions hôtes doivent être limitées aux domaines officiels des cinq plateformes.
- Toutes les données provenant de la page et tous les messages doivent être validés et bornés.
- Les calculs doivent transporter une fourchette `low`, `central`, `high` et un niveau de confiance, jamais une fausse valeur exacte.
- Le widget doit fonctionner au clavier, respecter `prefers-reduced-motion` et atteindre WCAG 2.2 AA.
- Les archives distribuées Chrome/Edge et Firefox doivent rester sous 150 Ko compressés, icônes incluses.
- `.vscode/` appartient à l’environnement local et ne doit jamais être ajouté au dépôt.
- Chaque tâche suit le cycle test rouge, implémentation minimale, test vert, inspection du diff et commit local.

---

## Task 1: Bootstrap the dependency-free runtime and deterministic build

**Files:**

- Create: `package.json`
- Create: `package-lock.json`
- Create: `tsconfig.json`
- Create: `biome.json`
- Create: `vitest.config.ts`
- Create: `scripts/build.mjs`
- Create: `scripts/create-zip.mjs`
- Create: `scripts/generate-icons.mjs`
- Create: `scripts/check-size.mjs`
- Create: `tests/unit/build-config.test.ts`

- [ ] Add the minimal `package.json` required to install the test runner, with exact development versions: `@biomejs/biome@2.5.4`, `@playwright/test@1.61.1`, `@types/chrome@0.2.2`, `esbuild@0.28.1`, `jsdom@29.1.1`, `typescript@7.0.2`, `vitest@4.1.10`. Keep runtime `dependencies` absent; run `npm install` to create the lockfile.
- [ ] Write a failing test that imports `package.json` and asserts: no `dependencies`, exact pinned `devDependencies`, Node engine `>=22`, package manager `npm@10.9.3`, and scripts for format, lint, typecheck, test, build, e2e, audit and verify.
- [ ] Run `npm test -- tests/unit/build-config.test.ts`; expect failure because the complete script/config contract is not implemented.
- [ ] Complete the package metadata and script contract without changing the pinned dependency set.
- [ ] Configure strict TypeScript with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, DOM and WebWorker libraries, and separate type-check entry points when page and worker globals conflict.
- [ ] Configure Biome for two-space indentation, 100-character lines, import organization and safe recommended lint rules.
- [ ] Implement a deterministic esbuild pipeline that emits `dist/chromium` and `dist/firefox`, copies only allowlisted static files, generates PNG icons, and creates store archives with an in-repository ZIP writer using stored entries and CRC32. A separate `dist/chromium-e2e` target may add only the local fixture origin and is never archived.
- [ ] Implement `check-size.mjs` to fail when either archive exceeds `153600` bytes and print both exact byte sizes.
- [ ] Run `npm test -- tests/unit/build-config.test.ts`, `npm run typecheck`, and `npm run build`; expect PASS.
- [ ] Commit with `chore: bootstrap lightweight extension toolchain`.

## Task 2: Define trusted contracts and browser API boundaries

**Files:**

- Create: `src/shared/range.ts`
- Create: `src/shared/contracts.ts`
- Create: `src/shared/validation.ts`
- Create: `src/browser/browser-api.ts`
- Create: `tests/unit/range.test.ts`
- Create: `tests/unit/validation.test.ts`
- Create: `tests/unit/browser-api.test.ts`

Core contracts:

```ts
export interface EstimateRange {
  low: number;
  central: number;
  high: number;
}

export interface VisibleTokenEstimate {
  input: EstimateRange;
  output: EstimateRange;
  source: "estimated" | "observed";
}

export interface NumericInteractionEvent {
  version: 1;
  eventId: string;
  tabSessionId: string;
  sequence: number;
  platform: PlatformId;
  modelProfileId: string;
  phase: "streaming" | "completed" | "interrupted";
  tokens: VisibleTokenEstimate;
  generatedAt: number;
}
```

- [ ] Write failing tests for range ordering, finite values, maximum token count `10_000_000`, identifier length `128`, enum allowlists, unknown keys, and malformed nested messages.
- [ ] Assert that a payload containing `prompt`, `response`, `text`, `url`, `conversationId`, or an unknown property is rejected.
- [ ] Run the targeted tests; expect module-not-found failures.
- [ ] Implement range math with `addRanges`, `scaleRange`, `clampRange` and invariant checks `0 <= low <= central <= high`.
- [ ] Implement manual schema validation without a runtime library. Return a discriminated result with a stable, non-sensitive error code; never include rejected values in errors.
- [ ] Wrap `runtime.sendMessage`, `storage.local`, `storage.session` and `runtime.onMessage` behind a typed promise API that supports both `chrome` and `browser` globals.
- [ ] Run `npm test -- tests/unit/range.test.ts tests/unit/validation.test.ts tests/unit/browser-api.test.ts`; expect PASS.
- [ ] Commit with `feat: add validated extension contracts`.

## Task 3: Build and calibrate the local visible-token estimator

**Files:**

- Create: `data/token-calibration.json`
- Create: `src/token/text-features.ts`
- Create: `src/token/token-estimator.ts`
- Create: `src/token/calibration.ts`
- Create: `tests/fixtures/tokens/latin.json`
- Create: `tests/fixtures/tokens/code.json`
- Create: `tests/fixtures/tokens/multilingual.json`
- Create: `tests/unit/token-estimator.test.ts`
- Create: `docs/token-calibration.md`

Estimator boundary:

```ts
export type TokenizerFamily = "openai" | "claude" | "gemini" | "mistral" | "generic";

export function estimateVisibleTokens(
  text: string,
  family: TokenizerFamily,
): EstimateRange;
```

- [ ] Create synthetic, non-personal fixtures containing French/English prose, source code, CJK, Arabic, emoji and empty/whitespace cases. Store only expected token-count ranges obtained from official counters during offline calibration; document tool, version and access date.
- [ ] Write failing tests for empty input, prose, code, multilingual text, monotonicity, deterministic output, a 2 MiB input rejection and coverage of every tokenizer family.
- [ ] Implement a single bounded pass over at most 2 MiB of text, counting Unicode code points, word segments, whitespace, punctuation, line breaks and code markers. Do not retain substrings after return.
- [ ] Load a small versioned JSON coefficient table. Compute the central estimate from features and derive low/high from the recorded calibration error, with a minimum uncertainty floor of 10%.
- [ ] Ensure no tokenizer package is shipped in the runtime bundle and no network request is used for calibration or estimation.
- [ ] Run `npm test -- tests/unit/token-estimator.test.ts`; expect PASS.
- [ ] Commit with `feat: estimate visible tokens locally`.

## Task 4: Implement the sourced environmental-impact registry and engine

**Files:**

- Create: `data/impact-profiles.json`
- Create: `src/impact/profile-types.ts`
- Create: `src/impact/profile-registry.ts`
- Create: `src/impact/impact-engine.ts`
- Create: `src/impact/equivalences.ts`
- Create: `tests/unit/profile-registry.test.ts`
- Create: `tests/unit/impact-engine.test.ts`
- Create: `tests/unit/equivalences.test.ts`
- Create: `METHODOLOGY.md`

Public engine:

```ts
export interface ImpactIndicator {
  range: EstimateRange;
  confidence: "A" | "B" | "C" | "D";
  sourceProfileId: string;
}

export interface ImpactEstimate {
  energyWh: ImpactIndicator;
  waterMl: ImpactIndicator;
  carbonG: ImpactIndicator;
  televisionSeconds: ImpactIndicator;
  carMeters: ImpactIndicator;
  profileId: string;
  methodologyVersion: string;
}

export function estimateImpact(
  profileId: string,
  tokens: VisibleTokenEstimate,
): ImpactEstimate;
```

- [ ] Write a registry-validation test that rejects an absent primary URL, non-HTTPS URL, invalid access/publication date, missing scope, missing limitations, invalid range, circular proxy, or unsupported unit.
- [ ] Write formula tests for `token-linear`, `prompt-median` and `model-proxy`, including propagation of token and profile uncertainty.
- [ ] Write exact equivalence tests: `100 Wh -> 3600 television seconds`, `193.2 gCO2e -> 1000 car meters`, and monotonic range propagation.
- [ ] Add the initial profiles with explicit provenance and no unsupported precision:
  - Gemini Apps median prompt: provider-published `0.24 Wh`, `0.26 ml`, `0.03 gCO2e`, expressed as a `prompt-median` range and grade A for the disclosed May 2025 product median only.
  - OpenAI GPT-4o/GPT-4.1 families: `token-linear` operational-inference profiles fitted from the three published query shapes in *How Hungry is AI?*, with broad systematic bounds and grade C.
  - Claude 3.5/3.7 families: `token-linear` operational-inference profiles fitted from the same paper, with broad systematic bounds and grade C.
  - Mistral Large 2 / Le Chat: provider-published marginal impact for a 400-output-token response of `1.14 gCO2e` and `45 ml` of water, excluding the user terminal, from Mistral’s 22 July 2025 lifecycle-analysis publication at `https://mistral.ai/news/our-contribution-to-a-global-environmental-standard-for-ai/`. Keep these two disclosed indicators in a grade-A `prompt-median` profile. Derive no energy value from them: use the explicitly named generic operational-energy proxy with grade D for energy and TV time. Other Mistral families widen the disclosed water/carbon ranges and grade them D.
  - Perplexity: match a visibly disclosed underlying model when possible; otherwise use a generic assistant proxy with grade D.
- [ ] Store source title, URL, publication date, access date `2026-07-18`, measurement scope, query shape, fitting method, uncertainty multiplier and limitations in every profile.
- [ ] Support per-indicator provenance and confidence so a Mistral water/carbon disclosure is not incorrectly inherited by proxy energy. Implement all arithmetic from numeric metrics only. Reject unknown profiles except the explicit `generic-assistant-v1` fallback.
- [ ] Document that hidden reasoning, cache, tools, batch size, hardware, region, embodied emissions and full lifecycle can be missing; prohibit ESG/regulatory use.
- [ ] Run the three targeted suites; expect PASS.
- [ ] Commit with `feat: add transparent impact methodology`.

## Task 5: Persist only bounded numeric aggregates

**Files:**

- Create: `src/storage/storage-types.ts`
- Create: `src/storage/aggregate-store.ts`
- Create: `src/storage/write-queue.ts`
- Create: `src/background/service-worker.ts`
- Create: `tests/unit/aggregate-store.test.ts`
- Create: `tests/unit/service-worker.test.ts`

- [ ] Write failing tests for first event, streaming replacement, completion, interruption, duplicate event ID, out-of-order sequence, concurrent tabs, local-date rollover and session reset.
- [ ] Assert the exact persisted key allowlist contains only theme/side/manual-model preferences, numeric counters, impacts, interaction counts, local date and bounded deduplication metadata.
- [ ] Assert JSON-stringified storage never contains fixture prompt/response text, complete page URLs or conversation identifiers.
- [ ] Implement a per-key promise queue so concurrent service-worker wakeups cannot lose increments.
- [ ] Keep daily aggregates in `storage.local`; keep tab-session state in `storage.session`; replace, rather than archive, the prior day at local-date rollover.
- [ ] Bound deduplication to the latest 256 event IDs and expire entries older than 30 minutes.
- [ ] Validate every inbound message before processing and return only stable result/error codes.
- [ ] Run `npm test -- tests/unit/aggregate-store.test.ts tests/unit/service-worker.test.ts`; expect PASS.
- [ ] Commit with `feat: aggregate private local metrics`.

## Task 6: Create the lightweight accessible widget

**Files:**

- Create: `src/widget/eco-widget.ts`
- Create: `src/widget/widget-template.ts`
- Create: `src/widget/widget-styles.ts`
- Create: `src/widget/widget-controller.ts`
- Create: `src/widget/format-impact.ts`
- Create: `tests/unit/widget.test.ts`
- Create: `tests/unit/format-impact.test.ts`

- [ ] Write failing DOM tests for Shadow DOM isolation, expanded width `232px`, collapsed control `40px`, safe `textContent`, light/dark themes, system default, persistence callback, collapse, left/right anchoring and resize clamping.
- [ ] Write keyboard tests for tab order, visible focus, Escape to cancel drag state, explicit left/right anchor buttons and an accessible name on every control.
- [ ] Implement the custom element with native buttons and semantic sections. Do not use `innerHTML` with dynamic values.
- [ ] Use CSS custom-property design tokens for color, typography, spacing, radii and focus. Use a restrained neutral palette with teal status accents, no remote fonts, no glassmorphism and no decorative animation.
- [ ] Throttle streaming visual updates to at most two per second; announce only completed responses through `aria-live="polite"`.
- [ ] Use pointer events for dragging, snap to the nearest edge with a 12px margin, and provide equivalent keyboard buttons. Re-clamp on resize.
- [ ] Disable non-essential transitions under `prefers-reduced-motion: reduce`.
- [ ] Format water as ml below 1 L then L, TV time in seconds/minutes/hours, car distance in meters/kilometres and every impact as a readable range.
- [ ] Run `npm test -- tests/unit/widget.test.ts tests/unit/format-impact.test.ts`; expect PASS.
- [ ] Commit with `feat: add compact accessible impact widget`.

## Task 7: Implement the adapter contract and content lifecycle

**Files:**

- Create: `src/adapters/adapter-contract.ts`
- Create: `src/adapters/dom-observer.ts`
- Create: `src/content/content-controller.ts`
- Create: `src/content/content-entry.ts`
- Create: `src/content/page-lifecycle.ts`
- Create: `tests/unit/dom-observer.test.ts`
- Create: `tests/unit/content-controller.test.ts`

Adapter contract:

```ts
export interface PlatformAdapter {
  readonly platform: PlatformId;
  detectModel(root: ParentNode): DetectedModel;
  findConversationRoot(document: Document): HTMLElement | null;
  readLatestTurn(root: HTMLElement): VisibleTurnSnapshot | null;
  getConversationMarker(document: Document): string | null;
  subscribe(root: HTMLElement, listener: () => void): () => void;
}
```

`VisibleTurnSnapshot` exists only inside the content-script bundle. It contains transient prompt/response strings and must not be exported from shared message contracts.

- [ ] Write failing tests for initialization, missing root, streaming updates, stable completion, interruption, regeneration, SPA navigation, observer cleanup and unknown DOM.
- [ ] Implement a scoped `MutationObserver` attached only to the conversation root and a 500 ms maximum update cadence.
- [ ] Convert strings to token ranges before constructing `NumericInteractionEvent`; explicitly overwrite local string references after the estimate is produced.
- [ ] Generate event IDs with `crypto.randomUUID`, increment a local sequence and never derive IDs from conversation content.
- [ ] Detect SPA navigation without storing or transmitting the current URL or conversation marker. A changed marker triggers an ephemeral session reset.
- [ ] Fail closed with `measurement-paused` when an adapter no longer recognizes its required structure.
- [ ] Run the targeted tests; expect PASS.
- [ ] Commit with `feat: add privacy-first content lifecycle`.

## Task 8: Add the ChatGPT adapter

**Files:**

- Create: `src/adapters/chatgpt/chatgpt-adapter.ts`
- Create: `src/adapters/chatgpt/chatgpt-selectors.ts`
- Create: `tests/fixtures/chatgpt/idle.html`
- Create: `tests/fixtures/chatgpt/streaming.html`
- Create: `tests/fixtures/chatgpt/unknown.html`
- Create: `tests/adapters/chatgpt-adapter.test.ts`

- [ ] Build anonymized fixture markup using stable semantics first: conversation `main`, message nodes with `data-message-author-role`, composer submit/stop controls and visible model label. Keep CSS selectors centralized in `chatgpt-selectors.ts`.
- [ ] Test prompt/response extraction, streaming state, completion, interruption, model normalization, regeneration and unknown DOM.
- [ ] Ensure the adapter never reads sidebar history, account UI, hidden preloaded conversations or full-document text.
- [ ] Implement the smallest selector fallbacks needed by the fixtures and return `null` when authorship cannot be established.
- [ ] Run `npm test -- tests/adapters/chatgpt-adapter.test.ts`; expect PASS.
- [ ] Commit with `feat: support ChatGPT conversations`.

## Task 9: Add the Claude adapter

**Files:**

- Create: `src/adapters/claude/claude-adapter.ts`
- Create: `src/adapters/claude/claude-selectors.ts`
- Create: `tests/fixtures/claude/idle.html`
- Create: `tests/fixtures/claude/streaming.html`
- Create: `tests/fixtures/claude/unknown.html`
- Create: `tests/adapters/claude-adapter.test.ts`

- [ ] Create synthetic fixture roles for human and assistant turns, the stop-generation control and the visible Claude model selector.
- [ ] Test extraction, streaming/completion, interruption, model mapping for Sonnet/Haiku/Opus, SPA marker changes and fail-closed behavior.
- [ ] Scope reads to the active conversation region and ignore project/sidebar content.
- [ ] Implement centralized semantic selectors with structural fallbacks that require both role and turn order.
- [ ] Run `npm test -- tests/adapters/claude-adapter.test.ts`; expect PASS.
- [ ] Commit with `feat: support Claude conversations`.

## Task 10: Add the Gemini adapter

**Files:**

- Create: `src/adapters/gemini/gemini-adapter.ts`
- Create: `src/adapters/gemini/gemini-selectors.ts`
- Create: `tests/fixtures/gemini/idle.html`
- Create: `tests/fixtures/gemini/streaming.html`
- Create: `tests/fixtures/gemini/unknown.html`
- Create: `tests/adapters/gemini-adapter.test.ts`

- [ ] Create synthetic fixtures for user-query and model-response nodes, stop control, model chooser and a completed response.
- [ ] Test role extraction, streaming/completion, interruption, Gemini family mapping, navigation reset and unrecognized markup.
- [ ] Ensure hidden accessibility duplicates do not double-count visible output.
- [ ] Implement de-duplication of DOM mirrors using element visibility and containment, never using text hashes.
- [ ] Run `npm test -- tests/adapters/gemini-adapter.test.ts`; expect PASS.
- [ ] Commit with `feat: support Gemini conversations`.

## Task 11: Add the Mistral Le Chat adapter

**Files:**

- Create: `src/adapters/mistral/mistral-adapter.ts`
- Create: `src/adapters/mistral/mistral-selectors.ts`
- Create: `tests/fixtures/mistral/idle.html`
- Create: `tests/fixtures/mistral/streaming.html`
- Create: `tests/fixtures/mistral/unknown.html`
- Create: `tests/adapters/mistral-adapter.test.ts`

- [ ] Create synthetic fixtures for user/assistant message semantics, response streaming state, stop control and visible model label.
- [ ] Test extraction, interruption, regeneration, Mistral family mapping, SPA reset and fail-closed behavior.
- [ ] Ignore attachments, sources and suggested follow-up prompts unless they are part of the visible assistant response container.
- [ ] Implement bounded selector fallbacks in one selector module.
- [ ] Run `npm test -- tests/adapters/mistral-adapter.test.ts`; expect PASS.
- [ ] Commit with `feat: support Mistral Le Chat conversations`.

## Task 12: Add the Perplexity adapter

**Files:**

- Create: `src/adapters/perplexity/perplexity-adapter.ts`
- Create: `src/adapters/perplexity/perplexity-selectors.ts`
- Create: `tests/fixtures/perplexity/idle.html`
- Create: `tests/fixtures/perplexity/streaming.html`
- Create: `tests/fixtures/perplexity/unknown.html`
- Create: `tests/adapters/perplexity-adapter.test.ts`

- [ ] Create synthetic fixtures separating the user query, narrative answer, citations, related questions and visible model label.
- [ ] Test that citations and related questions are excluded, while visible answer prose/code is included once.
- [ ] Test streaming/completion, interruption, underlying-model mapping, generic grade-D fallback, navigation reset and unknown DOM.
- [ ] Implement an answer-container allowlist; never aggregate arbitrary article or search-result text.
- [ ] Run `npm test -- tests/adapters/perplexity-adapter.test.ts`; expect PASS.
- [ ] Commit with `feat: support Perplexity conversations`.

## Task 13: Generate least-privilege browser manifests and static assets

**Files:**

- Create: `manifest/manifest.base.json`
- Create: `manifest/chromium.json`
- Create: `manifest/firefox.json`
- Create: `src/action/action.ts`
- Create: `tests/unit/manifest.test.ts`
- Generated: `dist/chromium/icons/*.png`
- Generated: `dist/firefox/icons/*.png`

- [ ] Write tests asserting Manifest V3, exact host allowlists, no `<all_urls>`, no unsafe CSP directives, no remotely hosted code, no unused permission, separate per-platform bundles and PNG icons at 16/32/48/128 pixels.
- [ ] Allow only `storage`. Toolbar action messaging targets content scripts already injected through host permissions and therefore does not require `activeTab`, `tabs` or `scripting`.
- [ ] Use these exact release host patterns: `https://chatgpt.com/*`, `https://chat.openai.com/*`, `https://claude.ai/*`, `https://gemini.google.com/*`, `https://chat.mistral.ai/*` and `https://www.perplexity.ai/*`. Treat any production-origin change as a reviewed manifest update, not a wildcard expansion.
- [ ] Generate accessible, original ecoIA raster icons locally from a deterministic Node script; do not embed SVG in manifests because Chromium manifest icons do not support SVG.
- [ ] Implement toolbar action messaging to toggle/reopen the widget on supported active tabs, with a stable unsupported-page response.
- [ ] Generate Firefox `browser_specific_settings.gecko.id` with minimum Firefox 121. Use `background.scripts` for Firefox’s non-persistent MV3 event page and `background.service_worker` for Chromium from the same classic background bundle; Firefox does not support extension service workers as of the documented 2026 compatibility table.
- [ ] Run `npm test -- tests/unit/manifest.test.ts && npm run build && npm run size`; expect PASS.
- [ ] Commit with `feat: package least-privilege browser builds`.

## Task 14: Exercise the complete extension in Chromium

**Files:**

- Create: `playwright.config.ts`
- Create: `tests/e2e/extension.fixture.ts`
- Create: `tests/e2e/widget.spec.ts`
- Create: `tests/e2e/aggregation.spec.ts`
- Create: `tests/e2e/network-zero.spec.ts`
- Create: `tests/e2e/accessibility.spec.ts`
- Create: `tests/e2e/performance.spec.ts`
- Create: `tests/fixtures/e2e/host.html`

- [ ] Start a local fixture server bound to `127.0.0.1`, build and load `dist/chromium-e2e` in a persistent Chromium context and verify actual extension injection. Assert that the local fixture host permission is absent from both release manifests and archives.
- [ ] Test expand/collapse, light/dark persistence, drag/snap, resize clamping, keyboard-only navigation, completed-response announcement and multi-tab aggregation.
- [ ] Intercept page and service-worker traffic. Fail if an extension-initiated HTTP(S), WebSocket, EventSource, beacon or remote resource request occurs; allow only the explicit fixture navigation made by the test harness.
- [ ] Run an accessibility check for roles, names, focus order, keyboard operation, contrast tokens and reduced-motion styles. Add `axe-core` only as a pinned development dependency if native Playwright assertions cannot cover an issue reliably.
- [ ] Feed a long synthetic stream and assert visual renders remain at or below two per second and observer work stays scoped to the fixture conversation root.
- [ ] Run `npm run e2e`; expect PASS on Chromium.
- [ ] Run `npm run build && npm run size`; expect both archives under 153600 bytes.
- [ ] Commit with `test: verify extension privacy and user journeys`.

## Task 15: Add defensive supply-chain checks and project documentation

**Files:**

- Create: `.github/workflows/ci.yml`
- Create: `.github/dependabot.yml`
- Create: `README.md`
- Create: `PRIVACY.md`
- Create: `SECURITY.md`
- Create: `CONTRIBUTING.md`
- Create: `CHANGELOG.md`
- Create: `LICENSE`
- Create: `NOTICE`
- Create: `THIRD_PARTY_NOTICES.md`
- Create: `docs/adding-an-adapter.md`
- Create: `docs/adding-an-impact-profile.md`
- Create: `docs/release-checklist.md`
- Create: `tests/unit/documentation.test.ts`

- [ ] Write tests that require the privacy commitments, limitations, source links, beginner installation steps, supported browsers/platforms, uninstall instructions, security contact process and release checksum instructions.
- [ ] Configure CI with read-only repository permissions, pinned action commit SHAs, npm cache, `npm ci`, format check, lint, type-check, unit/adapter tests, Chromium e2e, dependency audit, secret scan, dual build and size gate.
- [ ] Add an MIT license for ecoIA. If audited AI Wattch code is actually copied, add its exact MIT notice and identify copied files; otherwise state that AI Wattch informed the architecture but no source code was incorporated.
- [ ] Document Chrome/Edge developer-mode installation and Firefox temporary installation step by step for beginners.
- [ ] Explain estimate ranges, confidence grades, non-observable tokens and non-regulatory scope in French, with an English summary in the README.
- [ ] Document a release procedure that creates local archives and SHA-256 files. Do not create a GitHub repository, push, publish a release or submit to a store without a separate explicit approval.
- [ ] Run `npm test -- tests/unit/documentation.test.ts`; expect PASS.
- [ ] Commit with `docs: prepare ecoIA for open source release`.

## Task 16: Final verification and release-candidate audit

**Files:**

- Modify only files proven defective by the checks below.
- Create: `docs/verification/2026-07-18-v1-local-report.md`

- [ ] Run `npm run format:check`; record PASS or exact failure.
- [ ] Run `npm run lint`; record PASS or exact failure.
- [ ] Run `npm run typecheck`; record PASS or exact failure.
- [ ] Run `npm test -- --run`; record test count and PASS or exact failure.
- [ ] Run `npm run build`; record PASS and emitted archive names.
- [ ] Run `npm run e2e`; record test count and PASS or exact failure.
- [ ] Run `npm audit --omit=dev` and full `npm audit`; report runtime and development results separately.
- [ ] Run a secret scan over tracked files and inspect `git diff --check`, `git status --short`, archive contents and exact compressed sizes.
- [ ] Inspect bundles for `fetch(`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, `eval(`, `new Function`, remote URLs and conversation-field names; investigate every hit rather than relying on a blind string result.
- [ ] Perform a manual Chrome/Edge installation and fixture smoke test. Mark real-platform smoke tests NOT RUN until accounts and explicit user-authorized browser sessions are available.
- [ ] Perform a Firefox temporary-install smoke test when Firefox is available; otherwise mark it BLOCKED with the exact environment reason.
- [ ] Record each check as PASS, FAIL, NOT RUN or BLOCKED, including the command/method and remaining limitations.
- [ ] Inspect all commits and the complete diff from `8a75a92`; confirm `.vscode/` remains untracked and excluded from commits.
- [ ] Commit with `chore: record local release verification`.

## Definition of Done

- The real fixture journey works from platform adapter to visible widget and numeric local aggregates.
- Five platform adapters pass contract tests and fail closed on unknown DOM.
- No conversation text crosses the content-script message boundary or enters storage/logs.
- No extension-initiated network request occurs in automated verification.
- Environmental results show range, source, date, scope, limitations and confidence.
- The widget is compact, draggable, keyboard-operable, light/dark, responsive and reduced-motion aware.
- Chromium and Firefox builds are installable according to the documentation and each compressed archive is below 150 Ko.
- Every applicable verification result is reported with evidence; unavailable live-platform tests remain explicitly NOT RUN or BLOCKED.
- Publication to GitHub or an extension store is excluded until the user grants separate approval.
