# Checklist de publication

Cette procédure fabrique et contrôle les artefacts localement. Elle ne crée pas de dépôt GitHub, ne
fait aucun `git push`, ne publie aucune release et ne soumet rien aux stores sans autorisation
explicite du mainteneur.

## Avant de construire

- confirmer que le worktree est propre et que la version/changelog sont à jour ;
- vérifier l’identité Git de l’auteur ;
- vérifier les sources environnementales et leurs dates d’accès ;
- inspecter toute modification de permission, CSP ou origine ;
- exécuter `npm ci` depuis un environnement propre.

## Contrôles

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run e2e
npm run audit
npm run secrets
npm run build
npm run size
npm run checksums
```

Inspecter ensuite `dist/chromium`, `dist/firefox` et les deux archives. Rechercher l’absence de
`127.0.0.1`, de source map, de contenu utilisateur, de secret et de code distant. Charger les deux
artefacts manuellement, tester le thème, le repli, l’ancrage et une réponse sur chaque plateforme
autorisée.

## Empreintes SHA-256

`npm run checksums` crée un fichier `.sha256` à côté de chaque archive. Une vérification manuelle
équivalente sous macOS ou Linux est :

```bash
shasum -a 256 dist/packages/ecoia-chromium.zip
shasum -a 256 dist/packages/ecoia-firefox.zip
```

Publier chaque archive avec son fichier SHA-256 correspondant. Après publication autorisée,
télécharger à nouveau les fichiers publics, revérifier les empreintes et effectuer un test
d’installation depuis ces fichiers — une archive locale ne prouve pas la publication publique.
