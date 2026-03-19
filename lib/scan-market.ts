import { universalis } from "@/lib/universalis";
import { getRedis } from "@/lib/redis";
import {
  marketKey,
  MARKET_TTL_SECONDS,
  type MarketSnapshot,
  type MarketItemSnapshot,
} from "@/lib/market-snapshot";
import { getItemData, getItemMetadata } from "@/lib/xivapi";

type EnrichmentCache = {
  names: Record<number, string>;
  icons: Record<number, string>;
  craftableIds: Set<number>;
  gatherableIds: Set<number>;
  recipeMap: Record<number, number>;
  recipeComponentIds: Set<number>;
};

const MAX_TAX_RATE = 5;
const MIN_DAILY_VELOCITY = 0.5;
const BATCH_SIZE = 100;
const BATCH_DELAY_MS = 150;
const MAX_ITEMS_PER_DC = 2000;

const delay = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

type AggregatedEntry = { price?: number; quantity?: number; timestamp?: number };

function extractFromAggregated(
  nq: {
    minListing?: { dc?: AggregatedEntry };
    averageSalePrice?: { dc?: AggregatedEntry };
    recentPurchase?: { dc?: AggregatedEntry };
    dailySaleVelocity?: { dc?: AggregatedEntry };
  } | null
): {
  minPrice: number;
  avgSalePrice: number;
  lastSalePrice: number;
  lastSaleTimestamp?: number;
  dailyVelocity: number;
} | null {
  if (!nq) return null;
  const minPrice = nq.minListing?.dc?.price ?? 0;
  const avgSalePrice = nq.averageSalePrice?.dc?.price ?? 0;
  const recent = nq.recentPurchase?.dc;
  const lastSalePrice = recent?.price ?? 0;
  const lastSaleTimestamp = recent?.timestamp;
  const dailyVelocity = nq.dailySaleVelocity?.dc?.quantity ?? 0;

  if (minPrice <= 0 || avgSalePrice <= 0) return null;
  return {
    minPrice,
    avgSalePrice,
    lastSalePrice,
    lastSaleTimestamp,
    dailyVelocity,
  };
}

export async function runScanMarket(log: (msg: string) => void = console.log) {
  const startedAt = Date.now();
  log("[scan-market] Starting scan...");

  const [dataCenters, worlds, marketableIds] = await Promise.all([
    universalis.getDataCenters(),
    universalis.getWorlds(),
    universalis.getMarketableItems(),
  ]);

  log(`[scan-market] Fetched ${dataCenters.length} DCs, ${marketableIds.length} marketable items`);

  const worldMap = new Map(worlds.map((w) => [w.id, w.name]));
  const dcWithWorlds = dataCenters.map((dc) => ({
    name: dc.name,
    firstWorld: dc.worlds
      .map((id) => worldMap.get(id))
      .find((n): n is string => !!n),
  }));

  const itemIds = marketableIds.slice(0, MAX_ITEMS_PER_DC);
  const batches: number[][] = [];
  for (let i = 0; i < itemIds.length; i += BATCH_SIZE) {
    batches.push(itemIds.slice(i, i + BATCH_SIZE));
  }

  log(
    `[scan-market] Will process ${dcWithWorlds.length} DCs, ${batches.length} batches per DC (batchSize=${BATCH_SIZE}, maxItemsPerDC=${MAX_ITEMS_PER_DC}, delay=${BATCH_DELAY_MS}ms)`
  );

  const redis = await getRedis();
  log("[scan-market] Redis connected");

  const now = Date.now();

  const enrichmentCache: EnrichmentCache = {
    names: {},
    icons: {},
    craftableIds: new Set(),
    gatherableIds: new Set(),
    recipeMap: {},
    recipeComponentIds: new Set(),
  };

  for (const dc of dcWithWorlds) {
    if (!dc.firstWorld) {
      log(`[scan-market] Skipping DC ${dc.name} (no world)`);
      continue;
    }

    log(
      `[scan-market] Processing DC: ${dc.name} (firstWorld=${dc.firstWorld}, batches=${batches.length})`
    );

    let taxRate = MAX_TAX_RATE / 100;
    try {
      const taxRates = await universalis.getTaxRates(dc.firstWorld);
      if (typeof taxRates === "object" && taxRates !== null) {
        const rates = Object.values(taxRates as Record<string, number>);
        if (rates.length > 0) {
          taxRate = Math.max(...rates, 0) / 100;
        }
      }
    } catch (err) {
      log(
        `[scan-market] Tax rate fetch failed for ${dc.firstWorld}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }

    const items: MarketItemSnapshot[] = [];
    let consideredCount = 0;
    let skippedInvalidCount = 0;
    let skippedVelocityCount = 0;
    let skippedProfitCount = 0;

    for (let i = 0; i < batches.length; i++) {
      const batchIds = batches[i];
      const aggregated = await universalis.getAggregated(dc.name, batchIds);

      const results =
        (aggregated as {
          results?: Array<{
            itemId: number;
            nq?: {
              minListing?: { dc?: AggregatedEntry };
              averageSalePrice?: { dc?: AggregatedEntry };
              recentPurchase?: { dc?: AggregatedEntry };
              dailySaleVelocity?: { dc?: AggregatedEntry };
            };
          }>;
        }).results ?? [];

      for (const item of results) {
        const extracted = extractFromAggregated(item.nq ?? null);
        if (!extracted) {
          skippedInvalidCount++;
          continue;
        }

        consideredCount++;

        const {
          minPrice,
          avgSalePrice,
          lastSalePrice,
          lastSaleTimestamp,
          dailyVelocity,
        } = extracted;
        if (dailyVelocity < MIN_DAILY_VELOCITY) {
          skippedVelocityCount++;
          continue;
        }

        const netSellPrice = avgSalePrice * (1 - taxRate);
        const profit = Math.round(netSellPrice - minPrice);
        if (profit <= 0) {
          skippedProfitCount++;
          continue;
        }

        items.push({
          itemId: item.itemId,
          minPrice,
          avgSalePrice: Math.round(avgSalePrice),
          lastSalePrice: lastSalePrice > 0 ? Math.round(lastSalePrice) : undefined,
          lastSaleTimestamp:
            lastSalePrice > 0 && lastSaleTimestamp ? lastSaleTimestamp : undefined,
          profit,
          dailyVelocity: Math.round(dailyVelocity * 10) / 10,
        });
      }

      if ((i + 1) % 10 === 0 || i === batches.length - 1) {
        log(
          `[scan-market] ${dc.name}: processed batch ${i + 1}/${
            batches.length
          } (aggregatedItems=${results.length}, accumulatedItems=${items.length})`
        );
      }

      await delay(BATCH_DELAY_MS);
    }

    if (items.length > 0) {
      const dcItemIds = items.map((i) => i.itemId);
      const idsToFetch = dcItemIds.filter((id) => !(id in enrichmentCache.names));
      if (idsToFetch.length > 0) {
        const enrichStart = Date.now();
        try {
          const [itemData, metadata] = await Promise.all([
            getItemData(idsToFetch),
            getItemMetadata(idsToFetch),
          ]);
          Object.assign(enrichmentCache.names, itemData.names);
          Object.assign(enrichmentCache.icons, itemData.icons);
          metadata.craftableIds.forEach((id) => enrichmentCache.craftableIds.add(id));
          metadata.gatherableIds.forEach((id) => enrichmentCache.gatherableIds.add(id));
          Object.assign(enrichmentCache.recipeMap, metadata.recipeMap);
          metadata.recipeComponentIds.forEach((id) =>
            enrichmentCache.recipeComponentIds.add(id)
          );
          log(
            `[scan-market] ${dc.name}: XIVAPI enriched ${idsToFetch.length} items in ${Math.round((Date.now() - enrichStart) / 1000)}s`
          );
        } catch (err) {
          log(
            `[scan-market] ${dc.name}: XIVAPI enrichment failed: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }
      for (const item of items) {
        item.name = enrichmentCache.names[item.itemId];
        item.icon = enrichmentCache.icons[item.itemId];
        item.isCraftable = enrichmentCache.craftableIds.has(item.itemId);
        item.isGatherable = enrichmentCache.gatherableIds.has(item.itemId);
      }
    }

    const snapshot: MarketSnapshot = {
      lastUpdated: now,
      world: dc.firstWorld,
      dataCenter: dc.name,
      items,
      recipeMap: Object.fromEntries(
        items
          .filter((i) => i.itemId in enrichmentCache.recipeMap)
          .map((i) => [i.itemId, enrichmentCache.recipeMap[i.itemId]])
      ),
      recipeComponentIds: [...enrichmentCache.recipeComponentIds],
    };

    const key = marketKey(dc.name);
    await redis.set(key, JSON.stringify(snapshot), {
      EX: MARKET_TTL_SECONDS,
    });

    log(
      `[scan-market] ${dc.name}: stored ${items.length} items (considered=${consideredCount}, skippedInvalid=${skippedInvalidCount}, skippedLowVelocity=${skippedVelocityCount}, skippedNoProfit=${skippedProfitCount}, ttl=${MARKET_TTL_SECONDS}s)`
    );
  }

  const elapsedMs = Date.now() - startedAt;
  log(`[scan-market] Scan complete in ${Math.round(elapsedMs / 1000)}s`);
  return {
    dataCentersScanned: dcWithWorlds.length,
    itemCount: itemIds.length,
  };
}
