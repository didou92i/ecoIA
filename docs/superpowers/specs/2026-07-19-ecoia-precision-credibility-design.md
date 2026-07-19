# ecoIA — conception « précision et crédibilité »

Statut : validé par délégation produit le 19 juillet 2026.

## 1. Contexte

ecoIA estime localement les tokens visibles et les transforme en ordres de grandeur environnementaux.
La V1 protège les conversations et reste légère, mais elle ne peut pas connaître les tokens cachés,
le contexte réellement renvoyé au fournisseur, le cache, le matériel ou la région d’inférence. La
V2 doit améliorer l’utilité de l’estimation sans présenter ces inconnues comme des mesures.

## 2. Objectifs

1. Permettre de corriger le modèle appliqué à la conversation active.
2. Représenter le contexte conversationnel visible comme une enveloppe possible, sans inventer une
   valeur centrale non sourcée.
3. Expliquer la qualité des données, les sources et les principales limites en langage courant.
4. Diagnostiquer localement la reconnaissance de la plateforme, de la conversation et du modèle.
5. Conserver une extension sans compte, sans collecte réseau et sans dépendance JavaScript runtime.

## 3. Non-objectifs

- prétendre reproduire la facturation du fournisseur ;
- intercepter les requêtes privées ou le trafic réseau de la plateforme ;
- lire le raisonnement caché, les instructions système, le cache ou les outils invisibles ;
- créer un compte ecoIA, synchroniser les conversations ou envoyer des diagnostics ;
- permettre de saisir librement un nom de modèle dépourvu de profil documenté.

## 4. Options considérées

### Option A — précision locale renforcée

Le registre de profils reste embarqué. Le modèle peut être corrigé pour la conversation active, le
contexte visible fournit une borne haute, et les diagnostics restent dans le panneau.

Conséquences : confidentialité et légèreté préservées, mais les profils scientifiques nécessitent une
nouvelle version de l’extension pour être actualisés.

### Option B — registre scientifique distant

L’extension télécharge des profils de calcul signés sans transmettre les conversations.

Conséquences : profils actualisables plus vite, mais ajout d’une permission réseau, d’un service
externe, d’un mode hors ligne dégradé et d’une nouvelle frontière de confiance.

### Option C — backend complet

Un service central synchronise les réglages, l’historique et les diagnostics.

Conséquences : expérience multi-appareils possible, mais comptes, coûts, exploitation et risques de
confidentialité disproportionnés pour l’objectif de sensibilisation.

### Décision

La V2 retient l’option A. Les options B et C ne seront réexaminées que si une API fournisseur expose
des mesures vérifiables sans transmettre de conversation à ecoIA.

## 5. Expérience utilisateur

### 5.1 État normal

Le panneau conserve sa taille et ses indicateurs principaux. Le modèle effectivement appliqué est
affiché sous l’état de mesure. Les valeurs principales restent une estimation centrale précédée de
`≈`, accompagnée d’une plage écrite « de … à … ».

### 5.2 Modèle non communiqué

Une alerte compacte apparaît uniquement lorsque l’adaptateur ne peut pas lire le modèle :
« Modèle non communiqué — profil générique utilisé ». Un bouton « Choisir le modèle » ouvre
« Méthode et détails » et place le focus sur le sélecteur.

### 5.3 Sélection manuelle

Le sélecteur est toujours disponible dans « Méthode et détails » et propose :

- « Détection automatique » ;
- les profils documentés compatibles avec la plateforme active ;
- le profil générique de la plateforme, explicitement marqué « forte incertitude ».

Un choix manuel est prioritaire sur la détection automatique. Il n’est ni écrit dans
`storage.local` ni partagé avec un autre onglet. Il est effacé lors d’un changement de conversation
SPA, d’un rechargement de page ou de la fermeture de l’onglet.

### 5.4 Contexte conversationnel

L’entrée présente deux informations distinctes :

- l’estimation centrale du prompt utilisateur courant ;
- « contexte visible : jusqu’à ≈ N tokens supplémentaires » lorsque des tours antérieurs sont
  visibles.

Le moteur ne choisit pas arbitrairement combien de contexte le fournisseur a réellement retraité.
Pour l’entrée et les impacts, la borne basse et la valeur centrale restent fondées sur le prompt
courant ; la borne haute ajoute tous les tours antérieurs actuellement visibles. Le détail précise
que le fournisseur peut tronquer, résumer, mettre en cache ou enrichir ce contexte.

### 5.5 Qualité des données

La ligne actuelle de lettres est remplacée par « Qualité des données » avec le plus faible grade des
indicateurs affichés et une explication :

- A — donnée fournisseur documentée pour un périmètre comparable ;
- B — donnée publiée avec adaptation limitée ;
- C — estimation modélisée à partir de données publiées ;
- D — proxy générique avec forte incertitude.

Le détail conserve les grades propres à l’eau, à l’électricité et au carbone lorsque ceux-ci
diffèrent. Il affiche pour chaque source unique son titre court, sa date, son périmètre et sa limite
principale. L’ouverture de la source demeure une action utilisateur explicite.

### 5.6 Diagnostic local

Une section « Diagnostic » affiche uniquement :

- plateforme reconnue ou non ;
- conversation détectée ou mesure en pause ;
- modèle automatique, manuel ou générique ;
- contexte antérieur visible ou absent ;
- dernière mesure terminée ou réponse en cours.

Elle ne contient aucun texte, extrait, URL, identifiant de conversation, identifiant d’onglet ou
horodatage précis exportable.

## 6. Architecture

### 6.1 Adaptateur de plateforme

`DetectedModel` distingue un libellé observé d’un libellé de repli. L’adaptateur expose également le
texte antérieur visible à la demande, séparément du tour courant. Cette lecture n’est effectuée
qu’une fois par ancre utilisateur et uniquement dans le conteneur de conversation reconnu. Les tours
les plus récents sont retenus en priorité, dans leur ordre de lecture, jusqu’à la limite existante de
2 097 152 octets UTF-8. Le résultat indique si le contexte est complet ou partiel.

### 6.2 Contrôleur de contenu

Le contrôleur conserve en mémoire :

- le profil manuel éventuel de la conversation active ;
- l’estimation numérique du contexte visible associée à l’élément utilisateur courant ;
- l’origine du profil effectif : automatique, manuel ou générique.

Les chaînes du prompt, de la réponse et du contexte sont vidées immédiatement après conversion en
nombres. Le changement de marqueur de conversation réinitialise le profil manuel et le cache
numérique de contexte avant de traiter le nouveau tour.

### 6.3 Résolution du profil

L’ordre de résolution est déterministe :

1. profil manuel compatible avec la plateforme ;
2. profil reconnu depuis le libellé observé ;
3. profil générique propre à la plateforme.

Un identifiant absent du registre ou incompatible est rejeté et ne modifie pas la mesure.

### 6.4 Moteur de tokens et d’impact

Le prompt courant et le contexte antérieur visible sont estimés séparément. L’enveloppe d’entrée est
construite ainsi :

- `low` : borne basse du prompt courant ;
- `central` : estimation centrale du prompt courant ;
- `high` : borne haute du prompt courant plus borne haute du contexte antérieur visible.

La réponse conserve son estimation actuelle. Le moteur d’impact reçoit cette enveloppe et propage
les trois bornes sans modifier les coefficients scientifiques existants.

### 6.5 Widget

Le widget reçoit un modèle de vue numérique et des listes de profils déjà filtrées. Il ne résout pas
les profils et ne lit jamais la page. Le sélecteur émet uniquement un identifiant de profil ou la
valeur automatique. Tous les contenus provenant de la page restent écrits avec `textContent`.

### 6.6 Backend et mises à jour

Aucun backend runtime n’est ajouté. Le registre scientifique reste versionné dans Git, validé au
build et livré avec l’extension. La CI doit signaler une source dont la date de révision dépasse douze
mois, sans tenter de modifier automatiquement les coefficients.

## 7. Flux de données

1. L’adaptateur localise le dernier tour et indique si le modèle est observé ou non.
2. Le contrôleur convertit immédiatement le prompt et la réponse visibles en plages numériques.
3. Pour une nouvelle ancre utilisateur, il lit une fois le contexte antérieur visible, le convertit
   en nombres puis efface la chaîne.
4. Le résolveur choisit le profil effectif selon l’ordre défini.
5. Le moteur produit les impacts et le contrôleur envoie uniquement l’événement numérique au service
   worker.
6. Le widget reçoit les valeurs, la provenance, les explications et le diagnostic non sensible.
7. Une sélection manuelle relance le calcul du même événement ; l’agrégat remplace sa contribution au
   lieu d’ajouter une interaction.

## 8. Erreurs et états limites

- Profil manuel invalide : choix ignoré, retour au profil précédent et message accessible.
- Modèle non observé : profil générique, alerte visible et grade D.
- Contexte absent : aucune ligne supplémentaire et calcul V1 inchangé.
- Contexte supérieur à 2 097 152 octets UTF-8 : les tours les plus anciens sont exclus, la borne haute
  utilise la partie récente retenue et le diagnostic affiche « contexte partiel ».
- DOM non reconnu ou API d’extension invalidée : mesure en pause, aucune ancienne valeur présentée
  comme courante.
- Changement de conversation : suppression du choix manuel avant tout nouveau calcul.

## 9. Confidentialité, sécurité et performance

- aucune permission supplémentaire ;
- aucune requête réseau, télémétrie ou synchronisation ;
- aucun texte conservé dans le stockage ou envoyé au service worker ;
- sélecteur limité à une liste issue du registre validé ;
- lecture et calculs DOM toujours limités à la conversation ; seule sa présence structurelle est
  surveillée temporairement pendant une découverte ou un remplacement de racine ;
- contexte converti une fois par interaction, puis conservé uniquement sous forme numérique ;
- paquet compressé toujours inférieur à 150 Ko ;
- au maximum deux rendus visuels par seconde pendant le streaming.

## 10. Vérification et critères d’acceptation

1. Un modèle observé utilise automatiquement son profil sans afficher d’alerte.
2. Un modèle non communiqué affiche l’alerte et le profil générique.
3. Le sélecteur ne contient que des profils compatibles et documentés.
4. Un choix manuel recalcule la contribution courante sans augmenter le nombre d’interactions.
5. Le choix manuel disparaît lors d’un changement de conversation et n’apparaît dans aucun stockage.
6. La borne haute d’entrée augmente avec un contexte antérieur visible ; la valeur centrale reste
   celle du prompt courant.
7. Aucun texte de conversation ou identifiant de page ne franchit la frontière du service worker.
8. Les explications A à D, les sources uniques et les principales limites sont accessibles au clavier
   dans les thèmes clair et sombre.
9. Le diagnostic ne contient que les champs non sensibles définis dans cette spécification.
10. Les tests réseau, taille, performance, sécurité, accessibilité et empaquetage existants restent
    verts sur Chromium ; les builds Chromium et Firefox sont produits.
