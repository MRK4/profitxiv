import { createClient, type RedisClientType } from "redis";

let redis: RedisClientType | null = null;

export async function getRedis(): Promise<RedisClientType> {
  if (redis) return redis;
  const url = process.env.REDIS_URL;
  if (!url) {
    console.error("[redis] REDIS_URL is not set");
    throw new Error("REDIS_URL is not set");
  }
  console.log("[redis] Connecting...");
  redis = createClient({ url });
  redis.on("error", (err) => console.error("[redis] Error:", err));
  await redis.connect();
  console.log("[redis] Connected");
  return redis;
}
