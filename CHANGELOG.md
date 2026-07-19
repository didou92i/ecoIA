# Journal des modifications

Les changements notables suivent une forme simplifiée de Keep a Changelog.

## [Non publié]

### Ajouté

- profils sourcés Claude 3.5 Sonnet et Claude 3.5 Haiku, dérivés de la révision v6 de l’étude
  *How Hungry is AI?* avec résidus documentés ;
- fixture brute et commande reproductible `npm run impact-coefficients` pour contrôler les cinq
  profils issus des tableaux 1 et 4 ;
- inventaire transversal `data/source-inventory.json` et contrôle de fraîcheur CI pour les sources
  d’impact, d’équivalence et de calibration des tokens ;
- catalogue local et daté des modèles ChatGPT actuels, distinct des profils environnementaux et
  soumis à une revue de fraîcheur à 90 jours ou à l’échéance antérieure déclarée par modèle ;
- fixture de non-régression reproduisant la structure de conversation Perplexity actuelle.

### Modifié

- résolution des profils par alias structurés et exacts : les variantes non documentées reviennent
  désormais au profil générique ;
- réinitialisation de l’état conversationnel lors des transitions SPA vers une route sans
  identifiant ;
- reprise idempotente d’un événement après échec de stockage de session ;
- détection des tours et du modèle sur l’interface Perplexity actuelle, avec exclusion des badges
  de citation du comptage, déduplication des conteneurs imbriqués et validation prudente du libellé ;
- alerte de modèle réservée aux cas où la plateforme ne communique aucun nom ; un nom observé mais
  non documenté reste affiché avec un proxy explicite de qualité D ;
- profil Perplexity toujours ramené à son proxy générique de qualité D, même lorsqu’un fournisseur
  sous-jacent est nommé, afin de ne pas masquer l’impact non visible de la recherche et des outils.

## [0.1.0] - 2026-07-18

### Ajouté

- widget compact clair/sombre, déplaçable, repliable et accessible ;
- estimation locale des tokens visibles avec fourchettes calibrées ;
- profils environnementaux sourcés et équivalences pédagogiques ;
- adaptateurs ChatGPT, Claude, Gemini, Mistral Le Chat et Perplexity ;
- agrégats numériques de session et du jour, sans conservation des conversations ;
- builds Manifest V3 séparés pour Chromium et Firefox ;
- tests unitaires, adaptateurs et Chromium de bout en bout.
