"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChartColumn,
  Filter,
  Hammer,
  Info,
  Search,
  Square,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { BrailleSpinner } from "@/components/braille-spinner";
import Image from "next/image";
import { ScanAlertDialog } from "@/components/scan-alert-dialog";
import { TraceDialog } from "@/components/trace-dialog";
import { CompareDialog } from "@/components/compare-dialog";
import { CraftSimDialog } from "@/components/craft-sim-dialog";
import { Header } from "@/components/header";
import {
  buildItemMetadata,
  shouldDisplayItem,
  type ItemMetadataResponse,
} from "@/lib/search-filters";

interface DataCenterWithWorlds {
  name: string;
  region: string;
  worlds: string[];
}

interface ProfitResult {
  itemId: number;
  minPrice: number;
  avgSalePrice: number;
  lastSalePrice?: number;
  lastSaleTimestamp?: number;
  profit: number;
  dailyVelocity: number;
}

export default function Home() {
  const [dataCenters, setDataCenters] = useState<DataCenterWithWorlds[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDataCenter, setSelectedDataCenter] = useState<string>("");
  const [selectedWorld, setSelectedWorld] = useState<string>("");
  const [scanning, setScanning] = useState(false);
  const [cancelConfirmPending, setCancelConfirmPending] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const [scanProgress, setScanProgress] = useState<string | null>(null);
  const [progressValue, setProgressValue] = useState(0);
  const [results, setResults] = useState<ProfitResult[]>([]);
  const [itemNames, setItemNames] = useState<Record<number, string>>({});
  const [itemIcons, setItemIcons] = useState<Record<number, string>>({});
  const [searchError, setSearchError] = useState<string | null>(null);
  const [showScanAlert, setShowScanAlert] = useState(false);
  const [hideNonCraftable, setHideNonCraftable] = useState(true);
  const [hideNonGatherable, setHideNonGatherable] = useState(true);
  const [minAvgSalePrice, setMinAvgSalePrice] = useState("");
  const [minDailyVelocity, setMinDailyVelocity] = useState("");
  const [minLastSale, setMinLastSale] = useState("");
  const [recipeMap, setRecipeMap] = useState<Record<number, number>>({});
  const [traceItemId, setTraceItemId] = useState<number | null>(null);
  const [traceData, setTraceData] = useState<{
    steps: Array<{
      id: string;
      label: string;
      value: number | string;
      unit: string;
      source?: string;
      rawPath?: string;
      formula?: string;
    }>;
    links: { universalis: string; xivapi: string };
    hasData: boolean;
    description?: string | null;
  } | null>(null);
  const [traceLoading, setTraceLoading] = useState(false);
  const [sortBy, setSortBy] = useState<"avgSalePrice" | "dailyVelocity">(
    "avgSalePrice"
  );
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [githubStars, setGithubStars] = useState<number | null>(null);
  const [compareItemId, setCompareItemId] = useState<number | null>(null);
  const [compareData, setCompareData] = useState<{
    worlds: Array<{
      worldName: string;
      minPrice: number;
      currentAveragePrice: number;
      listingsCount: number;
    }>;
    itemId: number;
  } | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareDataCenter, setCompareDataCenter] = useState<string>("");
  const [craftSimItemId, setCraftSimItemId] = useState<number | null>(null);
  const [craftSimData, setCraftSimData] = useState<{
    itemId: number;
    amountResult: number;
    tree: Array<{
      itemId: number;
      name: string;
      amount: number;
      amountResult: number;
      buyPrice: number;
      craftCost: number;
      isCraftable: boolean;
      depth: number;
      children?: unknown[];
    }>;
    sellPrice: number;
  } | null>(null);
  const [craftSimLoading, setCraftSimLoading] = useState(false);
  const [craftSimChecked, setCraftSimChecked] = useState<Set<string>>(new Set());

  const selectedDC = dataCenters.find((dc) => dc.name === selectedDataCenter);
  const worlds = selectedDC?.worlds ?? [];

  useEffect(() => {
    apiClient
      .get("/api/universalis/regions")
      .then((res) => setDataCenters(res.data.dataCenters ?? []))
      .catch(() => setDataCenters([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch("https://api.github.com/repos/MRK4/profitxiv")
      .then((res) => res.json())
      .then((data) => {
        if (typeof data.stargazers_count === "number") {
          setGithubStars(data.stargazers_count);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && !sessionStorage.getItem("profitxiv-welcome-shown")) {
      sessionStorage.setItem("profitxiv-welcome-shown", "1");
      toast("Thanks for using ProfitXIV!", {
        description:
          "If you find it useful, consider starring the repo on GitHub.",
        action: {
          label: "Star on GitHub",
          onClick: () =>
            window.open("https://github.com/MRK4/profitxiv", "_blank"),
        },
        duration: 8000,
      });
    }
  }, []);

  const fetchedIdsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    const collectIdsFromTree = (
      nodes: Array<{ itemId: number; children?: unknown[] }>
    ): number[] =>
      nodes.flatMap((n) => [
        n.itemId,
        ...(n.children
          ? collectIdsFromTree(n.children as Array<{ itemId: number; children?: unknown[] }>)
          : []),
      ]);

    const ids = new Set(results.map((r) => r.itemId));
    if (craftSimData?.tree) {
      collectIdsFromTree(craftSimData.tree).forEach((id) => ids.add(id));
    }

    if (results.length === 0) {
      setItemNames({});
      setItemIcons({});
      fetchedIdsRef.current = new Set();
    }
    if (ids.size === 0) return;

    const idsToFetch = [...ids].filter((id) => !fetchedIdsRef.current.has(id));
    if (idsToFetch.length === 0) return;

    apiClient
      .get("/api/xivapi/items", { params: { ids: idsToFetch.join(",") } })
      .then((res) => {
        const names = res.data.names ?? {};
        const icons = res.data.icons ?? {};
        idsToFetch.forEach((id) => fetchedIdsRef.current.add(id));
        setItemNames((prev) => ({ ...prev, ...names }));
        setItemIcons((prev) => ({ ...prev, ...icons }));
      })
      .catch(() => {});
  }, [results, craftSimData]);

  const displayedResults = useMemo(() => {
    let filtered = [...results];
    const minAvg = minAvgSalePrice.trim() ? parseInt(minAvgSalePrice, 10) : NaN;
    const minVel = minDailyVelocity.trim()
      ? parseFloat(minDailyVelocity)
      : NaN;
    const minLast = minLastSale.trim() ? parseInt(minLastSale, 10) : NaN;
    if (!Number.isNaN(minAvg))
      filtered = filtered.filter((r) => r.avgSalePrice >= minAvg);
    if (!Number.isNaN(minVel))
      filtered = filtered.filter((r) => r.dailyVelocity >= minVel);
    if (!Number.isNaN(minLast))
      filtered = filtered.filter(
        (r) => (r.lastSalePrice ?? 0) >= minLast
      );
    return filtered.sort((a, b) => {
      const aVal = sortBy === "avgSalePrice" ? a.avgSalePrice : a.dailyVelocity;
      const bVal = sortBy === "avgSalePrice" ? b.avgSalePrice : b.dailyVelocity;
      return sortOrder === "desc" ? bVal - aVal : aVal - bVal;
    });
  }, [
    results,
    sortBy,
    sortOrder,
    minAvgSalePrice,
    minDailyVelocity,
    minLastSale,
  ]);

  const handleSort = (column: "avgSalePrice" | "dailyVelocity") => {
    if (sortBy === column) {
      setSortOrder((o) => (o === "desc" ? "asc" : "desc"));
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
  };

  const handleDataCenterChange = (value: string) => {
    setSelectedDataCenter(value);
    setSelectedWorld("");
    setResults([]);
    setSearchError(null);
    setScanProgress(null);
  };

  const handleStartSearch = () => {
    if (!selectedDataCenter || !selectedWorld) return;
    setShowScanAlert(true);
  };

  const handleConfirmSearch = () => {
    if (!selectedDataCenter || !selectedWorld) return;
    setShowScanAlert(false);
    setScanning(true);
    setSearchError(null);
    setResults([]);
    setRecipeMap({});
    setScanProgress("Scanning Universalis...");
    setProgressValue(0);

    const accumulated = new Map<number, ProfitResult>();
    const url = `/api/universalis/scan-full?world=${encodeURIComponent(selectedWorld)}&dataCenter=${encodeURIComponent(selectedDataCenter)}`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.addEventListener("results", (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      const batchResults = data.results ?? [];
      for (const r of batchResults) {
        const existing = accumulated.get(r.itemId);
        if (!existing || r.profit > existing.profit) {
          accumulated.set(r.itemId, r);
        }
      }
      const sorted = [...accumulated.values()]
        .sort((a, b) => b.profit - a.profit)
        .slice(0, 100);
      setResults(sorted);
      const totalBatches = data.totalBatches ?? 1;
      const batch = data.batch ?? 0;
      const pct = Math.round((batch / totalBatches) * 85);
      setProgressValue(pct);
      setScanProgress(
        `Batch ${data.batch}/${data.totalBatches} - ${sorted.length} items found`
      );
    });

    eventSource.addEventListener("done", async (e: MessageEvent) => {
      const data = e.data ? JSON.parse(e.data) : {};
      eventSourceRef.current = null;
      eventSource.close();

      const sorted = [...accumulated.values()]
        .sort((a, b) => b.profit - a.profit)
        .slice(0, 100);

      let filtered = sorted;
      const filters = { hideNonCraftable, hideNonGatherable };

      if ((hideNonCraftable || hideNonGatherable) && sorted.length > 0) {
        setScanProgress("Fetching item metadata (XIVAPI)...");
        setProgressValue(90);

        try {
          const itemIds = sorted.map((r) => r.itemId);
          const metadataRes = await apiClient.get<ItemMetadataResponse>(
            "/api/xivapi/item-metadata",
            { params: { ids: itemIds.join(",") } }
          );
          const metadataResponse: ItemMetadataResponse = {
            gatherableIds: metadataRes.data.gatherableIds ?? [],
            craftableIds: metadataRes.data.craftableIds ?? [],
            recipeMap: metadataRes.data.recipeMap ?? {},
            recipeComponentIds: metadataRes.data.recipeComponentIds ?? [],
          };

          filtered = sorted.filter((r) => {
            const metadata = buildItemMetadata(r.itemId, metadataResponse);
            return shouldDisplayItem(r.itemId, metadata, filters);
          });

          setRecipeMap(metadataResponse.recipeMap);
        } catch {
          setSearchError("Unable to fetch item metadata (XIVAPI)");
        }
      }

      setResults(filtered);
      setProgressValue(100);
      setScanProgress(null);
      setScanning(false);
      setCancelConfirmPending(false);
      toast.success(
        filtered.length > 0
          ? `Search complete! ${filtered.length} item${filtered.length === 1 ? "" : "s"} found.`
          : "Search complete."
      );
    });

    eventSource.addEventListener("scan_error", (e: MessageEvent) => {
      const data = e.data ? JSON.parse(e.data) : {};
      eventSourceRef.current = null;
      setSearchError(data.message ?? "Scan failed");
      eventSource.close();
      setScanning(false);
      setCancelConfirmPending(false);
      setScanProgress(null);
      setProgressValue(0);
    });

    eventSource.onerror = () => {
      if (eventSource.readyState === EventSource.CLOSED) return;
      eventSourceRef.current = null;
      setSearchError("Connection lost");
      eventSource.close();
      setScanning(false);
      setCancelConfirmPending(false);
      setScanProgress(null);
      setProgressValue(0);
    };
  };

  const handleSearchButtonClick = () => {
    if (!selectedDataCenter || !selectedWorld) return;
    if (scanning) {
      if (cancelConfirmPending) {
        eventSourceRef.current?.close();
        eventSourceRef.current = null;
        setScanning(false);
        setCancelConfirmPending(false);
        setScanProgress(null);
        setProgressValue(0);
        toast.info("Search cancelled");
      } else {
        setCancelConfirmPending(true);
      }
    } else {
      handleStartSearch();
    }
  };

  const formatGil = (n: number) =>
    n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  const gilUnit = (n: number) => (n > 1 ? "gils" : "gil");
  const velocityColor = (v: number) => {
    if (v >= 10) return "text-green-600 dark:text-green-400";
    if (v < 2) return "text-red-600 dark:text-red-400";
    return "text-amber-600 dark:text-amber-400";
  };
  const formatLastSaleDate = (ts: number) => {
    const date = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  };

  const handleTrace = async (itemId: number) => {
    if (!selectedWorld || !selectedDataCenter) return;
    setTraceItemId(itemId);
    setTraceData(null);
    setTraceLoading(true);
    try {
      const res = await apiClient.get("/api/universalis/trace", {
        params: { itemId, world: selectedWorld, dataCenter: selectedDataCenter },
      });
      setTraceData(res.data);
    } catch {
      setTraceData(null);
    } finally {
      setTraceLoading(false);
    }
  };

  const handleCompare = async (itemId: number, dataCenter: string) => {
    if (!dataCenter) return;
    setCompareItemId(itemId);
    setCompareData(null);
    setCompareDataCenter(dataCenter);
    setCompareLoading(true);
    try {
      const res = await apiClient.get("/api/universalis/compare-markets", {
        params: { dataCenter, itemId },
      });
      setCompareData(res.data);
    } catch {
      setCompareData(null);
      toast.error("Failed to load market comparison");
    } finally {
      setCompareLoading(false);
    }
  };

  const openCompareModal = (itemId: number) => {
    if (!selectedDataCenter) return;
    setCompareItemId(itemId);
    setCompareDataCenter(selectedDataCenter);
    handleCompare(itemId, selectedDataCenter);
  };

  const handleCraftSim = async (itemId: number) => {
    const recipeId = recipeMap[itemId];
    if (!recipeId || !selectedWorld) return;
    setCraftSimItemId(itemId);
    setCraftSimData(null);
    setCraftSimChecked(new Set());
    setCraftSimLoading(true);
    try {
      const res = await apiClient.get("/api/xivapi/recipe-tree", {
        params: { itemId, recipeId, world: selectedWorld },
      });
      setCraftSimData(res.data);
      const defaultChecked = new Set<string>();
      const flattenKeys = (
        nodes: Array<{ children?: unknown[] }>,
        prefix: string
      ): string[] => {
        return nodes.flatMap((n: { children?: unknown[] }, i: number) => {
              const key = prefix ? `${prefix}-${i}` : String(i);
              const keys = [key];
              if (n.children && n.children.length > 0) {
                keys.push(
                  ...flattenKeys(n.children as Array<{ children?: unknown[] }>, key)
                );
              }
              return keys;
            });
          };
      flattenKeys(res.data.tree, "").forEach((k) => defaultChecked.add(k));
      setCraftSimChecked(defaultChecked);
    } catch {
      setCraftSimData(null);
      toast.error("Failed to load craft simulator");
    } finally {
      setCraftSimLoading(false);
    }
  };

  const toggleCraftSimNode = (key: string) => {
    setCraftSimChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="flex min-h-screen flex-col items-center bg-background font-sans">
      <main className="flex w-full max-w-full flex-col gap-8 p-8 lg:max-w-6xl xl:max-w-7xl">
        <Header githubStars={githubStars} />

        <div className="flex flex-col gap-6 sm:flex-row">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Label htmlFor="data-center">Data Center</Label>
            <Select
              value={selectedDataCenter}
              onValueChange={handleDataCenterChange}
              disabled={loading}
            >
              <SelectTrigger id="data-center" className="w-full">
                <SelectValue
                  placeholder={
                    loading ? "Loading..." : "Select a server"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {dataCenters.map((dc) => (
                  <SelectItem key={dc.name} value={dc.name}>
                    {dc.name} ({dc.region})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Label htmlFor="world">World</Label>
            <Select
              value={selectedWorld}
              onValueChange={(v) => {
                setSelectedWorld(v);
                setResults([]);
                setSearchError(null);
                setScanProgress(null);
              }}
              disabled={!selectedDataCenter}
            >
              <SelectTrigger id="world" className="w-full">
                <SelectValue placeholder="Select a world" />
              </SelectTrigger>
              <SelectContent>
                {worlds.map((world) => (
                  <SelectItem key={world} value={world}>
                    {world}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                className="font-mono gap-2"
              >
                <Filter className="size-4" />
                Filters
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" side="bottom" className="w-80">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-2">
                  <Label
                    htmlFor="craftable-only"
                    className="font-mono cursor-pointer flex-1"
                  >
                    Hide non-craftable items
                  </Label>
                  <Switch
                    id="craftable-only"
                    checked={hideNonCraftable}
                    onCheckedChange={setHideNonCraftable}
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <Label
                    htmlFor="gatherable-only"
                    className="font-mono cursor-pointer flex-1"
                  >
                    Hide non-gatherable items
                  </Label>
                  <Switch
                    id="gatherable-only"
                    checked={hideNonGatherable}
                    onCheckedChange={setHideNonGatherable}
                  />
                </div>
                <div className="border-t pt-4 mt-1 space-y-3">
                  <div className="space-y-2">
                    <Label
                      htmlFor="min-avg-price"
                      className="font-mono text-xs"
                    >
                      Min avg. sale price (gil)
                    </Label>
                    <Input
                      id="min-avg-price"
                      type="number"
                      min={0}
                      placeholder="Any"
                      value={minAvgSalePrice}
                      onChange={(e) => setMinAvgSalePrice(e.target.value)}
                      className="font-mono h-8"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="min-daily-velocity"
                      className="font-mono text-xs"
                    >
                      Min sales/day
                    </Label>
                    <Input
                      id="min-daily-velocity"
                      type="number"
                      min={0}
                      step={0.1}
                      placeholder="Any"
                      value={minDailyVelocity}
                      onChange={(e) => setMinDailyVelocity(e.target.value)}
                      className="font-mono h-8"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="min-last-sale"
                      className="font-mono text-xs"
                    >
                      Min last sale (gil)
                    </Label>
                    <Input
                      id="min-last-sale"
                      type="number"
                      min={0}
                      placeholder="Any"
                      value={minLastSale}
                      onChange={(e) => setMinLastSale(e.target.value)}
                      className="font-mono h-8"
                    />
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              disabled={!selectedDataCenter || !selectedWorld}
              onClick={handleSearchButtonClick}
              className="w-full font-mono sm:w-auto"
            >
              {!scanning && <Search className="size-4" />}
              {scanning && <Square className="size-4 fill-current" />}
              {scanning
                ? cancelConfirmPending
                  ? "Click again to cancel"
                  : "Cancel search"
                : "Search"}
            </Button>
          </div>
        </div>

        {scanning && (
          <div className="w-full space-y-2">
            <p className="text-muted-foreground font-mono text-sm flex items-center gap-2">
              <BrailleSpinner />
              {scanProgress}
            </p>
            <Progress value={progressValue} className="h-2" />
          </div>
        )}

        <ScanAlertDialog
          open={showScanAlert}
          onOpenChange={setShowScanAlert}
          onConfirm={handleConfirmSearch}
        />

        {searchError && (
          <p className="text-destructive font-mono text-sm">{searchError}</p>
        )}

        {results.length > 0 && (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <TableHead className="font-mono cursor-help">
                        Item ID
                      </TableHead>
                    </TooltipTrigger>
                    <TooltipContent>Unique item ID in FFXIV</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <TableHead className="font-mono cursor-help">
                        Name
                      </TableHead>
                    </TooltipTrigger>
                    <TooltipContent>Item name</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <TableHead
                        className="font-mono text-right cursor-pointer hover:bg-muted/50 select-none"
                        onClick={() => handleSort("avgSalePrice")}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ")
                            handleSort("avgSalePrice");
                        }}
                      >
                        <span className="inline-flex items-center gap-1">
                          Avg. sale price
                          {sortBy === "avgSalePrice" &&
                            (sortOrder === "desc" ? (
                              <ArrowDown className="size-3" />
                            ) : (
                              <ArrowUp className="size-3" />
                            ))}
                        </span>
                      </TableHead>
                    </TooltipTrigger>
                    <TooltipContent>
                      Average sale price per unit over the last 4 days. Click to
                      sort.
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <TableHead className="font-mono text-right cursor-help">
                        Last sale
                      </TableHead>
                    </TooltipTrigger>
                    <TooltipContent>
                      Price of the most recent sale per unit
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <TableHead
                        className="font-mono text-right cursor-pointer hover:bg-muted/50 select-none"
                        onClick={() => handleSort("dailyVelocity")}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ")
                            handleSort("dailyVelocity");
                        }}
                      >
                        <span className="inline-flex items-center gap-1">
                          Sales/day
                          {sortBy === "dailyVelocity" &&
                            (sortOrder === "desc" ? (
                              <ArrowDown className="size-3" />
                            ) : (
                              <ArrowUp className="size-3" />
                            ))}
                        </span>
                      </TableHead>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="mb-2">
                        Average number of sales per day (velocity). Click to
                        sort.
                      </p>
                      <div className="flex flex-col gap-1.5 text-xs">
                        <span className="flex items-center gap-2">
                          <span className="size-2.5 shrink-0 rounded-sm bg-green-500" />
                          High turnover (≥10/day)
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="size-2.5 shrink-0 rounded-sm bg-amber-500" />
                          Moderate (2–10/day)
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="size-2.5 shrink-0 rounded-sm bg-red-500" />
                          {"Low (<2/day) — risky when price is high"}
                        </span>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                  <TableHead className="w-32" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedResults.length === 0 ? (
                  <TableRow>
                    <TableCell>
                      <Skeleton className="h-5 w-16 rounded" />
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-2">
                        <Skeleton className="size-6 shrink-0 rounded" />
                        <Skeleton className="h-5 w-24 rounded" />
                      </span>
                    </TableCell>
                    <TableCell>
                      <Skeleton className="ml-auto h-5 w-20 rounded" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="ml-auto h-5 w-24 rounded" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="ml-auto h-5 w-8 rounded" />
                    </TableCell>
                    <TableCell className="w-32">
                      <div className="flex gap-0.5">
                        <Skeleton className="size-8 rounded" />
                        <Skeleton className="size-8 rounded" />
                        <Skeleton className="size-8 rounded" />
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  displayedResults.map((row) => (
                  <TableRow key={row.itemId}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <TableCell
                          className="font-mono text-muted-foreground cursor-pointer hover:bg-muted/50 transition-colors select-none"
                          onClick={() => {
                            navigator.clipboard.writeText(String(row.itemId));
                            toast.success("ID copied to clipboard");
                          }}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              navigator.clipboard.writeText(String(row.itemId));
                              toast.success("ID copied to clipboard");
                            }
                          }}
                        >
                          {row.itemId}
                        </TableCell>
                      </TooltipTrigger>
                      <TooltipContent>Click to copy</TooltipContent>
                    </Tooltip>
                    <TableCell className="font-mono">
                      <span className="inline-flex items-center gap-2">
                        {itemIcons[row.itemId] ? (
                          <Image
                            src={itemIcons[row.itemId]}
                            alt=""
                            width={24}
                            height={24}
                            className="rounded shrink-0"
                          />
                        ) : (
                          <Skeleton className="size-6 shrink-0 rounded" />
                        )}
                        {itemNames[row.itemId] ?? "—"}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-right text-green-600 dark:text-green-400">
                      {formatGil(row.avgSalePrice)} {gilUnit(row.avgSalePrice)}
                    </TableCell>
                    <TableCell className="font-mono text-right">
                      {(row.lastSalePrice ?? 0) > 0 ? (
                        <span className="flex flex-col items-end">
                          <span>
                            {formatGil(row.lastSalePrice!)}{" "}
                            {gilUnit(row.lastSalePrice!)}
                          </span>
                          {row.lastSaleTimestamp != null && (
                            <span className="text-muted-foreground text-xs">
                              {formatLastSaleDate(row.lastSaleTimestamp)}
                            </span>
                          )}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell
                      className={`font-mono text-right ${velocityColor(row.dailyVelocity)}`}
                    >
                      {row.dailyVelocity}
                    </TableCell>
                    <TableCell className="w-32">
                      <div className="flex items-center gap-0.5">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              onClick={() => openCompareModal(row.itemId)}
                              disabled={!selectedDataCenter}
                            >
                              <ChartColumn className="size-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            Compare prices by world
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                onClick={() => handleCraftSim(row.itemId)}
                                disabled={
                                  !selectedWorld ||
                                  !recipeMap[row.itemId]
                                }
                              >
                                <Hammer className="size-4" />
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {scanning
                              ? "Feature will be available once the scan is complete"
                              : "Simulate craft cost: choose which materials to craft/gather vs buy"}
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              onClick={() => handleTrace(row.itemId)}
                              disabled={
                                !selectedWorld || !selectedDataCenter
                              }
                            >
                              <Info className="size-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            Get item details
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {results.length === 0 && !scanning && !searchError && (
          <p className="text-muted-foreground font-mono text-xs">
            Select a Data Center and World, then click Search to find items with
            the highest resale value.
          </p>
        )}

        <TraceDialog
          open={traceItemId !== null}
          onOpenChange={() => setTraceItemId(null)}
          traceItemId={traceItemId}
          itemNames={itemNames}
          itemIcons={itemIcons}
          traceData={traceData}
          traceLoading={traceLoading}
          recipeMap={recipeMap}
          selectedWorld={selectedWorld}
          hideNonCraftable={hideNonCraftable}
          scanning={scanning}
        />

        <CompareDialog
          open={compareItemId !== null}
          onOpenChange={() => setCompareItemId(null)}
          compareItemId={compareItemId}
          itemNames={itemNames}
          compareData={compareData}
          compareLoading={compareLoading}
          compareDataCenter={compareDataCenter}
          onDataCenterChange={(dc) => {
            setCompareDataCenter(dc);
            if (compareItemId) handleCompare(compareItemId, dc);
          }}
          dataCenters={dataCenters}
          formatGil={formatGil}
          gilUnit={gilUnit}
        />

        <CraftSimDialog
          open={craftSimItemId !== null}
          onOpenChange={() => setCraftSimItemId(null)}
          craftSimItemId={craftSimItemId}
          itemNames={itemNames}
          craftSimData={craftSimData}
          craftSimLoading={craftSimLoading}
          craftSimChecked={craftSimChecked}
          toggleCraftSimNode={toggleCraftSimNode}
          itemIcons={itemIcons}
          formatGil={formatGil}
          gilUnit={gilUnit}
        />
      </main>
    </div>
  );
}
