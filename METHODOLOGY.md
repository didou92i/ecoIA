# Méthodologie environnementale ecoIA

Version : `2026-07-19.2`
Dernière vérification des sources : 19 juillet 2026

## Ce que mesure ecoIA

ecoIA affiche une estimation pédagogique de l’impact associé au texte visible d’une interaction.
Il ne s’agit ni d’une mesure électrique du centre de données, ni d’un bilan carbone certifié, ni
d’une donnée utilisable pour une déclaration ESG ou réglementaire.

Les plateformes ne rendent généralement pas publics le modèle exact, le matériel, le batch, la
région, le cache, les instructions système, les appels d’outils ou les tokens de raisonnement.
ecoIA montre donc une borne basse, une valeur centrale et une borne haute. Le niveau de confiance
qualifie la provenance de chaque indicateur :

- A : valeur publiée par le fournisseur pour le produit et le périmètre indiqués ;
- B : mesure expérimentale du même modèle sur un matériel identifié ;
- C : estimation publiée pour le modèle ou une famille proche ;
- D : proxy générique ou transposition faute de données suffisantes.

Le niveau A ne transforme pas une médiane par prompt en mesure exacte de la réponse courante.

Les formulations affichées dans l’extension sont les suivantes :

- A — donnée fournisseur documentée pour un périmètre comparable ;
- B — donnée publiée avec adaptation limitée ;
- C — estimation modélisée à partir de données publiées ;
- D — proxy générique avec forte incertitude.

Le grade global est le moins bon des grades de l’électricité, de l’eau et du carbone. Chaque
indicateur conserve son propre grade dans le détail. Ces grades qualifient la conception et la
provenance du profil ; ils ne prouvent pas que le fournisseur a mesuré l’interaction affichée.

## Profils et provenance

Le registre machine-readable des coefficients est `data/impact-profiles.json`. Le catalogue local
des noms de modèles actuellement proposés par les produits est distinct et se trouve dans
`data/model-catalog.json`. L’inventaire transversal de toutes leurs sources, ainsi que des sources
d’impact, d’équivalence automobile et de calibration des tokens, est
`data/source-inventory.json`. Une modification est refusée par les tests si un profil n’a pas de
source HTTPS, de date, de périmètre, de limites, d’unité reconnue ou de fourchette valide. Les
proxys circulaires sont également interdits.

Une source de catalogue prouve seulement qu’un nom ou un mode est proposé dans une interface. Elle
ne devient jamais une source de coefficient environnemental. Cette séparation est détaillée dans
`docs/adr/0003-separate-model-catalog-from-impact-evidence.md`.

### Revue de fraîcheur des sources

Chaque source de l’inventaire a une `accessedDate`. La commande `npm run source-freshness` lit
uniquement `data/source-inventory.json` et `data/model-catalog.json` avec les bibliothèques standard
de Node.js. Elle couvre les profils d’impact, le facteur automobile, toutes les familles de
calibration des tokens, les sources du catalogue et la date de revue du catalogue lui-même. Elle
demande une revue après plus de 366 jours strictement pour les sources stables ; une source à
exactement 366 jours reste acceptée. Les sources et le catalogue de modèles, plus volatils, ont une
limite distincte de 90 jours. Une entrée peut imposer une échéance antérieure avec `reviewBy` ; elle
cesse alors d’être présentée comme un choix courant et la vérification échoue dès cette date. Les
identifiants à revoir sont affichés dans un ordre stable et la commande sort avec un code non nul.
Une date source ou date de revue invalide arrête aussi la vérification.

Cette commande ne télécharge aucune URL, n’écrit aucun fichier et ne modifie jamais les coefficients
automatiquement. `npm run verify` l’exécute avant le build : une revue consiste donc à vérifier la
source humainement, à mettre à jour l’inventaire, les registres et les calculs associés, puis à
livrer une nouvelle version de l’extension.

## Contexte conversationnel visible

ecoIA estime séparément le prompt courant et les tours précédents encore visibles dans la page. Si
ce contexte visible existe, l’enveloppe utilisée pour les impacts est :

- `low` : borne basse du prompt courant ;
- `central` : estimation centrale du prompt courant ;
- `high` : borne haute du prompt courant plus borne haute du contexte antérieur visible.

Le contexte visible ne change donc pas la valeur centrale : il représente une borne haute possible.
Il ne prouve pas le contexte réel reçu par le fournisseur. Celui-ci peut tronquer, résumer, mettre
en cache ou enrichir ce contexte avec des données qu’ecoIA ne voit pas. La lecture parcourt le DOM en
sens inverse depuis le tour courant, sans matérialiser ni trier tout l’historique. Elle s’arrête après
4 096 nœuds DOM visités ou 2 097 152 octets UTF-8 retenus ; atteindre une borne marque le contexte
comme partiel.

### Gemini Apps

Google publie pour le prompt texte médian de Gemini Apps observé en mai 2025 : `0,24 Wh`,
`0,03 gCO2e` et `0,26 ml` d’eau. Le périmètre inclut la pile de service en production. Google
précise que cette médiane ne représente pas chaque prompt et que les chiffres n’ont pas reçu de
vérification tierce indépendante.

Source : https://cloud.google.com/blog/products/infrastructure/measuring-the-environmental-impact-of-ai-inference/

Le profil ecoIA est de type `prompt-median` : il ne prétend pas que ces trois valeurs évoluent
linéairement avec les tokens visibles. Les multiplicateurs 0,5× et 2× forment une plage de
sensibilité choisie par ecoIA ; ils ne sont pas un intervalle statistique publié par Google.

### Mistral Large 2 / Le Chat

Mistral publie l’impact marginal d’une réponse Le Chat de 400 tokens : `1,14 gCO2e` et `45 ml`
d’eau, terminal utilisateur exclu. L’étude inclut des impacts amont, notamment une approximation de
la fabrication des serveurs. Elle ne publie pas l’énergie par réponse.

Source : https://mistral.ai/news/our-contribution-to-a-global-environmental-standard-for-ai/

L’eau et le carbone utilisent donc un profil `prompt-median` de confiance A. L’énergie et sa durée
de télévision utilisent séparément le proxy générique de confiance D. Pour un autre modèle
Mistral, les valeurs Large 2 sont des proxys de confiance D avec une fourchette encore élargie.

### GPT-4o, GPT-4.1, Claude 3.7 Sonnet et Claude 3.5

L’étude *How Hungry is AI?* combine les performances d’API publiques, une inférence du matériel et
des paramètres d’infrastructure pour trois formes de requêtes :

- courte : 100 tokens d’entrée et 300 de sortie ;
- moyenne : 1 000 tokens d’entrée et 1 000 de sortie ;
- longue : 10 000 tokens d’entrée et 1 500 de sortie.

Source : https://arxiv.org/abs/2505.09598v6

La première publication est datée du 14 mai 2025 ; les données utilisées proviennent de la révision
v6 du 24 novembre 2025, consultée le 19 juillet 2026. La transcription locale
`data/how-hungry-ai-v6.json` conserve séparément la chaîne brute et la valeur numérique normalisée
des 15 moyennes et des 15 écarts-types du tableau 4, ainsi que les formes de requêtes et les
paramètres d’infrastructure du tableau 1. Le libellé source exact `GPT-4o (Mar '25)` désigne un
snapshot daté de GPT-4o ; l’alias runtime `gpt 4o` ne prétend pas étendre la mesure à toutes les
versions historiques ou futures portant ce nom.

Le rendu HTML v6 écrit littéralement `0515` pour l’écart-type de GPT-4.1 sur la forme moyenne. La
fixture préserve donc `standardDeviationRaw: "0515"` et consigne séparément
`standardDeviationNormalized: 0.515` avec le statut explicite
`inferred-missing-decimal-point`. Cette normalisation est une inférence de transcription, pas une
valeur brute publiée. La dérivation des coefficients dépend uniquement des moyennes normalisées ;
aucun écart-type n’entre dans l’ajustement.

Les valeurs d’énergie centrales publiées sont ajustées à la forme non négative :

`energyWh = base + inputTokens / 1000 × inputWhPer1k + outputTokens / 1000 × outputWhPer1k`

Le script pur `scripts/derive-impact-coefficients.mjs`, exécutable avec
`npm run impact-coefficients`, énumère les ensembles actifs possibles d’un active-set NNLS sans
dépendance, accès réseau ni écriture. Il résout exactement les trois coefficients lorsque la
solution est non négative (GPT-4o et Claude 3.7 Sonnet). Pour GPT-4.1, Claude 3.5 Sonnet et Claude
3.5 Haiku, la solution non contrainte aurait une base négative : l’ajustement NNLS fixe donc la base
à zéro et minimise la somme des carrés non pondérée sur les trois formes. Le registre conserve les
coefficients avec une précision de calcul, tandis que l’interface arrondit fortement les résultats.

Les contrôles reproduits par la commande sont :

- GPT-4o et Claude 3.7 Sonnet : résidu numérique nul à la précision flottante ;
- GPT-4.1 : RMSE `0,04113 Wh`, résidu relatif maximal `7,7519 %` ;
- Claude 3.5 Sonnet : RMSE `0,03499 Wh`, résidu relatif maximal `5,9034 %` ;
- Claude 3.5 Haiku : RMSE `0,18239 Wh`, résidu relatif maximal `30,713 %`.

Le résidu important de Claude 3.5 Haiku indique qu’une forme affine non négative sépare mal les
effets de base, d’entrée et de sortie avec seulement trois formes de requête. Ce profil reste de
confiance C, avec des fourchettes larges et cette limite affichée dans le registre ; il ne doit pas
être interprété comme une régression fidèle de chaque forme publiée.

L’eau et le carbone suivent les paramètres de l’étude :

`carbonKg = energyKWh × carbonIntensityKgPerKWh`

`waterL = energyKWh / PUE × onsiteWueLPerKWh + energyKWh × offsiteWueLPerKWh`

Les paramètres OpenAI/Azure sont PUE `1,12`, WUE sur site `0,30 L/kWh`, WUE hors site
`4,35 L/kWh` et intensité carbone `0,35 kgCO2e/kWh`. Les paramètres Anthropic/AWS sont PUE `1,14`,
WUE sur site `0,18 L/kWh`, WUE hors site `5,11 L/kWh` et intensité carbone
`0,287 kgCO2e/kWh`. Ces profils sont de confiance C. Les bornes élargies couvrent une partie de
l’incertitude systémique ; elles ne peuvent pas englober toutes les configurations réelles.

### Identité exacte des modèles

Un profil spécifique n’est sélectionné que si le libellé normalisé correspond à un alias exact,
éventuellement précédé d’un fournisseur explicitement autorisé. Une variante datée, suffixée ou
« Extended Thinking » non documentée par la source est dirigée vers le profil générique. La ligne
v6 est « Claude 3.7 Sonnet » sans variante ET distincte ; « Claude 3.7 Sonnet ET » n’hérite donc pas
de ce profil. De même, la médiane « Gemini Apps » ne documente pas séparément Gemini 2.5 Pro ou
Gemini 2.5 Flash. Cette politique fail-closed est détaillée dans
`docs/adr/0002-evidence-gated-model-profiles.md`.

### Catalogue ChatGPT actuel et profil d’impact

Le catalogue `data/model-catalog.json`, version `2026-07-19.2`, reconnaît, lors de sa revue du
19 juillet 2026, les choix ChatGPT
suivants : GPT-5.6 Sol, GPT-5.6 Sol Pro, GPT-5.5 Instant, GPT-5.4 Thinking, GPT-5.3 Instant et
OpenAI o3. Les libellés et modes associés proviennent des pages officielles
« [GPT-5.6 in ChatGPT](https://help.openai.com/en/articles/20001354-gpt-56-in-chatgpt/) » et
« [Model Release Notes](https://help.openai.com/en/articles/9624314-model-release-notes) »,
consultées le 19 juillet 2026. Ces sources documentent la disponibilité et les noms dans ChatGPT ;
elles ne publient aucun coefficient d’électricité, d’eau ou de carbone par modèle.

En conséquence, ces six choix se résolvent explicitement vers `openai-generic-v1`. Ce profil est un
proxy fondé sur la ligne GPT-4o datée de mars 2025 de *How Hungry is AI?*, avec des fourchettes
élargies et un grade D pour chaque indicateur. L’interface affiche « proxy D » et une explication
dans « Méthode et détails » : reconnaître le nom courant améliore le diagnostic, sans créer une
fausse précision environnementale. Les profils GPT-4o et GPT-4.1 restent dans le registre comme
profils scientifiques datés ; ils ne sont pas présentés comme les choix actuels de ChatGPT.

Le catalogue déclare une date de revue et une limite de fraîcheur de 90 jours. Il impose aussi une
revue de GPT-5.4 au 23 juillet 2026, date de fin annoncée dans le sélecteur ChatGPT observé pendant
la validation, et d’OpenAI o3 au 26 août 2026, date de retrait publiée dans les notes officielles.
À l’échéance `reviewBy`, le choix est retiré du catalogue affiché jusqu’à nouvelle revue et la CI
échoue : l’extension préfère perdre un alias « courant » plutôt que conserver silencieusement une
information périmée. Une mise à jour de nom ne change pas la version méthodologique tant qu’aucun
coefficient, calcul ou périmètre d’impact n’est modifié.

## Profil générique

Le profil `generic-assistant-v1` résume l’ordre de grandeur des profils opérationnels publiés avec
une fourchette volontairement très large : 0,2–0,25× à 4–5× selon l’indicateur. Il est de confiance
D. Perplexity l’utilise via `perplexity-generic-v1` lorsque l’interface ne divulgue pas le modèle
sous-jacent, mais aussi lorsqu’elle affiche un nom sans preuve environnementale propre au service.
Le nom visible reste affiché avec « proxy D ». La recherche, la récupération, la navigation et les
outils non visibles ne sont pas comptabilisés dans cette fourchette.

Le profil `openai-generic-v1` est le proxy OpenAI de grade D décrit ci-dessus. Il est distinct du
catalogue de noms et ne constitue pas une mesure des modèles GPT-5.x ou o3.

## Équivalences pédagogiques

- Télévision : appareil LED de référence de 100 W ;
  `seconds = energyWh / 100 × 3600`.
- Automobile : facteur ADEME/Datagir de 193,2 gCO2e par véhicule-kilomètre ;
  `meters = carbonG / 193.2 × 1000`.
- Eau : affichage en millilitres sous un litre, puis en litres.

Source automobile :
https://docs.datagir.ademe.fr/documentation/lexique-environnemental-et-changement-climat

Une équivalence facilite la compréhension ; ce n’est pas une consommation supplémentaire.

## Limites communes

- Seuls les tokens du prompt et de la réponse visibles sont estimés.
- Le raisonnement caché, le contexte système, le cache, les outils et les médias sont exclus ; le
  contexte visible ne permet pas de les déduire.
- La région et le centre de données ne sont pas déduits de la position de l’utilisateur.
- Les profils opérationnels et les analyses de cycle de vie n’ont pas le même périmètre.
- Les pratiques des fournisseurs et leur efficacité changent dans le temps.
- Une génération d’image, de vidéo ou d’audio n’est pas couverte par la V1.

Pour proposer un nouveau profil, il faut fournir une source primaire, son périmètre, sa date, ses
unités, ses hypothèses, ses limites et des tests reproduisant les calculs. Une valeur commerciale,
un billet sans méthode ou une conversion sans unité ne suffit pas.
