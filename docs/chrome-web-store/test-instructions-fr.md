# Instructions de test pour l’équipe Chrome Web Store

## Prérequis

Aucun compte ecoIA, aucune clé API et aucun identifiant de test ne sont nécessaires.

## Parcours principal

1. Installer l’extension.
2. Ouvrir une conversation textuelle sur ChatGPT, Claude, Gemini, Mistral Le Chat ou Perplexity.
3. Vérifier que la notice « Mesurer en toute transparence » apparaît avant toute mesure.
4. Cliquer sur « Activer ecoIA ».
5. Envoyer un nouveau prompt textuel et attendre la fin de la réponse.
6. Vérifier l’apparition des tokens visibles et des estimations d’eau, de voiture et de télévision.
7. Ouvrir « Méthode et détails » pour consulter le modèle appliqué, l’électricité, le carbone, la
   qualité des données, les sources, les limites et le diagnostic local.
8. Cliquer sur « Désactiver la mesure » et vérifier le retour à la notice de consentement.

## Interactions complémentaires

- faire glisser l’en-tête pour déplacer le panneau ;
- utiliser les flèches lorsque l’en-tête a le focus ;
- changer de thème avec le bouton lune/soleil ;
- replier puis rouvrir le panneau ;
- choisir manuellement un modèle compatible dans « Méthode et détails ».

## Résultat attendu

Les données affichées sont des estimations pédagogiques. Aucun appel réseau n’est initié par
l’extension. Le choix « Pas maintenant » laisse la mesure inactive et permet de rouvrir le widget
plus tard.

## Plateformes

Les sélecteurs de pages tierces peuvent évoluer. Si une plateforme n’expose plus une conversation
reconnue, ecoIA affiche une mesure en pause sans lire le reste de la page.
