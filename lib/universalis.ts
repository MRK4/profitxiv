import axios, { type AxiosInstance } from "axios";

const API_VERSION = process.env.UNIVERSALIS_API_VERSION ?? "v2";
const API_BASE_URL =
  process.env.UNIVERSALIS_API_URL ?? "https://universalis.app/api";

const universalisClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10000,
});

export type WorldDcRegion = string; // World name, DC name, or region (Japan, Europe, North-America, Oceania)

export interface DataCenter {
  name: string;
  region: string;
  worlds: number[];
}

export interface World {
  id: number;
  name: string;
}

export interface UniversalisApi {
  getDataCenters: () => Promise<DataCenter[]>;
  getWorlds: () => Promise<World[]>;
  getMarketBoard: (
    worldDcRegion: WorldDcRegion,
    itemIds: number | number[],
    params?: { listings?: number; entries?: number; hq?: boolean }
  ) => Promise<unknown>;
  getAggregated: (
    worldDcRegion: WorldDcRegion,
    itemIds: number | number[]
  ) => Promise<unknown>;
  getHistory: (
    worldDcRegion: WorldDcRegion,
    itemIds: number | number[],
    params?: { entriesToReturn?: number }
  ) => Promise<unknown>;
  getTaxRates: (world: string) => Promise<unknown>;
  getMarketableItems: () => Promise<number[]>;
  getMostRecentlyUpdated: (
    dcName: string,
    params?: { entries?: number }
  ) => Promise<{ itemID: number; worldID: number; worldName?: string }[]>;
}

export const universalis: UniversalisApi = {
  getDataCenters: async () => {
    const { data } = await universalisClient.get<DataCenter[]>(
      `/${API_VERSION}/data-centers`
    );
    return data;
  },

  getWorlds: async () => {
    const { data } = await universalisClient.get<World[]>(
      `/${API_VERSION}/worlds`
    );
    return data;
  },

  getMarketBoard: async (
    worldDcRegion: WorldDcRegion,
    itemIds: number | number[],
    params
  ) => {
    const ids =
      typeof itemIds === "number" ? itemIds : itemIds.join(",");
    const { data } = await universalisClient.get(
      `/${API_VERSION}/${encodeURIComponent(worldDcRegion)}/${ids}`,
      { params }
    );
    return data;
  },

  getAggregated: async (
    worldDcRegion: WorldDcRegion,
    itemIds: number | number[]
  ) => {
    const ids =
      typeof itemIds === "number" ? itemIds : itemIds.join(",");
    const { data } = await universalisClient.get(
      `/${API_VERSION}/aggregated/${encodeURIComponent(worldDcRegion)}/${ids}`
    );
    return data;
  },

  getHistory: async (
    worldDcRegion: WorldDcRegion,
    itemIds: number | number[],
    params
  ) => {
    const ids =
      typeof itemIds === "number" ? itemIds : itemIds.join(",");
    const { data } = await universalisClient.get(
      `/${API_VERSION}/history/${encodeURIComponent(worldDcRegion)}/${ids}`,
      { params }
    );
    return data;
  },

  getTaxRates: async (world: string) => {
    const { data } = await universalisClient.get(`/${API_VERSION}/tax-rates`, {
      params: { world },
    });
    return data;
  },

  getMarketableItems: async () => {
    const { data } = await universalisClient.get<number[]>(
      `/${API_VERSION}/marketable`
    );
    return data;
  },

  getMostRecentlyUpdated: async (dcName: string, params) => {
    const { data } = await universalisClient.get<{
      items: { itemID: number; worldID: number; worldName?: string }[];
    }>(`/${API_VERSION}/extra/stats/most-recently-updated`, {
      params: { dcName, entries: params?.entries ?? 100 },
    });
    return data.items;
  },
};
