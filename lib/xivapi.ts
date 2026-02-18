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
