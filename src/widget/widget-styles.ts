export const widgetStyles = `
:host {
  --widget-width: 232px;
  --collapsed-size: 40px;
  --surface: #f7faf9;
  --surface-raised: #ffffff;
  --surface-muted: #e9f0ee;
  --text: #12201e;
  --text-muted: #526461;
  --border: #cddbd7;
  --accent: #0f766e;
  --accent-soft: #d8f3ee;
  --focus: #0b6cff;
  --warning-surface: #fff4d6;
  --warning-border: #a05a00;
  --warning-text: #633600;
  --error-text: #9f1239;
  --shadow: 0 8px 28px rgb(15 32 29 / 18%);
  position: fixed;
  z-index: 2147483000;
  top: 96px;
  width: var(--widget-width);
  color: var(--text);
  color-scheme: light;
  font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 12px;
  line-height: 1.4;
  text-rendering: optimizeLegibility;
}

:host([data-side="right"]) { right: 12px; left: auto; }
:host([data-side="left"]) { left: 12px; right: auto; }
:host([data-theme="dark"]) {
  --surface: #111917;
  --surface-raised: #18231f;
  --surface-muted: #22312c;
  --text: #eff8f5;
  --text-muted: #a8bbb5;
  --border: #344941;
  --accent: #5eead4;
  --accent-soft: #173c36;
  --focus: #8cb8ff;
  --warning-surface: #3d2d0c;
  --warning-border: #f2b94b;
  --warning-text: #ffe5a3;
  --error-text: #ffb4c2;
  --shadow: 0 10px 32px rgb(0 0 0 / 38%);
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

.panel {
  width: var(--widget-width);
  max-height: calc(100vh - 24px);
  overflow: auto;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--surface);
  box-shadow: var(--shadow);
}

.header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 6px;
  padding: 9px 9px 7px 10px;
  border-bottom: 1px solid var(--border);
}

.drag-handle {
  min-width: 0;
  min-height: 28px;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: grab;
  text-align: left;
}
:host([data-dragging]) .drag-handle { cursor: grabbing; }
.mark {
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  border-radius: 8px;
  background: #0d4143;
  color: #f4faf8;
  font-size: 14px;
  font-weight: 750;
}
.brand { font-size: 13px; font-weight: 750; letter-spacing: -0.01em; }
.header-actions { display: flex; gap: 3px; }
.icon-button {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
}
.icon-button:hover { background: var(--surface-muted); border-color: var(--border); }
.anchor-actions { display: flex; gap: 3px; padding: 0 9px 8px; }
.anchor-actions .icon-button { width: 26px; height: 26px; }

.body { padding: 9px; }
.status-row { display: flex; align-items: center; gap: 6px; color: var(--text-muted); }
.status-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--accent); }
.model {
  margin-top: 3px;
  overflow: hidden;
  color: var(--text);
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.model-warning {
  display: grid;
  gap: 4px;
  margin-top: 7px;
  padding: 7px;
  border: 1px solid var(--warning-border);
  border-radius: 9px;
  background: var(--warning-surface);
  color: var(--warning-text);
}
.model-warning[hidden] { display: none; }
.warning-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; }
.warning-action {
  justify-self: start;
  min-height: 28px;
  padding: 3px 7px;
  border: 1px solid currentColor;
  border-radius: 7px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-weight: 700;
}
.eyebrow {
  margin: 10px 0 5px;
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.token-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.token-card, .summary-card {
  padding: 7px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface-raised);
}
.label { display: block; color: var(--text-muted); font-size: 10px; }
.estimate-content { min-width: 0; }
.value {
  display: block;
  margin-top: 2px;
  font-weight: 750;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
}
.estimate-range {
  display: block;
  margin-top: 1px;
  color: var(--text-muted);
  font-size: 9px;
  font-variant-numeric: tabular-nums;
  line-height: 1.25;
}
.impact-list { display: grid; gap: 5px; }
.impact-row {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr);
  align-items: center;
  gap: 7px;
  padding: 7px 8px;
  border-radius: 10px;
  background: var(--accent-soft);
}
.impact-icon { color: var(--accent); font-size: 15px; text-align: center; }
.impact-name { color: var(--text-muted); font-size: 10px; }
.impact-value {
  display: block;
  color: var(--text);
  font-size: 14px;
  font-weight: 780;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.015em;
  line-height: 1.25;
}
.summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.summary-card .value { font-size: 11px; }
details { margin-top: 8px; border-top: 1px solid var(--border); padding-top: 7px; }
summary { min-height: 26px; display: flex; align-items: center; color: var(--text-muted); cursor: pointer; }
.details-grid { display: grid; gap: 4px; padding: 5px 1px 2px; }
.model-control { display: grid; gap: 3px; margin-bottom: 4px; }
.model-control label { color: var(--text); font-weight: 700; }
.model-control select {
  width: 100%;
  min-height: 32px;
  padding: 4px 6px;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: var(--surface-raised);
  color: var(--text);
}
.detected-model, .selection-error, .context-line, .explanation {
  margin: 0;
  color: var(--text-muted);
  font-size: 10px;
}
.selection-error { min-height: 1.4em; color: var(--error-text); font-weight: 650; }
.context-line { margin-top: 3px; color: var(--text); font-weight: 650; }
.context-line[hidden] { display: none; }
.explanation { line-height: 1.45; }
.detail-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
.detail-row > .estimate-content { text-align: right; }
.detail-value { display: block; font-variant-numeric: tabular-nums; }
.disclosure-section, .diagnostic-section { margin-top: 6px; padding-top: 6px; border-top: 1px solid var(--border); }
.detail-heading { margin: 0 0 3px; font-size: 11px; }
.compact-list { display: grid; gap: 4px; margin: 0; padding-left: 17px; }
.compact-list li { min-width: 0; }
.source-list a { color: var(--accent); font-weight: 650; text-decoration-thickness: 1px; }
.source-meta { display: block; color: var(--text-muted); font-size: 10px; overflow-wrap: anywhere; }
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
  background: #0d4143;
  color: #f4faf8;
  box-shadow: var(--shadow);
  cursor: pointer;
  font-size: 17px;
  font-weight: 800;
}
:host([collapsed]) { width: var(--collapsed-size); }
:host([collapsed]) .panel { display: none; }
:host([collapsed]) .collapsed-button { display: grid; }

@media (prefers-reduced-motion: no-preference) {
  :host { transition: top 140ms ease, left 140ms ease, right 140ms ease; }
  .panel, .collapsed-button { transition: opacity 120ms ease, transform 120ms ease; }
}
@media (prefers-reduced-motion: reduce) {
  :host, .panel, .collapsed-button { scroll-behavior: auto; transition: none !important; }
}
`;
