# Rapport de vérification locale ecoIA V1

Date : 18 juillet 2026

Branche : `codex/ecoia-v1`

Périmètre applicatif audité : `8a75a92..1bbd2ce`

Ce rapport décrit uniquement ce qui a été exécuté ou observé localement. Il ne constitue pas une
validation des déclarations environnementales des fournisseurs, une certification de sécurité ou
une publication GitHub/store.

## Résultat synthétique

La release candidate locale passe la chaîne automatisée disponible : 183 tests Vitest, 8 parcours
Chromium avec l’extension chargée, deux builds, budget de poids, audits npm, scan de secrets et
empreintes SHA-256. Les essais manuels Google Chrome/Edge/Firefox et les comptes réels restent
explicitement bloqués ou non exécutés ci-dessous.

## Qualité, tests et build

- `npm run format:check` — **PASS** : 93 fichiers vérifiés, aucune correction requise.
- `npm run lint` — **PASS** : 109 fichiers vérifiés, aucune erreur.
- `npm run typecheck` — **PASS** : `tsc --noEmit`, code de sortie 0.
- `npm test` — **PASS** : 23 fichiers de tests, 183 tests réussis, 0 échec.
- `npm run build` — **PASS** : `dist/chromium`, `dist/firefox`,
  `ecoia-chromium.zip` et `ecoia-firefox.zip` générés.
- `npm run size` — **PASS** : Chromium 98 597 octets ; Firefox 98 738 octets ; budget maximal
  153 600 octets par archive.
- `npm run e2e` — **PASS** : 8/8 parcours Chromium. Injection réelle, thème persistant,
  repli/dépli, déplacement, redimensionnement, clavier, contraste, mouvement réduit, agrégation
  multi-onglets, stockage numérique, zéro trafic distant et deux rendus maximum par seconde.
- parcours de redimensionnement répété avec
  `playwright test ... --repeat-each=5` — **PASS** : 5/5.

## Sécurité, confidentialité et chaîne logicielle

- `npm audit --audit-level=moderate` — **PASS** : 0 vulnérabilité dans l’arbre complet de
  développement au moment du contrôle.
- `npm audit --omit=dev` — **PASS** : 0 vulnérabilité runtime ; aucune dépendance runtime déclarée.
- `npm run secrets` — **PASS** : 129 fichiers considérés, aucun motif de secret à haute confiance.
- manifests générés — **PASS** : Manifest V3, seule permission `storage`, six origines exactes,
  absence de `<all_urls>`, `tabs`, `activeTab`, `scripting` et `webRequest`.
- scan des bundles pour `fetch(`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`,
  `eval(` et `new Function` — **PASS** : aucun appel trouvé.
- scan des releases pour `127.0.0.1`, `localhost` et `*.map` — **PASS** : aucun élément trouvé.
- requêtes navigateur observées par le test E2E — **PASS** : aucune requête distante initiée par
  l’extension ; seule la navigation de fixture déclenchée par le harnais est autorisée.
- stockage inspecté depuis le service worker en E2E — **PASS** : les textes synthétiques, l’origine
  de fixture et l’identifiant de conversation sont absents de `storage.local` et
  `storage.session`.

### Hits inspectés, non classés comme défauts

Les propriétés `promptText`, `responseText`, `conversationRoot` et `conversationMarker` existent
dans les bundles de contenu : elles font partie du contrat DOM éphémère avant conversion locale.
Elles n’apparaissent pas dans le bundle d’arrière-plan. Le contrôleur vide les deux chaînes après
estimation ; les tests de frontière et le contrôle E2E du stockage vérifient qu’elles ne franchissent
pas la messagerie numérique.

Les seules URL HTTPS trouvées dans le JavaScript sont les trois sources primaires Google, Mistral et
*How Hungry is AI?*. Elles alimentent le lien utilisateur « Voir la source primaire ». L’absence de
primitive réseau empêche leur chargement automatique ; l’ouverture demande un clic explicite. Les
manifests ne référencent aucun script distant.

## Archives et empreintes

- `npm run checksums` — **PASS**.
- `shasum -a 256 -c` exécuté depuis `dist/packages` — **PASS** pour les deux fichiers.
- Chromium :
  `f6663f461957f90b8a3eedbdd77e82f275ceea8c05e4981e859e61df11595ba5`.
- Firefox :
  `83e12e9558fc1a6d35221f6fa609e500217dfffac5fe604fa5efcb6a81af3187`.
- contenu inspecté — **PASS** : manifest, arrière-plan, cœur partagé, cinq adaptateurs, quatre icônes
  PNG et documents légaux/méthodologiques présents ; aucune source map.

Ces empreintes correspondent exactement aux archives locales de ce contrôle. La construction est
déterministe ; toute release doit néanmoins régénérer et confirmer ses propres empreintes avant
publication.

## Essais navigateurs et plateformes

- Chromium Playwright, extension non empaquetée et fixture locale — **PASS** : parcours complet du
  DOM synthétique au widget et aux agrégats numériques.
- installation manuelle Google Chrome — **BLOCKED** : Google Chrome 149 est installé, mais cette
  version ignore le chargement non empaqueté par les drapeaux d’automatisation utilisés. Le contrôle
  interactif ne peut pas ouvrir `chrome://extensions` en raison de la politique de sécurité de
  l’environnement. Aucune installation n’a donc été revendiquée.
- installation Microsoft Edge — **BLOCKED** : l’application Microsoft Edge n’est pas installée dans
  l’environnement.
- installation temporaire Mozilla Firefox — **BLOCKED** : Firefox et `web-ext` ne sont pas installés.
- smoke tests ChatGPT, Claude, Gemini, Mistral Le Chat et Perplexity sur comptes réels — **NOT RUN** :
  aucune session de navigateur explicitement autorisée avec conversation de test n’a été fournie.
  Les cinq adaptateurs sont couverts uniquement par fixtures synthétiques et tests de contrat.

## Git et périmètre utilisateur

- `git diff --check main...HEAD` — **PASS** après correction de deux fins de ligne Markdown.
- `git status --porcelain` dans le worktree — **PASS** : vide au moment du contrôle.
- historique inspecté depuis `8a75a92` — **PASS** : 20 commits avant le présent rapport, 129 fichiers
  modifiés dans le périmètre audité.
- `.vscode/` — **PASS** : reste non suivi dans le checkout principal, absent de `git ls-files` et de
  tous les commits ecoIA.
- publication — **NOT RUN** : aucun dépôt distant créé, aucun push, aucune pull request, aucune
  release et aucune soumission store.

## Limites restantes

- Les DOM réels peuvent changer sans préavis ; les tests de fixtures ne prouvent pas les cinq sites
  en production.
- Firefox/Edge doivent être chargés manuellement avant la première release publique.
- Les tokens système, cachés, mis en cache, d’outils, de recherche et de médias restent non
  observables.
- Les impacts sont des fourchettes pédagogiques sourcées, pas des mesures de centre de données.
- L’identité Git locale actuelle a été générée automatiquement :
  `AZZABI <az@macbook-pro-de-azzabi.home>`. Elle doit être confirmée ou corrigée avant tout push
  public.

## Décision locale

**PASS avec limites déclarées** pour conserver une release candidate locale sur la branche de
travail. La fusion, le push et la publication demandent une décision séparée du mainteneur.
