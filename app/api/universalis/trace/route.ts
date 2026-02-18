import { NextRequest, NextResponse } from "next/server";
import { universalis } from "@/lib/universalis";
import { getItemDescription } from "@/lib/xivapi";

const MAX_TAX_RATE = 5;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get("itemId");
    const world = searchParams.get("world");
    const dataCenter = searchParams.get("dataCenter");

    if (!itemId || !world || !dataCenter) {
      return NextResponse.json(
        { error: "Missing itemId, world or dataCenter parameter" },
        { status: 400 }
      );
    }

    const itemIdNum = parseInt(itemId, 10);
    if (Number.isNaN(itemIdNum)) {
      return NextResponse.json(
        { error: "Invalid itemId" },
        { status: 400 }
      );
    }

    const [aggregated, taxRates] = await Promise.all([
      universalis.getAggregated(world, itemIdNum),
      universalis.getTaxRates(world),
    ]);

    const taxRate =
      typeof taxRates === "object" && taxRates !== null
        ? Math.max(...Object.values(taxRates as Record<string, number>), 0) /
          100
        : MAX_TAX_RATE / 100;

    const aggResults = (aggregated as {
      results?: Array<{
        itemId: number;
        nq?: {
          minListing?: { world?: { price?: number } };
          averageSalePrice?: { world?: { price?: number } };
          recentPurchase?: { world?: { price?: number } };
          dailySaleVelocity?: { world?: { quantity?: number } };
        };
      }>;
    }).results ?? [];

    const item = aggResults.find((r) => r.itemId === itemIdNum);
    const itemDescription = await getItemDescription(itemIdNum);
    if (!item?.nq) {
      return NextResponse.json({
        itemId: itemIdNum,
        world,
        dataCenter,
        hasData: false,
        steps: [],
        description: itemDescription,
        links: {
          universalis: `https://universalis.app/market/${itemIdNum}`,
          xivapi: `https://xivapi.com/item/${itemIdNum}`,
        },
      });
    }

    const nq = item.nq;
    const minPrice = nq.minListing?.world?.price ?? 0;
    const avgSalePrice = nq.averageSalePrice?.world?.price ?? 0;
    const lastSalePrice = nq.recentPurchase?.world?.price ?? 0;
    const dailyVelocity = nq.dailySaleVelocity?.world?.quantity ?? 0;
    const netSellPrice = avgSalePrice * (1 - taxRate);
    const profit = Math.round(netSellPrice - minPrice);

    const steps = [
      {
        id: "1",
        label: "Min listing price (buy)",
        value: minPrice,
        unit: "gil",
        source: "Universalis → nq.minListing.world.price",
        rawPath: "aggregated.results[].nq.minListing.world.price",
      },
      {
        id: "2",
        label: "Average sale price (per unit)",
        value: Math.round(avgSalePrice),
        unit: "gil",
        source: "Universalis → nq.averageSalePrice.world.price",
        rawPath: "aggregated.results[].nq.averageSalePrice.world.price",
      },
      {
        id: "2b",
        label: "Last sale price (per unit)",
        value: lastSalePrice > 0 ? Math.round(lastSalePrice) : "—",
        unit: lastSalePrice > 0 ? "gil" : "",
        source: "Universalis → nq.recentPurchase.world.price",
        rawPath: "aggregated.results[].nq.recentPurchase.world.price",
      },
      {
        id: "3",
        label: "Daily sale velocity",
        value: Math.round(dailyVelocity * 10) / 10,
        unit: "sales/day",
        source: "Universalis → nq.dailySaleVelocity.world.quantity",
        rawPath: "aggregated.results[].nq.dailySaleVelocity.world.quantity",
      },
      {
        id: "4",
        label: "Tax rate (retainer)",
        value: `${(taxRate * 100).toFixed(1)}%`,
        unit: "",
        source: taxRates
          ? "Universalis → tax-rates"
          : `Default (max ${MAX_TAX_RATE}%)`,
        rawPath: "tax-rates.world",
      },
      {
        id: "5",
        label: "Net sell price (after tax)",
        value: Math.round(netSellPrice),
        unit: "gil",
        formula: `avgSalePrice × (1 - taxRate) = ${Math.round(avgSalePrice)} × ${(1 - taxRate).toFixed(3)}`,
        source: "Computed",
      },
      {
        id: "6",
        label: "Profit per sale",
        value: profit,
        unit: "gil",
        formula: `netSellPrice - minPrice = ${Math.round(netSellPrice)} - ${minPrice}`,
        source: "Computed",
      },
    ];

    return NextResponse.json({
      itemId: itemIdNum,
      world,
      dataCenter,
      hasData: true,
      steps,
      description: itemDescription,
      links: {
        universalis: `https://universalis.app/market/${itemIdNum}`,
        xivapi: `https://xivapi.com/item/${itemIdNum}`,
      },
    });
  } catch (error) {
    console.error("Trace error:", error);
    return NextResponse.json(
      { error: "Failed to trace item" },
      { status: 500 }
    );
  }
}
