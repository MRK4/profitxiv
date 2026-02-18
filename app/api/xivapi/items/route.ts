import { NextRequest, NextResponse } from "next/server";
import { getItemData } from "@/lib/xivapi";

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
      .slice(0, 100);

    if (itemIds.length === 0) {
      return NextResponse.json({ names: {}, icons: {} });
    }

    const { names, icons } = await getItemData(itemIds);
    return NextResponse.json({ names, icons });
  } catch (error) {
    console.error("XIVAPI items error:", error);
    return NextResponse.json(
      { error: "Failed to fetch item names" },
      { status: 500 }
    );
  }
}
