export interface MarketItemSnapshot {
  itemId: number;
  minPrice: number;
  avgSalePrice: number;
  lastSalePrice?: number;
  lastSaleTimestamp?: number;
  profit: number;
  dailyVelocity: number;
  /** XIVAPI: pre-computed during cron scan */
  name?: string;
  icon?: string;
  isCraftable?: boolean;
  isGatherable?: boolean;
}

export interface MarketSnapshot {
  lastUpdated: number;
  world: string;
  dataCenter: string;
  items: MarketItemSnapshot[];
  /** XIVAPI metadata: pre-computed during cron scan */
  recipeMap?: Record<number, number>;
  recipeComponentIds?: number[];
}

export const MARKET_KEY_PREFIX = "market:";
export const MARKET_TTL_SECONDS = 8 * 60 * 60; // 8 hours

export function marketKey(world: string): string {
  return `${MARKET_KEY_PREFIX}${world}`;
}
