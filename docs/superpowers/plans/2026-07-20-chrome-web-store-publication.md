# Chrome Web Store Publication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer une version Chromium d’ecoIA conforme, consentie, documentée et prête à importer dans le Chrome Web Store.

**Architecture:** `ContentController` charge une notice de consentement versionnée avant toute interaction avec les adaptateurs DOM. Le widget présente cette notice dans son Shadow DOM et ne révèle le tableau de mesure qu’après acceptation. Les documents et visuels du Store sont générés séparément du paquet d’exécution afin de ne pas alourdir l’extension.

**Tech Stack:** TypeScript 7, WebExtension Manifest V3, APIs `storage.local` et `storage.session`, Shadow DOM natif, Vitest, Playwright, scripts Node.js sans nouvelle dépendance.

## Global Constraints

- Aucun texte visible ne doit être lu avant le consentement.
- Aucune nouvelle permission, requête réseau ou dépendance ne doit être ajoutée.
- Le consentement stocké ne contient qu’une version de notice et un booléen.
- La révocation arrête immédiatement les nouveaux abonnements et mesures.
- L’interface conserve une largeur de 195 px et une hauteur maximale de 480 px.
- Les déclarations du Store doivent correspondre à `PRIVACY.md` et au code livré.
- Le ZIP Chromium doit contenir `manifest.json` à sa racine.

---

### Task 1: Consentement versionné et validation stricte

**Files:**
- Create: `src/privacy/measurement-consent.ts`
- Create: `tests/unit/measurement-consent.test.ts`

**Interfaces:**
- Produces: `measurementConsentStorageKey`, `MeasurementConsent`, `parseMeasurementConsent(value)` et `createMeasurementConsent(granted)`.

- [ ] **Step 1: Write the failing test**

```ts
expect(parseMeasurementConsent({ version: 1, noticeVersion: 1, granted: true })).toEqual({
  version: 1,
  noticeVersion: 1,
  granted: true,
});
expect(parseMeasurementConsent({ version: 1, noticeVersion: 1, granted: true, text: "x" })).toBeNull();
expect(parseMeasurementConsent({ version: 1, noticeVersion: 2, granted: true })).toBeNull();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/measurement-consent.test.ts`

Expected: FAIL because `src/privacy/measurement-consent.ts` does not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
export const measurementConsentStorageKey = "ecoia.measurement-consent.v1";

export interface MeasurementConsent {
  version: 1;
  noticeVersion: 1;
  granted: boolean;
}

export function createMeasurementConsent(granted: boolean): MeasurementConsent {
  return { version: 1, noticeVersion: 1, granted };
}

export function parseMeasurementConsent(value: unknown): MeasurementConsent | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).sort().join(",") !== "granted,noticeVersion,version") return null;
  return record.version === 1 && record.noticeVersion === 1 && typeof record.granted === "boolean"
    ? { version: 1, noticeVersion: 1, granted: record.granted }
    : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/measurement-consent.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/privacy/measurement-consent.ts tests/unit/measurement-consent.test.ts
git commit -m "feat: validate local measurement consent"
```

### Task 2: Interface de consentement accessible

**Files:**
- Modify: `src/widget/widget-template.ts`
- Modify: `src/widget/widget-controller.ts`
- Modify: `src/widget/eco-widget.ts`
- Modify: `src/widget/widget-styles.ts`
- Modify: `tests/unit/widget.test.ts`

**Interfaces:**
- Consumes: `MeasurementConsent` semantics from Task 1.
- Produces: `WidgetConfiguration.consentGranted`, `onConsentChange(granted)`, `WidgetController.setConsentGranted(granted)`.

- [ ] **Step 1: Write failing widget tests**

```ts
const onConsentChange = vi.fn();
const widget = createWidget();
widget.configure({ consentGranted: false, onConsentChange });
expect(widget.shadowRoot?.querySelector<HTMLElement>("[data-consent]")?.hidden).toBe(false);
expect(widget.shadowRoot?.querySelector<HTMLElement>("[data-measurement-body]")?.hidden).toBe(true);
widget.shadowRoot?.querySelector<HTMLButtonElement>("[data-consent-accept]")?.click();
expect(onConsentChange).toHaveBeenCalledWith(true);
```

Add equivalent assertions for « Pas maintenant », « Désactiver la mesure », accessible button labels,
dark theme and the fixed 195 × 480 px budget.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/widget.test.ts`

Expected: FAIL because the consent elements and callbacks are absent.

- [ ] **Step 3: Extend the template and controller**

Add native buttons with these stable attributes:

```ts
data-consent
data-consent-accept
data-consent-decline
data-consent-revoke
data-measurement-body
```

Use the exact notice:

```text
ecoIA estime localement les tokens à partir du texte visible. Aucun texte n’est stocké ni transmis.
```

The privacy link targets `https://github.com/didou92i/ecoIA/blob/main/PRIVACY.md` with
`target="_blank"` and `rel="noopener noreferrer"`.

- [ ] **Step 4: Add restrained styles**

Reuse the existing design tokens. Keep the disclosure compact, maintain visible focus, include
`prefers-reduced-motion`, and do not add continuous animation or an external asset.

- [ ] **Step 5: Run widget tests**

Run: `npm test -- tests/unit/widget.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/widget tests/unit/widget.test.ts
git commit -m "feat: add first-use privacy notice"
```

### Task 3: Bloquer toute mesure avant acceptation

**Files:**
- Modify: `src/content/content-controller.ts`
- Modify: `tests/unit/content-controller.test.ts`

**Interfaces:**
- Consumes: `parseMeasurementConsent`, `createMeasurementConsent`, `measurementConsentStorageKey`.
- Produces: internal `startMeasurement()` and `disableMeasurement()` transitions.

- [ ] **Step 1: Write failing controller tests**

Cover these exact outcomes:

```ts
await controller.start();
expect(adapter.findRootCallCount).toBe(0);
expect(adapter.lastTurnSnapshot).toBeNull();
expect(adapter.contextReadCount).toBe(0);

await consentCallback(widget)(true);
expect(local.values[measurementConsentStorageKey]).toEqual(createMeasurementConsent(true));
expect(adapter.findRootCallCount).toBeGreaterThan(0);

await consentCallback(widget)(false);
expect(adapter.cleanup).toHaveBeenCalledOnce();
```

Also test malformed consent, storage read failure, stored acceptance and reactivation baseline.

- [ ] **Step 2: Run controller tests to verify failure**

Run: `npm test -- tests/unit/content-controller.test.ts`

Expected: FAIL because `start()` currently reads the conversation immediately.

- [ ] **Step 3: Implement fail-closed lifecycle**

Load the consent in the same bounded `storage.local.get` call as preferences and day aggregate. Append
the widget even when storage fails, but do not call `findConversationRoot`, `detectModel`,
`readLatestTurn`, `readVisibleContext` or `subscribe` until consent is valid and granted.

Persist accept/refuse using:

```ts
await this.api.storage.local.set({
  [measurementConsentStorageKey]: createMeasurementConsent(granted),
});
```

On revocation, disconnect adapter and lifecycle observers, clear current measurement, create a fresh
baseline for the next activation and configure the widget as not consented.

- [ ] **Step 4: Run controller tests**

Run: `npm test -- tests/unit/content-controller.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/content/content-controller.ts tests/unit/content-controller.test.ts
git commit -m "feat: require consent before conversation access"
```

### Task 4: Adapter les tests navigateur au nouveau premier lancement

**Files:**
- Modify: `tests/e2e/extension.fixture.ts`
- Modify: `tests/e2e/widget.spec.ts`
- Modify: `tests/e2e/network-zero.spec.ts`

**Interfaces:**
- Consumes: storage key and value from Task 1.
- Produces: helper `grantMeasurementConsent(context)` for ordinary E2E journeys.

- [ ] **Step 1: Add the E2E consent helper and onboarding journey**

Before ordinary fixture navigation, write the exact consent object through the extension service
worker. Add one isolated test starting with empty storage that verifies notice visibility, zero
conversation reads through visible results, acceptance, activation, revocation and zero network calls.

- [ ] **Step 2: Run targeted E2E tests**

Run: `npm run build:e2e && npx playwright test tests/e2e/widget.spec.ts tests/e2e/network-zero.spec.ts`

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e
git commit -m "test: cover consented browser measurement"
```

### Task 5: Préparer le dossier Chrome Web Store

**Files:**
- Create: `docs/chrome-web-store/listing-fr.md`
- Create: `docs/chrome-web-store/privacy-answers-fr.md`
- Create: `docs/chrome-web-store/test-instructions-fr.md`
- Create: `docs/chrome-web-store/submission-checklist.md`
- Create: `docs/chrome-web-store/assets/promo-440x280.svg`
- Create: `scripts/generate-store-assets.mjs`
- Modify: `package.json`
- Modify: `PRIVACY.md`
- Modify: `README.md`
- Modify: `tests/unit/documentation.test.ts`

**Interfaces:**
- Consumes: real consent behavior and current manifest permissions.
- Produces: `npm run store-assets` and copy-ready Store declarations.

- [ ] **Step 1: Add failing documentation assertions**

Assert that the Store documents include the single purpose, every requested permission, local-only
text processing, no remote code, no sale or sharing, support URL, privacy URL and TerritorIA credit.

- [ ] **Step 2: Run documentation tests to verify failure**

Run: `npm test -- tests/unit/documentation.test.ts`

Expected: FAIL because the Store documents are absent.

- [ ] **Step 3: Write copy-ready documents**

Use the approved title, summary and single purpose. Describe values as estimates and never as direct
measurements. State the data categories conservatively and exactly match `PRIVACY.md`.

- [ ] **Step 4: Generate the promotional image**

Create a local SVG source using the TerritorIA brand mark and the claim:

```text
Comprendre l’impact de vos conversations IA
```

The Node script launches the already-pinned Playwright Chromium, renders the local SVG at 440 × 280
and writes `docs/chrome-web-store/assets/promo-440x280.png`. It must not add a runtime dependency.

- [ ] **Step 5: Run documentation and asset checks**

Run: `npm test -- tests/unit/documentation.test.ts && npm run store-assets`

Expected: PASS and a 440 × 280 PNG.

- [ ] **Step 6: Commit**

```bash
git add docs/chrome-web-store scripts/generate-store-assets.mjs package.json PRIVACY.md README.md tests/unit/documentation.test.ts
git commit -m "docs: prepare Chrome Web Store submission"
```

### Task 6: Version, package et vérification finale

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `manifest/manifest.base.json`
- Modify: `CHANGELOG.md`
- Regenerate: `dist/chromium/**`
- Regenerate: `dist/firefox/**`
- Regenerate: `dist/packages/ecoia-chromium.zip`
- Regenerate: `dist/packages/ecoia-firefox.zip`
- Regenerate: `dist/packages/*.sha256`

**Interfaces:**
- Produces: release candidate `0.2.0` and store-uploadable Chromium ZIP.

- [ ] **Step 1: Set version 0.2.0 and changelog**

Keep package and manifest versions identical. Document consent-first measurement and Store readiness.

- [ ] **Step 2: Run the full verification suite**

Run: `npm run verify`

Expected: PASS for format, lint, typecheck, unit tests, evidence checks, source freshness, builds and
size budget.

- [ ] **Step 3: Run the browser suite**

Run: `npm run e2e`

Expected: PASS for all Chromium E2E tests.

- [ ] **Step 4: Regenerate checksums and inspect archives**

Run: `npm run checksums && unzip -l dist/packages/ecoia-chromium.zip`

Expected: `manifest.json` at archive root; no source maps, test files, `.env`, `.git` or secrets.

- [ ] **Step 5: Inspect diff and secret scan**

Run: `npm run secrets && git diff --check && git status --short`

Expected: secret scan PASS, no whitespace errors and only intended release artifacts changed.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json manifest/manifest.base.json CHANGELOG.md dist
git commit -m "release: prepare ecoIA 0.2.0 for Chrome Web Store"
```

- [ ] **Step 7: Prepare publication handoff**

Keep the Chrome Web Store dashboard open. Report the ZIP path, SHA-256, listing asset paths and the
remaining manual actions: upload, legal attestations, payment if requested and final submission.
