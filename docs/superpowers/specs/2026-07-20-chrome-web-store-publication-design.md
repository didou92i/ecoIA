# Publication Chrome Web Store d’ecoIA

## Objectif

Publier ecoIA sous le nom de l’éditeur TerritorIA sur le Chrome Web Store avec une fiche claire,
une déclaration de confidentialité fidèle au fonctionnement réel et un paquet reproductible. La
publication doit conserver les principes actuels : traitement local, absence de télémétrie, absence
de serveur et permissions limitées aux plateformes compatibles.

## Périmètre

La livraison comprend :

- un consentement explicite au premier lancement avant toute lecture du texte visible ;
- une possibilité de refuser ou de révoquer ce consentement ;
- une fiche Chrome Web Store en français avec titre, résumé, description et procédure de test ;
- les réponses prêtes à copier dans les sections Confidentialité et Permissions ;
- une image promotionnelle de 440 × 280 pixels ;
- des captures de 1280 × 800 pixels montrant les états réels de l’extension ;
- un ZIP Chromium dont le `manifest.json` se trouve à la racine ;
- une checklist de soumission et de mise à jour.

La création du compte Google, le paiement, la double authentification, l’acceptation des conditions
et le clic final de soumission restent des actions personnelles du propriétaire du compte.

## Parcours de consentement

Au premier chargement sur une plateforme compatible, le widget affiche une vue compacte expliquant
que le dernier prompt et la dernière réponse visibles sont traités temporairement dans le navigateur
afin d’estimer les tokens et leurs ordres de grandeur environnementaux. Aucun abonnement à la racine
de conversation et aucune lecture textuelle ne démarrent avant l’acceptation.

Deux actions sont proposées :

- « Activer ecoIA » enregistre localement le consentement et démarre la mesure ;
- « Pas maintenant » replie le widget et laisse la mesure inactive.

Un contrôle accessible dans « Méthode et détails » permet ensuite de désactiver la mesure. La
désactivation arrête les observateurs et les calculs, sans effacer automatiquement les agrégats déjà
créés. La suppression des données reste documentée par la désinstallation ; aucun effacement distant
n’existe puisque l’extension n’utilise aucun serveur.

Le consentement est stocké dans `storage.local` sous une clé versionnée contenant uniquement un booléen
et une version de notice. Aucun texte de conversation, URL, titre de page ou identifiant de compte
n’est ajouté au stockage.

## Architecture et flux

`ContentController` demeure le point de coordination. Il charge les préférences et le consentement,
configure le widget, puis choisit l’un des deux chemins :

1. consentement absent ou refusé : rendre l’état d’information, sans rechercher ni observer la
   conversation ;
2. consentement accepté : démarrer le flux existant de détection, estimation et agrégation.

Le widget expose deux événements explicites, acceptation et révocation. La révocation réutilise la
méthode d’arrêt existante pour retirer les observateurs, vider la mesure courante et afficher un état
inactif. La réactivation crée une nouvelle baseline afin de ne pas agréger une réponse déjà affichée.

La couche de stockage valide strictement la forme de la notice versionnée. Une valeur inconnue ou
malformée est traitée comme une absence de consentement.

## Interface et accessibilité

La notice tient dans la largeur actuelle du widget et n’augmente pas sa taille maximale. Elle utilise
les tokens visuels existants, sans dépendance supplémentaire ni animation décorative. Les actions sont
des boutons natifs, accessibles au clavier, avec focus visible. L’information ne dépend pas de la
couleur. Le mode sombre, le mouvement réduit et la vue repliée continuent de fonctionner.

Texte principal :

> ecoIA estime localement les tokens à partir du texte visible. Aucun texte n’est stocké ni transmis.

Lien secondaire : « Lire la politique de confidentialité » vers la page GitHub publique du projet.

## Fiche Chrome Web Store

- Éditeur : `TerritorIA`
- Nom : `ecoIA — Impact environnemental de l’IA`
- Résumé : `Estime localement les tokens et leur impact en eau, électricité et carbone pendant vos conversations IA.`
- Catégorie recommandée : Productivité
- Langue principale : français
- Visibilité initiale : non répertoriée pour validation, puis publique
- Assistance : dépôt GitHub et formulaire d’incident GitHub
- Politique de confidentialité : page publique `PRIVACY.md` du dépôt principal

La description longue explique que les valeurs sont des estimations pédagogiques et non des mesures
directes des centres de données. Elle distingue clairement tokens visibles, contexte possible,
fourchettes d’impact et niveau de qualité des données.

## Déclarations de confidentialité

La fiche déclare le traitement local et transitoire du contenu de site et du contenu généré par
l’utilisateur lorsque cela correspond aux catégories proposées par Google. Elle précise :

- aucune transmission à TerritorIA ou à un tiers ;
- aucune vente, publicité, analytique ou profilage ;
- aucun stockage du texte des conversations ;
- stockage local limité aux préférences, au consentement et aux agrégats numériques bornés ;
- aucune utilisation de code distant ;
- permissions limitées à `storage` et aux origines listées dans le manifest.

Les réponses du formulaire doivent rester exactement cohérentes avec `PRIVACY.md` et le comportement
testé du paquet.

## Visuels

La tuile promotionnelle utilise le symbole TerritorIA, le nom ecoIA et une phrase courte sur fond
clair, sans affirmation environnementale absolue. Les captures montrent le produit réel sur ChatGPT
et Perplexity, en veillant à ne laisser apparaître aucune donnée personnelle ou conversation sensible.
Elles sont recadrées aux dimensions imposées sans déformer l’interface.

## Gestion des erreurs

- échec de lecture ou d’écriture du consentement : mesure inactive et message local compréhensible ;
- racine de conversation absente : comportement de pause existant après consentement ;
- valeur de consentement invalide : retour à la notice initiale ;
- API de stockage indisponible : aucune lecture de conversation ;
- refus de validation Chrome Web Store : corriger le motif documenté, incrémenter la version et
  reconstruire l’intégralité du ZIP.

## Vérification

Les tests unitaires couvrent : validation du consentement, absence de recherche de conversation avant
acceptation, démarrage après acceptation, arrêt après révocation et baseline après réactivation. Les
tests du widget couvrent le clavier, les libellés et l’affichage clair/sombre. Le test réseau continue
d’exiger zéro requête initiée par l’extension.

Avant livraison, exécuter `npm run verify`, puis inspecter le ZIP pour confirmer le manifest à la
racine, les icônes attendues et l’absence de fichiers de développement. La soumission reste différée
afin que le propriétaire conserve le dernier contrôle avant publication publique.

## Critères d’acceptation

- aucun texte visible n’est lu avant le consentement ;
- l’extension reste utilisable localement et sans compte ;
- le refus n’empêche pas l’utilisateur d’activer ecoIA plus tard ;
- la révocation arrête immédiatement les nouvelles mesures ;
- aucune nouvelle permission ou dépendance n’est ajoutée ;
- les déclarations du Store correspondent au code et à `PRIVACY.md` ;
- le paquet, les visuels et les textes sont prêts à être importés manuellement dans le tableau de bord.
