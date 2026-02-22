import { NextRequest } from "next/server";
import { universalis } from "@/lib/universalis";

const MAX_TAX_RATE = 5;
const MIN_DAILY_VELOCITY = 0.5;
const BATCH_SIZE = 100;
const BATCH_DELAY_MS = 100;
const PRICE_ANOMALY_THRESHOLD = 50;

const delay = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

function sseMessage(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const world = searchParams.get("world");
  const dataCenter = searchParams.get("dataCenter");

  if (!world || !dataCenter) {
    return new Response(
      JSON.stringify({ error: "Missing world or dataCenter parameter" }),
      { status: 400 }
    );
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const safeEnqueue = (data: Uint8Array) => {
        try {
          controller.enqueue(data);
        } catch {
          // Controller closed (e.g. client disconnected), ignore
        }
      };

      try {
        const [marketableIds, taxRates] = await Promise.all([
          universalis.getMarketableItems(),
          universalis.getTaxRates(world),
        ]);

        const taxRate =
          typeof taxRates === "object" && taxRates !== null
            ? Math.max(
                ...Object.values(taxRates as Record<string, number>),
                0
              ) / 100
            : MAX_TAX_RATE / 100;

        const batches: number[][] = [];
        for (let i = 0; i < marketableIds.length; i += BATCH_SIZE) {
          batches.push(marketableIds.slice(i, i + BATCH_SIZE));
        }

        for (let i = 0; i < batches.length; i++) {
          const batchIds = batches[i];
          const aggregated = await universalis.getAggregated(world, batchIds);

          const aggResults = (aggregated as {
            results?: Array<{
              itemId: number;
              nq?: {
                minListing?: { world?: { price?: number } };
                averageSalePrice?: { world?: { price?: number } };
                recentPurchase?: {
                  world?: { price?: number; timestamp?: number };
                };
                dailySaleVelocity?: { world?: { quantity?: number } };
              };
            }>;
          }).results ?? [];

          const batchResults: {
            itemId: number;
            minPrice: number;
            avgSalePrice: number;
            lastSalePrice: number;
            lastSaleTimestamp?: number;
            profit: number;
            dailyVelocity: number;
          }[] = [];

          for (const item of aggResults) {
            const nq = item.nq;
            if (!nq) continue;

            const minPrice = nq.minListing?.world?.price ?? 0;
            const avgSalePrice = nq.averageSalePrice?.world?.price ?? 0;
            const recentPurchase = nq.recentPurchase?.world;
            const lastSalePrice = recentPurchase?.price ?? 0;
            const lastSaleTimestamp = recentPurchase?.timestamp;
            const dailyVelocity =
              nq.dailySaleVelocity?.world?.quantity ?? 0;

            if (minPrice <= 0 || avgSalePrice <= 0) continue;

            const netSellPrice = avgSalePrice * (1 - taxRate);
            const profit = Math.round(netSellPrice - minPrice);

            if (profit <= 0) continue;
            if (dailyVelocity < MIN_DAILY_VELOCITY) continue;

            // Exclure les items avec prix anormaux (transfert d'argent entre personnages)
            if (
              lastSalePrice > 0 &&
              lastSalePrice > avgSalePrice * PRICE_ANOMALY_THRESHOLD
            )
              continue;
            if (avgSalePrice > minPrice * PRICE_ANOMALY_THRESHOLD) continue;

            batchResults.push({
              itemId: item.itemId,
              minPrice,
              avgSalePrice: Math.round(avgSalePrice),
              lastSalePrice: lastSalePrice > 0 ? Math.round(lastSalePrice) : 0,
              lastSaleTimestamp:
                lastSalePrice > 0 && lastSaleTimestamp
                  ? lastSaleTimestamp
                  : undefined,
              profit,
              dailyVelocity: Math.round(dailyVelocity * 10) / 10,
            });
          }

          if (batchResults.length > 0) {
            safeEnqueue(
              encoder.encode(
                sseMessage("results", {
                  results: batchResults,
                  batch: i + 1,
                  totalBatches: batches.length,
                })
              )
            );
          }

          if (i < batches.length - 1) {
            await delay(BATCH_DELAY_MS);
          }
        }

        safeEnqueue(
          encoder.encode(sseMessage("done", { totalBatches: batches.length }))
        );
      } catch (error) {
        console.error("Full scan error:", error);
        safeEnqueue(
          encoder.encode(
            sseMessage("scan_error", {
              message:
                error instanceof Error ? error.message : "Scan failed",
            })
          )
        );
      } finally {
        try {
          controller.close();
        } catch {
          // Already closed
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
