# Ajouter un profil d’impact

Les profils versionnés se trouvent dans `data/impact-profiles.json`. Toutes les références suivies
se trouvent dans `data/source-inventory.json`. Une valeur sans provenance ne doit pas entrer dans
l’interface.

## Informations obligatoires

- source primaire HTTPS, titre, date de publication et date d’accès ;
- périmètre exact : opérationnel, cycle de vie, produit, modèle et forme de requête ;
- unités d’origine et formule de conversion ;
- hypothèses et limites ;
- bornes basse et haute ;
- confiance A, B, C ou D selon `METHODOLOGY.md`.

Le profil doit être compatible avec les plateformes déclarées dans son champ `platforms`. Un profil
spécifique ne doit pas devenir une option de modèle pour une plateforme non couverte. Toute source
doit être datée, sourcée, décrite dans ses limites et revue avant que sa date d’accès ne dépasse 366
jours.

Les `modelAliases` doivent identifier l’exact model variant documenté. Utilisez des alias normalisés
exacts et, si nécessaire, une liste fermée de préfixes fournisseur. N’ajoutez pas de correspondance
par sous-chaîne : une date, un suffixe, une édition ou un mode comme Extended Thinking qui n’existe
pas dans la source doit échouer de manière sûre vers le profil générique.

Un profil par prompt médian ne doit pas être présenté comme une fonction exacte des tokens. Un proxy
doit rester clairement identifié, avec une fourchette plus large. Évitez toute conversion circulaire
entre énergie, eau et carbone.

## Implémentation

1. Ajouter ou réutiliser une source dans `sources`, puis la référencer dans
   `data/source-inventory.json` et son domaine.
2. Ajouter un identifiant de profil stable et une version entière.
3. Renseigner chaque indicateur séparément : estimateur, unité, coefficients, multiplicateurs,
   confiance et `sourceId`.
4. Mettre à jour `METHODOLOGY.md` avec les calculs reproductibles. Pour une table source comparable
   à *How Hungry is AI?*, transcrire les chaînes brutes et les valeurs numériques normalisées dans
   un fixture versionné, signaler explicitement toute normalisation inférée, tester toutes les
   valeurs publiées et vérifier les coefficients avec `npm run impact-coefficients`.
5. Ajouter des tests du registre, des unités, des limites et des résultats attendus. Pour chaque
   nouveau profil, ajouter ou mettre à jour un cas dans `tests/unit/model-selection.test.ts` pour
   vérifier sa compatibilité et ses options de modèle sur les plateformes concernées.
6. Pour chaque nouvelle source, ajouter ou mettre à jour un cas dans
   `tests/unit/source-freshness.test.ts` qui couvre son test de date et de fraîcheur. Exécuter aussi
   `npm run source-freshness` : ce gate complémentaire vérifie l’inventaire local complet, mais ne
   remplace pas le test ajouté.
7. Exécuter `npm run verify` et comparer l’affichage aux valeurs documentées.

Une mise à jour de valeur existante crée une nouvelle version méthodologique ; elle ne réécrit pas
silencieusement le sens d’un profil publié.

## Mettre à jour seulement un nom de modèle actuel

Un nouveau nom dans l’interface d’un fournisseur n’est pas, à lui seul, un nouveau profil d’impact.
Si une source officielle documente le nom ou le mode disponible sans publier de coefficients
environnementaux propres à ce modèle :

1. ajouter ou mettre à jour l’entrée fermée dans `data/model-catalog.json` ;
2. référencer la source officielle avec la catégorie `model-catalog` dans
   `data/source-inventory.json` ;
3. faire pointer l’entrée vers le profil générique de grade D compatible avec la plateforme ;
4. conserver un appariement exact et des alias limités aux libellés réellement observés ;
5. si un retrait, une fin de disponibilité ou une revue anticipée est déjà annoncé, ajouter
   `reviewBy` avec sa date ISO ; à cette date l’alias cesse d’être présenté comme courant jusqu’à
   nouvelle revue ;
6. ajouter les tests positifs et fail-closed du catalogue, puis vérifier la revue de fraîcheur à
   90 jours et toute échéance antérieure.

La source commerciale prouve alors seulement l’identité du choix courant. Elle ne doit pas être
réutilisée comme source d’électricité, d’eau ou de carbone. Une telle mise à jour ne change pas la
version méthodologique si les coefficients et leur périmètre restent identiques. Voir
`docs/adr/0003-separate-model-catalog-from-impact-evidence.md`.
