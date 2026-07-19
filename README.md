# ecoIA

ecoIA est une extension de navigateur open source qui transforme l’usage visible des assistants IA
en repères environnementaux simples : eau, électricité, carbone, durée équivalente d’un téléviseur
de 100 W et distance équivalente en voiture.

Le petit panneau se déplace à gauche ou à droite, se replie en un bouton de 40 px et propose un
thème clair, sombre ou système. Tout le calcul est local. ecoIA n’est pas un compteur physique : il
met en avant une estimation centrale, puis écrit la plage possible en toutes lettres avec un niveau
de confiance et une source.

## Plateformes et navigateurs

La V1 reconnaît les conversations textuelles de ChatGPT, Claude, Gemini, Mistral Le Chat et
Perplexity. Les builds ciblent :

- Google Chrome et Microsoft Edge, version 121 ou plus récente ;
- Mozilla Firefox, version 121 ou plus récente.

Chromium est exercé automatiquement avec l’extension réellement chargée. Le paquet Firefox est
construit séparément avec son format d’arrière-plan natif ; la vérification manuelle Firefox fait
partie de la checklist de publication.

## Installer facilement

### Depuis une archive publiée

Lorsqu’une version GitHub est disponible, téléchargez `ecoia-chromium.zip` pour Google Chrome ou
Microsoft Edge, ou `ecoia-firefox.zip` pour Mozilla Firefox. Comparez son empreinte SHA-256 avec le
fichier `.sha256` associé, puis décompressez l’archive dans un dossier que vous conserverez.

Pour Google Chrome :

1. saisissez `chrome://extensions` dans la barre d’adresse ;
2. activez **Mode développeur** ;
3. cliquez **Charger l’extension non empaquetée** ;
4. choisissez le dossier décompressé contenant `manifest.json`.

Pour Microsoft Edge :

1. saisissez `edge://extensions` ;
2. activez **Mode développeur** ;
3. cliquez **Charger l’extension décompressée** ;
4. choisissez le dossier décompressé.

Pour Mozilla Firefox, l’installation locale est temporaire tant que l’extension n’est pas signée :

1. saisissez `about:debugging#/runtime/this-firefox` ;
2. cliquez **Charger un module complémentaire temporaire** ;
3. sélectionnez le fichier `manifest.json` du dossier Firefox décompressé ;
4. recommencez après un redémarrage de Firefox si nécessaire.

### Construire depuis le code source

Prérequis : Node.js 22 ou supérieur et npm 10.9.3.

```bash
npm ci
npm run verify
npm run e2e
```

Les dossiers chargeables sont créés dans `dist/chromium` et `dist/firefox`. Les archives se trouvent
dans `dist/packages`.

Après avoir cliqué sur le bouton de rechargement de l’extension dans `chrome://extensions`,
actualisez aussi chaque onglet ChatGPT, Claude, Gemini, Mistral ou Perplexity déjà ouvert. Chrome
exécute sinon, jusqu’à l’actualisation de la page, l’ancien script de contenu dont le contexte vient
d’être invalidé.

## Utiliser ecoIA

Ouvrez une plateforme prise en charge puis une conversation textuelle. Le panneau apparaît à droite.
Vous pouvez le déplacer, l’ancrer avec les flèches, le replier ou changer de thème. Un clic sur
l’icône ecoIA dans la barre du navigateur ouvre ou replie aussi le panneau sur une page prise en
charge.

1. Laissez « Détection automatique » lorsque le panneau reconnaît le modèle affiché par la
   plateforme. ecoIA applique alors le profil documenté correspondant, notamment pour Claude 3.5
   Sonnet et Claude 3.5 Haiku. Si le modèle n’est pas communiqué, le panneau l’indique et utilise
   un profil générique plus incertain. Un modèle affiché mais non documenté, daté ou suffixé utilise
   également le profil générique : un nom proche ne constitue pas une preuve d’équivalence.
2. Lisez `≈` comme « environ » : c’est l’estimation centrale, pas une mesure du fournisseur. La
   ligne « de … à … » écrit séparément la borne basse et la borne haute possible ; ce n’est pas une
   soustraction ni une promesse de précision.
3. Vous pouvez ouvrir « Méthode et détails » et choisir un modèle compatible avec la plateforme si
   la détection est incorrecte. Ce choix manuel est gardé uniquement en mémoire pour la
   conversation active : il disparaît lors d’une navigation ou d’un rechargement de page, y compris
   lorsqu’une nouvelle conversation est affichée sans quitter la plateforme.
4. La ligne « Contexte visible » peut apparaître quand des échanges précédents sont encore dans la
   page. ecoIA les ajoute seulement à la borne haute possible de l’entrée. Ce contexte visible
   n’est pas une preuve du contexte réellement traité par le fournisseur, qui peut le tronquer,
   le résumer, le mettre en cache ou l’enrichir.
5. Les grades A à D décrivent la qualité des données et de leur adaptation, pas la précision de la
   conversation courante. La section « Diagnostic » explique localement l’état de la plateforme,
   de la conversation, du modèle, du contexte et de la réponse ; elle ne montre pas de texte de
   conversation ni de lien ou identifiant.

Une question et ses éventuels segments de réponse visibles comptent comme une seule interaction ;
leurs textes visibles sont cumulés pour l’estimation. Consultez
[la méthodologie](METHODOLOGY.md) et [la calibration des tokens](docs/token-calibration.md).

## Confidentialité

- Le texte visible est lu uniquement dans la page et immédiatement transformé en nombres.
- Aucun prompt, aucune réponse, URL complète ou identité de conversation n’est envoyé au service
  worker ni stocké.
- Aucune requête réseau n’est effectuée par l’extension. Seul un clic explicite sur « Voir la source
  primaire » ouvre le site de la source.
- Les préférences et agrégats numériques restent dans le stockage local du navigateur.

Voir [PRIVACY.md](PRIVACY.md) pour le détail vérifiable.

## Limites importantes

ecoIA ne voit pas les instructions système, les tokens cachés ou non visibles, le raisonnement
caché, le cache, les outils, la recherche web, le matériel, la région ni les médias. Une plateforme
peut modifier son interface et nécessiter une mise à jour d’adaptateur. Les résultats ne constituent
ni une facture énergétique, ni un audit, ni un bilan carbone certifié, ni une donnée réglementaire.

## Désinstaller

Dans `chrome://extensions`, `edge://extensions` ou `about:addons`, trouvez ecoIA puis choisissez
**Supprimer**. Le navigateur efface alors les données de l’extension selon son fonctionnement
normal. Vous pouvez ensuite supprimer le dossier décompressé.

## Développer et contribuer

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run impact-coefficients
npm run source-freshness
npm run e2e
npm run audit
npm run secrets
npm run build
npm run size
```

Le runtime n’a aucune dépendance JavaScript. Consultez [CONTRIBUTING.md](CONTRIBUTING.md),
[le guide d’adaptateur](docs/adding-an-adapter.md) et
[le guide de profil d’impact](docs/adding-an-impact-profile.md). Les décisions d’architecture sont
consignées dans [l’ADR 0001](docs/adr/0001-local-privacy-first-extension.md) et
[l’ADR 0002](docs/adr/0002-evidence-gated-model-profiles.md).

## English summary

ecoIA is a lightweight, open-source browser extension that estimates visible LLM token usage and
turns it into understandable water, electricity and carbon ranges. It supports ChatGPT, Claude,
Gemini, Mistral Le Chat and Perplexity, runs locally, stores numeric aggregates only, and makes no
extension-initiated network request. Estimates are educational ranges, not provider billing,
physical measurements, certified carbon accounting or regulatory data.

## Licence

ecoIA est distribué sous licence MIT. Voir [LICENSE](LICENSE) et
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
