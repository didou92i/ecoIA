# Installer ecoIA sans connaissances techniques

Ce guide permet d’installer ecoIA en quelques minutes. Aucun compte ecoIA, aucune clé API et aucune
commande informatique ne sont nécessaires.

> ecoIA affiche des **estimations pédagogiques**. Ce n’est ni un compteur physique, ni une facture
> énergétique, ni un bilan carbone certifié.

## Avant de commencer

Vous avez seulement besoin :

- d’un navigateur compatible : Google Chrome, Microsoft Edge ou Mozilla Firefox ;
- de conserver le dossier ecoIA sur votre ordinateur après l’installation ;
- d’une minute pour autoriser le « mode développeur » du navigateur.

## Google Chrome ou Microsoft Edge

### 1. Télécharger le bon fichier

1. Ouvrez la page [Dernière version d’ecoIA](https://github.com/didou92i/ecoIA/releases/latest).
2. Dans **Assets**, téléchargez `ecoia-chromium.zip`.
3. N’utilisez pas les fichiers « Source code » proposés automatiquement par GitHub : ils ne
   contiennent pas l’extension déjà construite.

### 2. Décompresser l’archive

Double-cliquez sur `ecoia-chromium.zip`. Un dossier `ecoia-chromium` apparaît. Déplacez-le dans un
endroit que vous conserverez, par exemple votre dossier Documents.

### 3. Charger l’extension

Pour Chrome :

1. saisissez `chrome://extensions` dans la barre d’adresse ;
2. activez **Mode développeur** en haut à droite ;
3. cliquez sur **Charger l’extension non empaquetée** ;
4. choisissez le dossier `ecoia-chromium` décompressé, celui qui contient `manifest.json`.

Pour Edge, suivez les mêmes étapes depuis `edge://extensions`, puis cliquez sur **Charger
l’extension décompressée**.

### 4. Faire un premier essai

1. Ouvrez ChatGPT, Claude, Gemini, Mistral Le Chat ou Perplexity.
2. Actualisez l’onglet si la plateforme était déjà ouverte.
3. Posez une nouvelle question textuelle.
4. Le petit panneau ecoIA apparaît. Vous pouvez le déplacer, le replier et changer son thème.

## Mozilla Firefox

Firefox accepte l’archive de développement de façon temporaire tant qu’elle n’est pas signée :

1. téléchargez `ecoia-firefox.zip` depuis la
   [dernière version](https://github.com/didou92i/ecoIA/releases/latest) ;
2. décompressez-la ;
3. ouvrez `about:debugging#/runtime/this-firefox` ;
4. cliquez sur **Charger un module complémentaire temporaire** ;
5. sélectionnez `manifest.json` dans le dossier décompressé.

Firefox peut demander de recommencer après son redémarrage. Une distribution signée pourra être
ajoutée plus tard sans modifier le fonctionnement local d’ecoIA.

## Mettre ecoIA à jour

Le dépôt officiel reste le point de contrôle des mises à jour :
[github.com/didou92i/ecoIA](https://github.com/didou92i/ecoIA).

1. Téléchargez la nouvelle archive depuis **Releases**.
2. Décompressez-la dans un nouveau dossier.
3. Dans la page des extensions, supprimez l’ancienne ecoIA ou remplacez son dossier, puis cliquez
   sur le bouton de rechargement.
4. Actualisez les onglets d’assistants IA déjà ouverts.

Les agrégats numériques conservés par le navigateur peuvent être supprimés lors d’une
désinstallation complète. ecoIA ne conserve jamais le texte des conversations.

## Résoudre les problèmes courants

### « Le fichier manifest est introuvable »

Vérifiez que vous avez décompressé `ecoia-chromium.zip`, puis sélectionnez le dossier qui contient
directement `manifest.json`, pas le fichier ZIP et pas le dossier parent.

### « Extension context invalidated »

Ce message apparaît lorsqu’une ancienne page utilise encore la version précédente de l’extension.
Rechargez ecoIA dans `chrome://extensions`, puis actualisez complètement la page ChatGPT ou
Perplexity.

### Le panneau reste sur « En attente »

Actualisez la plateforme, posez une **nouvelle** question et attendez la fin de la réponse. Si le
problème continue, ouvrez une demande dans les
[Issues GitHub](https://github.com/didou92i/ecoIA/issues) en indiquant le navigateur, la plateforme
et une capture masquant vos conversations et vos informations personnelles.

## Désinstaller

Dans `chrome://extensions`, `edge://extensions` ou `about:addons`, trouvez ecoIA puis choisissez
**Supprimer**. Vous pouvez ensuite effacer le dossier décompressé de votre ordinateur.
