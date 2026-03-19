import { NextRequest } from "next/server";
import { getRedis } from "@/lib/redis";
import { marketKey } from "@/lib/market-snapshot";
import type { MarketSnapshot } from "@/lib/market-snapshot";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const dataCenter = searchParams.get("dataCenter");
  const world = searchParams.get("world");

  const target = dataCenter ?? world;
  if (!target) {
    console.log("[api/market] Missing dataCenter or world parameter");
    return Response.json(
      { error: "Missing dataCenter or world parameter" },
      { status: 400 }
    );
  }

  try {
    console.log("[api/market] Fetching market for:", target);
    const redis = await getRedis();
    const key = marketKey(target);
    const raw = await redis.get(key);

    if (!raw) {
      console.log("[api/market] No data found for key:", key);
      return Response.json(
        { error: "No market data for this datacenter yet", data: null },
        { status: 404 }
      );
    }

    const snapshot = JSON.parse(raw) as MarketSnapshot;
    console.log("[api/market] Found", snapshot.items?.length ?? 0, "items for", target);
    return Response.json({ data: snapshot });
  } catch (err) {
    console.error("Market API error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to fetch market" },
      { status: 500 }
    );
  }
}
