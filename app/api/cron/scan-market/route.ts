import { NextRequest } from "next/server";
import { runScanMarket } from "@/lib/scan-market";
import { appendScanLog, createScanLoggerWithFile } from "@/lib/scan-logger";

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  console.log("[cron/scan-market] Incoming request", {
    url: request.url,
    method: request.method,
    userAgent: request.headers.get("user-agent") ?? "unknown",
  });

  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isDev = process.env.NODE_ENV === "development";
  const host =
    request.headers.get("host") ?? request.headers.get("x-forwarded-host") ?? "";
  const isLocalhost =
    host.startsWith("localhost") || host.startsWith("127.0.0.1");

  const skipAuth = isDev || isLocalhost;
  if (!skipAuth && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.log("[cron/scan-market] Unauthorized: missing or invalid CRON_SECRET");
    return new Response("Unauthorized", { status: 401 });
  }

  const log = createScanLoggerWithFile();

  try {
    const result = await runScanMarket(log);
    const elapsedMs = Date.now() - startedAt;
    const summary = JSON.stringify({ elapsedMs, ...result });
    console.log("[cron/scan-market] Scan finished OK", summary);
    void appendScanLog(`[cron/scan-market] Scan finished OK ${summary}`);
    return Response.json({
      ok: true,
      ...result,
    });
  } catch (err) {
    const elapsedMs = Date.now() - startedAt;
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[cron/scan-market] Error after", elapsedMs, "ms:", err);
    void appendScanLog(
      `[cron/scan-market] Error after ${elapsedMs}ms: ${errMsg}`
    );
    return Response.json(
      { error: err instanceof Error ? err.message : "Scan failed" },
      { status: 500 }
    );
  }
}
