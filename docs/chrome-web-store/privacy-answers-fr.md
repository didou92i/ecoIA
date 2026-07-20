# Réponses de confidentialité Chrome Web Store

Ce document prépare les réponses à recopier. Il ne remplace pas la lecture des libellés affichés par
Google au moment de la soumission.

## Objectif unique

> L’objectif unique d’ecoIA est d’afficher pendant une conversation avec un assistant IA compatible
> une estimation locale et pédagogique des tokens visibles et de leurs ordres de grandeur
> environnementaux.

## Justification de `storage`

> La permission `storage` conserve localement le consentement, les préférences d’affichage et des
> agrégats numériques bornés de session et du jour. Aucun texte de conversation, URL complète, titre
> de page ou identifiant de conversation n’est stocké.

## Justification des permissions d’hôte

> Les permissions d’hôte sont limitées aux six origines explicitement déclarées dans le manifest,
> correspondant à cinq plateformes compatibles. Elles permettent de détecter la racine de conversation
> et de traiter temporairement le dernier prompt et la dernière réponse visibles après consentement.
> Aucun accès à `<all_urls>`, aux onglets, au réseau ou à l’historique n’est demandé.

## Code distant

**Réponse : non. Aucun code distant n’est utilisé.**

Tous les scripts, styles, données de modèle et coefficients sont inclus dans le paquet. L’extension
n’importe aucun script, module WebAssembly, police ou configuration exécutable depuis Internet.

## Catégories de données à déclarer

Par prudence, déclarer les catégories proposées par Google qui couvrent le contenu de site, les
communications personnelles et le contenu généré par l’utilisateur lorsqu’elles apparaissent dans le
formulaire. Le texte subit uniquement un traitement local et transitoire après consentement.

Déclaration à associer :

> ecoIA lit temporairement le dernier prompt et la dernière réponse visibles afin de calculer une
> estimation de tokens. Les chaînes sont vidées immédiatement après conversion en nombres. Il n’existe
> aucune transmission à TerritorIA ou à un tiers, aucun stockage du texte et aucun accès humain.

## Utilisations à certifier

- aucune vente de données ;
- aucun transfert à des fins publicitaires ou de profilage ;
- aucun transfert pour décision de crédit, d’assurance ou d’éligibilité ;
- aucun usage sans rapport avec l’objectif unique annoncé ;
- aucune transmission de données à TerritorIA ou à un tiers ;
- traitement strictement local nécessaire au calcul demandé par l’utilisateur.

## Stockage local déclaré

`storage.local` contient uniquement :

- la notice de consentement versionnée ;
- les préférences de thème, position et repli ;
- l’agrégat numérique du jour ;
- le journal numérique borné de reprise si une écriture est interrompue.

`storage.session` contient uniquement les agrégats numériques de session et des identifiants
éphémères bornés. La description exhaustive se trouve dans
https://github.com/didou92i/ecoIA/blob/main/PRIVACY.md.

## Cohérence obligatoire

Ne jamais sélectionner « aucune donnée traitée » si le formulaire de Google inclut le traitement
local dans sa définition. Ne jamais affirmer qu’ecoIA mesure directement un centre de données. Toute
évolution future impliquant un serveur, de l’analytique ou une nouvelle permission doit être déclarée
avant publication de la mise à jour.
