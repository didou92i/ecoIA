# Ajouter un adaptateur de plateforme

Un adaptateur transforme uniquement le DOM visible d’une plateforme en un `VisibleTurnSnapshot`.
Il ne contacte aucune API distante et ne conserve aucun texte.

## Étapes

1. Implémenter le contrat `PlatformAdapter` dans `src/adapters/<platform>/`.
2. Préférer des sélecteurs sémantiques stables (`data-*`, rôles, éléments structurants).
3. Limiter le `MutationObserver` à la racine de conversation avec
   `subscribeToScopedMutations`.
4. Exclure les boutons, contenus masqués, citations dupliquées et zones d’accessibilité qui
   répètent la réponse.
5. Ajouter trois fixtures synthétiques : repos, streaming et modèle inconnu.
6. Tester interruption, régénération, changement SPA, contenu exclu et nettoyage de l’observer.
7. Créer une entrée minuscule dans `src/content/entries/` et un bloc d’origine exact dans le
   manifest. Ne jamais élargir vers `<all_urls>`.

La méthode `readLatestTurn` doit renvoyer des chaînes uniquement au contrôleur de contenu. Celui-ci
les convertit en nombres, les efface, puis transmet un événement validé. Un adaptateur ne doit jamais
écrire dans le stockage ou les logs.

## Validation

Exécuter les tests ciblés de l’adaptateur, `npm run verify` et `npm run e2e`. Une plateforme réelle
doit ensuite être testée manuellement avec un compte autorisé, sans enregistrer de conversation dans
les fixtures ou les captures.
