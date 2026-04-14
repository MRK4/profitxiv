import { runScanMarket } from "@/lib/scan-market";
import { createScanLoggerWithFile } from "@/lib/scan-logger";

export async function POST() {
  if (process.env.NODE_ENV !== "development") {
    console.log("[dev/trigger-scan] Rejected: not in development");
    return Response.json({ error: "Only available in development" }, { status: 403 });
  }

  console.log("[dev/trigger-scan] Manual scan triggered");

  try {
    const result = await runScanMarket(createScanLoggerWithFile());
    console.log("[dev/trigger-scan] Success:", result);
    return Response.json({ ok: true, ...result });
  } catch (err) {
    console.error("[dev/trigger-scan] Error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Scan failed" },
      { status: 500 }
    );
  }
}
