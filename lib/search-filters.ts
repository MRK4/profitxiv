export interface ItemMetadata {
  id: number;
  isCraftable: boolean;
  isGatherable: boolean;
  isRecipeComponent: boolean;
  recipeId?: number;
}

export interface ItemMetadataResponse {
  gatherableIds: number[];
  craftableIds: number[];
  recipeMap: Record<number, number>;
  recipeComponentIds: number[];
}

export function buildItemMetadata(
  itemId: number,
  response: ItemMetadataResponse
): ItemMetadata {
  const craftableSet = new Set(response.craftableIds);
  const gatherableSet = new Set(response.gatherableIds);
  const componentSet = new Set(response.recipeComponentIds);

  return {
    id: itemId,
    isCraftable: craftableSet.has(itemId),
    isGatherable: gatherableSet.has(itemId),
    isRecipeComponent: componentSet.has(itemId),
    recipeId: response.recipeMap[itemId],
  };
}

export interface SearchFilters {
  hideNonCraftable: boolean;
  hideNonGatherable: boolean;
}

export function shouldDisplayItem(
  itemId: number,
  metadata: ItemMetadata,
  filters: SearchFilters
): boolean {
  const { isCraftable, isGatherable, isRecipeComponent } = metadata;

  if (!filters.hideNonCraftable && !filters.hideNonGatherable) return true;

  if (filters.hideNonCraftable && !filters.hideNonGatherable)
    return isCraftable || isRecipeComponent;

  if (filters.hideNonGatherable && !filters.hideNonCraftable)
    return isGatherable || isRecipeComponent || isCraftable;

  return isCraftable || isGatherable || isRecipeComponent;
}
