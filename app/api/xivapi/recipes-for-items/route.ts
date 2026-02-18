import { NextRequest, NextResponse } from "next/server";
import { getRecipesForItems } from "@/lib/xivapi";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get("ids");
    if (!idsParam) {
      return NextResponse.json(
        { error: "Missing ids parameter (comma-separated)" },
        { status: 400 }
      );
    }
    const itemIds = idsParam
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !Number.isNaN(n))
      .slice(0, 200);

    if (itemIds.length === 0) {
      return NextResponse.json({
        craftableIds: [],
        recipeMap: {},
      });
    }

    const { craftableIds, recipeMap } = await getRecipesForItems(itemIds);
    return NextResponse.json({
      craftableIds: [...craftableIds],
      recipeMap,
    });
  } catch (error) {
    console.error("Recipes for items error:", error);
    return NextResponse.json(
      { error: "Failed to fetch recipes for items" },
      { status: 500 }
    );
  }
}
