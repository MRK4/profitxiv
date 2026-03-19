import { universalis } from "@/lib/universalis";
import { getRedis } from "@/lib/redis";
import {
  marketKey,
  MARKET_TTL_SECONDS,
  type MarketSnapshot,
  type MarketItemSnapshot,
} from "@/lib/market-snapshot";

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

    const snapshot: MarketSnapshot = {
      lastUpdated: now,
      world: dc.firstWorld,
      dataCenter: dc.name,
      items,
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
