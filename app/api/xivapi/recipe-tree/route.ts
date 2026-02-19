import { NextRequest, NextResponse } from "next/server";
import {
  getRecipeTree,
  collectRecipeItemIds,
  getRecipeWithIngredients,
} from "@/lib/xivapi";
import { universalis } from "@/lib/universalis";

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const itemIdParam = searchParams.get("itemId");
    const recipeIdParam = searchParams.get("recipeId");
    const world = searchParams.get("world");

    if (!itemIdParam || !recipeIdParam) {
      return NextResponse.json(
        { error: "itemId and recipeId are required" },
        { status: 400 }
      );
    }

    const itemId = parseInt(itemIdParam, 10);
    const recipeId = parseInt(recipeIdParam, 10);

    if (isNaN(itemId) || isNaN(recipeId)) {
      return NextResponse.json(
        { error: "itemId and recipeId must be valid numbers" },
        { status: 400 }
      );
    }

    const marketPrices: Record<number, number> = {};

    if (world) {
      const itemIds = await collectRecipeItemIds(recipeId);
      const marketableIds = await universalis.getMarketableItems();
      const marketableSet = new Set(marketableIds);
      const idsToFetch = [...itemIds].filter((id) => marketableSet.has(id));

      if (idsToFetch.length > 0) {
        const aggregated = await universalis.getAggregated(world, idsToFetch);
        const results = (aggregated as { results?: Array<{ itemId: number; nq?: { minListing?: { world?: { price?: number } } } }> })
          .results ?? [];

        for (const r of results) {
          const price = r.nq?.minListing?.world?.price;
          if (price != null && price > 0) {
            marketPrices[r.itemId] = price;
          }
        }
      }
    }

    const tree = await getRecipeTree(recipeId, marketPrices);

    const recipe = await getRecipeWithIngredients(recipeId);
    const amountResult = recipe?.amountResult ?? 1;

    let sellPrice = 0;
    if (world) {
      try {
        const aggregated = await universalis.getAggregated(world, itemId);
        const results = (aggregated as { results?: Array<{ itemId: number; nq?: { averageSalePrice?: { world?: { price?: number } } } }> })
          .results ?? [];
        const r = results.find((x) => x.itemId === itemId);
        sellPrice = r?.nq?.averageSalePrice?.world?.price ?? 0;
      } catch {
        sellPrice = 0;
      }
    }

    return NextResponse.json({
      itemId,
      amountResult,
      tree,
      sellPrice: Math.round(sellPrice),
    });
  } catch (error) {
    console.error("Recipe tree API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch recipe tree" },
      { status: 500 }
    );
  }
}
