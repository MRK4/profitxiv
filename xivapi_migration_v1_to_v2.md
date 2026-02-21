> **Migration terminée** — La migration vers XIVAPI v2 a été implémentée. Ce document est conservé comme référence.

1. Objectif du document

Ce document décrit précisément la procédure à suivre pour migrer l’application vers XIVAPI v2 en supprimant totalement les dépendances à la v1.

L’objectif est de :

Supprimer tous les endpoints legacy

Uniformiser les appels via le système sheet-based de la v2

Reconstruire la logique de craft côté application

Optimiser les appels API

Garantir une architecture maintenable et stable

2. Principes fondamentaux de XIVAPI v2

Contrairement à la v1, la v2 repose sur un accès structuré aux Sheets du jeu.

Il n’existe plus :

d’endpoint recipe-tree

d’endpoint item-metadata

d’index “magiques” dédiés

Toutes les données proviennent principalement des sheets suivantes :

Item

Recipe

Les relations doivent être exploitées et reconstruites côté application.

3. Récupération des données d’un Item
Endpoint standard
GET https://xivapi.com/v2/item/{itemId}

Bonnes pratiques

Toujours limiter les champs :

?fields=ID,Name,Icon,LevelItem,Sources

Données obtenues

Nom

Icône

Niveau d’objet

Sources (utile pour détecter le gatherable)

Ce endpoint remplace tous les anciens appels liés aux métadonnées d’item.

4. Déterminer si un item est craftable

Un item est craftable s’il existe au moins une recette où il est le résultat.

Endpoint
GET https://xivapi.com/v2/search
?sheets=Recipe
&query=ItemResult.ID={itemId}
&fields=ID

Interprétation

Si au moins un résultat est retourné → l’item est craftable

Sinon → il ne l’est pas

5. Récupération complète d’une recette

Une fois l’ID de la recette connu :

GET https://xivapi.com/v2/sheet/Recipe/{recipeId}


Limiter les champs si nécessaire :

?fields=ID,ItemResult,AmountResult,ItemIngredient0,AmountIngredient0,...

Informations disponibles

Item résultant

Quantité produite

Liste des ingrédients

Quantité par ingrédient

Job requis

Niveau requis

6. Déterminer si un item est utilisé comme composant

Un item peut ne pas être craftable mais être utilisé dans d’autres recettes.

Il faut rechercher s’il apparaît dans les champs ItemIngredientX.

Endpoint
GET https://xivapi.com/v2/search
?sheets=Recipe
&query=ItemIngredient0.ID={itemId}
&fields=ID


Il faut vérifier tous les slots d’ingrédients possibles (ItemIngredient0 à ItemIngredient9).

Si au moins une recette est trouvée → l’item est un composant.

7. Déterminer si un item est récoltable

La v2 expose les sources directement via l’item.

Endpoint
GET https://xivapi.com/v2/item/{itemId}?fields=Sources

Logique

Si la propriété Sources contient une entrée liée à GatheringItem, alors :

→ L’item est récoltable.

Sinon :

→ Il ne l’est pas.

8. Reconstruction de l’arbre de craft

XIVAPI v2 ne fournit aucun “recipe tree” automatique.

L’arbre doit être construit manuellement :

Vérifier si l’item est craftable

Récupérer sa recette

Extraire la liste des ingrédients

Pour chaque ingrédient :

Vérifier s’il est craftable

Si oui → récupérer sa recette

Répéter récursivement

Il est impératif de maintenir une liste d’IDs déjà traités afin d’éviter les boucles infinies.

9. Optimisation des performances

Pour limiter le nombre d’appels :

Regrouper les recherches via /v2/search

Toujours utiliser fields

Mettre en cache les items déjà chargés

Ne jamais recalculer plusieurs fois la craftabilité d’un même item

10. Suppression définitive des routes v1

Les endpoints suivants doivent être supprimés :

/api/xivapi/items

/api/xivapi/item-metadata

/api/xivapi/recipe-tree

Ils sont remplacés par :

/v2/item/{id}

/v2/search?sheets=Recipe

/v2/sheet/Recipe/{id}

11. Résultat attendu

Après migration :

Architecture unifiée

Aucune dépendance à la v1

Logique claire et contrôlée côté application

Maintenance simplifiée

Meilleure compatibilité future