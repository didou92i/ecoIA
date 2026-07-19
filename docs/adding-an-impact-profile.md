# Ajouter un profil d’impact

Les profils versionnés se trouvent dans `data/impact-profiles.json`. Une valeur sans provenance ne
doit pas entrer dans l’interface.

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

Un profil par prompt médian ne doit pas être présenté comme une fonction exacte des tokens. Un proxy
doit rester clairement identifié, avec une fourchette plus large. Évitez toute conversion circulaire
entre énergie, eau et carbone.

## Implémentation

1. Ajouter ou réutiliser une source dans `sources`.
2. Ajouter un identifiant de profil stable et une version entière.
3. Renseigner chaque indicateur séparément : estimateur, unité, coefficients, multiplicateurs,
   confiance et `sourceId`.
4. Mettre à jour `METHODOLOGY.md` avec les calculs reproductibles.
5. Ajouter des tests du registre, des unités, des limites et des résultats attendus. Ajouter ou
   adapter les tests des options de modèle pour vérifier que le profil n’est proposé que sur les
   plateformes compatibles.
6. Ajouter un cas de fraîcheur si la règle de date change, puis exécuter
   `npm run source-freshness` pour vérifier le registre local.
7. Exécuter `npm run verify` et comparer l’affichage aux valeurs documentées.

Une mise à jour de valeur existante crée une nouvelle version méthodologique ; elle ne réécrit pas
silencieusement le sens d’un profil publié.
