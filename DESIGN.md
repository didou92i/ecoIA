---
name: ecoIA
description: Un fil d'impact compact qui rend les estimations environnementales lisibles en un regard.
colors:
  surface: "oklch(97.5% 0.008 175)"
  surface-raised: "oklch(99.2% 0.004 175)"
  surface-muted: "oklch(94% 0.014 175)"
  text: "oklch(22% 0.02 175)"
  text-muted: "oklch(46% 0.025 175)"
  border: "oklch(84% 0.018 175)"
  accent: "oklch(50% 0.095 178)"
  accent-strong: "oklch(32% 0.064 185)"
  accent-soft: "oklch(93% 0.035 175)"
  warning: "oklch(52% 0.13 72)"
  error: "oklch(47% 0.17 20)"
typography:
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 760
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 450
    lineHeight: 1.45
    letterSpacing: "normal"
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "10px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.075em"
rounded:
  control: "10px"
  content: "14px"
  panel: "18px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
components:
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.panel}"
    width: "195px"
  button-ghost:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.control}"
    size: "32px"
  impact-trail:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text}"
    rounded: "{rounded.content}"
    padding: "8px 10px"
---

# Design System: ecoIA

## Overview

**Creative North Star: "Le Fil d'impact"**

ecoIA ressemble à un instrument de lecture calme posé au bord de la conversation. Une ligne discrète
relie les équivalences et donne un ordre de lecture naturel. La surface reste compacte, familière et
immédiatement compréhensible. Une lueur courte confirme une nouvelle mesure, puis l'interface redevient
silencieuse.

Le système rejette les tableaux de bord envahissants, la fausse précision, les cartes imbriquées et
les codes visuels génériques des outils IA. Les thèmes clair et sombre ont la même importance. La
structure, la taille et les interactions restent identiques dans les deux environnements.

**Key Characteristics:**

- Une colonne unique de 195 px, lisible sans masquer la conversation.
- Une stratégie colorée restreinte, avec un seul accent végétal et des neutres teintés.
- Un parcours d'impact relié plutôt qu'une répétition de cartes identiques.
- Des transitions de 160 à 720 ms qui utilisent uniquement opacité et transformation.
- Une divulgation progressive pour la méthode, les sources et le diagnostic.

## Colors

La palette évoque un carnet de mesure végétal et technique. Les neutres sont légèrement teintés vers
le vert d'eau, jamais blancs ou noirs purs.

### Primary

- **Vert de mesure** : réservé aux états actifs, aux pictogrammes d'impact et aux liens utiles.
- **Encre TerritorIA** : utilisée pour la marque compacte et les contrôles fortement identifiants.

### Secondary

- **Brume d'eau** : porte le fond du parcours d'impact et les états sélectionnés sans devenir une
  décoration dominante.

### Neutral

- **Papier minéral** : surface principale claire, calme et légèrement teintée.
- **Encre profonde** : texte principal, valeurs et libellés de modèle.
- **Lichen discret** : texte secondaire, plages et explications.
- **Trait de mesure** : bordures, séparateurs et ligne verticale du parcours.

**The Rare Accent Rule.** L'accent reste sous 10 % de la surface et signifie toujours un état, une
mesure ou une action.

**The Theme Parity Rule.** Aucun élément ne dépend d'un thème pour rester visible ou compréhensible.

## Typography

**Display Font:** police système du navigateur
**Body Font:** police système du navigateur
**Label Font:** police système du navigateur

**Character:** une seule famille native assure un rendu rapide, stable et familier. La hiérarchie
vient du poids, de la taille et de l'espacement, jamais d'une police distante.

### Hierarchy

- **Title** (760, 14 px, 1.2) : marque et valeurs d'impact principales.
- **Body** (450, 12 px, 1.45) : états, modèles et détails explicatifs.
- **Label** (700, 10 px, 0.075 em, capitales) : titres de section courts.
- **Range** (520, 9.5 px, 1.3) : plages possibles et précisions secondaires.

**The Numeric Calm Rule.** Les nombres utilisent des chiffres tabulaires. Ils ne changent jamais de
taille pendant une réponse en cours.

## Elevation

Le système combine une superposition tonale et une seule ombre ambiante autour du panneau. Les
contenus internes restent plats. Les bordures et séparateurs portent la structure, pas une collection
d'ombres individuelles.

### Shadow Vocabulary

- **Panneau flottant** : ombre large et diffuse, uniquement autour du widget complet.
- **Confirmation de mesure** : halo coloré temporaire, déclenché une seule fois à la fin d'une
  nouvelle réponse.

**The One Shadow Rule.** Une seule ombre structurelle est autorisée, celle du panneau flottant.

### Translucidité fonctionnelle

En thème clair, le panneau principal utilise une surface opaque à 72 %, un flou d'arrière-plan de
16 px et une fine lumière intérieure. Les registres de tokens conservent 88 % d'opacité. En thème
sombre, l'opacité remonte à 90 % pour protéger le contraste sur les pages claires. Cet effet
appartient uniquement au conteneur flottant : il ne doit pas devenir une collection de cartes en
verre ni réduire le contraste des données.

La hauteur déployée est plafonnée à 480 px sur toutes les plateformes. Les détails supplémentaires
défilent à l'intérieur du panneau. Le zoom propre au site reste respecté, car le neutraliser rendrait
le widget insensible aux réglages d'accessibilité du navigateur.

## Components

### Buttons

- **Shape:** carrés doucement arrondis de 28 px, cible minimale supérieure à 24 px.
- **Primary:** action textuelle dans les alertes, bordure complète et fond transparent.
- **Hover / Focus:** changement tonal en 160 ms et anneau de focus de 2 px sans déplacement.
- **Ghost:** contrôles de thème et de repli, avec pictogrammes SVG statiques.

### Cards / Containers

- **Corner Style:** panneau à 18 px, groupes de contenu à 14 px, contrôles à 10 px.
- **Background:** une surface principale et une seule surface relevée.
- **Shadow Strategy:** aucune ombre interne.
- **Border:** trait de 1 px suffisamment contrasté dans les deux thèmes.
- **Internal Padding:** rythme de 4, 8, 12 et 16 px.

### Inputs / Fields

- **Style:** contrôle natif, fond relevé, bordure de 1 px et rayon de 10 px.
- **Focus:** anneau bleu de 2 px indépendant de la couleur de marque.
- **Error / Disabled:** texte explicite, couleur secondaire et sémantique native.

### Navigation

La marque TerritorIA et le nom ecoIA forment la poignée de déplacement. Le relâchement conserve la
position exacte, tandis que les flèches du clavier permettent un ajustement accessible. Cet en-tête
reste visible pendant le défilement interne afin que la marque, le thème et le repli ne soient jamais
rognés.

### Impact Trail

Les trois équivalences partagent un même conteneur. Une ligne verticale relie des pictogrammes SVG
de même taille. Lorsqu'une réponse se termine, les lignes apparaissent successivement par opacité et
translation verticale, puis restent immobiles.

## Do's and Don'ts

### Do:

- **Do** conserver une lecture complète à 320 px et une largeur nominale de 195 px.
- **Do** utiliser uniquement des pictogrammes SVG intégrés, une police système et des animations CSS.
- **Do** limiter les transitions interactives à 160 ou 220 ms avec une courbe exponentielle.
- **Do** réserver l'animation de 720 ms à la confirmation d'une nouvelle mesure.
- **Do** maintenir les valeurs centrales, les plages et la qualité des données comme informations
  distinctes.

### Don't:

- **Don't** créer des tableaux de bord envahissants ou des cartes imbriquées.
- **Don't** utiliser les interfaces IA violettes et néon génériques, les effets de verre décoratifs
  ou les lueurs permanentes.
- **Don't** introduire une gamification culpabilisante, des alertes anxiogènes ou des scores
  moralisateurs.
- **Don't** masquer les fourchettes, les limites ou la provenance derrière une fausse précision
  scientifique.
- **Don't** ajouter des animations gratuites, des dépendances lourdes ou des contrôles non standards.
- **Don't** animer les propriétés de mise en page comme la largeur, la hauteur, la position ou les
  marges.
