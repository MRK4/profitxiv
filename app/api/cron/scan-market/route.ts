import { NextRequest } from "next/server";
import { runScanMarket } from "@/lib/scan-market";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.log("[cron/scan-market] Unauthorized: missing or invalid CRON_SECRET");
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const result = await runScanMarket((msg) => console.log(msg));
    return Response.json({
      ok: true,
      ...result,
    });
  } catch (err) {
    console.error("[cron/scan-market] Error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Scan failed" },
      { status: 500 }
    );
  }
}
