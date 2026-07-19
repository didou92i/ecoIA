export interface WidgetElements {
  panel: HTMLElement;
  expandButton: HTMLButtonElement;
  collapseButton: HTMLButtonElement;
  themeButton: HTMLButtonElement;
  anchorLeftButton: HTMLButtonElement;
  anchorRightButton: HTMLButtonElement;
  dragHandle: HTMLButtonElement;
  status: HTMLElement;
  model: HTMLElement;
  modelWarning: HTMLElement;
  modelWarningText: HTMLElement;
  chooseModelButton: HTMLButtonElement;
  details: HTMLDetailsElement;
  modelSelect: HTMLSelectElement;
  detectedModel: HTMLElement;
  selectionError: HTMLElement;
  context: HTMLElement;
  contextExplanation: HTMLElement;
  inputTokens: HTMLElement;
  inputTokenRange: HTMLElement;
  outputTokens: HTMLElement;
  outputTokenRange: HTMLElement;
  water: HTMLElement;
  waterRange: HTMLElement;
  car: HTMLElement;
  carRange: HTMLElement;
  television: HTMLElement;
  televisionRange: HTMLElement;
  session: HTMLElement;
  day: HTMLElement;
  energy: HTMLElement;
  energyRange: HTMLElement;
  carbon: HTMLElement;
  carbonRange: HTMLElement;
  qualityOverall: HTMLElement;
  qualityExplanation: HTMLElement;
  qualityIndicators: HTMLUListElement;
  sourceList: HTMLUListElement;
  limitations: HTMLUListElement;
  diagnostics: HTMLUListElement;
  live: HTMLElement;
}

function element<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tagName);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function iconButton(label: string, glyph: string): HTMLButtonElement {
  const button = element("button", "icon-button", glyph);
  button.type = "button";
  button.setAttribute("aria-label", label);
  return button;
}

function estimateContent(
  valueClassName: string,
  valueDataAttribute: string,
  rangeDataAttribute: string,
): [HTMLElement, HTMLElement, HTMLElement] {
  const content = element("div", "estimate-content");
  const value = element("span", valueClassName, "En attente");
  value.setAttribute(valueDataAttribute, "");
  const range = element("span", "estimate-range", "Calcul en cours");
  range.setAttribute(rangeDataAttribute, "");
  content.append(value, range);
  return [content, value, range];
}

function tokenCard(
  labelText: string,
  dataAttribute: string,
  rangeDataAttribute: string,
): [HTMLElement, HTMLElement, HTMLElement] {
  const card = element("div", "token-card");
  card.append(element("span", "label", labelText));
  const [content, value, range] = estimateContent("value", dataAttribute, rangeDataAttribute);
  card.append(content);
  return [card, value, range];
}

function impactRow(
  glyph: string,
  labelText: string,
  dataAttribute: string,
  rangeDataAttribute: string,
): [HTMLElement, HTMLElement, HTMLElement] {
  const row = element("div", "impact-row");
  const icon = element("span", "impact-icon", glyph);
  icon.setAttribute("aria-hidden", "true");
  const content = element("div");
  content.append(element("span", "impact-name", labelText));
  const [estimate, value, range] = estimateContent(
    "impact-value",
    dataAttribute,
    rangeDataAttribute,
  );
  content.append(estimate);
  row.append(icon, content);
  return [row, value, range];
}

function summaryCard(labelText: string, dataAttribute: string): [HTMLElement, HTMLElement] {
  const card = element("div", "summary-card");
  card.append(element("span", "label", labelText));
  const value = element("span", "value", "Aucune donnée");
  value.setAttribute(dataAttribute, "");
  card.append(value);
  return [card, value];
}

function detailEstimateRow(
  labelText: string,
  dataAttribute: string,
  rangeDataAttribute: string,
): [HTMLElement, HTMLElement, HTMLElement] {
  const row = element("div", "detail-row");
  row.append(element("span", undefined, labelText));
  const [estimate, value, range] = estimateContent(
    "detail-value",
    dataAttribute,
    rangeDataAttribute,
  );
  row.append(estimate);
  return [row, value, range];
}

export function createWidgetTemplate(shadowRoot: ShadowRoot, styles: string): WidgetElements {
  const style = element("style");
  style.textContent = styles;
  const region = element("section", "panel");
  region.setAttribute("role", "region");
  region.setAttribute("aria-label", "Impact environnemental estimé de cette conversation IA");

  const header = element("header", "header");
  const dragHandle = element("button", "drag-handle");
  dragHandle.type = "button";
  dragHandle.setAttribute("aria-label", "Déplacer ecoIA");
  dragHandle.append(element("span", "mark", "e"), element("span", "brand", "ecoIA"));
  const headerActions = element("div", "header-actions");
  const themeButton = iconButton("Passer au thème sombre", "◐");
  themeButton.setAttribute("data-theme-toggle", "");
  const collapseButton = iconButton("Replier ecoIA", "⌄");
  collapseButton.setAttribute("data-collapse", "");
  headerActions.append(themeButton, collapseButton);
  header.append(dragHandle, headerActions);

  const anchorActions = element("div", "anchor-actions");
  const anchorLeftButton = iconButton("Ancrer ecoIA à gauche", "←");
  anchorLeftButton.setAttribute("data-anchor-left", "");
  const anchorRightButton = iconButton("Ancrer ecoIA à droite", "→");
  anchorRightButton.setAttribute("data-anchor-right", "");
  anchorActions.append(anchorLeftButton, anchorRightButton);

  const body = element("div", "body");
  const statusRow = element("div", "status-row");
  const statusDot = element("span", "status-dot");
  statusDot.setAttribute("aria-hidden", "true");
  const status = element("span", undefined, "Initialisation…");
  status.setAttribute("data-status", "");
  statusRow.append(statusDot, status);
  const model = element("div", "model", "Modèle non communiqué");
  model.setAttribute("data-model", "");
  body.append(statusRow, model);

  const modelWarning = element("div", "model-warning");
  modelWarning.setAttribute("data-model-warning", "");
  modelWarning.hidden = true;
  const warningLabel = element("strong", "warning-label", "Attention");
  const modelWarningText = element("span");
  modelWarningText.setAttribute("data-model-warning-text", "");
  const chooseModelButton = element("button", "warning-action", "Choisir le modèle");
  chooseModelButton.type = "button";
  chooseModelButton.setAttribute("data-choose-model", "");
  modelWarning.append(warningLabel, modelWarningText, chooseModelButton);
  body.append(modelWarning);

  body.append(element("h2", "eyebrow", "Tokens visibles"));
  const tokenGrid = element("div", "token-grid");
  const [inputCard, inputTokens, inputTokenRange] = tokenCard(
    "Entrée",
    "data-input-tokens",
    "data-input-token-range",
  );
  const [outputCard, outputTokens, outputTokenRange] = tokenCard(
    "Sortie",
    "data-output-tokens",
    "data-output-token-range",
  );
  tokenGrid.append(inputCard, outputCard);
  body.append(tokenGrid);

  body.append(element("h2", "eyebrow", "Impact estimé"));
  const impactList = element("div", "impact-list");
  const [waterRow, water, waterRange] = impactRow("●", "Eau", "data-water", "data-water-range");
  const [carRow, car, carRange] = impactRow("↔", "Voiture", "data-car", "data-car-range");
  const [televisionRow, television, televisionRange] = impactRow(
    "▣",
    "Téléviseur 100 W",
    "data-television",
    "data-television-range",
  );
  impactList.append(waterRow, carRow, televisionRow);
  body.append(impactList);

  body.append(element("h2", "eyebrow", "Repères"));
  const summaryGrid = element("div", "summary-grid");
  const [sessionCard, session] = summaryCard("Session", "data-session");
  const [dayCard, day] = summaryCard("Aujourd’hui", "data-day");
  summaryGrid.append(sessionCard, dayCard);
  body.append(summaryGrid);

  const details = element("details");
  details.append(element("summary", undefined, "Méthode et détails"));
  const detailsGrid = element("div", "details-grid");

  const modelControl = element("div", "model-control");
  const modelLabel = element("label", undefined, "Modèle appliqué");
  const modelSelect = element("select");
  modelSelect.id = "ecoia-model-profile";
  modelSelect.setAttribute("data-model-select", "");
  modelLabel.htmlFor = modelSelect.id;
  const detectedModel = element("p", "detected-model");
  detectedModel.setAttribute("data-detected-model", "");
  const selectionError = element("p", "selection-error");
  selectionError.setAttribute("data-selection-error", "");
  selectionError.setAttribute("aria-live", "polite");
  selectionError.setAttribute("aria-atomic", "true");
  modelControl.append(modelLabel, modelSelect, detectedModel, selectionError);

  const context = element("p", "context-line");
  context.setAttribute("data-context", "");
  context.hidden = true;
  const contextExplanation = element("p", "explanation");
  contextExplanation.setAttribute("data-context-explanation", "");
  const [energyRow, energy, energyRange] = detailEstimateRow(
    "Électricité",
    "data-energy",
    "data-energy-range",
  );
  const [carbonRow, carbon, carbonRange] = detailEstimateRow(
    "Carbone",
    "data-carbon",
    "data-carbon-range",
  );
  const qualitySection = element("section", "disclosure-section");
  qualitySection.setAttribute("aria-label", "Qualité des données");
  const qualityOverall = element("h3", "detail-heading", "Qualité des données");
  qualityOverall.setAttribute("data-quality-overall", "");
  const qualityExplanation = element("p", "explanation");
  qualityExplanation.setAttribute("data-quality-explanation", "");
  const qualityIndicators = element("ul", "compact-list");
  qualityIndicators.setAttribute("data-quality-indicators", "");
  const sourceHeading = element("h3", "detail-heading", "Sources");
  const sourceList = element("ul", "compact-list source-list");
  sourceList.setAttribute("data-disclosure-sources", "");
  const limitationHeading = element("h3", "detail-heading", "Limites");
  const limitations = element("ul", "compact-list");
  limitations.setAttribute("data-disclosure-limitations", "");
  qualitySection.append(
    qualityOverall,
    qualityExplanation,
    qualityIndicators,
    sourceHeading,
    sourceList,
    limitationHeading,
    limitations,
  );

  const diagnosticSection = element("section", "diagnostic-section");
  diagnosticSection.setAttribute("aria-label", "Diagnostic local");
  diagnosticSection.append(element("h3", "detail-heading", "Diagnostic"));
  const diagnostics = element("ul", "compact-list diagnostic-list");
  diagnostics.setAttribute("data-diagnostics", "");
  diagnosticSection.append(diagnostics);

  detailsGrid.append(
    modelControl,
    context,
    contextExplanation,
    energyRow,
    carbonRow,
    qualitySection,
    diagnosticSection,
  );
  details.append(detailsGrid);
  body.append(details);

  region.append(header, anchorActions, body);
  const expandButton = element("button", "collapsed-button", "e");
  expandButton.type = "button";
  expandButton.setAttribute("data-expand", "");
  expandButton.setAttribute("aria-label", "Ouvrir ecoIA");
  const live = element("div", "live");
  live.setAttribute("data-live", "");
  live.setAttribute("aria-live", "polite");
  live.setAttribute("aria-atomic", "true");
  shadowRoot.append(style, region, expandButton, live);

  return {
    panel: region,
    expandButton,
    collapseButton,
    themeButton,
    anchorLeftButton,
    anchorRightButton,
    dragHandle,
    status,
    model,
    modelWarning,
    modelWarningText,
    chooseModelButton,
    details,
    modelSelect,
    detectedModel,
    selectionError,
    context,
    contextExplanation,
    inputTokens,
    inputTokenRange,
    outputTokens,
    outputTokenRange,
    water,
    waterRange,
    car,
    carRange,
    television,
    televisionRange,
    session,
    day,
    energy,
    energyRange,
    carbon,
    carbonRange,
    qualityOverall,
    qualityExplanation,
    qualityIndicators,
    sourceList,
    limitations,
    diagnostics,
    live,
  };
}
