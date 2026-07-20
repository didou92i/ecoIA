import { createBrandMark } from "./brand-mark";

export interface WidgetElements {
  panel: HTMLElement;
  expandButton: HTMLButtonElement;
  collapseButton: HTMLButtonElement;
  themeButton: HTMLButtonElement;
  dragHandle: HTMLButtonElement;
  consent: HTMLElement;
  consentAcceptButton: HTMLButtonElement;
  consentDeclineButton: HTMLButtonElement;
  consentRevokeButton: HTMLButtonElement;
  measurementBody: HTMLElement;
  status: HTMLElement;
  model: HTMLElement;
  modelWarning: HTMLElement;
  modelWarningText: HTMLElement;
  chooseModelButton: HTMLButtonElement;
  details: HTMLDetailsElement;
  modelSelect: HTMLSelectElement;
  detectedModel: HTMLElement;
  modelMethodNote: HTMLElement;
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

type IconName = "theme" | "collapse" | "water" | "car" | "television";

const iconPaths: Record<IconName, string> = {
  theme: "M12 3a9 9 0 1 0 9 9c-2.4 1.5-5.6 1.1-7.5-.9C11.6 9.1 11.1 5.7 12 3Z",
  collapse: "m7 10 5 5 5-5",
  water: "M12 3.5s-5 5.6-5 9.2a5 5 0 0 0 10 0c0-3.6-5-9.2-5-9.2Z",
  car: "M5 15l1.6-5h10.8l1.6 5M4 15h16v3H4zM7 18v2M17 18v2",
  television: "M4 6h16v11H4zM9 21h6m-3-4v4",
};

function icon(name: IconName): SVGSVGElement {
  const namespace = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(namespace, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.75");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.setAttribute("data-icon", name);
  const path = document.createElementNS(namespace, "path");
  path.setAttribute("d", iconPaths[name]);
  svg.append(path);
  return svg;
}

function iconButton(label: string, iconName: IconName): HTMLButtonElement {
  const button = element("button", "icon-button");
  button.type = "button";
  button.setAttribute("aria-label", label);
  button.append(icon(iconName));
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
  iconName: IconName,
  labelText: string,
  dataAttribute: string,
  rangeDataAttribute: string,
): [HTMLElement, HTMLElement, HTMLElement] {
  const row = element("div", "impact-row");
  row.setAttribute("data-impact-step", "");
  const iconContainer = element("span", "impact-icon");
  iconContainer.setAttribute("aria-hidden", "true");
  iconContainer.append(icon(iconName));
  const content = element("div");
  content.append(element("span", "impact-name", labelText));
  const [estimate, value, range] = estimateContent(
    "impact-value",
    dataAttribute,
    rangeDataAttribute,
  );
  content.append(estimate);
  row.append(iconContainer, content);
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
  dragHandle.setAttribute(
    "aria-label",
    "Déplacer ecoIA. Utilisez les flèches pour ajuster sa position.",
  );
  dragHandle.append(createBrandMark(), element("span", "brand", "ecoIA"));
  const headerActions = element("div", "header-actions");
  const themeButton = iconButton("Passer au thème sombre", "theme");
  themeButton.setAttribute("data-theme-toggle", "");
  const collapseButton = iconButton("Replier ecoIA", "collapse");
  collapseButton.setAttribute("data-collapse", "");
  headerActions.append(themeButton, collapseButton);
  header.append(dragHandle, headerActions);

  const consent = element("section", "consent");
  consent.setAttribute("data-consent", "");
  consent.setAttribute("aria-labelledby", "ecoia-consent-title");
  const consentTitle = element("h2", "consent-title", "Mesurer en toute transparence");
  consentTitle.id = "ecoia-consent-title";
  const consentText = element(
    "p",
    "consent-text",
    "ecoIA estime localement les tokens à partir du texte visible. Aucun texte n’est stocké ni transmis.",
  );
  const privacyLink = element("a", "privacy-link", "Lire la politique de confidentialité");
  privacyLink.href = "https://github.com/didou92i/ecoIA/blob/main/PRIVACY.md";
  privacyLink.target = "_blank";
  privacyLink.rel = "noopener noreferrer";
  privacyLink.setAttribute("data-privacy-link", "");
  const consentActions = element("div", "consent-actions");
  const consentAcceptButton = element("button", "consent-primary", "Activer ecoIA");
  consentAcceptButton.type = "button";
  consentAcceptButton.setAttribute("data-consent-accept", "");
  const consentDeclineButton = element("button", "consent-secondary", "Pas maintenant");
  consentDeclineButton.type = "button";
  consentDeclineButton.setAttribute("data-consent-decline", "");
  consentActions.append(consentAcceptButton, consentDeclineButton);
  consent.append(consentTitle, consentText, privacyLink, consentActions);

  const body = element("div", "body");
  body.setAttribute("data-measurement-body", "");
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
  const [waterRow, water, waterRange] = impactRow("water", "Eau", "data-water", "data-water-range");
  const [carRow, car, carRange] = impactRow("car", "Voiture", "data-car", "data-car-range");
  const [televisionRow, television, televisionRange] = impactRow(
    "television",
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
  const modelMethodNote = element("p", "explanation");
  modelMethodNote.setAttribute("data-model-method-note", "");
  const selectionError = element("p", "selection-error");
  selectionError.setAttribute("data-selection-error", "");
  selectionError.setAttribute("aria-live", "polite");
  selectionError.setAttribute("aria-atomic", "true");
  modelControl.append(modelLabel, modelSelect, detectedModel, modelMethodNote, selectionError);

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

  const privacyControl = element("section", "privacy-control");
  privacyControl.setAttribute("aria-label", "Confidentialité");
  const consentRevokeButton = element("button", "consent-revoke", "Désactiver la mesure");
  consentRevokeButton.type = "button";
  consentRevokeButton.setAttribute("data-consent-revoke", "");
  privacyControl.append(element("h3", "detail-heading", "Confidentialité"), consentRevokeButton);

  detailsGrid.append(
    modelControl,
    context,
    contextExplanation,
    energyRow,
    carbonRow,
    qualitySection,
    diagnosticSection,
    privacyControl,
  );
  details.append(detailsGrid);
  body.append(details);

  region.append(header, consent, body);
  const expandButton = element("button", "collapsed-button");
  expandButton.type = "button";
  expandButton.setAttribute("data-expand", "");
  expandButton.setAttribute("aria-label", "Ouvrir ecoIA");
  expandButton.append(createBrandMark());
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
    dragHandle,
    consent,
    consentAcceptButton,
    consentDeclineButton,
    consentRevokeButton,
    measurementBody: body,
    status,
    model,
    modelWarning,
    modelWarningText,
    chooseModelButton,
    details,
    modelSelect,
    detectedModel,
    modelMethodNote,
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
