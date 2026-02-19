"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ChartColumn,
  Github,
  Hammer,
  Info,
  Loader2,
  Search,
  Star,
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { BrailleSpinner } from "@/components/braille-spinner";
import Image from "next/image";

interface CraftSimNodeData {
  itemId: number;
  name: string;
  amount: number;
  amountResult?: number;
  buyPrice: number;
  craftCost: number;
  isCraftable: boolean;
  depth: number;
  children?: CraftSimNodeData[];
}

function CraftSimNode({
  node,
  path,
  checked,
  onToggle,
  craftSimChecked,
  toggleCraftSimNode,
  itemIcons,
  formatGil,
  gilUnit,
}: {
  node: CraftSimNodeData;
  path: string;
  checked: boolean;
  onToggle: () => void;
  craftSimChecked: Set<string>;
  toggleCraftSimNode: (key: string) => void;
  itemIcons: Record<number, string>;
  formatGil: (n: number) => string;
  gilUnit: (n: number) => string;
}) {
  const cost = checked
    ? node.isCraftable && node.craftCost > 0
      ? (node.craftCost / (node.amountResult || 1)) * node.amount
      : 0
    : node.buyPrice * node.amount;
  return (
    <div className="flex flex-col gap-0">
      <div
        className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50"
        style={{ paddingLeft: `${node.depth * 12 + 8}px` }}
      >
        <Checkbox
          checked={checked}
          onCheckedChange={onToggle}
          id={`craft-${path}`}
        />
        <label
          htmlFor={`craft-${path}`}
          className="flex items-center gap-2 flex-1 cursor-pointer min-w-0"
        >
          {itemIcons[node.itemId] ? (
            <Image
              src={itemIcons[node.itemId]}
              alt=""
              width={20}
              height={20}
              className="rounded shrink-0"
            />
          ) : (
            <span className="size-5 shrink-0 rounded bg-muted" />
          )}
          <span className="font-mono text-sm truncate">{node.name}</span>
          <span className="text-muted-foreground font-mono text-sm shrink-0">
            x{node.amount}
          </span>
        </label>
        <span className="font-mono text-sm text-right shrink-0">
          {formatGil(Math.round(cost))} {gilUnit(Math.round(cost))}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <a
              href={`https://ffxivteamcraft.com/db/en/item/${node.itemId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label={`Open ${node.name} in Teamcraft`}
            >
              <ArrowRight className="size-4" />
            </a>
          </TooltipTrigger>
          <TooltipContent>Open in Teamcraft</TooltipContent>
        </Tooltip>
      </div>
      {node.children &&
        node.children.length > 0 &&
        node.children.map((child, i) => (
          <CraftSimNode
            key={`${path}-${i}`}
            node={child as CraftSimNodeData}
            path={`${path}-${i}`}
            checked={craftSimChecked.has(`${path}-${i}`)}
            onToggle={() => toggleCraftSimNode(`${path}-${i}`)}
            craftSimChecked={craftSimChecked}
            toggleCraftSimNode={toggleCraftSimNode}
            itemIcons={itemIcons}
            formatGil={formatGil}
            gilUnit={gilUnit}
          />
        ))}
    </div>
  );
}

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
  const [scanProgress, setScanProgress] = useState<string | null>(null);
  const [progressValue, setProgressValue] = useState(0);
  const [results, setResults] = useState<ProfitResult[]>([]);
  const [itemNames, setItemNames] = useState<Record<number, string>>({});
  const [itemIcons, setItemIcons] = useState<Record<number, string>>({});
  const [searchError, setSearchError] = useState<string | null>(null);
  const [showScanAlert, setShowScanAlert] = useState(false);
  const [hideNonCraftable, setHideNonCraftable] = useState(true);
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
    if (results.length === 0) {
      setItemNames({});
      setItemIcons({});
      fetchedIdsRef.current = new Set();
      return;
    }
    const ids = [...new Set(results.map((r) => r.itemId))];
    const idsToFetch = ids.filter((id) => !fetchedIdsRef.current.has(id));
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
  }, [results]);

  useEffect(() => {
    if (!craftSimData) return;
    const collectIds = (
      nodes: typeof craftSimData.tree
    ): number[] =>
      nodes.flatMap((n) => [
        n.itemId,
        ...(n.children ? collectIds(n.children as typeof craftSimData.tree) : []),
      ]);
    const ids = [...new Set(collectIds(craftSimData.tree))];
    const idsToFetch = ids.filter((id) => !fetchedIdsRef.current.has(id));
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
  }, [craftSimData]);

  const displayedResults = useMemo(() => {
    const sorted = [...results].sort((a, b) => {
      const aVal = sortBy === "avgSalePrice" ? a.avgSalePrice : a.dailyVelocity;
      const bVal = sortBy === "avgSalePrice" ? b.avgSalePrice : b.dailyVelocity;
      return sortOrder === "desc" ? bVal - aVal : aVal - bVal;
    });
    return sorted;
  }, [results, sortBy, sortOrder]);

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
    console.log("[Recherche] Étape 1: Scan Universalis");

    const accumulated = new Map<number, ProfitResult>();
    const url = `/api/universalis/scan-full?world=${encodeURIComponent(selectedWorld)}&dataCenter=${encodeURIComponent(selectedDataCenter)}`;
    const eventSource = new EventSource(url);

    eventSource.addEventListener("results", (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      const batchResults = data.results ?? [];
      console.log(
        `[Recherche] Batch ${data.batch}/${data.totalBatches} reçu - ${batchResults.length} items`
      );
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
      const totalBatches = data.totalBatches ?? 1;
      eventSource.close();

      console.log("[Recherche] Scan terminé");

      const sorted = [...accumulated.values()]
        .sort((a, b) => b.profit - a.profit)
        .slice(0, 100);

      let finalCount = sorted.length;
      if (hideNonCraftable && sorted.length > 0) {
        setScanProgress(
          "Checking craftable items (XIVAPI)..."
        );
        setProgressValue(90);
        console.log("[Recherche] Étape 2: Vérification XIVAPI");

        try {
          const itemIds = sorted.map((r) => r.itemId);
          const allCraftableIds: number[] = [];
          const allRecipeMap: Record<number, number> = {};
          for (let i = 0; i < itemIds.length; i += 100) {
            const batchIds = itemIds.slice(i, i + 100);
            const res = await apiClient.get(
              "/api/xivapi/recipes-for-items",
              {
                params: { ids: batchIds.join(",") },
              }
            );
            const craftableIds = res.data.craftableIds ?? [];
            const recipeMap = res.data.recipeMap ?? {};
            allCraftableIds.push(...craftableIds);
            Object.assign(allRecipeMap, recipeMap);
          }
          const craftableSet = new Set(allCraftableIds);
          const filtered = sorted.filter((r) => craftableSet.has(r.itemId));
          finalCount = filtered.length;
          setResults(filtered);
          setRecipeMap(allRecipeMap);
          console.log(
            `[Recherche] Vérification XIVAPI terminée - ${filtered.length} items craftables`
          );
        } catch (err) {
          console.error("[Recherche] Erreur vérification XIVAPI:", err);
          setSearchError(
            "Unable to verify craftable items (XIVAPI)"
          );
          setResults(sorted);
        }
      } else {
        setResults(sorted);
      }

      setProgressValue(100);
      setScanProgress(null);
      setScanning(false);
      toast.success(
        finalCount > 0
          ? `Search complete! ${finalCount} item${finalCount === 1 ? "" : "s"} found.`
          : "Search complete."
      );
      console.log("[Recherche] Étape 3: Terminé");
    });

    eventSource.addEventListener("scan_error", (e: MessageEvent) => {
      const data = e.data ? JSON.parse(e.data) : {};
      setSearchError(data.message ?? "Scan failed");
      eventSource.close();
      setScanning(false);
      setScanProgress(null);
      setProgressValue(0);
    });

    eventSource.onerror = () => {
      if (eventSource.readyState === EventSource.CLOSED) return;
      setSearchError("Connection lost");
      eventSource.close();
      setScanning(false);
      setScanProgress(null);
      setProgressValue(0);
    };
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

  const computeCraftSimTotal = () => {
    if (!craftSimData) return 0;
    let total = 0;
    const walk = (nodes: typeof craftSimData.tree, prefix: string) => {
      nodes.forEach((n, i) => {
        const key = prefix ? `${prefix}-${i}` : String(i);
        const checked = craftSimChecked.has(key);
        if (checked) {
          if (n.isCraftable && n.craftCost > 0) {
            total += (n.craftCost / (n.amountResult || 1)) * n.amount;
          }
        } else {
          total += n.buyPrice * n.amount;
        }
        if (
          checked &&
          n.children &&
          n.children.length > 0 &&
          !(n.isCraftable && n.craftCost > 0)
        ) {
          walk(n.children as typeof craftSimData.tree, key);
        }
      });
    };
    walk(craftSimData.tree, "");
    return total;
  };

  return (
    <div className="flex min-h-screen flex-col items-center bg-background font-sans">
      <main className="flex w-full max-w-full flex-col gap-8 p-8 lg:max-w-6xl xl:max-w-7xl">
        <div className="flex w-full items-center justify-between gap-4">
          <h1 className="font-mono text-2xl font-bold tracking-tight flex items-center gap-2">
            <Image
              src="/gil.png"
              alt="Gil"
              width={28}
              height={28}
              className="size-7"
            />
            ProfitXIV
          </h1>
          <Tooltip>
            <TooltipTrigger asChild>
              <a
                href="https://github.com/MRK4/profitxiv"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors font-mono text-sm"
                aria-label="View on GitHub"
              >
                <Github className="size-5" />
              </a>
            </TooltipTrigger>
            <TooltipContent>
              {githubStars !== null ? (
                <span className="flex items-center gap-1.5">
                  <Star className="size-4 fill-current shrink-0" />
                  {githubStars.toLocaleString()}
                </span>
              ) : (
                "Click to open repository"
              )}
            </TooltipContent>
          </Tooltip>
        </div>

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
          <div className="flex items-center gap-2">
            <Switch
              id="craftable-only"
              checked={hideNonCraftable}
              onCheckedChange={setHideNonCraftable}
            />
            <Label htmlFor="craftable-only" className="font-mono cursor-pointer">
              Hide non-craftable items
            </Label>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              disabled={
                !selectedDataCenter || !selectedWorld || scanning
              }
              onClick={handleStartSearch}
              className="w-full font-mono sm:w-auto"
            >
              {!scanning && <Search className="size-4" />}
              {scanning ? "Searching..." : "Search"}
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

        <AlertDialog open={showScanAlert} onOpenChange={setShowScanAlert}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="font-mono">
                Search
              </AlertDialogTitle>
              <AlertDialogDescription>
                This search scans all market items and may take 6 to 8
                minutes. Results will appear progressively. Continue?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="font-mono">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                className="font-mono"
                onClick={handleConfirmSearch}
              >
                Continue
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

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
                {displayedResults.map((row) => (
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
                ))}
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

        <Dialog
          open={traceItemId !== null}
          onOpenChange={(open) => !open && setTraceItemId(null)}
        >
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:!max-w-2xl">
            <DialogHeader>
              <DialogTitle className="font-mono">
                {traceItemId && itemNames[traceItemId] ? (
                  <>
                    {itemNames[traceItemId]}{" "}
                    <span className="text-muted-foreground text-sm font-normal">
                      ({traceItemId})
                    </span>
                  </>
                ) : traceItemId ? (
                  <>
                    Item{" "}
                    <span className="text-muted-foreground text-sm font-normal">
                      {traceItemId}
                    </span>
                  </>
                ) : (
                  "Trace"
                )}
              </DialogTitle>
              <DialogDescription>
                {traceData?.description
                  ? traceData.description.replace(/<\/?[^>]+>/g, "").trim()
                  : "Step-by-step logic to verify data against in-game"}
              </DialogDescription>
            </DialogHeader>
            {traceLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
              </div>
            ) : traceData ? (
              <div className="flex flex-col gap-4">
                {!traceData.hasData && (
                  <p className="text-muted-foreground text-sm">
                    No market data for this item on {selectedWorld}.
                  </p>
                )}
                <div className="flex gap-4">
                  <div className="size-20 shrink-0 rounded-md flex items-center justify-center overflow-hidden">
                    {traceItemId != null && itemIcons[traceItemId] ? (
                      <Image
                        src={itemIcons[traceItemId]}
                        alt={itemNames[traceItemId] ?? ""}
                        width={80}
                        height={80}
                        className="size-20 object-contain"
                      />
                    ) : (
                      <Skeleton className="size-20 rounded-md shrink-0" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Tabs defaultValue="overview" className="w-full">
                      <TabsList className="w-full">
                        <TabsTrigger value="overview" className="flex-1">
                          Overview
                        </TabsTrigger>
                        <TabsTrigger value="trace" className="flex-1">
                          Trace
                        </TabsTrigger>
                        <TabsTrigger value="links" className="flex-1">
                          Links
                        </TabsTrigger>
                      </TabsList>
                      <TabsContent value="overview" className="space-y-3 mt-3">
                        {traceItemId != null && (
                          (() => {
                            const isCraftable =
                              !scanning &&
                              (hideNonCraftable ||
                                Object.keys(recipeMap).length > 0) &&
                              recipeMap[traceItemId] != null;
                            const cardContent = (
                              <>
                                <div className="font-medium text-foreground">
                                  Craftable
                                </div>
                                {scanning ? (
                                  <p className="mt-1 text-muted-foreground text-xs">
                                    Recipe will be available once processing is
                                    complete.
                                  </p>
                                ) : hideNonCraftable ||
                                  Object.keys(recipeMap).length > 0 ? (
                                  <p
                                    className={`mt-1 text-lg font-semibold ${recipeMap[traceItemId] != null ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}
                                  >
                                    {recipeMap[traceItemId] != null
                                      ? "Yes"
                                      : "No"}
                                  </p>
                                ) : (
                                  <p className="mt-1 text-muted-foreground text-xs">
                                    Enable &quot;Hide non-craftable
                                    items&quot;, then run a search to check.
                                  </p>
                                )}
                                {isCraftable && (
                                  <span className="mt-2 inline-flex items-center gap-1 text-primary text-xs">
                                    FFXIV Teamcraft
                                    <ArrowRight className="size-3.5" />
                                  </span>
                                )}
                              </>
                            );
                            return isCraftable ? (
                              <a
                                href={`https://ffxivteamcraft.com/db/en/item/${traceItemId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block rounded-md border border-primary/30 bg-primary/5 p-3 font-mono text-sm transition-colors hover:bg-primary/10 cursor-pointer"
                              >
                                {cardContent}
                              </a>
                            ) : (
                              <div className="rounded-md border border-primary/30 bg-primary/5 p-3 font-mono text-sm">
                                {cardContent}
                              </div>
                            );
                          })()
                        )}
                        {traceData.steps[0] && (
                          <div className="rounded-md border bg-muted/30 p-3 font-mono text-sm">
                            <div className="font-medium text-foreground">
                              {traceData.steps[0].label}
                            </div>
                            <div className="mt-1 text-lg text-green-600 dark:text-green-400">
                              {typeof traceData.steps[0].value === "number"
                                ? traceData.steps[0].value.toLocaleString(
                                    "en-US"
                                  )
                                : traceData.steps[0].value}
                              {traceData.steps[0].unit &&
                                ` ${traceData.steps[0].unit}`}
                            </div>
                          </div>
                        )}
                      </TabsContent>
                      <TabsContent value="trace" className="mt-3">
                        <div className="grid min-h-[18rem] grid-cols-2 gap-3 [grid-auto-rows:1fr]">
                          {traceData.steps.map((step) => {
                            const tooltipContent =
                              step.id === "5"
                                ? "What you receive when selling, after the market board tax. Formula: Average sale price × (1 - Tax rate)"
                                : step.id === "6"
                                  ? "Profit per unit after buying at the minimum listing price and selling. Formula: Net sell price - Min listing price (buy)"
                                  : null;
                            const card = (
                              <div className="h-full rounded-md border bg-muted/30 p-3 font-mono text-sm flex flex-col justify-center">
                                <div className="font-medium text-foreground">
                                  {step.label}
                                </div>
                                <div className="mt-1 text-lg text-green-600 dark:text-green-400">
                                  {typeof step.value === "number"
                                    ? step.value.toLocaleString("en-US")
                                    : step.value}
                                  {step.unit && ` ${step.unit}`}
                                </div>
                              </div>
                            );
                            return tooltipContent ? (
                              <Tooltip key={step.id}>
                                <TooltipTrigger asChild>{card}</TooltipTrigger>
                                <TooltipContent
                                  side="bottom"
                                  className="max-w-xs text-xs"
                                >
                                  {tooltipContent}
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <div key={step.id}>{card}</div>
                            );
                          })}
                        </div>
                      </TabsContent>
                      <TabsContent value="links" className="space-y-3 mt-3">
                        <div className="flex flex-col gap-2">
                          <a
                            href={traceData.links.universalis}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline text-sm"
                          >
                            <span className="inline-flex items-center gap-1">
                              Universalis market board
                              <ArrowRight className="size-3.5" />
                            </span>
                          </a>
                          {traceItemId != null &&
                            recipeMap[traceItemId] != null && (
                              <a
                                href={`https://ffxivteamcraft.com/db/en/item/${traceItemId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline text-sm"
                              >
                                <span className="inline-flex items-center gap-1">
                                  FFXIV Teamcraft
                                  <ArrowRight className="size-3.5" />
                                </span>
                              </a>
                            )}
                        </div>
                      </TabsContent>
                    </Tabs>
                  </div>
                </div>
              </div>
            ) : traceItemId && !traceLoading ? (
              <p className="text-destructive text-sm">
                Failed to load trace data.
              </p>
            ) : null}
          </DialogContent>
        </Dialog>

        <Dialog
          open={compareItemId !== null}
          onOpenChange={(open) => !open && setCompareItemId(null)}
        >
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:!max-w-2xl">
            <DialogHeader>
              <DialogTitle className="font-mono">
                {compareItemId && itemNames[compareItemId] ? (
                  <>
                    {itemNames[compareItemId]}{" "}
                    <span className="text-muted-foreground text-sm font-normal">
                      ({compareItemId})
                    </span>
                  </>
                ) : compareItemId ? (
                  <>
                    Comparison{" "}
                    <span className="text-muted-foreground text-sm font-normal">
                      {compareItemId}
                    </span>
                  </>
                ) : (
                  "Market comparison"
                )}
              </DialogTitle>
              <DialogDescription>
                Prices by world in the selected Data Center
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="compare-dc" className="font-mono shrink-0">
                  Data Center
                </Label>
                <Select
                  value={compareDataCenter}
                  onValueChange={(dc) => {
                    setCompareDataCenter(dc);
                    if (compareItemId) handleCompare(compareItemId, dc);
                  }}
                  disabled={compareLoading}
                >
                  <SelectTrigger id="compare-dc" className="font-mono flex-1">
                    <SelectValue placeholder="Select a DC" />
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
              {compareLoading ? (
                <div className="flex flex-col gap-4">
                  <div className="rounded-md border bg-muted/30 p-3 font-mono text-sm space-y-2">
                    <div className="flex gap-2">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                    <div className="flex gap-2">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                    <div className="flex gap-2">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-12" />
                    </div>
                  </div>
                  <div className="rounded-md border overflow-hidden">
                    <div className="p-2 border-b">
                      <div className="flex gap-4 justify-between">
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-16" />
                      </div>
                    </div>
                    {[...Array(6)].map((_, i) => (
                      <div
                        key={i}
                        className="flex gap-4 justify-between p-2 border-b last:border-0"
                      >
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-8" />
                      </div>
                    ))}
                  </div>
                </div>
              ) : compareData && compareData.worlds.length > 0 ? (
                <>
                  <div className="rounded-md border bg-muted/30 p-3 font-mono text-sm space-y-2">
                    <div>
                      <span className="text-muted-foreground">Cheapest: </span>
                      <span className="text-red-600 dark:text-red-400 font-medium">
                        {compareData.worlds[0].worldName}{" "}
                        {formatGil(compareData.worlds[0].minPrice)} {gilUnit(compareData.worlds[0].minPrice)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">
                        Most expensive:{" "}
                      </span>
                      <span className="text-green-600 dark:text-green-400 font-medium">
                        {
                          compareData.worlds[compareData.worlds.length - 1]
                            .worldName
                        }{" "}
                        {formatGil(
                          compareData.worlds[compareData.worlds.length - 1]
                            .minPrice
                        )}{" "}
                        {gilUnit(
                          compareData.worlds[compareData.worlds.length - 1]
                            .minPrice
                        )}
                      </span>
                    </div>
                    {compareData.worlds.length > 1 &&
                      compareData.worlds[0].minPrice > 0 && (
                        <div>
                          <span className="text-muted-foreground">
                            Difference:{" "}
                          </span>
                          <span>
                            {(
                              ((compareData.worlds[
                                compareData.worlds.length - 1
                              ].minPrice -
                                compareData.worlds[0].minPrice) /
                                compareData.worlds[0].minPrice) *
                              100
                            ).toFixed(0)}
                            %
                          </span>
                        </div>
                      )}
                  </div>
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="font-mono">World</TableHead>
                          <TableHead className="font-mono text-right">
                            Min price
                          </TableHead>
                          <TableHead className="font-mono text-right">
                            Avg price
                          </TableHead>
                          <TableHead className="font-mono text-right">
                            Listings
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {compareData.worlds.map((w) => (
                          <TableRow key={w.worldName}>
                            <TableCell className="font-mono">
                              {w.worldName}
                            </TableCell>
                            <TableCell className="font-mono text-right text-green-600 dark:text-green-400">
                              {formatGil(w.minPrice)} {gilUnit(w.minPrice)}
                            </TableCell>
                            <TableCell className="font-mono text-right">
                              {formatGil(
                                Math.round(w.currentAveragePrice)
                              )}{" "}
                              {gilUnit(Math.round(w.currentAveragePrice))}
                            </TableCell>
                            <TableCell className="font-mono text-right">
                              {w.listingsCount}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              ) : compareData && compareData.worlds.length === 0 ? (
                <p className="text-muted-foreground text-sm py-4">
                  No market data for this item on this Data Center.
                </p>
              ) : compareItemId && !compareLoading ? (
                <p className="text-destructive text-sm py-4">
                  Failed to load comparison.
                </p>
              ) : null}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={craftSimItemId !== null}
          onOpenChange={(open) => !open && setCraftSimItemId(null)}
        >
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:!max-w-2xl">
            <DialogHeader>
              <DialogTitle className="font-mono">
                {craftSimItemId && itemNames[craftSimItemId] ? (
                  <>
                    {itemNames[craftSimItemId]}{" "}
                    <span className="text-muted-foreground text-sm font-normal">
                      ({craftSimItemId})
                    </span>
                  </>
                ) : craftSimItemId ? (
                  <>
                    Craft simulator{" "}
                    <span className="text-muted-foreground text-sm font-normal">
                      {craftSimItemId}
                    </span>
                  </>
                ) : (
                  "Craft yield simulator"
                )}
              </DialogTitle>
              <DialogDescription>
                Toggle materials: checked = craft/gather, unchecked = buy at
                market/NPC price
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              {craftSimLoading ? (
                <div className="flex flex-col gap-4">
                  <div className="rounded-md border bg-muted/30 p-3 font-mono text-sm space-y-2">
                    <div className="flex gap-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                    <div className="flex gap-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    {[...Array(6)].map((_, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 p-2 rounded-md border"
                      >
                        <Skeleton className="h-4 w-4 shrink-0" />
                        <Skeleton className="h-4 w-20 shrink-0" />
                        <Skeleton className="h-4 flex-1" />
                      </div>
                    ))}
                  </div>
                </div>
              ) : craftSimData && craftSimData.tree.length > 0 ? (
                <>
                  <div className="rounded-md border bg-muted/30 p-3 font-mono text-sm space-y-2">
                    <div>
                      <span className="text-muted-foreground">
                        Total material cost:{" "}
                      </span>
                      <span className="font-medium">
                        {formatGil(Math.round(computeCraftSimTotal()))}{" "}
                        {gilUnit(Math.round(computeCraftSimTotal()))}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">
                        Sell price:{" "}
                      </span>
                      <span className="text-green-600 dark:text-green-400 font-medium">
                        {formatGil(craftSimData.sellPrice)}{" "}
                        {gilUnit(craftSimData.sellPrice)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">
                        Profit:{" "}
                      </span>
                      <span
                        className={
                          craftSimData.sellPrice - computeCraftSimTotal() >= 0
                            ? "text-green-600 dark:text-green-400 font-medium"
                            : "text-red-600 dark:text-red-400 font-medium"
                        }
                      >
                        {formatGil(
                          Math.round(
                            craftSimData.sellPrice - computeCraftSimTotal()
                          )
                        )}{" "}
                        {gilUnit(
                          Math.round(
                            craftSimData.sellPrice - computeCraftSimTotal()
                          )
                        )}
                      </span>
                    </div>
                    {computeCraftSimTotal() > 0 && (
                      <div>
                        <span className="text-muted-foreground">
                          Margin:{" "}
                        </span>
                        <span>
                          {(
                            ((craftSimData.sellPrice -
                              computeCraftSimTotal()) /
                              computeCraftSimTotal()) *
                            100
                          ).toFixed(1)}
                          %
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    {(
                      craftSimData.tree as Array<{
                        itemId: number;
                        name: string;
                        amount: number;
                        buyPrice: number;
                        craftCost: number;
                        isCraftable: boolean;
                        depth: number;
                        children?: unknown[];
                      }>
                    ).map((node, i) => (
                      <div key={i}>
                        <CraftSimNode
                          node={node as CraftSimNodeData}
                          path={String(i)}
                          checked={craftSimChecked.has(String(i))}
                          onToggle={() => toggleCraftSimNode(String(i))}
                          craftSimChecked={craftSimChecked}
                          toggleCraftSimNode={toggleCraftSimNode}
                          itemIcons={itemIcons}
                          formatGil={formatGil}
                          gilUnit={gilUnit}
                        />
                      </div>
                    ))}
                  </div>
                </>
              ) : craftSimData && craftSimData.tree.length === 0 ? (
                <p className="text-muted-foreground text-sm py-4">
                  No recipe data for this item.
                </p>
              ) : craftSimItemId && !craftSimLoading ? (
                <p className="text-destructive text-sm py-4">
                  Failed to load craft simulator.
                </p>
              ) : null}
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
