# Task 7 — Parcours Chromium, accessibilité, confidentialité et performance

## Statut

PASS. Les 15 scénarios Chromium chargent réellement `dist/chromium-e2e`; les vérifications
statiques, les 254 tests unitaires et le build standard passent également.

- Base vérifiée : `17bb8fd9934da0425d6feb08adfc0b8cb7dacd5c`.
- Commit de livraison : sujet `test: cover precision and credibility journeys`; son SHA final est
  fourni dans le handoff, car un commit ne peut pas contenir son propre SHA de manière stable.
- Déploiement, push, merge et publication : NOT RUN (hors périmètre et non demandés).

## Couverture livrée

- Fixture ChatGPT locale : deux tours antérieurs inventés et non personnels, modèle GPT-4o
  observé, variantes `/missing-model` et `/no-context` exécutées avant `document_idle`.
- Précision : résolution automatique GPT-4o sans alerte, avertissement générique exact et focus,
  allowlist ChatGPT, sélection GPT-4.1 sur le même tour, reset SPA et reload, enveloppe de contexte.
- Accessibilité : chemin clavier alerte → détails → sélecteur → source, noms accessibles, focus
  visible, diagnostics structurés non tabulables, contrastes texte/muted >= 4.5 en clair et sombre,
  aucun débordement horizontal ou élément hors écran à 320 × 720.
- Confidentialité : zéro requête HTTP(S)/WS(S) distante, zéro ressource distante, inspection du
  vrai service worker et absence des textes fixture, profils manuels et marqueurs dans
  `storage.local` et `storage.session`.
- Performance : assertion conservée à au plus deux rendus visibles par seconde. La lecture unique
  du contexte reste instrumentée dans `tests/unit/content-controller.test.ts`; le plafond de 2 MiB
  et le contexte partiel restent couverts dans `tests/unit/visible-context.test.ts`.

## Preuves RED → GREEN

- RED E2E ciblé : `npx playwright test tests/e2e/precision-controls.spec.ts
  tests/e2e/accessibility.spec.ts tests/e2e/network-zero.spec.ts` — FAIL, 7/8 PASS ; panneau
  détaillé à `bottom=792` dans un viewport haut de 720.
- RED unitaire de régression : `npx vitest run tests/unit/widget.test.ts` — FAIL, 21/22 PASS ;
  `clampWidgetTop(96, 720, false, 696)` recevait 96 au lieu de 12.
- GREEN ciblé : `npx playwright test tests/e2e/accessibility.spec.ts` — PASS, 3/3.
- Deux relances complètes intermédiaires : FAIL, 14/15, sur des attentes E2E historiques trop
  étroites (`GPT-4o` puis portée globale du contrôle des tirets), corrigées sans changement produit.
- GREEN final : `npm run e2e` — PASS, 15/15 en 18,9 s.

## Correction production

`src/widget/widget-controller.ts` recale désormais la position verticale avec la hauteur réellement
rendue après le `toggle` des détails, à la frame suivante. La frame en attente est annulée au
`disconnect`. Aucun stockage, calcul d'impact, message réseau ou contrat public n'a changé.

## Vérifications finales

- `npm run format:check` — PASS, 106 fichiers.
- `npm run lint` — PASS, 122 fichiers.
- `npm run typecheck` — PASS.
- `npm test` — PASS, 28 fichiers et 254 tests.
- `npm run build` — PASS.
- `npm run e2e` — PASS, 15 scénarios Chromium.
- `git diff --check` — PASS.
- Console et réseau — PASS : la fixture commune échoue sur `console.error`, `pageerror` et
  `requestfailed`; le scénario réseau vérifie en plus HTTP(S), WS(S) et les ressources Performance.

## Fichiers

- Production : `src/widget/widget-controller.ts`.
- Fixture : `tests/fixtures/e2e/host.html`.
- E2E : `tests/e2e/precision-controls.spec.ts`, `accessibility.spec.ts`,
  `network-zero.spec.ts`, `performance.spec.ts`, `aggregation.spec.ts`, `widget.spec.ts`,
  `extension.fixture.ts`.
- Régression unitaire : `tests/unit/widget.test.ts`.
- Rapport : `.superpowers/sdd/task-7-report.md`.

## Auto-revue et préoccupations

- Le correctif est limité au défaut observé et garde l'ancienne hauteur de repli et les positions
  de glisser-déposer.
- Les attentes asynchrones de sélection/reset/bornage utilisent l'UI et les attentes Playwright,
  sans temporisation longue arbitraire.
- Aucun contenu personnel réel, secret, API test-only ou charge de 2 MiB n'a été ajouté.
- Préoccupation résiduelle : aucune. Le warning Node `NO_COLOR`/`FORCE_COLOR` vu dans la sortie
  Playwright est un avertissement du runner, pas une erreur console de la page ou de l'extension.
