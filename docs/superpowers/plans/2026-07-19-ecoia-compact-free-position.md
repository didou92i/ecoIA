# ecoIA Compact Free Position Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the widget monogram with the TerritorIA head, reduce the deployed footprint, and persist an exact free position instead of snapping left or right.

**Architecture:** Keep the existing dependency-free Shadow DOM widget. Add one optimized local brand data URI, remove the obsolete anchor controls, centralize compact dimensions in CSS tokens, and evolve stored preferences from a side anchor to finite `left` and `top` coordinates with legacy migration.

**Tech Stack:** TypeScript 7, native Web Components and Shadow DOM, CSS, Chrome/Firefox Manifest V3 storage, Vitest, Playwright, esbuild.

## Global Constraints

- Expanded width is exactly 195 CSS px and maximum height is exactly 480 CSS px.
- Collapsed size is exactly 36 CSS px.
- Functional text stays at or above 11 px; secondary ranges may use 9 px.
- Interactive controls stay at or above 28 px.
- The logo is local, transparent, network-free and introduces no new browser permission.
- Pointer release preserves exact `left` and `top`; it never snaps automatically.
- Arrow keys move by 10 px; Shift plus an arrow moves by 1 px.
- The widget remains at least 12 px inside the viewport after movement, resize and reopen.
- Legacy `side: "left" | "right"` preferences remain readable.
- Do not add runtime dependencies, CSS `zoom`, permanent scaling, telemetry or remote assets.
- Keep the archive budget at 153,600 bytes for both Chromium and Firefox.

---

### Task 1: Optimized TerritorIA brand mark and compact template

**Files:**
- Create: `src/widget/assets/territoria-head-48.webp`
- Create: `src/widget/assets.d.ts`
- Create: `src/widget/brand-mark.ts`
- Modify: `scripts/build.mjs`
- Modify: `src/widget/widget-template.ts`
- Modify: `tests/unit/widget.test.ts`

**Interfaces:**
- Consumes: the approved `/Users/az/Downloads/Colorful Brain Human Technology Logo (3).png` source.
- Produces: `createBrandMark(): HTMLImageElement`, used by the expanded header and collapsed control.

- [ ] **Step 1: Produce a transparent, optimized 48 px brand source**

Use the approved image as the visual reference, remove only its white background, preserve the head
geometry and colors, then encode a 48 by 48 lossless WebP. Run `cwebp` on the transparent intermediate:

```bash
cwebp -quiet -lossless -m 6 -resize 48 48 /tmp/territoria-head-transparent.png \
  -o /tmp/territoria-head-48.webp
wc -c /tmp/territoria-head-48.webp
```

Expected: the WebP has alpha, is visually faithful at 24 px and remains below 2,000 bytes.

- [ ] **Step 2: Write failing brand and template tests**

Add assertions to `tests/unit/widget.test.ts`:

```ts
const brandMarks = widget.shadowRoot?.querySelectorAll<HTMLImageElement>("[data-brand-mark]");
expect(brandMarks).toHaveLength(2);
for (const mark of brandMarks ?? []) {
  expect(mark.alt).toBe("");
  expect(mark.src).toMatch(/^data:image\/webp;base64,/u);
  expect(mark.width).toBe(48);
  expect(mark.height).toBe(48);
}
expect(widget.shadowRoot?.querySelector("[data-anchor-left]")).toBeNull();
expect(widget.shadowRoot?.querySelector("[data-anchor-right]")).toBeNull();
```

- [ ] **Step 3: Run the targeted test and confirm RED**

Run: `npx vitest run tests/unit/widget.test.ts`

Expected: FAIL because no `[data-brand-mark]` elements exist and anchor buttons still exist.

- [ ] **Step 4: Add the local brand module**

Copy the optimized file to `src/widget/assets/territoria-head-48.webp`. Declare the import in
`src/widget/assets.d.ts`:

```ts
declare module "*.webp" {
  const dataUri: string;
  export default dataUri;
}
```

Configure the existing esbuild call in `scripts/build.mjs` with `loader: { ".webp": "dataurl" }`, then
create `src/widget/brand-mark.ts`:

```ts
import territoriaHeadDataUri from "./assets/territoria-head-48.webp";

export function createBrandMark(): HTMLImageElement {
  const image = document.createElement("img");
  image.src = territoriaHeadDataUri;
  image.alt = "";
  image.width = 48;
  image.height = 48;
  image.decoding = "async";
  image.setAttribute("aria-hidden", "true");
  image.setAttribute("data-brand-mark", "");
  return image;
}
```

- [ ] **Step 5: Replace the monogram and remove anchoring controls**

In `src/widget/widget-template.ts`, import `createBrandMark`, remove `anchorLeftButton` and
`anchorRightButton` from `WidgetElements`, remove the left/right icon names and paths, and build the
brand controls as follows:

```ts
dragHandle.setAttribute("aria-label", "Déplacer ecoIA. Utilisez les flèches pour ajuster sa position.");
dragHandle.append(createBrandMark(), element("span", "brand", "ecoIA"));

const expandButton = element("button", "collapsed-button");
expandButton.append(createBrandMark());
```

Append `header` directly before `body`; do not create or append `anchorActions`.

- [ ] **Step 6: Run the targeted unit suite and confirm GREEN**

Run: `npx vitest run tests/unit/widget.test.ts`

Expected: PASS for brand/template assertions; position tests may remain unchanged until Task 3.

- [ ] **Step 7: Commit the isolated template change**

```bash
git add scripts/build.mjs src/widget/assets/territoria-head-48.webp src/widget/assets.d.ts \
  src/widget/brand-mark.ts src/widget/widget-template.ts tests/unit/widget.test.ts
git commit -m "feat: add compact TerritorIA widget mark"
```

---

### Task 2: Compact 195 px visual system

**Files:**
- Modify: `src/widget/widget-styles.ts`
- Modify: `tests/unit/widget.test.ts`
- Modify: `tests/e2e/widget.spec.ts`
- Modify: `tests/e2e/accessibility.spec.ts`
- Modify: `DESIGN.md`
- Modify: `.impeccable/design.json`

**Interfaces:**
- Consumes: `[data-brand-mark]` and the anchor-free template from Task 1.
- Produces: CSS dimension tokens `--widget-width: 195px`, `--widget-max-height: 480px`, and `--collapsed-size: 36px`.

- [ ] **Step 1: Change size expectations before CSS**

Update the unit and E2E expectations:

```ts
expect(styles).toContain("--widget-width: 195px");
expect(styles).toContain("--widget-max-height: 480px");
expect(styles).toContain("--collapsed-size: 36px");
await expect(widget.locator(".panel")).toHaveCSS("width", "195px");
await expect(widget.locator(".panel")).toHaveCSS("max-height", "480px");
```

Keep the assertions banning CSS `zoom`, infinite animation and position-property transitions.

- [ ] **Step 2: Run tests and confirm RED**

Run: `npx vitest run tests/unit/widget.test.ts && npx playwright test tests/e2e/widget.spec.ts`

Expected: FAIL with the old 248 px, 600 px and 44 px values.

- [ ] **Step 3: Apply compact tokens and density**

In `src/widget/widget-styles.ts`:

```css
:host {
  --widget-width: 195px;
  --widget-max-height: 480px;
  --collapsed-size: 36px;
  font-size: 11px;
}
[data-brand-mark] { width: 24px; height: 24px; display: block; object-fit: contain; }
.header { gap: 6px; padding: 7px 7px 6px 8px; }
.drag-handle { min-height: 28px; gap: 6px; }
.icon-button { width: 28px; height: 28px; border-radius: 9px; }
.body { padding: 7px 8px 8px; }
.eyebrow { margin: 9px 0 4px; font-size: 9px; }
.impact-row { grid-template-columns: 26px minmax(0, 1fr); min-height: 46px; gap: 7px; padding: 6px 7px; }
.impact-icon { width: 26px; height: 26px; }
.impact-list::before { top: 20px; bottom: 20px; left: 20px; }
.impact-value { font-size: 12px; }
.estimate-range { font-size: 9px; }
```

Remove `.mark`, `.anchor-actions` and related rules. Preserve the existing translucent surfaces,
16 px backdrop blur, focus ring, themes and reduced-motion behavior.

- [ ] **Step 4: Update accessibility and design documentation**

Adjust the 320 px E2E geometry assertions for a 195 px panel without relaxing viewport containment.
Update `DESIGN.md` and `.impeccable/design.json` to record 195 px, 480 px, 36 px and 28 px controls.

- [ ] **Step 5: Run focused tests**

Run:

```bash
npx vitest run tests/unit/widget.test.ts
npx playwright test tests/e2e/widget.spec.ts tests/e2e/accessibility.spec.ts
```

Expected: PASS with no horizontal page overflow, visible focus and readable light/dark themes.

- [ ] **Step 6: Commit the visual reduction**

```bash
git add src/widget/widget-styles.ts tests/unit/widget.test.ts tests/e2e/widget.spec.ts \
  tests/e2e/accessibility.spec.ts DESIGN.md .impeccable/design.json
git commit -m "feat: reduce ecoIA widget footprint"
```

---

### Task 3: Free pointer and keyboard positioning

**Files:**
- Modify: `src/widget/widget-controller.ts`
- Modify: `src/widget/eco-widget.ts`
- Modify: `src/content/content-controller.ts`
- Modify: `tests/unit/widget.test.ts`
- Modify: `tests/unit/content-controller.test.ts`

**Interfaces:**
- Produces: `WidgetPreferences { theme, collapsed, left, top }`.
- Produces: `StoredWidgetPreferences`, which additionally accepts legacy optional `side`.
- Produces: `clampWidgetPosition(left, top, viewportWidth, viewportHeight, renderedWidth, renderedHeight)` returning `{ left, top }`.

- [ ] **Step 1: Add failing pure-position and keyboard tests**

Add unit coverage equivalent to:

```ts
expect(clampWidgetPosition(420, 300, 900, 700, 195, 480)).toEqual({ left: 420, top: 208 });
expect(clampWidgetPosition(-20, -30, 900, 700, 195, 480)).toEqual({ left: 12, top: 12 });

vi.spyOn(window, "innerWidth", "get").mockReturnValue(900);
handle.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
expect(widget.style.left).toBe("683px");
expect(onPreferencesChange).toHaveBeenLastCalledWith(
  expect.objectContaining({ left: expect.any(Number), top: expect.any(Number) }),
);
```

Add a legacy storage test in `tests/unit/content-controller.test.ts` that starts with
`{ side: "right", top: 96 }`, verifies a valid on-screen `left`, then verifies that the next write
contains finite `left` and `top` values.

- [ ] **Step 2: Run tests and confirm RED**

Run:

```bash
npx vitest run tests/unit/widget.test.ts tests/unit/content-controller.test.ts
```

Expected: FAIL because `clampWidgetPosition`, `left` persistence and keyboard movement do not exist.

- [ ] **Step 3: Introduce current and legacy preference types**

In `src/widget/widget-controller.ts`:

```ts
export interface WidgetPreferences {
  theme: WidgetTheme;
  collapsed: boolean;
  left: number;
  top: number;
}

export interface StoredWidgetPreferences extends Partial<WidgetPreferences> {
  side?: WidgetSide;
}
```

Make configuration consume `StoredWidgetPreferences`, while `onPreferencesChange` emits only the
current complete `WidgetPreferences` shape.

- [ ] **Step 4: Implement two-axis clamping and migration**

Implement the pure helper:

```ts
export function clampWidgetPosition(
  left: number,
  top: number,
  viewportWidth: number,
  viewportHeight: number,
  renderedWidth: number,
  renderedHeight: number,
): { left: number; top: number } {
  const margin = 12;
  return {
    left: Math.max(margin, Math.min(left, Math.max(margin, viewportWidth - renderedWidth - margin))),
    top: Math.max(margin, Math.min(top, Math.max(margin, viewportHeight - renderedHeight - margin))),
  };
}
```

When `left` is absent, derive it once from legacy `side`; right uses
`window.innerWidth - renderedWidth - 12`, left uses 12. Reject non-finite coordinates.

- [ ] **Step 5: Preserve exact pointer release and add keyboard movement**

During pointer movement, apply clamped `left` and `top`. On pointer release, do not calculate a side
and do not remove the inline left coordinate. Call `applyPreferences()` once to persist the final
coordinates.

On the drag handle `keydown`, handle `ArrowLeft`, `ArrowRight`, `ArrowUp` and `ArrowDown`, call
`preventDefault()`, use 10 px or 1 px with Shift, clamp, render and persist. Keep `Escape` restoring
the last persisted coordinates.

- [ ] **Step 6: Validate stored preferences defensively**

Update `isStoredPreferences` in `src/content/content-controller.ts` to accept only finite `left` and
`top` numbers and to keep accepting a valid legacy side. Do not accept strings, infinity or NaN.

- [ ] **Step 7: Run unit suites and confirm GREEN**

Run:

```bash
npx vitest run tests/unit/widget.test.ts tests/unit/content-controller.test.ts
```

Expected: PASS for migration, free pointer positioning, clamping and keyboard movement.

- [ ] **Step 8: Commit positioning behavior**

```bash
git add src/widget/widget-controller.ts src/widget/eco-widget.ts src/content/content-controller.ts \
  tests/unit/widget.test.ts tests/unit/content-controller.test.ts
git commit -m "feat: persist free ecoIA widget position"
```

---

### Task 4: End-to-end persistence, documentation and release evidence

**Files:**
- Modify: `tests/e2e/widget.spec.ts`
- Modify: `tests/e2e/accessibility.spec.ts`
- Modify: `README.md`
- Modify: `docs/INSTALLATION.md`

**Interfaces:**
- Consumes: the complete compact template and free-position controller.
- Produces: user-facing movement instructions and executable release evidence.

- [ ] **Step 1: Replace the anchoring E2E journey**

Drag the widget to a central coordinate, release, capture its `x` and `y`, reload the page and assert
the coordinates differ by no more than one CSS pixel. Then resize the viewport and assert every edge
remains at least 12 px inside the viewport. Assert `[data-anchor-left]` and `[data-anchor-right]` do not
exist.

- [ ] **Step 2: Add a keyboard E2E journey**

Focus the drag handle, press `ArrowLeft`, then `Shift+ArrowUp`. Assert `left` changes by 10 px, `top`
changes by 1 px, focus remains visible and the new coordinates survive reload.

- [ ] **Step 3: Update beginner documentation**

In `README.md` and `docs/INSTALLATION.md`, explain: drag the logo and “ecoIA” zone, release anywhere,
use arrow keys for 10 px steps and Shift plus arrows for 1 px steps. Remove instructions describing
left/right anchor buttons and record the 195 px compact width.

- [ ] **Step 4: Run format and focused browser tests**

Run:

```bash
npm run format
npm run lint
npm run typecheck
npm run e2e
```

Expected: PASS, including free movement, persistence, resize, keyboard, 320 px viewport and both themes.

- [ ] **Step 5: Run the full release verification**

Run:

```bash
npm run verify
npm run secrets
npm run checksums
git diff --check
```

Expected: all commands PASS; `ecoia-chromium.zip` and `ecoia-firefox.zip` are each at or below
153,600 bytes.

- [ ] **Step 6: Inspect the final diff and commit**

```bash
git status --short
git diff --stat
git add README.md docs/INSTALLATION.md tests/e2e/widget.spec.ts tests/e2e/accessibility.spec.ts
git commit -m "test: verify compact free-position widget"
```

- [ ] **Step 7: Manual local handoff**

Reload `/Users/az/Desktop/projet ecoIA/.worktrees/ecoia-v1/dist/chromium` from
`chrome://extensions`, refresh one ChatGPT and one Perplexity tab, then confirm the brand mark,
compact footprint and free movement. Do not claim this manual check as PASS unless it is actually
performed.
