<p align="center">
  <img src="assets/logos/stacked/logo_evergreen_territoria-stacked_20260719_full-color.png" width="180" alt="Logo TerritorIA — Intelligence Artificielle Conseil et Digital">
</p>

<h1 align="center">ecoIA</h1>

<p align="center"><strong>Comprendre l’impact estimé de ses usages IA, au moment où l’on s’en sert.</strong></p>

> ecoIA est un outil open source de sensibilisation développé par **TerritorIA — Intelligence
> Artificielle, Conseil & Digital**. Il fonctionne localement et reste librement consultable,
> partageable et améliorable depuis ce dépôt.

ecoIA est une extension de navigateur open source qui transforme l’usage visible des assistants IA
en repères environnementaux simples : eau, électricité, carbone, durée équivalente d’un téléviseur
de 100 W et distance équivalente en voiture.

Le petit panneau se place librement dans la fenêtre, se replie en un bouton de 36 px et propose un
thème clair, sombre ou système. Tout le calcul est local. ecoIA n’est pas un compteur physique : il
met en avant une estimation centrale, puis écrit la plage possible en toutes lettres avec un niveau
de confiance et une source.

## Pourquoi utiliser ecoIA ?

- **Rendre l’invisible compréhensible** : les tokens visibles deviennent des repères en eau,
  électricité, temps de télévision et distance en voiture.
- **Encourager des usages plus conscients** : l’utilisateur voit l’ordre de grandeur de chaque
  interaction, de sa session et de sa journée.
- **Rester honnête sur l’incertitude** : chaque valeur est une fourchette estimée, accompagnée d’un
  niveau de confiance, d’une méthode et de ses limites.
- **Préserver les conversations** : le calcul reste dans le navigateur ; aucun texte n’est envoyé
  par ecoIA.

## Plateformes et navigateurs

La V1 reconnaît les conversations textuelles de ChatGPT, Claude, Gemini, Mistral Le Chat et
Perplexity. Les builds ciblent :

- Google Chrome et Microsoft Edge, version 121 ou plus récente ;
- Mozilla Firefox, version 121 ou plus récente.

Chromium est exercé automatiquement avec l’extension réellement chargée. Le paquet Firefox est
construit séparément avec son format d’arrière-plan natif ; la vérification manuelle Firefox fait
partie de la checklist de publication.

## Installer facilement — le parcours débutant

| 1. Télécharger | 2. Décompresser | 3. Charger |
| --- | --- | --- |
| Prenez l’archive de votre navigateur dans la dernière version GitHub. | Ouvrez le fichier ZIP et conservez le dossier obtenu. | Activez le mode développeur et choisissez ce dossier. |

Le guide pas à pas explique aussi les mises à jour et les erreurs fréquentes :
**[Installer ecoIA sans connaissances techniques](docs/INSTALLATION.md)**.

### Depuis une archive publiée

Depuis la [dernière version GitHub](https://github.com/didou92i/ecoIA/releases/latest), téléchargez
`ecoia-chromium.zip` pour Google Chrome ou Microsoft Edge, ou `ecoia-firefox.zip` pour Mozilla
Firefox. Comparez si vous le souhaitez son empreinte SHA-256 avec le fichier `.sha256` associé,
puis décompressez l’archive dans un dossier que vous conserverez.

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
Faites glisser la zone du logo TerritorIA et du nom « ecoIA » pour le placer où vous le souhaitez.
Lorsque cette zone possède le focus, les flèches du clavier le déplacent de 10 px et `Maj` avec une
flèche permet un ajustement fin de 1 px. Vous pouvez aussi le replier ou changer de thème. Un clic sur
l’icône ecoIA dans la barre du navigateur ouvre ou replie aussi le panneau sur une page prise en
charge.

Chrome mémorise le niveau de zoom séparément pour chaque site. Le panneau conserve toujours une
largeur CSS de 195 px, mais il peut donc sembler plus grand sur une plateforme réglée à 100 % que sur
une autre réglée à 75 %. Pour comparer les plateformes à taille visuelle identique, ouvrez chacune
d’elles et utilisez `⌘ 0` sur macOS ou `Ctrl 0` sur Windows et Linux afin de rétablir le même zoom.

1. Laissez « Détection automatique » lorsque le panneau reconnaît le modèle affiché par la
   plateforme. ecoIA applique alors le profil documenté correspondant lorsqu’il existe, notamment
   pour Claude 3.5 Sonnet et Claude 3.5 Haiku. Pour ChatGPT, le catalogue courant reconnaît
   GPT-5.6 Sol, GPT-5.6 Sol Pro, GPT-5.5 Instant, GPT-5.4 Thinking, GPT-5.3 Instant et OpenAI o3,
   d’après la revue du 19 juillet 2026. GPT-5.4 doit être revu avant le 23 juillet 2026 et o3 avant
   le 26 août 2026 ; passé ces échéances, ecoIA les retire automatiquement des choix « courants »
   jusqu’à une nouvelle revue.
   Faute de coefficients environnementaux primaires propres à ces modèles, ils utilisent tous le
   profil `openai-generic-v1`, affiché comme « proxy D ». Les pages d’aide OpenAI attestent seulement
   les noms disponibles dans le produit, pas leur impact environnemental. Si le modèle n’est pas
   communiqué, le panneau l’indique aussi et utilise ce profil générique plus incertain. Un modèle
   affiché mais non documenté, daté ou suffixé utilise également un profil générique : un nom proche
   ne constitue pas une preuve d’équivalence.
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
   le résumer, le mettre en cache ou l’enrichir. Pour rester léger, ecoIA remonte depuis le tour
   courant et s’arrête après 4 096 nœuds DOM visités ou 2 097 152 octets UTF-8 ; le contexte est
   alors signalé comme partiel.
5. Les grades A à D décrivent la qualité des données et de leur adaptation, pas la précision de la
   conversation courante. La section « Diagnostic » explique localement l’état de la plateforme,
   de la conversation, du modèle, du contexte et de la réponse ; elle ne montre pas de texte de
   conversation ni de lien ou identifiant.

Une question et ses éventuels segments de réponse visibles comptent comme une seule interaction ;
leurs textes visibles sont cumulés pour l’estimation. Consultez
[la méthodologie](METHODOLOGY.md) et [la calibration des tokens](docs/token-calibration.md).

Les noms ChatGPT évoluent plus vite que les publications environnementales. Leur catalogue local
est donc séparé des profils d’impact et doit être revu au plus tard tous les 90 jours, ou plus tôt
lorsqu’une entrée déclare `reviewBy`. Cette revue ne modifie jamais automatiquement les
coefficients.

Les totaux commencent à partir de l’activation d’ecoIA. Lors d’un rechargement, le tour déjà visible
reste estimé à l’écran mais demeure entièrement hors agrégation, même si sa réponse était en cours :
la suite après rechargement est exclue pour éviter tout double comptage. Seul un tour réellement ajouté
ensuite peut être agrégé. Après l’ouverture d’une conversation observée vide, une réponse vue en cours
est considérée comme nouvellement créée ; une réponse qui apparaît déjà terminée reste une baseline
prudente afin de ne pas compter un historique chargé tardivement.

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

Le runtime n’a aucune dépendance JavaScript. La commande `npm run audit` couvre néanmoins tout
l’arbre installé, y compris la toolchain de développement utilisée pour tester et construire le
projet. Consultez [CONTRIBUTING.md](CONTRIBUTING.md),
[le guide d’adaptateur](docs/adding-an-adapter.md) et
[le guide de profil d’impact](docs/adding-an-impact-profile.md). Les décisions d’architecture sont
consignées dans [l’ADR 0001](docs/adr/0001-local-privacy-first-extension.md) et
[l’ADR 0002](docs/adr/0002-evidence-gated-model-profiles.md), ainsi que dans
[l’ADR 0003](docs/adr/0003-separate-model-catalog-from-impact-evidence.md).

## Projet, gouvernance et mises à jour

ecoIA est développé et maintenu par **TerritorIA — Intelligence Artificielle, Conseil & Digital**.
Le dépôt officiel est [github.com/didou92i/ecoIA](https://github.com/didou92i/ecoIA) : son
propriétaire conserve le contrôle des versions publiées, des corrections et de la feuille de route.

Vous pouvez utiliser, étudier et adapter le code selon la licence MIT. Pour proposer une
amélioration ou signaler une plateforme devenue incompatible, ouvrez une
[Issue](https://github.com/didou92i/ecoIA/issues) sans joindre de prompt, de réponse ou de donnée
personnelle non masquée.

## English summary

ecoIA is a lightweight, open-source browser extension that estimates visible LLM token usage and
turns it into understandable water, electricity and carbon ranges. It supports ChatGPT, Claude,
Gemini, Mistral Le Chat and Perplexity, runs locally, stores numeric aggregates only, and makes no
extension-initiated network request. Estimates are educational ranges, not provider billing,
physical measurements, certified carbon accounting or regulatory data.

## Licence

ecoIA est distribué sous licence MIT. Voir [LICENSE](LICENSE) et
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Le code peut être réutilisé selon cette licence ;
le logo TerritorIA reste un actif de marque distinct, comme précisé dans [NOTICE](NOTICE).
