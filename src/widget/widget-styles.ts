export const widgetStyles = `
:host {
  --widget-width: 195px;
  --widget-max-height: 480px;
  --collapsed-size: 36px;
  --surface: oklch(97% 0.014 170);
  --surface-raised: oklch(99% 0.008 170);
  --surface-muted: oklch(93% 0.02 170);
  --panel-surface: oklch(97% 0.014 170 / 0.72);
  --header-surface: oklch(97% 0.014 170 / 0.94);
  --data-surface: oklch(99% 0.008 170 / 0.88);
  --impact-surface: oklch(92% 0.045 170 / 0.82);
  --text: oklch(25% 0.024 175);
  --text-muted: oklch(43% 0.028 175);
  --border: oklch(83% 0.028 170);
  --border-soft: oklch(90% 0.022 170);
  --accent: oklch(53% 0.105 175);
  --accent-soft: oklch(92% 0.045 170);
  --focus: oklch(53% 0.19 255);
  --warning-surface: oklch(95% 0.065 85);
  --warning-border: oklch(54% 0.13 65);
  --warning-text: oklch(36% 0.09 60);
  --error-text: oklch(43% 0.17 20);
  --shadow: 0 12px 36px rgb(10 34 29 / 16%);
  position: fixed;
  z-index: 2147483000;
  top: 96px;
  display: block;
  width: var(--widget-width);
  color: var(--text);
  color-scheme: light;
  contain: layout style;
  font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 11px;
  line-height: 1.4;
  text-rendering: optimizeLegibility;
}

:host([data-theme="dark"]) {
  --surface: oklch(19% 0.018 175);
  --surface-raised: oklch(23% 0.022 175);
  --surface-muted: oklch(27% 0.024 175);
  --panel-surface: oklch(19% 0.018 175 / 0.90);
  --header-surface: oklch(19% 0.018 175 / 0.96);
  --data-surface: oklch(23% 0.022 175 / 0.96);
  --impact-surface: oklch(28% 0.05 175 / 0.94);
  --text: oklch(94% 0.014 170);
  --text-muted: oklch(74% 0.028 170);
  --border: oklch(36% 0.028 175);
  --border-soft: oklch(30% 0.024 175);
  --accent: oklch(79% 0.12 175);
  --accent-soft: oklch(28% 0.05 175);
  --focus: oklch(76% 0.13 250);
  --warning-surface: oklch(28% 0.055 75);
  --warning-border: oklch(75% 0.13 75);
  --warning-text: oklch(88% 0.075 85);
  --error-text: oklch(80% 0.105 20);
  --shadow: 0 16px 42px rgb(0 0 0 / 38%);
  color-scheme: dark;
}

* { box-sizing: border-box; }
button, summary, select, a { font: inherit; }
button { color: inherit; }
button, summary { -webkit-tap-highlight-color: transparent; }
button:focus-visible, summary:focus-visible, select:focus-visible, a:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}
[data-icon] { width: 15px; height: 15px; display: block; }
[data-brand-mark] {
  width: 24px;
  height: 24px;
  display: block;
  flex: 0 0 auto;
  object-fit: contain;
  padding: 2px;
}

.panel {
  position: relative;
  isolation: isolate;
  width: var(--widget-width);
  max-height: min(var(--widget-max-height), calc(100vh - 24px));
  overflow: auto;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--panel-surface);
  box-shadow: inset 0 1px 0 oklch(99% 0.008 170 / .42), var(--shadow);
  -webkit-backdrop-filter: blur(16px) saturate(1.16);
  backdrop-filter: blur(16px) saturate(1.16);
  scrollbar-color: var(--border) transparent;
  scrollbar-width: thin;
}
.panel::after {
  position: absolute;
  z-index: 3;
  inset: 0;
  border: 1px solid var(--accent);
  border-radius: inherit;
  content: "";
  opacity: 0;
  pointer-events: none;
  transform: scale(.985);
}

.header {
  position: sticky;
  z-index: 4;
  top: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 6px;
  padding: 5px 6px 5px 7px;
  border-bottom: 1px solid var(--border-soft);
  background: var(--header-surface);
  -webkit-backdrop-filter: blur(12px) saturate(1.1);
  backdrop-filter: blur(12px) saturate(1.1);
}
.drag-handle {
  min-width: 0;
  min-height: 28px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: grab;
  text-align: left;
}
:host([data-dragging]) .drag-handle { cursor: grabbing; }
.brand { font-size: 12px; font-weight: 760; letter-spacing: -.01em; }
.header-actions { display: flex; align-items: center; gap: 2px; }
.icon-button {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 9px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}
.icon-button:hover { border-color: var(--border); background: var(--surface-muted); color: var(--text); }
.icon-button:active { transform: scale(.94); }
.body { padding: 7px 8px 8px; }
.status-row { display: flex; align-items: center; gap: 6px; color: var(--text-muted); }
.status-dot {
  width: 7px;
  height: 7px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.model {
  margin-top: 2px;
  overflow: hidden;
  color: var(--text);
  font-weight: 680;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.model-warning {
  display: grid;
  gap: 4px;
  margin-top: 6px;
  padding: 7px;
  border: 1px solid var(--warning-border);
  border-radius: 10px;
  background: var(--warning-surface);
  color: var(--warning-text);
}
.model-warning[hidden] { display: none; }
.warning-label { font-size: 9px; text-transform: uppercase; letter-spacing: .08em; }
.warning-action {
  justify-self: start;
  min-height: 28px;
  padding: 3px 7px;
  border: 1px solid currentColor;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-weight: 700;
}
.eyebrow {
  margin: 9px 0 4px;
  color: var(--text-muted);
  font-size: 9px;
  font-weight: 760;
  letter-spacing: .09em;
  text-transform: uppercase;
}

.token-grid, .summary-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--data-surface);
}
.token-card, .summary-card { min-width: 0; padding: 6px 7px; }
.token-card + .token-card, .summary-card + .summary-card { border-left: 1px solid var(--border-soft); }
.label { display: block; color: var(--text-muted); font-size: 9px; }
.estimate-content { min-width: 0; }
.value {
  display: block;
  margin-top: 1px;
  font-weight: 760;
  font-variant-numeric: tabular-nums;
  letter-spacing: -.01em;
}
.estimate-range {
  display: block;
  margin-top: 1px;
  color: var(--text-muted);
  font-size: 9px;
  font-variant-numeric: tabular-nums;
  line-height: 1.3;
}
.estimate-range[hidden] { display: none; }

.impact-list {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--impact-surface);
}
.impact-list::before {
  position: absolute;
  top: 20px;
  bottom: 20px;
  left: 20px;
  width: 1px;
  background: var(--accent);
  content: "";
  opacity: .38;
}
.impact-row {
  position: relative;
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr);
  align-items: center;
  gap: 7px;
  min-height: 46px;
  padding: 6px 7px;
}
.impact-row + .impact-row { border-top: 1px solid var(--border-soft); }
.impact-icon {
  z-index: 1;
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  border: 1px solid color-mix(in oklch, var(--accent) 34%, transparent);
  border-radius: 50%;
  background: var(--data-surface);
  color: var(--accent);
}
.impact-icon [data-icon] { width: 14px; height: 14px; }
.impact-name { color: var(--text-muted); font-size: 9px; }
.impact-value {
  display: block;
  color: var(--text);
  font-size: 12px;
  font-weight: 790;
  font-variant-numeric: tabular-nums;
  letter-spacing: -.015em;
  line-height: 1.2;
}
.summary-card .value { font-size: 11px; line-height: 1.3; }

details { margin-top: 7px; padding-top: 6px; border-top: 1px solid var(--border); }
summary {
  min-height: 28px;
  display: flex;
  align-items: center;
  color: var(--text-muted);
  cursor: pointer;
  font-weight: 620;
}
.details-grid { display: grid; gap: 4px; padding: 5px 1px 2px; }
.model-control { display: grid; gap: 3px; margin-bottom: 4px; }
.model-control label { color: var(--text); font-weight: 700; }
.model-control select {
  width: 100%;
  min-height: 30px;
  padding: 4px 6px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--data-surface);
  color: var(--text);
}
.detected-model, .selection-error, .context-line, .explanation {
  margin: 0;
  color: var(--text-muted);
  font-size: 9px;
}
.selection-error { min-height: 1.4em; color: var(--error-text); font-weight: 650; }
.context-line { margin-top: 3px; color: var(--text); font-weight: 650; }
.context-line[hidden] { display: none; }
.explanation { line-height: 1.45; }
.detail-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
.detail-row > .estimate-content { text-align: right; }
.detail-value { display: block; font-variant-numeric: tabular-nums; }
.disclosure-section, .diagnostic-section {
  margin-top: 6px;
  padding-top: 7px;
  border-top: 1px solid var(--border);
}
.detail-heading { margin: 0 0 3px; font-size: 10px; }
.compact-list { display: grid; gap: 4px; margin: 0; padding-left: 17px; }
.compact-list li { min-width: 0; }
.source-list a { color: var(--accent); font-weight: 680; text-decoration-thickness: 1px; }
.source-meta { display: block; color: var(--text-muted); font-size: 9px; overflow-wrap: anywhere; }
.diagnostic-list { list-style: none; padding-left: 0; }
.live { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }

.collapsed-button {
  width: var(--collapsed-size);
  height: var(--collapsed-size);
  display: none;
  place-items: center;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 13px;
  background: var(--panel-surface);
  box-shadow: var(--shadow);
  cursor: pointer;
  -webkit-backdrop-filter: blur(16px) saturate(1.16);
  backdrop-filter: blur(16px) saturate(1.16);
}
.collapsed-button [data-brand-mark] { width: 27px; height: 27px; }
:host([collapsed]) { width: var(--collapsed-size); }
:host([collapsed]) .panel { display: none; }
:host([collapsed]) .collapsed-button { display: grid; }

@media (prefers-reduced-motion: no-preference) {
  .icon-button, .warning-action, .panel, .collapsed-button {
    transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease, opacity 160ms ease, transform 160ms ease;
  }
  :host([data-dragging]) .panel { transform: scale(.992); }
  :host([data-fresh-measurement]) .panel::after {
    animation: measurement-ring 720ms cubic-bezier(.16, 1, .3, 1);
  }
  :host([data-fresh-measurement]) .impact-row {
    animation: impact-reveal 420ms cubic-bezier(.16, 1, .3, 1) both;
  }
  :host([data-fresh-measurement]) .impact-row:nth-child(2) { animation-delay: 55ms; }
  :host([data-fresh-measurement]) .impact-row:nth-child(3) { animation-delay: 110ms; }
}
@keyframes measurement-ring {
  0% { opacity: 0; transform: scale(.985); }
  30% { opacity: .85; }
  100% { opacity: 0; transform: scale(1); }
}
@keyframes impact-reveal {
  0% { opacity: .55; transform: translateY(5px); }
  100% { opacity: 1; transform: translateY(0); }
}
@media (prefers-reduced-motion: reduce) {
  :host, .panel, .collapsed-button, .icon-button, .warning-action {
    scroll-behavior: auto;
    animation: none !important;
    transition: none !important;
  }
}
`;
