# Contribuer à ecoIA

Merci de contribuer à un outil de sensibilisation sobre et respectueux de la vie privée.

## Préparer l’environnement

Utilisez Node.js 22 ou supérieur et npm 10.9.3, puis exécutez `npm ci`. Créez une branche courte,
limitez le changement à un objectif et ajoutez les tests correspondant au risque.

Avant une proposition :

```bash
npm run verify
npm run e2e
npm run audit
npm run secrets
```

## Règles du projet

- aucune dépendance runtime sans justification documentée ;
- aucune télémétrie, requête distante ou collecte de texte utilisateur ;
- aucune nouvelle origine ou permission sans revue explicite du manifest ;
- pas de valeur environnementale sans source, unité, périmètre, limites et test ;
- fixtures synthétiques et anonymes uniquement ;
- interface accessible au clavier et compatible avec le mouvement réduit ;
- ne copiez pas de code tiers sans vérifier sa licence et conserver son avis légal.

Pour une plateforme, suivez [docs/adding-an-adapter.md](docs/adding-an-adapter.md). Pour une nouvelle
source d’impact, suivez [docs/adding-an-impact-profile.md](docs/adding-an-impact-profile.md).
