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
  inputTokens: HTMLElement;
  outputTokens: HTMLElement;
  water: HTMLElement;
  car: HTMLElement;
  television: HTMLElement;
  session: HTMLElement;
  day: HTMLElement;
  energy: HTMLElement;
  carbon: HTMLElement;
  confidence: HTMLElement;
  sourceLink: HTMLAnchorElement;
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

function tokenCard(labelText: string, dataAttribute: string): [HTMLElement, HTMLElement] {
  const card = element("div", "token-card");
  card.append(element("span", "label", labelText));
  const value = element("span", "value", "0 token");
  value.setAttribute(dataAttribute, "");
  card.append(value);
  return [card, value];
}

function impactRow(
  glyph: string,
  labelText: string,
  dataAttribute: string,
): [HTMLElement, HTMLElement] {
  const row = element("div", "impact-row");
  const icon = element("span", "impact-icon", glyph);
  icon.setAttribute("aria-hidden", "true");
  const content = element("div");
  content.append(element("span", "impact-name", labelText));
  const value = element("span", "impact-value", "—");
  value.setAttribute(dataAttribute, "");
  content.append(value);
  row.append(icon, content);
  return [row, value];
}

function summaryCard(labelText: string, dataAttribute: string): [HTMLElement, HTMLElement] {
  const card = element("div", "summary-card");
  card.append(element("span", "label", labelText));
  const value = element("span", "value", "Aucune donnée");
  value.setAttribute(dataAttribute, "");
  card.append(value);
  return [card, value];
}

function detailRow(labelText: string, dataAttribute: string): [HTMLElement, HTMLElement] {
  const row = element("div", "detail-row");
  row.append(element("span", undefined, labelText));
  const value = element("span", undefined, "—");
  value.setAttribute(dataAttribute, "");
  row.append(value);
  return [row, value];
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
  const collapseButton = iconButton("Replier ecoIA", "–");
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
  const model = element("div", "model", "Modèle non détecté");
  model.setAttribute("data-model", "");
  body.append(statusRow, model);

  body.append(element("h2", "eyebrow", "Tokens visibles"));
  const tokenGrid = element("div", "token-grid");
  const [inputCard, inputTokens] = tokenCard("Entrée", "data-input-tokens");
  const [outputCard, outputTokens] = tokenCard("Sortie", "data-output-tokens");
  tokenGrid.append(inputCard, outputCard);
  body.append(tokenGrid);

  body.append(element("h2", "eyebrow", "Réponse actuelle"));
  const impactList = element("div", "impact-list");
  const [waterRow, water] = impactRow("●", "Eau", "data-water");
  const [carRow, car] = impactRow("↔", "Distance en voiture", "data-car");
  const [televisionRow, television] = impactRow("▣", "Télévision 100 W", "data-television");
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
  const [energyRow, energy] = detailRow("Électricité", "data-energy");
  const [carbonRow, carbon] = detailRow("Carbone", "data-carbon");
  const [confidenceRow, confidence] = detailRow("Confiance", "data-confidence");
  const sourceLink = element("a", "source-link", "Voir la source primaire");
  sourceLink.hidden = true;
  sourceLink.target = "_blank";
  sourceLink.rel = "noopener noreferrer";
  sourceLink.setAttribute("aria-label", "Ouvrir la source primaire dans un nouvel onglet");
  detailsGrid.append(energyRow, carbonRow, confidenceRow, sourceLink);
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
    inputTokens,
    outputTokens,
    water,
    car,
    television,
    session,
    day,
    energy,
    carbon,
    confidence,
    sourceLink,
    live,
  };
}
