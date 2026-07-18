# Calibration de l’estimation des tokens visibles

Date de calibration : 18 juillet 2026  
Version des coefficients : `2026-07-18.1`

ecoIA n’essaie pas de reproduire un compteur de facturation. Le navigateur expose le texte visible,
mais pas nécessairement les instructions système, le raisonnement, les outils, le cache ou le format
exact envoyé au modèle. L’extension calcule donc une fourchette locale et conserve la mention
« estimé ».

## Corpus

Le corpus commité dans `tests/fixtures/tokens/` est synthétique et ne contient aucune conversation
réelle. Il couvre du français, de l’anglais, du code JavaScript et Python, des écritures latines,
arabes et CJK, ainsi que des emoji.

## Références hors extension

- OpenAI : `tiktoken` 0.13.0, encodage `o200k_base`, projet officiel
  `https://github.com/openai/tiktoken`.
- Claude : `@anthropic-ai/tokenizer` 0.0.4, projet Anthropic
  `https://github.com/anthropics/anthropic-tokenizer-typescript`. Ce tokenizer est ancien et ne
  représente pas exactement les familles Claude actuelles ; il sert uniquement de proxy de
  calibration, avec une fourchette élargie.
- Mistral : `mistral-common` 1.11.6 et son tokenizer V7, projet officiel
  `https://github.com/mistralai/mistral-common`. Les modèles Le Chat peuvent employer une autre
  version ; la fourchette en tient compte.
- Gemini : la documentation Google indique environ quatre caractères par token. Le compteur exact
  nécessite un appel authentifié `countTokens`, incompatible avec la promesse « zéro réseau » de
  l’extension. Les fixtures conservent donc une plage documentaire de trois à cinq caractères par
  token, pas un résultat d’API prétendument observé.

Ces outils ont été exécutés dans un environnement temporaire de calibration. Ils ne figurent ni
dans `package.json`, ni dans les bundles, ni dans les archives distribuées.

## Méthode légère

Un parcours Unicode borné à 2 Mio mesure les caractères, mots, espaces, ponctuations, retours à la
ligne, marqueurs de code, écritures non latines et emoji. Des coefficients versionnés produisent une
valeur centrale. Les erreurs observées et l’incertitude liée aux versions de tokenizer déterminent
les bornes basse et haute. La marge minimale dépasse 10 % pour toutes les familles.

La calibration doit être revue lorsque le corpus change, lorsqu’un fournisseur publie un compteur
local actuel ou lorsqu’un test de plateforme expose des tokens observés fiables.
