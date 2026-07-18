# ADR 0001 — Extension locale, légère et centrée sur la confidentialité

Statut : accepté le 18 juillet 2026.

## Contexte

ecoIA doit sensibiliser pendant l’usage de plusieurs assistants web, rester compréhensible pour un
débutant, fonctionner sans compte ecoIA et ne pas exposer les conversations. Les fournisseurs ne
publient pas tous les tokens réels, le matériel ou la région d’inférence.

## Options considérées

1. Service cloud central avec analyse des conversations : plus simple à mettre à jour, mais collecte
   sensible, coût opérationnel et point de panne.
2. Tokenizers complets et SDK par fournisseur embarqués : meilleure précision locale potentielle,
   mais poids et maintenance élevés, sans résoudre les tokens cachés.
3. Extension WebExtension locale, adaptateurs DOM bornés, heuristique calibrée et profils sourcés.

## Décision

La V1 adopte l’option 3 : TypeScript compilé en JavaScript natif, aucune dépendance runtime, Shadow
DOM, adaptateur séparé par origine et Manifest V3 limité à `storage`. Le texte visible est converti en
fourchettes numériques dans le script de contenu ; seul le numérique franchit la frontière vers le
service worker. Les profils environnementaux sont versionnés, sourcés et assortis d’une confiance.

Chromium utilise un service worker MV3 ; Firefox utilise un arrière-plan non persistant issu du même
bundle. Un cœur de contenu commun évite de dupliquer le widget dans les cinq adaptateurs.

## Conséquences

- fonctionnement hors ligne et aucune infrastructure à opérer ;
- confidentialité et auditabilité renforcées ;
- archives très petites et installation locale simple ;
- précision volontairement bornée par ce que l’interface rend visible ;
- maintenance nécessaire lorsque le DOM d’une plateforme change ;
- pas de mesure des images, outils, recherches, cache ou raisonnement caché en V1.

## Conditions de réexamen

Réexaminer si une API fournisseur standard expose des comptages et impacts vérifiables sans envoyer
de conversation à ecoIA, si les navigateurs modifient les mondes isolés ou si la calibration locale
ne respecte plus le budget de précision documenté. Toute dépendance runtime ou permission nouvelle
nécessite un ADR complémentaire et une revue de sécurité.
