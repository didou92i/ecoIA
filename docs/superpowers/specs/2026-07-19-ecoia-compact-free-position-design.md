# ecoIA compact et librement positionnable

**Statut :** design validé par l’utilisateur le 19 juillet 2026

## Objectif

Réduire sensiblement l’encombrement du widget ecoIA, remplacer le monogramme « e » par la tête
colorée TerritorIA fournie par l’utilisateur et permettre un placement réellement libre dans la
fenêtre. Le résultat doit rester lisible, accessible, local, léger et cohérent sur toutes les
plateformes prises en charge.

## Décisions validées

### Format compact

- La largeur déployée passe de 248 px à 195 px.
- La hauteur déployée est plafonnée à 480 px. Le contenu supplémentaire défile à l’intérieur.
- Le bouton replié passe de 44 px à 36 px.
- Le texte fonctionnel ne descend jamais sous 11 px. Les plages secondaires peuvent utiliser 9 px.
- Les contrôles interactifs mesurent au moins 28 px, au-dessus de la cible minimale WCAG de 24 px.
- Les marges, espacements, rayons et hauteurs de ligne sont réduits de manière optique plutôt que par
  une transformation CSS globale.
- Les tokens, les trois équivalences, les fourchettes et la méthode restent présents. La réduction ne
  supprime aucune information scientifique.

Une mise à l’échelle CSS à 70 % est exclue : elle produirait un texte d’environ 8,4 px et des cibles
d’action trop petites. La combinaison de la largeur, de la hauteur et d’une densité accrue doit donner
un encombrement perçu inférieur d’environ 30 %, sans diminuer la lisibilité dans la même proportion.

### Identité TerritorIA

- La tête colorée du fichier `Colorful Brain Human Technology Logo (3).png` remplace le carré « e »
  dans l’en-tête.
- Le libellé « ecoIA » reste affiché à côté du pictogramme.
- La tête est présentée sur fond transparent, sans carré blanc, dans une boîte visuelle de 24 px.
- La source de 16,9 Ko n’est pas copiée telle quelle dans l’extension. Une variante locale, transparente
  et optimisée est créée pour le widget.
- Le rendu doit rester net sur un écran haute densité et lisible dans les thèmes clair et sombre.
- L’actif est intégré sans chargement réseau et sans élargir les permissions de l’extension.

### Déplacement libre

- Toute la zone de marque de l’en-tête sert de poignée de déplacement. Les boutons de thème et de
  repli conservent leur fonction normale.
- Pendant le glissement, les coordonnées horizontale et verticale suivent le pointeur.
- Au relâchement, le widget conserve exactement sa position. Il ne s’ancre plus automatiquement au
  bord gauche ou droit.
- La rangée de deux boutons d’ancrage est supprimée afin de réduire la hauteur et d’éviter une
  interaction contradictoire.
- La position `left` et `top` est enregistrée dans `chrome.storage.local` avec le thème et l’état
  replié.
- Les anciennes préférences contenant `side: "left" | "right"` restent acceptées. Lors du premier
  chargement, elles sont converties en une coordonnée horizontale valide, puis la nouvelle forme est
  enregistrée à la prochaine interaction.
- Après un redimensionnement, un changement de zoom ou une réouverture, les coordonnées sont limitées
  aux bords visibles avec une marge de 12 px. La position n’est modifiée que si le widget sortirait de
  la fenêtre.
- Lorsque la poignée possède le focus, les touches fléchées déplacent le widget. Le pas normal est de
  10 px et `Maj` permet un ajustement fin de 1 px. Ce déplacement est lui aussi enregistré.

## Architecture

### `widget-template.ts`

Le modèle remplace le texte « e » par un élément d’image décoratif dont la source locale est définie
par le code de l’extension. La rangée `anchor-actions` et ses références sont retirées. Le bouton de
marque conserve le nom accessible « Déplacer ecoIA » et décrit l’usage des flèches au clavier.

### `widget-styles.ts`

Les tokens de dimension deviennent la source unique de l’échelle compacte : largeur 195 px, hauteur
480 px et format replié 36 px. Les espacements et tailles sont ajustés sans `zoom`, `scale()` permanent
ou police distante. Le verre, les thèmes et le focus visible sont conservés.

### `widget-controller.ts`

Les préférences utilisent une coordonnée `left` en plus de `top`. Une fonction pure limite chaque axe
selon les dimensions réellement rendues. Le relâchement du pointeur enregistre les coordonnées sans
les convertir en côté. Les événements clavier utilisent la même fonction de limitation et la même
persistance.

### `content-controller.ts`

La validation des préférences accepte le nouveau champ horizontal fini et bornable. Elle continue à
tolérer l’ancien champ `side` pour assurer une migration non destructive des installations existantes.
Les valeurs non numériques ou non finies sont ignorées.

### Actif graphique

La variante transparente optimisée est produite à partir du fichier validé, puis intégrée localement.
Le paquet final doit respecter le budget existant de 153 600 octets pour Chromium et Firefox. Si
l’actif fait dépasser ce budget, l’optimisation porte sur l’image et sur le code supprimé avec les
anciens ancrages ; le budget ne sera pas augmenté pour masquer le dépassement.

## États et cas limites

- Position enregistrée devenue trop proche du bord après réduction de fenêtre : limitation à 12 px.
- Passage du mode déployé au mode replié : conservation du point supérieur gauche, puis limitation si
  nécessaire.
- Réouverture du mode déployé près du bord droit ou inférieur : limitation selon les dimensions
  déployées réelles.
- Perte du pointeur ou annulation avec `Escape` : retour à la dernière position enregistrée.
- Préférence historique uniquement ancrée à droite : calcul de `left = viewportWidth - width - 12`.
- Préférence historique ancrée à gauche : calcul de `left = 12`.
- Viewport de 320 px : aucune barre de défilement horizontale sur la page.
- Mode sombre : le logo conserve ses couleurs, sans halo blanc autour de l’image.

## Vérification attendue

### Tests unitaires

- Validation et migration des anciennes préférences.
- Limitation indépendante des axes horizontal et vertical.
- Conservation exacte de la position au relâchement.
- Déplacement clavier avec pas normal et pas fin.
- Absence des boutons d’ancrage et présence du logo accessible.
- Dimensions compactes et absence de propriété CSS `zoom`.

### Tests E2E

- Largeur de 195 px, hauteur maximale de 480 px et bouton replié de 36 px.
- Glissement jusqu’au centre, relâchement sans ancrage, puis conservation après rechargement.
- Déplacement vers chacun des quatre coins sans sortir du viewport.
- Repli, réouverture et redimensionnement avec limitation correcte.
- Navigation clavier, focus visible, thèmes clair et sombre et viewport de 320 px.
- Aucune requête réseau distante et aucune nouvelle permission.

### Contrôles de livraison

- `npm run verify`
- `npm run e2e`
- `npm run secrets`
- `npm run checksums`
- Contrôle visuel des thèmes clair et sombre.
- Budget de 153 600 octets respecté pour les deux paquets.

## Hors périmètre

- Un réglage utilisateur permettant de choisir plusieurs tailles.
- Le redimensionnement manuel du widget.
- Le déplacement par inertie ou une animation physique.
- Une synchronisation de position entre plusieurs appareils.
- Une modification du logo principal affiché dans le README ou des autres actifs de marque.
