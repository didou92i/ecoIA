# ecoIA — Spécification de conception de l’extension navigateur

Date : 18 juillet 2026

Statut : conception validée, prête pour planification
Licence prévue : MIT

## 1. Résumé

ecoIA est une extension open source de sensibilisation à l’impact des usages des assistants d’intelligence artificielle. Elle affiche, pendant une conversation, une estimation locale et transparente :

- des tokens visibles en entrée et en sortie ;
- de l’électricité consommée en Wh ;
- de l’eau consommée en ml ou L ;
- des émissions en gCO2e ;
- d’équivalences en durée de télévision LED et en distance automobile.

L’extension cible d’abord Chrome et Edge, avec un build Firefox issu du même code. Elle prend en charge ChatGPT, Claude, Gemini, Mistral Le Chat et Perplexity.

Les chiffres environnementaux ne sont jamais présentés comme des mesures exactes lorsque les fournisseurs ne publient pas les données nécessaires. Chaque résultat comporte une fourchette, une origine, une date, des limites méthodologiques et un niveau de confiance.

## 2. Objectifs

La V1 doit :

1. rendre l’impact d’une interaction compréhensible en quelques secondes ;
2. compter localement les tokens visibles sans enregistrer les conversations ;
3. fonctionner en temps réel sans dégrader sensiblement la page hôte ;
4. expliquer la provenance et l’incertitude de chaque estimation ;
5. être facile à installer depuis une archive GitHub ;
6. être suffisamment simple pour recevoir des contributions externes ;
7. ne dépendre d’aucun serveur ecoIA.

## 3. Non-objectifs de la V1

La V1 ne cherche pas à :

- reproduire les tokens facturés lorsque la plateforme ne les expose pas ;
- estimer précisément les instructions système, le cache, les appels d’outils ou le raisonnement caché ;
- produire un bilan carbone certifié, réglementaire ou auditable ;
- mesurer la génération d’images, de vidéo ou d’audio ;
- proposer des statistiques au-delà de la réponse courante, de la session et du jour ;
- prendre en charge des sites arbitraires sans adaptateur validé ;
- utiliser la position de l’utilisateur comme approximation de celle du centre de données ;
- publier automatiquement sur un store ou un dépôt distant.

## 4. Décision d’architecture

### 4.1 Options étudiées

#### Fork complet d’AI Wattch

Avantage : détecteurs et stockage existants.

Inconvénients : React, D3, Tailwind, polices, dépendance à une API distante, géolocalisation IP, trois plateformes seulement et dette de typage. L’audit local du 18 juillet 2026 a trouvé environ 12 263 lignes dans `src`, un paquet Chrome de 615 390 octets non compressé, 25 tests unitaires réussis, quatre erreurs TypeScript et onze alertes dans la chaîne de développement. Aucun avis `npm audit --omit=dev` n’affectait les dépendances de production lors de cette vérification.

#### Nouvelle extension native

Avantages : confidentialité et poids maîtrisés, architecture exactement adaptée.

Inconvénient : les détecteurs de plateformes doivent être construits et maintenus.

#### Application React avec animations Framer Motion

Avantage : développement d’interface familier.

Inconvénients : dépendances et poids inutiles pour un petit widget injecté.

### 4.2 Décision

ecoIA est un dépôt indépendant en TypeScript, HTML et CSS natifs. Les parties pertinentes d’AI Wattch peuvent être réutilisées de manière sélective après revue, conformément à sa licence MIT. Toute portion substantielle reprise conserve le texte de licence et la notice de copyright d’origine dans `THIRD_PARTY_NOTICES.md`, avec une mention dans `NOTICE` et dans les fichiers appropriés.

### 4.3 Conséquences

- aucune dépendance d’interface à l’exécution ;
- aucune API distante pour le calcul ;
- profils environnementaux distribués avec l’extension ;
- adaptateurs de plateformes isolés et remplaçables ;
- plus de travail initial sur les détecteurs, compensé par une base plus petite et testable.

Conditions de réexamen : un framework d’interface ne sera envisagé que si l’interface dépasse durablement les capacités de composants DOM simples ou si sa maintenance native devient mesurablement plus coûteuse.

## 5. Architecture logique

```text
Page de l’assistant IA
  -> adaptateur de plateforme
  -> estimateur local de tokens
  -> moteur d’impact versionné
  -> service worker événementiel
  -> mini-panneau isolé en Shadow DOM
  -> stockage local agrégé
```

### 5.1 Content scripts

Un bundle de content script est généré pour chaque plateforme. Le manifeste ne charge que le bundle correspondant au domaine visité. Chaque adaptateur respecte une interface commune :

- détecter le modèle affiché ;
- localiser la zone de conversation ;
- reconnaître le prompt visible courant ;
- suivre la réponse pendant sa génération ;
- signaler la fin, l’interruption ou la régénération ;
- émettre uniquement des métriques numériques.

Les permissions hôtes sont limitées aux domaines officiels nécessaires aux cinq services. Aucune permission `<all_urls>` n’est demandée.

### 5.2 Estimateur de tokens

Le texte visible est lu temporairement dans la mémoire du content script. L’estimateur produit des bornes basse, centrale et haute pour l’entrée et la sortie. Le texte est ensuite libéré et n’est ni stocké, ni journalisé, ni envoyé.

L’estimation légère utilise des caractéristiques déterministes : nombre de caractères, segments de mots, espaces, ponctuation, code et catégories Unicode. Des coefficients par famille de tokenizer et par type de contenu sont calibrés hors extension sur des corpus de test à l’aide des compteurs ou tokenizers officiels disponibles. Les coefficients et leurs erreurs observées sont distribués sous forme de petites données statiques.

Si une page expose directement un nombre de tokens fiable, l’adaptateur peut l’utiliser et marque le résultat comme observé.

### 5.3 Moteur d’impact

Le moteur ne reçoit que : fournisseur, modèle ou famille, tokens estimés, durée de génération et type d’événement. Il sélectionne un profil versionné, calcule une fourchette puis retourne les trois impacts et leurs équivalences.

Les estimateurs acceptés sont :

- `token-linear` : base fixe plus facteurs distincts d’entrée et de sortie ;
- `prompt-median` : donnée publiée par requête médiane, sans prétendre à une relation linéaire exacte ;
- `model-proxy` : modèle ou classe comparable avec fourchette élargie.

Un profil incomplet ou sans source n’est pas publiable.

### 5.4 Service worker

Le service worker Manifest V3 se réveille uniquement lors d’un événement. Il :

- valide le schéma des métriques ;
- sérialise les écritures concurrentes de plusieurs onglets ;
- déduplique les événements ;
- met à jour les agrégats du jour ;
- diffuse les totaux numériques aux widgets ouverts.

### 5.5 Widget

Le widget est rendu dans un Shadow DOM et n’insère jamais de HTML provenant de la conversation. Toutes les valeurs dynamiques sont affectées via `textContent` ou des propriétés sûres. Le Shadow DOM n’est pas considéré comme une frontière de sécurité ; il sert uniquement à isoler les styles.

### 5.6 API navigateur

Un petit adaptateur interne normalise `chrome.*` et `browser.*`. Aucun polyfill volumineux n’est requis. Les manifestes Chrome/Edge et Firefox sont générés depuis une base commune afin d’éviter leur divergence.

## 6. Confidentialité et sécurité

### 6.1 Données traitées

Traitement transitoire en mémoire :

- texte visible du dernier prompt ;
- texte visible de la réponse en cours ;
- libellé visible du modèle.

Stockage autorisé :

- thème et côté d’ancrage ;
- modèle choisi manuellement lorsque la détection échoue ;
- compteurs numériques d’entrée et de sortie ;
- fourchettes d’énergie, d’eau et de carbone ;
- nombre d’interactions par plateforme et famille de modèle ;
- agrégats de la session et du jour.

Stockage interdit :

- prompts et réponses ;
- extraits, empreintes cryptographiques ou résumés de conversation ;
- URL complète ou identifiant de conversation ;
- adresse IP ou localisation de l’utilisateur ;
- identifiants de compte ;
- clés d’API ;
- télémétrie ou identifiant d’installation.

Une session correspond à la conversation active dans un onglet depuis son ouverture ou depuis la dernière navigation interne vers une autre conversation. Elle est conservée en mémoire de session du navigateur et disparaît à la fermeture de la session du navigateur. Le total du jour est un agrégat numérique partagé entre onglets ; il est remplacé au changement de date locale. Aucun historique des jours précédents n’est conservé dans la V1.

### 6.2 Réseau

ecoIA ne crée aucune requête `fetch`, XHR, WebSocket, `sendBeacon` ou ressource distante. Les icônes, styles, références bibliographiques et profils sont inclus dans le paquet. La politique de sécurité de contenu interdit le code distant et l’évaluation dynamique. Un lien bibliographique externe ne peut être ouvert qu’après un clic explicite de l’utilisateur ; cette navigation volontaire n’est jamais déclenchée en arrière-plan.

### 6.3 Données non fiables

Le contenu des pages est traité comme une entrée non fiable. Il n’est jamais utilisé comme code, sélecteur construit dynamiquement, commande, URL, décision d’autorisation ou HTML. Les métriques envoyées au service worker sont validées avec des limites numériques strictes.

## 7. Méthodologie environnementale

### 7.1 Registre de profils

Chaque profil contient :

- identifiant stable et version ;
- fournisseur, famille et règles de correspondance du modèle ;
- type d’estimateur ;
- valeurs basse, centrale et haute ;
- unité et périmètre de mesure ;
- matériel, région et infrastructure lorsque connus ;
- date de publication et date de vérification ;
- URL de la source primaire ;
- limites et hypothèses ;
- niveau de confiance A, B, C ou D.

### 7.2 Niveaux de confiance

- A : mesure publiée par le fournisseur pour le produit concerné ;
- B : mesure expérimentale sur le même modèle et un matériel identifié ;
- C : estimation publiée pour le même modèle ou une famille proche ;
- D : profil générique ou proxy faute de données suffisantes.

Le niveau ne transforme pas une donnée par prompt en donnée exacte par token. Le détail explique toujours le périmètre réel de la source.

### 7.3 Sources initiales

Les sources de départ sont :

- documentation Chrome Manifest V3, content scripts et Storage API ;
- documentation WebExtensions de Mozilla ;
- documentations de comptage de tokens de Gemini et Claude ;
- tokenizer open source officiel de Mistral ;
- étude Google sur l’impact d’un prompt médian Gemini Apps ;
- ML.ENERGY Benchmark ;
- étude « How Hungry is AI? » ;
- étude « Making AI Less Thirsty » ;
- Base Empreinte et documentation Datagir de l’ADEME.

La liste exacte, les dates d’accès et les licences des données figurent dans `METHODOLOGY.md` et dans le registre machine-readable.

### 7.4 Équivalences

- télévision : appareil de référence de 100 W ; `seconds = energyWh / 100 * 3600` ;
- automobile : facteur de référence ADEME de 193,2 gCO2e par véhicule-km ; `meters = carbonG / 193.2 * 1000` ;
- eau : affichage direct en ml sous 1 L, puis en L.

Les équivalences sont des repères pédagogiques, pas des mesures additionnelles.

### 7.5 Limites affichées

Le détail « Méthode et sources » mentionne explicitement :

- l’absence possible de tokens cachés ;
- l’incertitude sur le matériel, le batch, le cache et la région ;
- la différence entre mesure opérationnelle et cycle de vie complet ;
- la date des données ;
- l’interdiction d’utiliser ecoIA pour une déclaration ESG ou réglementaire.

## 8. Expérience utilisateur

### 8.1 Forme

Le widget développé mesure environ 232 px de large et reste borné par la hauteur disponible. Il possède une poignée de déplacement, s’aimante au bord le plus proche et conserve une marge minimale de 12 px. Son état replié est une pastille de 40 px.

La position initiale est à droite. L’utilisateur peut :

- glisser le widget ;
- l’ancrer à gauche ou à droite avec des boutons accessibles ;
- le replier ;
- le rouvrir par la pastille ou l’action de la barre d’outils.

La position est recalée lorsque la fenêtre est redimensionnée afin que le widget reste entièrement visible.

### 8.2 Contenu

Ordre d’information :

1. modèle et état de la mesure ;
2. tokens visibles d’entrée et de sortie ;
3. impacts de la réponse courante ;
4. total de la session ;
5. total du jour ;
6. niveau de confiance et accès à la méthode.

Les trois impacts principaux sont l’eau, la distance automobile et la durée de télévision. L’électricité en Wh et le carbone en gCO2e restent visibles dans le détail.

### 8.3 Thèmes et mouvement

Le thème suit le système au premier lancement. Un bouton permet de choisir clair ou sombre et mémorise le choix. Les animations sont limitées au déplacement, au repli et à la variation douce des nombres. `prefers-reduced-motion` désactive les transitions non essentielles.

### 8.4 Ton

Le vocabulaire est pédagogique, sobre et non culpabilisant. Les niveaux « léger », « modéré » et « important » ne remplacent jamais les valeurs. La V1 ne contient ni score social, ni classement, ni récompense encourageant la consommation.

### 8.5 Accessibilité

Objectif : WCAG 2.2 AA.

- commandes natives et libellées ;
- focus visible ;
- navigation clavier complète ;
- alternative clavier au glisser-déposer ;
- contraste suffisant dans les deux thèmes ;
- aucune information portée uniquement par la couleur ;
- annonces `aria-live="polite"` uniquement à la fin d’une réponse ;
- cibles interactives d’au moins 24 x 24 px, avec espacement évitant les activations accidentelles.

## 9. États et erreurs

États possibles : initialisation, mesure active, réponse en cours, réponse terminée, modèle inconnu, mesure en pause et plateforme non prise en charge.

Règles :

- un adaptateur qui ne reconnaît plus la page échoue fermé et affiche « mesure en pause » ;
- aucune valeur antérieure n’est présentée comme la réponse courante ;
- une réponse interrompue compte uniquement sa partie visible ;
- les segments assistant visibles rattachés au même message utilisateur forment une interaction et
  leur texte visible est cumulé ;
- une régénération rattachée au même prompt met à jour cette interaction visible ;
- un prompt modifié crée une nouvelle interaction ;
- un changement de conversation SPA réinitialise la session sans stocker l’identifiant ;
- un modèle inconnu utilise un profil générique de confiance D et propose une sélection manuelle ;
- les événements possèdent un identifiant aléatoire éphémère et une fenêtre de déduplication ;
- les dépassements de taille, profondeur ou valeur sont rejetés par le service worker.

## 10. Performance

Budgets de la V1 :

- paquet compressé inférieur à 150 Ko, icônes incluses ;
- aucune dépendance JavaScript d’exécution ;
- au maximum deux rafraîchissements visuels par seconde pendant le streaming ;
- lecture et calculs DOM limités au conteneur de conversation ; observateur structurel temporaire
  limité à la découverte ou au remplacement de cette racine ;
- aucun parcours complet du document à chaque mutation ;
- données locales bornées à la session et au jour courant ;
- arrêt propre de tous les observateurs et écouteurs lors d’une navigation ou désactivation.

Le build échoue si le budget de paquet est dépassé. Les performances sont mesurées sur des fixtures longues avant la publication.

## 11. Structure prévue du dépôt

```text
src/
  adapters/
    chatgpt/
    claude/
    gemini/
    mistral/
    perplexity/
  browser/
  content/
  impact/
  storage/
  widget/
  shared/
data/
  impact-profiles.json
  token-calibration.json
scripts/
tests/
  fixtures/
  unit/
  adapters/
  e2e/
docs/
  superpowers/specs/
manifest/
```

Les fichiers restent courts et orientés vers une responsabilité. Les cinq adaptateurs implémentent le même contrat et ne dépendent pas du widget.

## 12. Tests et vérification

### 12.1 Tests unitaires

- estimation des tokens par type de texte et famille ;
- propagation des bornes basse, centrale et haute ;
- formules des équivalences ;
- sélection et validation des profils ;
- stockage, concurrence et déduplication ;
- thèmes et préférences.

### 12.2 Tests de contrat des adaptateurs

Chaque plateforme possède des fragments HTML anonymisés couvrant :

- prompt court et long ;
- réponse en streaming ;
- arrêt anticipé ;
- régénération ;
- changement de modèle ;
- changement de conversation SPA ;
- DOM non reconnu.

Les fixtures ne contiennent aucune conversation réelle ou donnée personnelle.

### 12.3 Tests de navigateur

Une instance Chromium persistante charge l’extension non empaquetée et des pages de fixture locales. Les tests vérifient l’injection, le Shadow DOM, le déplacement, l’ancrage, le repli, les thèmes, le clavier, le stockage entre onglets et l’absence de doublons.

Une vérification réseau bloque et signale tout `fetch`, XHR, WebSocket, `sendBeacon` ou ressource distante créé par l’extension.

### 12.4 Vérification réelle

Avant une release, un smoke test manuel est exécuté sur les cinq plateformes avec des comptes autorisés. Les sélecteurs observés sont mis à jour sans capturer de contenu personnel dans les fixtures.

### 12.5 CI

GitHub Actions exécute avec permissions minimales : format, lint, type-check, tests unitaires, tests d’adaptateurs, build des deux navigateurs, tests Chromium, audit des dépendances, scan de secrets et contrôle de taille. Les versions sont épinglées et le lockfile est commité.

## 13. Documentation et distribution

Le dépôt inclut :

- `README.md` français avec résumé anglais ;
- `LICENSE` MIT ;
- `NOTICE` pour les portions tierces ;
- `PRIVACY.md` ;
- `SECURITY.md` ;
- `CONTRIBUTING.md` ;
- `METHODOLOGY.md` ;
- `CHANGELOG.md` ;
- guide d’ajout d’un adaptateur ou d’un profil.

Chaque release GitHub fournit des archives Chrome/Edge et Firefox, leurs sommes SHA-256 et des instructions pour débutants. La publication dans Chrome Web Store, Microsoft Edge Add-ons ou Firefox Add-ons est une opération externe distincte nécessitant une validation explicite.

## 14. Critères d’acceptation V1

La V1 est acceptée lorsque :

1. les cinq plateformes déclenchent correctement une interaction complète ;
2. les tokens visibles d’entrée et de sortie évoluent pendant la réponse ;
3. les trois impacts affichent fourchette, unité et confiance ;
4. chaque profil publié a une source primaire consultable et datée ;
5. le widget se déplace, s’ancre, se replie et reste visible après redimensionnement ;
6. les thèmes clair et sombre fonctionnent et persistent ;
7. le parcours clavier est complet ;
8. aucun prompt, réponse, identifiant de conversation ou emplacement utilisateur n’est stocké ;
9. aucun appel réseau n’est émis par l’extension ;
10. le paquet compressé reste inférieur à 150 Ko ;
11. tous les contrôles CI requis réussissent ;
12. les builds Chrome/Edge et Firefox s’installent selon la documentation ;
13. les limites méthodologiques sont visibles depuis le widget ;
14. les éléments réutilisés sous MIT sont attribués.

## 15. Références de conception

- Chrome Extensions — Manifest V3 : https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3
- Chrome Extensions — Content scripts : https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts
- Chrome Extensions — Storage API : https://developer.chrome.com/docs/extensions/reference/api/storage
- Mozilla — WebExtensions content scripts : https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/content_scripts
- Gemini — Understand and count tokens : https://ai.google.dev/gemini-api/docs/tokens
- Claude — Token counting : https://platform.claude.com/docs/en/build-with-claude/token-counting
- Mistral — `mistral-common` : https://github.com/mistralai/mistral-common
- Google — Measuring the environmental impact of AI inference : https://cloud.google.com/blog/products/infrastructure/measuring-the-environmental-impact-of-ai-inference/
- ML.ENERGY Benchmark : https://arxiv.org/abs/2505.06371
- How Hungry is AI? : https://arxiv.org/abs/2505.09598
- Making AI Less Thirsty : https://arxiv.org/abs/2304.03271
- ADEME — Base Empreinte : https://base-empreinte.ademe.fr/
- ADEME Datagir — facteur automobile : https://docs.datagir.ademe.fr/documentation/lexique-environnemental-et-changement-climat
- AI Wattch — dépôt MIT étudié : https://github.com/AIWattch/AI-Wattch
