import { NextResponse } from "next/server";
import { universalis } from "@/lib/universalis";

export async function GET() {
  try {
    const [dataCenters, worlds] = await Promise.all([
      universalis.getDataCenters(),
      universalis.getWorlds(),
    ]);

    const worldMap = new Map(worlds.map((w) => [w.id, w.name]));

    const dataCentersWithWorldNames = dataCenters.map((dc) => ({
      name: dc.name,
      region: dc.region,
      worlds: dc.worlds
        .map((id) => worldMap.get(id))
        .filter((name): name is string => name != null),
    }));

    return NextResponse.json({
      dataCenters: dataCentersWithWorldNames,
    });
  } catch (error) {
    console.error("Universalis API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch regions data" },
      { status: 500 }
    );
  }
}
