import { appendFile, mkdir, readdir, unlink } from "node:fs/promises";
import path from "node:path";

const LOG_DIR = path.join(process.cwd(), "logs");
const PREFIX = "scan-";

/** UTC date YYYY-MM-DD for log filename */
function utcDateString(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Delete log files older than "yesterday" (UTC), keeping at most two calendar days
 * (today + yesterday). Example: on Wednesday, Monday's file is removed.
 */
export async function pruneScanLogs(): Promise<void> {
  try {
    const files = await readdir(LOG_DIR);
    const now = new Date();
    const cutoff = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - 1
    );

    for (const name of files) {
      if (!name.startsWith(PREFIX) || !name.endsWith(".log")) continue;
      const datePart = name.slice(PREFIX.length, -4);
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
      if (!match) continue;
      const fileTime = Date.UTC(
        parseInt(match[1], 10),
        parseInt(match[2], 10) - 1,
        parseInt(match[3], 10)
      );
      if (fileTime < cutoff) {
        await unlink(path.join(LOG_DIR, name));
      }
    }
  } catch {
    // Directory missing or empty — ignore
  }
}

/**
 * Append one line to today's scan log (UTC). Prunes old files first.
 */
export async function appendScanLog(message: string): Promise<void> {
  await pruneScanLogs();
  await mkdir(LOG_DIR, { recursive: true });
  const fileName = `${PREFIX}${utcDateString(new Date())}.log`;
  const filePath = path.join(LOG_DIR, fileName);
  const line = `${new Date().toISOString()} ${message}\n`;
  await appendFile(filePath, line, "utf8");
}

/** Console + file log for `runScanMarket` */
export function createScanLoggerWithFile(): (msg: string) => void {
  return (msg: string) => {
    console.log(msg);
    void appendScanLog(msg);
  };
}
