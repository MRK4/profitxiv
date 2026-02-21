"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface TraceStep {
  id: string;
  label: string;
  value: number | string;
  unit: string;
  source?: string;
  rawPath?: string;
  formula?: string;
}

export interface TraceData {
  steps: TraceStep[];
  links: { universalis: string; xivapi: string };
  hasData: boolean;
  description?: string | null;
}

interface TraceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  traceItemId: number | null;
  itemNames: Record<number, string>;
  itemIcons: Record<number, string>;
  traceData: TraceData | null;
  traceLoading: boolean;
  recipeMap: Record<number, number>;
  selectedWorld: string;
  hideNonCraftable: boolean;
  scanning: boolean;
}

export function TraceDialog({
  open,
  onOpenChange,
  traceItemId,
  itemNames,
  itemIcons,
  traceData,
  traceLoading,
  recipeMap,
  selectedWorld,
  hideNonCraftable,
  scanning,
}: TraceDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onOpenChange(false)}
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
              : ""}
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
                                {recipeMap[traceItemId] != null ? "Yes" : "No"}
                              </p>
                            ) : (
                              <p className="mt-1 text-muted-foreground text-xs">
                                Enable &quot;Hide non-craftable items&quot;,
                                then run a search to check.
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
                            ? traceData.steps[0].value.toLocaleString("en-US")
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
  );
}
