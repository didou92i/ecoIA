# Méthodologie environnementale ecoIA

Version : `2026-07-18.1`
Dernière vérification des sources : 18 juillet 2026

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

## Profils et provenance

Le registre machine-readable est `data/impact-profiles.json`. Une modification est refusée par les
tests si un profil n’a pas de source HTTPS, de date, de périmètre, de limites, d’unité reconnue ou de
fourchette valide. Les proxys circulaires sont également interdits.

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

### GPT-4o, GPT-4.1 et Claude 3.7 Sonnet

L’étude *How Hungry is AI?* combine les performances d’API publiques, une inférence du matériel et
des paramètres d’infrastructure pour trois formes de requêtes :

- courte : 100 tokens d’entrée et 300 de sortie ;
- moyenne : 1 000 tokens d’entrée et 1 000 de sortie ;
- longue : 10 000 tokens d’entrée et 1 500 de sortie.

Source : https://arxiv.org/abs/2505.09598v6

Les valeurs d’énergie centrales publiées sont ajustées à la forme non négative :

`energyWh = base + inputTokens / 1000 × inputWhPer1k + outputTokens / 1000 × outputWhPer1k`

Pour GPT-4o et Claude 3.7, les trois coefficients sont résolus sur les trois formes. Pour GPT-4.1,
un ajustement aux moindres carrés contraint les coefficients à rester positifs, car la résolution
exacte produirait une base négative sans sens physique. Le registre conserve les coefficients avec
une précision de calcul, tandis que l’interface arrondit fortement les résultats.

L’eau et le carbone suivent les paramètres de l’étude :

`carbonKg = energyKWh × carbonIntensityKgPerKWh`

`waterL = energyKWh / PUE × onsiteWueLPerKWh + energyKWh × offsiteWueLPerKWh`

Ces profils sont de confiance C. Les bornes de 0,3–0,5× à 2–3× couvrent une partie de l’incertitude
systémique ; elles ne peuvent pas englober toutes les configurations réelles.

## Profil générique

Le profil `generic-assistant-v1` résume l’ordre de grandeur des profils opérationnels publiés avec
une fourchette volontairement très large : 0,2–0,25× à 4–5× selon l’indicateur. Il est de confiance
D. Perplexity l’utilise lorsque l’interface ne divulgue pas le modèle sous-jacent ; la recherche, la
navigation et les outils non visibles ne sont alors pas comptabilisés.

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
- Le raisonnement caché, le contexte système, le cache, les outils et les médias sont exclus.
- La région et le centre de données ne sont pas déduits de la position de l’utilisateur.
- Les profils opérationnels et les analyses de cycle de vie n’ont pas le même périmètre.
- Les pratiques des fournisseurs et leur efficacité changent dans le temps.
- Une génération d’image, de vidéo ou d’audio n’est pas couverte par la V1.

Pour proposer un nouveau profil, il faut fournir une source primaire, son périmètre, sa date, ses
unités, ses hypothèses, ses limites et des tests reproduisant les calculs. Une valeur commerciale,
un billet sans méthode ou une conversion sans unité ne suffit pas.
