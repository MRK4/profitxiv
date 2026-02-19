import { NextRequest, NextResponse } from "next/server";
import { universalis } from "@/lib/universalis";

interface Listing {
  worldName?: string;
  pricePerUnit: number;
  quantity: number;
}

interface WorldMarketData {
  worldName: string;
  minPrice: number;
  currentAveragePrice: number;
  listingsCount: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dataCenter = searchParams.get("dataCenter");
    const itemIdParam = searchParams.get("itemId");

    if (!dataCenter || !itemIdParam) {
      return NextResponse.json(
        { error: "dataCenter and itemId are required" },
        { status: 400 }
      );
    }

    const itemId = parseInt(itemIdParam, 10);
    if (isNaN(itemId)) {
      return NextResponse.json(
        { error: "itemId must be a valid number" },
        { status: 400 }
      );
    }

    const data = await universalis.getMarketBoard(dataCenter, itemId);

    const listings = (data as { listings?: Listing[] }).listings ?? [];
    const worldMap = new Map<
      string,
      { prices: number[]; totalValue: number; totalQty: number }
    >();

    for (const listing of listings) {
      const worldName = listing.worldName;
      if (!worldName) continue;

      const existing = worldMap.get(worldName);
      const price = listing.pricePerUnit;
      const qty = listing.quantity;

      if (existing) {
        existing.prices.push(price);
        existing.totalValue += price * qty;
        existing.totalQty += qty;
      } else {
        worldMap.set(worldName, {
          prices: [price],
          totalValue: price * qty,
          totalQty: qty,
        });
      }
    }

    const worlds: WorldMarketData[] = [];
    for (const [worldName, agg] of worldMap) {
      if (agg.prices.length === 0) continue;
      const minPrice = Math.min(...agg.prices);
      const currentAveragePrice =
        agg.totalQty > 0 ? agg.totalValue / agg.totalQty : minPrice;
      worlds.push({
        worldName,
        minPrice,
        currentAveragePrice,
        listingsCount: agg.prices.length,
      });
    }

    worlds.sort((a, b) => a.minPrice - b.minPrice);

    return NextResponse.json({
      itemId,
      worlds,
    });
  } catch (error) {
    console.error("Compare markets API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch market comparison data" },
      { status: 500 }
    );
  }
}
