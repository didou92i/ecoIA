# Checklist de soumission Chrome Web Store

## Avant l’import

- [ ] Utiliser le compte développeur contrôlé par TerritorIA avec double authentification.
- [ ] Vérifier l’adresse électronique publique de l’éditeur.
- [ ] Exécuter `npm ci`, `npm run verify`, `npm run e2e` et `npm run audit`.
- [ ] Exécuter `npm run store-assets`.
- [ ] Exécuter `npm run checksums` et conserver le SHA-256.
- [ ] Vérifier que `manifest.json` se trouve à la racine de `ecoia-chromium.zip`.
- [ ] Vérifier l’absence de source map, `.env`, secret, trace et fichier de test dans le ZIP.

## Fiche

- [ ] Copier le nom, le résumé, l’objectif unique et la description de `listing-fr.md`.
- [ ] Sélectionner la catégorie Productivité et le français comme langue principale.
- [ ] Importer `promo-440x280.png`.
- [ ] Importer au moins une capture 1280 × 800 ; les deux captures fournies sont recommandées.
- [ ] Indiquer https://github.com/didou92i/ecoIA/issues comme assistance.
- [ ] Indiquer https://github.com/didou92i/ecoIA/blob/main/PRIVACY.md comme confidentialité.

## Confidentialité

- [ ] Déclarer l’objectif unique.
- [ ] Justifier `storage` et les permissions d’hôte.
- [ ] Déclarer « Aucun code distant ».
- [ ] Déclarer honnêtement le traitement local et transitoire du contenu visible.
- [ ] Certifier aucune transmission, aucune vente, aucune publicité et aucun profilage.
- [ ] Vérifier la cohérence exacte avec `PRIVACY.md`.

## Distribution

- [ ] Choisir d’abord la visibilité **non répertoriée** pour la validation finale.
- [ ] Activer la **publication différée** afin de conserver le dernier contrôle.
- [ ] Coller les instructions de test de `test-instructions-fr.md`.
- [ ] Relire les attestations juridiques personnellement.
- [ ] Soumettre pour examen uniquement après la confirmation du propriétaire du compte.
- [ ] Après validation privée, passer à la visibilité publique au moment choisi par TerritorIA.

## Mise à jour suivante

- [ ] Incrémenter la version du manifest et du paquet.
- [ ] Reconstruire l’intégralité du ZIP.
- [ ] Relancer les tests et régénérer le SHA-256.
- [ ] Décrire tout changement de permissions ou de traitement des données avant la publication.
