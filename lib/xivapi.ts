import axios, { type AxiosInstance } from "axios";

const xivapiV1: AxiosInstance = axios.create({
  baseURL: "https://xivapi.com",
  timeout: 30000,
});

const xivapiV2: AxiosInstance = axios.create({
  baseURL: "https://v2.xivapi.com",
  timeout: 15000,
});

export async function getItemDescription(
  itemId: number
): Promise<string | null> {
  try {
    const { data } = await xivapiV1.get<{ Description?: string }>(
      `/item/${itemId}`,
      { params: { columns: "Description" } }
    );
    const desc = data.Description;
    if (typeof desc === "string" && desc.trim()) return desc;
    return null;
  } catch {
    return null;
  }
}

export async function getItemName(itemId: number): Promise<string | null> {
  try {
    const { data } = await xivapiV2.get(
      `/api/sheet/Item/${itemId}?fields=Name`
    );
    return data.fields?.Name ?? null;
  } catch {
    return null;
  }
}

export async function getItemNames(
  itemIds: number[]
): Promise<Record<number, string>> {
  const results = await Promise.all(
    itemIds.map(async (id) => {
      const name = await getItemName(id);
      return { id, name };
    })
  );
  return Object.fromEntries(
    results.filter((r) => r.name != null).map((r) => [r.id, r.name!])
  );
}

const ITEM_DATA_BATCH_SIZE = 100;

interface ItemSearchResult {
  ID?: number;
  Name?: string;
  Icon?: string;
}

interface ItemSearchResponse {
  Results?: ItemSearchResult[];
}

function buildIconUrl(iconPath: string | undefined): string | null {
  if (!iconPath) return null;
  const hr1Path = iconPath.replace(/\.png$/, "_hr1.png");
  return `https://xivapi.com${hr1Path.startsWith("/") ? hr1Path : `/${hr1Path}`}`;
}

async function getItemIconsViaSearch(
  itemIds: number[]
): Promise<Record<number, string>> {
  const icons: Record<number, string> = {};
  for (let i = 0; i < itemIds.length; i += ITEM_DATA_BATCH_SIZE) {
    const batch = itemIds.slice(i, i + ITEM_DATA_BATCH_SIZE);
    const filterValue = batch.join(",");
    const params = {
      indexes: "Item",
      filters: `ID|=${filterValue}`,
      columns: "ID,Icon",
      limit: ITEM_DATA_BATCH_SIZE,
    };
    console.log("[getItemIcons] Search request:", { batch: batch.slice(0, 5), params });
    try {
      const { data } = await xivapiV1.get<ItemSearchResponse>("/search", {
        params,
      });
      const results = data.Results ?? [];
      console.log("[getItemIcons] Search response:", {
        resultsCount: results.length,
        sample: results[0],
      });
      for (const r of results) {
        const id = r.ID;
        if (id != null) {
          const iconUrl = buildIconUrl(r.Icon);
          if (iconUrl != null) icons[id] = iconUrl;
          else console.log("[getItemIcons] No icon for ID", id, "Icon raw:", r.Icon);
        }
      }
    } catch (err) {
      console.error("[getItemIcons] Search failed:", (err as any)?.response?.data?.Message ?? (err as Error).message);
      throw err;
    }
  }
  return icons;
}

async function getItemIconsViaItemEndpoint(
  itemIds: number[]
): Promise<Record<number, string>> {
  const icons: Record<number, string> = {};
  console.log("[getItemIcons] Fallback: using /item/{id} for", itemIds.length, "items");
  for (const id of itemIds) {
    try {
      const { data } = await xivapiV1.get<{ Icon?: string }>(`/item/${id}`, {
        params: { columns: "Icon" },
      });
      const iconUrl = buildIconUrl(data.Icon);
      if (iconUrl != null) icons[id] = iconUrl;
    } catch (err) {
      console.log("[getItemIcons] /item/{id} failed for", id, (err as Error).message);
    }
  }
  return icons;
}

export async function getItemIcons(
  itemIds: number[]
): Promise<Record<number, string>> {
  if (itemIds.length === 0) return {};
  try {
    return await getItemIconsViaSearch(itemIds);
  } catch {
    return getItemIconsViaItemEndpoint(itemIds);
  }
}

export async function getItemData(
  itemIds: number[]
): Promise<{
  names: Record<number, string>;
  icons: Record<number, string>;
}> {
  const [names, icons] = await Promise.all([
    getItemNames(itemIds),
    getItemIcons(itemIds),
  ]);
  return { names, icons };
}

interface SearchRecipeResult {
  ID: number;
  ItemResult?: { ID: number };
}

interface SearchResponse {
  Results?: SearchRecipeResult[];
}

interface RecipeListResponse {
  Pagination?: { PageTotal: number };
  Results?: SearchRecipeResult[];
}

const SEARCH_BATCH_SIZE = 100;
const RECIPE_PAGE_SIZE = 1000;

const RECIPE_PAGE_PARALLEL = 4;

/** Fallback when /search is unavailable: scan /recipe list pages for matching ItemResult.ID */
async function getRecipesForItemsViaList(
  itemIdsSet: Set<number>
): Promise<{ craftableIds: Set<number>; recipeMap: Record<number, number> }> {
  const craftableIds = new Set<number>();
  const recipeMap: Record<number, number> = {};

  const fetchPage = (page: number) =>
    xivapiV1.get<RecipeListResponse>("/recipe", {
      params: {
        columns: "ID,ItemResult.ID",
        limit: RECIPE_PAGE_SIZE,
        page,
      },
    });

  const { data: firstPage } = await fetchPage(1);
  const pageTotal = firstPage.Pagination?.PageTotal ?? 1;
  const processResults = (results: { ID: number; ItemResult?: { ID: number } }[]) => {
    for (const r of results) {
      const itemId = r.ItemResult?.ID;
      if (itemId != null && itemIdsSet.has(itemId)) {
        craftableIds.add(itemId);
        if (!(itemId in recipeMap)) recipeMap[itemId] = r.ID;
      }
    }
  };
  processResults(firstPage.Results ?? []);

  for (let i = 2; i <= pageTotal; i += RECIPE_PAGE_PARALLEL) {
    const pages = Array.from(
      { length: Math.min(RECIPE_PAGE_PARALLEL, pageTotal - i + 1) },
      (_, j) => i + j
    );
    const responses = await Promise.all(pages.map((p) => fetchPage(p)));
    for (const res of responses) {
      processResults(res.data.Results ?? []);
    }
    if (itemIdsSet.size > 0 && [...itemIdsSet].every((id) => craftableIds.has(id))) {
      break;
    }
  }

  return { craftableIds, recipeMap };
}

export async function getRecipesForItems(
  itemIds: number[]
): Promise<{ craftableIds: Set<number>; recipeMap: Record<number, number> }> {
  const craftableIds = new Set<number>();
  const recipeMap: Record<number, number> = {};
  const itemIdsSet = new Set(itemIds);

  for (let i = 0; i < itemIds.length; i += SEARCH_BATCH_SIZE) {
    const batch = itemIds.slice(i, i + SEARCH_BATCH_SIZE);
    const filterValue = batch.join(",");

    try {
      const { data } = await xivapiV1.get<SearchResponse>("/search", {
        params: {
          indexes: "Recipe",
          filters: `ItemResult.ID|=${filterValue}`,
          columns: "ID,ItemResult.ID",
          limit: SEARCH_BATCH_SIZE,
        },
      });

      const results = data.Results ?? [];
      for (const r of results) {
        const itemId = r.ItemResult?.ID;
        if (itemId != null) {
          craftableIds.add(itemId);
          if (!(itemId in recipeMap)) recipeMap[itemId] = r.ID;
        }
      }
    } catch {
      return getRecipesForItemsViaList(itemIdsSet);
    }
  }

  return { craftableIds, recipeMap };
}

// --- Gatherable items (mining, botany, fishing) ---

interface GameContentLinksResponse {
  GameContentLinks?: {
    GatheringItem?: { Item?: unknown[] };
  };
}

export async function getGatherableItems(
  itemIds: number[]
): Promise<Set<number>> {
  const gatherableIds = new Set<number>();
  const BATCH_SIZE = 50;

  for (let i = 0; i < itemIds.length; i += BATCH_SIZE) {
    const batch = itemIds.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (id) => {
        try {
          const { data } = await xivapiV1.get<GameContentLinksResponse>(
            `/item/${id}`,
            { params: { columns: "GameContentLinks" } }
          );
          const items = data.GameContentLinks?.GatheringItem?.Item;
          return Array.isArray(items) && items.length > 0 ? id : null;
        } catch {
          return null;
        }
      })
    );
    results.forEach((id) => {
      if (id != null) gatherableIds.add(id);
    });
  }

  return gatherableIds;
}

export interface ItemMetadataResult {
  gatherableIds: number[];
  craftableIds: number[];
  recipeMap: Record<number, number>;
  recipeComponentIds: number[];
}

export async function getItemMetadata(
  itemIds: number[]
): Promise<ItemMetadataResult> {
  const [recipesResult, gatherableIds] = await Promise.all([
    getRecipesForItems(itemIds),
    getGatherableItems(itemIds),
  ]);

  const { craftableIds, recipeMap } = recipesResult;
  const recipeIds = [...new Set(Object.values(recipeMap))];
  const recipeComponentIds = await getRecipeIngredientIds(recipeIds);

  return {
    gatherableIds: [...gatherableIds],
    craftableIds: [...craftableIds],
    recipeMap,
    recipeComponentIds: [...recipeComponentIds],
  };
}

// --- Recipe tree for craft simulator ---

const RECIPE_COLUMNS =
  "ID,AmountResult,AmountIngredient0,AmountIngredient1,AmountIngredient2,AmountIngredient3,AmountIngredient4,AmountIngredient5,AmountIngredient6,AmountIngredient7,ItemIngredient0.ID,ItemIngredient0.Name,ItemIngredient0.PriceLow,ItemIngredient0.PriceMid,ItemIngredient1.ID,ItemIngredient1.Name,ItemIngredient1.PriceLow,ItemIngredient1.PriceMid,ItemIngredient2.ID,ItemIngredient2.Name,ItemIngredient2.PriceLow,ItemIngredient2.PriceMid,ItemIngredient3.ID,ItemIngredient3.Name,ItemIngredient3.PriceLow,ItemIngredient3.PriceMid,ItemIngredient4.ID,ItemIngredient4.Name,ItemIngredient4.PriceLow,ItemIngredient4.PriceMid,ItemIngredient5.ID,ItemIngredient5.Name,ItemIngredient5.PriceLow,ItemIngredient5.PriceMid,ItemIngredient6.ID,ItemIngredient6.Name,ItemIngredient6.PriceLow,ItemIngredient6.PriceMid,ItemIngredient7.ID,ItemIngredient7.Name,ItemIngredient7.PriceLow,ItemIngredient7.PriceMid,ItemIngredientRecipe0,ItemIngredientRecipe1,ItemIngredientRecipe2,ItemIngredientRecipe3,ItemIngredientRecipe4,ItemIngredientRecipe5,ItemIngredientRecipe6,ItemIngredientRecipe7,ItemResult.ID";

export interface RecipeIngredient {
  itemId: number;
  name: string;
  amount: number;
  priceLow: number;
  priceMid: number;
  isCraftable: boolean;
  subRecipeId?: number;
}

export interface RecipeData {
  recipeId: number;
  itemId: number;
  amountResult: number;
  ingredients: RecipeIngredient[];
}

interface XivRecipeRaw {
  ID: number;
  AmountResult?: number;
  AmountIngredient0?: number;
  AmountIngredient1?: number;
  AmountIngredient2?: number;
  AmountIngredient3?: number;
  AmountIngredient4?: number;
  AmountIngredient5?: number;
  AmountIngredient6?: number;
  AmountIngredient7?: number;
  ItemIngredient0?: { ID?: number; Name?: string; PriceLow?: number; PriceMid?: number };
  ItemIngredient1?: { ID?: number; Name?: string; PriceLow?: number; PriceMid?: number };
  ItemIngredient2?: { ID?: number; Name?: string; PriceLow?: number; PriceMid?: number };
  ItemIngredient3?: { ID?: number; Name?: string; PriceLow?: number; PriceMid?: number };
  ItemIngredient4?: { ID?: number; Name?: string; PriceLow?: number; PriceMid?: number };
  ItemIngredient5?: { ID?: number; Name?: string; PriceLow?: number; PriceMid?: number };
  ItemIngredient6?: { ID?: number; Name?: string; PriceLow?: number; PriceMid?: number };
  ItemIngredient7?: { ID?: number; Name?: string; PriceLow?: number; PriceMid?: number };
  ItemIngredientRecipe0?: { ID?: number }[] | null;
  ItemIngredientRecipe1?: { ID?: number }[] | null;
  ItemIngredientRecipe2?: { ID?: number }[] | null;
  ItemIngredientRecipe3?: { ID?: number }[] | null;
  ItemIngredientRecipe4?: { ID?: number }[] | null;
  ItemIngredientRecipe5?: { ID?: number }[] | null;
  ItemIngredientRecipe6?: { ID?: number }[] | null;
  ItemIngredientRecipe7?: { ID?: number }[] | null;
  ItemResult?: { ID?: number };
}

const MAX_RECIPE_DEPTH = 3;

export async function getRecipeWithIngredients(
  recipeId: number,
  depth = 0
): Promise<RecipeData | null> {
  if (depth > MAX_RECIPE_DEPTH) return null;
  try {
    const { data } = await xivapiV1.get<XivRecipeRaw>(`/recipe/${recipeId}`, {
      params: { columns: RECIPE_COLUMNS },
    });

    const itemId = data.ItemResult?.ID ?? 0;
    const amountResult = data.AmountResult ?? 1;
    const ingredients: RecipeIngredient[] = [];

    for (let i = 0; i < 8; i++) {
      const amount =
        (data as unknown as Record<string, number>)[`AmountIngredient${i}`] ?? 0;
      if (amount <= 0) continue;

      const ing = data as unknown as Record<string, unknown>;
      const itemIng = ing[`ItemIngredient${i}`] as
        | { ID?: number; Name?: string; PriceLow?: number; PriceMid?: number }
        | undefined;
      const subRecipes = ing[`ItemIngredientRecipe${i}`] as { ID?: number }[] | undefined;

      const ingItemId = itemIng?.ID;
      if (!ingItemId || ingItemId <= 0) continue;

      const subRecipe = Array.isArray(subRecipes) && subRecipes.length > 0 ? subRecipes[0] : null;
      const isCraftable = subRecipe != null && (subRecipe.ID ?? 0) > 0;

      ingredients.push({
        itemId: ingItemId,
        name: itemIng?.Name ?? `Item ${ingItemId}`,
        amount,
        priceLow: itemIng?.PriceLow ?? 0,
        priceMid: itemIng?.PriceMid ?? 0,
        isCraftable,
        subRecipeId: isCraftable ? (subRecipe!.ID ?? 0) : undefined,
      });
    }

    return {
      recipeId: data.ID,
      itemId,
      amountResult,
      ingredients,
    };
  } catch {
    return null;
  }
}

/** Collect all item IDs used as ingredients in the given recipes (depth 0 only) */
export async function getRecipeIngredientIds(
  recipeIds: number[]
): Promise<Set<number>> {
  const ingredientIds = new Set<number>();
  const uniqueRecipeIds = [...new Set(recipeIds)];

  const CONCURRENCY = 5;
  for (let i = 0; i < uniqueRecipeIds.length; i += CONCURRENCY) {
    const batch = uniqueRecipeIds.slice(i, i + CONCURRENCY);
    const recipes = await Promise.all(
      batch.map((rid) => getRecipeWithIngredients(rid, 0))
    );
    for (const r of recipes) {
      if (r) {
        for (const ing of r.ingredients) {
          ingredientIds.add(ing.itemId);
        }
      }
    }
  }

  return ingredientIds;
}

export interface RecipeTreeNode {
  itemId: number;
  name: string;
  amount: number;
  amountResult: number;
  buyPrice: number;
  craftCost: number;
  isCraftable: boolean;
  depth: number;
  children?: RecipeTreeNode[];
}

export async function getRecipeTree(
  recipeId: number,
  marketPrices: Record<number, number>,
  depth = 0
): Promise<RecipeTreeNode[]> {
  const recipe = await getRecipeWithIngredients(recipeId, depth);
  if (!recipe) return [];

  const nodes: RecipeTreeNode[] = [];

  for (const ing of recipe.ingredients) {
    const marketPrice = marketPrices[ing.itemId] ?? null;
    const npcPrice =
      ing.priceLow > 0 ? ing.priceLow : ing.priceMid > 0 ? ing.priceMid : 0;
    const buyPrice = marketPrice != null ? Math.min(marketPrice, npcPrice || Infinity) : npcPrice;

    let craftCost = 0;
    let children: RecipeTreeNode[] | undefined;

    if (ing.isCraftable && ing.subRecipeId && depth < MAX_RECIPE_DEPTH) {
      children = await getRecipeTree(ing.subRecipeId, marketPrices, depth + 1);
      const subRecipe = await getRecipeWithIngredients(ing.subRecipeId, depth + 1);
      const subAmountResult = subRecipe?.amountResult ?? 1;
      craftCost = children.reduce(
        (sum, c) =>
          sum +
          (c.isCraftable ? c.craftCost / (c.amountResult || 1) : c.buyPrice) *
            c.amount,
        0
      );
      nodes.push({
        itemId: ing.itemId,
        name: ing.name,
        amount: ing.amount,
        amountResult: subAmountResult,
        buyPrice,
        craftCost,
        isCraftable: ing.isCraftable,
        depth,
        children,
      });
    } else {
      nodes.push({
        itemId: ing.itemId,
        name: ing.name,
        amount: ing.amount,
        amountResult: 1,
        buyPrice,
        craftCost: 0,
        isCraftable: ing.isCraftable,
        depth,
      });
    }
  }

  return nodes;
}

export async function collectRecipeItemIds(
  recipeId: number,
  depth = 0
): Promise<Set<number>> {
  const recipe = await getRecipeWithIngredients(recipeId, depth);
  if (!recipe || depth > MAX_RECIPE_DEPTH) return new Set();

  const ids = new Set<number>();
  for (const ing of recipe.ingredients) {
    ids.add(ing.itemId);
    if (ing.isCraftable && ing.subRecipeId) {
      const subIds = await collectRecipeItemIds(ing.subRecipeId, depth + 1);
      subIds.forEach((id) => ids.add(id));
    }
  }
  return ids;
}
