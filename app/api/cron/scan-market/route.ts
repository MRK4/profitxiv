import { NextRequest } from "next/server";
import { runScanMarket } from "@/lib/scan-market";

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  console.log("[cron/scan-market] Incoming request", {
    url: request.url,
    method: request.method,
    userAgent: request.headers.get("user-agent") ?? "unknown",
  });

  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.log("[cron/scan-market] Unauthorized: missing or invalid CRON_SECRET");
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const result = await runScanMarket((msg) => console.log(msg));
    const elapsedMs = Date.now() - startedAt;
    console.log(
      "[cron/scan-market] Scan finished OK",
      JSON.stringify({ elapsedMs, ...result })
    );
    return Response.json({
      ok: true,
      ...result,
    });
  } catch (err) {
    const elapsedMs = Date.now() - startedAt;
    console.error("[cron/scan-market] Error after", elapsedMs, "ms:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Scan failed" },
      { status: 500 }
    );
  }
}
