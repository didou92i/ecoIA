# Confidentialité

ecoIA est conçu pour fonctionner localement et avec minimisation des données.

## Données traitées

Le script de contenu lit le dernier prompt et la dernière réponse textuelle visibles afin d’estimer
une fourchette de tokens. Ces chaînes existent seulement en mémoire dans le contexte de la page. Elles
sont remplacées par des chaînes vides immédiatement après conversion.

Aucun prompt, aucun texte de réponse, aucun titre de page, aucune URL complète et aucun identifiant de
conversation n’est stocké ou transmis au processus d’arrière-plan. Les messages entre composants sont
validés et contiennent uniquement des nombres, des identifiants éphémères aléatoires et des valeurs
issues de listes fermées.

## Stockage local

- `storage.local` conserve les préférences visuelles et l’agrégat numérique du jour courant ;
- `storage.session` conserve les agrégats numériques des sessions d’onglet ;
- les identifiants de déduplication sont limités à 256 entrées et expirent après 30 minutes ;
- le changement de date remplace l’agrégat quotidien précédent au lieu de créer un historique.

Ces données restent dans le profil du navigateur. ecoIA n’exploite aucun compte et aucun serveur.

## Réseau

L’extension n’effectue aucune requête réseau, ne charge aucune police distante et ne contient aucun
outil d’analytique ou de télémétrie. Le test navigateur échoue si une requête HTTP(S), WebSocket ou
ressource distante est initiée par l’extension.

Le lien « Voir la source primaire » n’ouvre une page externe qu’après un clic explicite de
l’utilisateur. Cette navigation est alors soumise à la politique de confidentialité du site choisi.

## Permissions

La seule permission d’API est `storage`. Les accès aux sites sont limités aux six origines exactes
déclarées dans le manifest. ecoIA ne demande ni `tabs`, ni `activeTab`, ni `scripting`, ni
`webRequest`, ni `<all_urls>`.

## Suppression

La désinstallation supprime les données de l’extension selon les garanties du navigateur. ecoIA ne
possède aucune copie distante à supprimer.
