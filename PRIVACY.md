# Confidentialité

ecoIA est conçu pour fonctionner localement et avec minimisation des données.

## Données traitées

Le script de contenu lit le dernier prompt et la dernière réponse textuelle visibles afin d’estimer
une fourchette de tokens. Ces chaînes existent seulement en mémoire dans le contexte de la page. Elles
sont remplacées par des chaînes vides immédiatement après conversion.

Lorsque des tours précédents sont visibles, leur contexte est converti une seule fois en estimation
numérique pour l’interaction correspondante, puis la chaîne est vidée. ecoIA ne sait pas si le
fournisseur a réellement renvoyé tout ou partie de ce contexte ; cette information sert uniquement à
proposer une borne haute possible.

Les totaux commencent à partir de l’activation d’ecoIA dans la page. Le dernier tour déjà visible au
démarrage, au rechargement ou juste après un changement de conversation sert de baseline, même si sa
réponse est encore en cours. Ce tour reste affiché mais n’est jamais agrégé : ses mutations, sa suite
et sa terminaison restent exclues. Recharger au milieu d’une réponse exclut donc le reste de cette
réponse plutôt que de risquer de compter deux fois sa valeur absolue. Seul un tour utilisateur
réellement ajouté ensuite devient éligible ; en cas de remplacement ou virtualisation ambiguë du DOM,
ecoIA préfère sous-compter.

Aucun prompt, aucun texte de réponse, aucun titre de page, aucune URL complète et aucun identifiant de
conversation n’est stocké ou transmis au processus d’arrière-plan. Les messages entre composants sont
validés et contiennent uniquement des nombres, des identifiants éphémères aléatoires et des valeurs
issues de listes fermées.

## Stockage local

- `storage.local` conserve les préférences visuelles, l’agrégat numérique du jour courant et, en cas
  d’écriture interrompue, le journal de reprise décrit ci-dessous ;
- `storage.session` conserve les agrégats numériques des sessions d’onglet et leurs contributions
  récentes ;
- `ecoia.sessions.v1` est un registre de 32 sessions au maximum. Il contient seulement un identifiant
  éphémère et un `lastSeen` numérique par session. Une session inactive depuis plus de 24 heures ou
  évincée par la borne est supprimée avec ses deux clés d’agrégat et d’événements lors du prochain
  événement accepté ou d’une réinitialisation de session ;
- les identifiants de déduplication sont limités à 256 entrées. Ils deviennent inactifs après
  30 minutes et sont physiquement élagués lors du prochain événement accepté ou d’une
  réinitialisation de session ;
- le changement de date remplace l’agrégat quotidien précédent au lieu de créer un historique.

### Journal de reprise

`ecoia.journal.v1` permet de terminer de façon idempotente une écriture commencée dans
`storage.local` puis interrompue avant `storage.session`, notamment après la suspension d’un service
worker MV3. Il contient uniquement des agrégats numériques absolus et des métadonnées éphémères bornées.
Ces métadonnées sont des identifiants aléatoires, séquences, dates calendaires, horodatages, états de
32 sessions et au plus 256 contributions. Il ne contient aucun prompt, aucune réponse, aucune URL,
aucun titre et aucun identifiant de conversation.

Après une interruption, ce journal peut persister sans expiration arbitraire jusqu’à la reprise du
service worker, ou plus rarement jusqu’à la désinstallation si aucune reprise ne se produit. Cette
persistance potentiellement indéfinie est le compromis retenu pour préserver l’idempotence après une
longue suspension : le journal est unique, strictement borné et contient uniquement des agrégats
numériques et des métadonnées éphémères bornées, sans texte de conversation ni URL. Il est rejoué une
seule fois puis supprimé. Seul un journal invalide ou porteur d’un champ inconnu est supprimé sans
reprise. Sa structure est validée avec des clés exactes, des UUID v4 canoniques, des listes bornées et
des dates `YYYY-MM-DD` calendaires avant toute copie vers `storage.session`.

Ces données restent dans le profil du navigateur. ecoIA n’exploite aucun compte et aucun serveur.
Le choix manuel d’un modèle est uniquement conservé en mémoire de la page, jamais dans
`storage.local` ou `storage.session`. Il est remis à zéro lors d’un changement de conversation,
d’une navigation ou d’un rechargement de page.

## Diagnostic local

Le diagnostic affiche uniquement cinq états issus de listes fermées : plateforme reconnue ou non
reconnue ; conversation détectée ou mesure en pause ; modèle automatique, manuel ou générique ;
contexte absent, complet ou partiel ; réponse en attente, en cours, terminée ou interrompue.
Il ne contient aucun texte de conversation, extrait, URL, identifiant de conversation, identifiant
d’onglet ni horodatage précis.

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
