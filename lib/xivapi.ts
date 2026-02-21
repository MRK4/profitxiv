import axios, { type AxiosInstance } from "axios";

const xivapi: AxiosInstance = axios.create({
  baseURL: "https://v2.xivapi.com",
  timeout: 30000,
});

/** v2 Icon format: { id, path, path_hr1 } with path_hr1 like "ui/icon/037000/037609_hr1.tex" */
function buildIconUrlFromV2(icon: { path_hr1?: string } | undefined): string | null {
  if (!icon?.path_hr1) return null;
  const path = icon.path_hr1.replace(/^ui\/icon\//, "").replace(/\.tex$/, ".png");
  return `https://xivapi.com/i/${path}`;
}

export async function getItemDescription(
  itemId: number
): Promise<string | null> {
  try {
    const { data } = await xivapi.get<{ fields?: { Description?: string } }>(
      `/api/sheet/Item/${itemId}`,
      { params: { fields: "Description" } }
    );
    const desc = data.fields?.Description;
    if (typeof desc === "string" && desc.trim()) return desc;
    return null;
  } catch {
    return null;
  }
}

const ITEM_DATA_BATCH_SIZE = 100;

interface V2ItemRow {
  row_id: number;
  fields?: {
    Name?: string;
    Icon?: { path_hr1?: string };
  };
}

interface V2SheetItemResponse {
  rows?: V2ItemRow[];
}

/** Batch fetch names and icons via v2 sheet endpoint */
export async function getItemData(
  itemIds: number[]
): Promise<{
  names: Record<number, string>;
  icons: Record<number, string>;
}> {
  const names: Record<number, string> = {};
  const icons: Record<number, string> = {};
  if (itemIds.length === 0) return { names, icons };

  for (let i = 0; i < itemIds.length; i += ITEM_DATA_BATCH_SIZE) {
    const batch = itemIds.slice(i, i + ITEM_DATA_BATCH_SIZE);
    const rowsParam = batch.join(",");
    try {
      const { data } = await xivapi.get<V2SheetItemResponse>(
        "/api/sheet/Item",
        { params: { fields: "Name,Icon", rows: rowsParam } }
      );
      const rows = data.rows ?? [];
      for (const row of rows) {
        const id = row.row_id;
        if (row.fields?.Name != null) names[id] = row.fields.Name;
        const iconUrl = buildIconUrlFromV2(row.fields?.Icon);
        if (iconUrl != null) icons[id] = iconUrl;
      }
    } catch (err) {
      console.error("[getItemData] Sheet fetch failed:", (err as Error).message);
      throw err;
    }
  }
  return { names, icons };
}

interface V2SearchRecipeResult {
  sheet?: string;
  row_id: number;
  fields?: {
    ItemResult?: { row_id?: number };
  };
}

interface V2SearchResponse {
  results?: V2SearchRecipeResult[];
}

/** v2: GET /api/search?sheets=Recipe&query=ItemResult={itemId}&fields=ID */
export async function getRecipesForItems(
  itemIds: number[]
): Promise<{ craftableIds: Set<number>; recipeMap: Record<number, number> }> {
  const craftableIds = new Set<number>();
  const recipeMap: Record<number, number> = {};

  const CONCURRENCY = 5;
  for (let i = 0; i < itemIds.length; i += CONCURRENCY) {
    const batch = itemIds.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (itemId) => {
        try {
          const { data } = await xivapi.get<V2SearchResponse>(
            "/api/search",
            {
              params: {
                sheets: "Recipe",
                query: `ItemResult=${itemId}`,
                fields: "ID",
              },
            }
          );
          const hits = data.results ?? [];
          const first = hits[0];
          if (first) {
            return { itemId, recipeId: first.row_id };
          }
          return null;
        } catch {
          return null;
        }
      })
    );
    for (const r of results) {
      if (r) {
        craftableIds.add(r.itemId);
        if (!(r.itemId in recipeMap)) recipeMap[r.itemId] = r.recipeId;
      }
    }
  }

  return { craftableIds, recipeMap };
}

/** v2: GameContentLinks n'existe plus. On utilise Sources (peut être vide pour certains items). */
function isGatherableFromSources(sources: unknown): boolean {
  if (!sources) return false;
  const str = JSON.stringify(sources);
  return str.includes("GatheringItem");
}

interface V2ItemSourcesRow {
  row_id: number;
  fields?: { Sources?: unknown };
}

export async function getGatherableItems(
  itemIds: number[]
): Promise<Set<number>> {
  const gatherableIds = new Set<number>();
  if (itemIds.length === 0) return gatherableIds;

  for (let i = 0; i < itemIds.length; i += ITEM_DATA_BATCH_SIZE) {
    const batch = itemIds.slice(i, i + ITEM_DATA_BATCH_SIZE);
    const rowsParam = batch.join(",");
    try {
      const { data } = await xivapi.get<{ rows?: V2ItemSourcesRow[] }>(
        "/api/sheet/Item",
        { params: { fields: "Sources", rows: rowsParam } }
      );
      const rows = data.rows ?? [];
      for (const row of rows) {
        if (isGatherableFromSources(row.fields?.Sources)) {
          gatherableIds.add(row.row_id);
        }
      }
    } catch {
      // Skip failed batch
    }
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

const RECIPE_FIELDS =
  "AmountIngredient,AmountResult,ItemResult.row_id,Ingredient[].row_id,Ingredient[].Name,Ingredient[].PriceLow,Ingredient[].PriceMid";

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

interface V2RecipeIngredient {
  row_id?: number;
  value?: number;
  fields?: { Name?: string; PriceLow?: number; PriceMid?: number };
}

interface V2RecipeRaw {
  row_id: number;
  fields?: {
    AmountIngredient?: number[];
    AmountResult?: number;
    ItemResult?: { row_id?: number };
    Ingredient?: V2RecipeIngredient[];
  };
}

const MAX_RECIPE_DEPTH = 3;

export async function getRecipeWithIngredients(
  recipeId: number,
  depth = 0,
  resolveCraftability = true
): Promise<RecipeData | null> {
  if (depth > MAX_RECIPE_DEPTH) return null;
  try {
    const { data } = await xivapi.get<V2RecipeRaw>(`/api/sheet/Recipe/${recipeId}`, {
      params: { fields: RECIPE_FIELDS },
    });

    const fields = data.fields ?? {};
    const itemId = fields.ItemResult?.row_id ?? 0;
    const amountResult = fields.AmountResult ?? 1;
    const amounts = fields.AmountIngredient ?? [];
    const ingredientsRaw = fields.Ingredient ?? [];

    const ingredients: RecipeIngredient[] = [];
    const ingredientIds: number[] = [];

    for (let i = 0; i < Math.min(8, ingredientsRaw.length, amounts.length); i++) {
      const amount = amounts[i] ?? 0;
      if (amount <= 0) continue;

      const ing = ingredientsRaw[i];
      const ingItemId = ing?.row_id ?? ing?.value ?? 0;
      if (!ingItemId || ingItemId <= 0) continue;

      ingredientIds.push(ingItemId);
      ingredients.push({
        itemId: ingItemId,
        name: ing?.fields?.Name ?? `Item ${ingItemId}`,
        amount,
        priceLow: ing?.fields?.PriceLow ?? 0,
        priceMid: ing?.fields?.PriceMid ?? 0,
        isCraftable: false,
        subRecipeId: undefined,
      });
    }

    if (ingredients.length === 0) return null;

    if (resolveCraftability) {
      const { recipeMap } = await getRecipesForItems(ingredientIds);
      for (const ing of ingredients) {
        const subRecipeId = recipeMap[ing.itemId];
        if (subRecipeId != null && subRecipeId > 0) {
          ing.isCraftable = true;
          ing.subRecipeId = subRecipeId;
        }
      }
    }

    return {
      recipeId: data.row_id,
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
      batch.map((rid) => getRecipeWithIngredients(rid, 0, false))
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
