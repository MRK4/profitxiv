"use client";

import { useMemo } from "react";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface CraftSimNodeData {
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

export interface CraftSimTree {
  itemId: number;
  amountResult: number;
  tree: CraftSimNodeData[];
  sellPrice: number;
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
            node={child}
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

interface CraftSimDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  craftSimItemId: number | null;
  itemNames: Record<number, string>;
  craftSimData: {
    itemId: number;
    amountResult: number;
    tree: Array<{
      itemId: number;
      name: string;
      amount: number;
      amountResult?: number;
      buyPrice: number;
      craftCost: number;
      isCraftable: boolean;
      depth: number;
      children?: unknown[];
    }>;
    sellPrice: number;
  } | null;
  craftSimLoading: boolean;
  craftSimChecked: Set<string>;
  toggleCraftSimNode: (key: string) => void;
  itemIcons: Record<number, string>;
  formatGil: (n: number) => string;
  gilUnit: (n: number) => string;
}

export function CraftSimDialog({
  open,
  onOpenChange,
  craftSimItemId,
  itemNames,
  craftSimData,
  craftSimLoading,
  craftSimChecked,
  toggleCraftSimNode,
  itemIcons,
  formatGil,
  gilUnit,
}: CraftSimDialogProps) {
  const total = useMemo(() => {
    if (!craftSimData) return 0;
    let sum = 0;
    const walk = (nodes: CraftSimNodeData[], prefix: string) => {
      nodes.forEach((n, i) => {
        const key = prefix ? `${prefix}-${i}` : String(i);
        const checked = craftSimChecked.has(key);
        if (checked) {
          if (n.isCraftable && n.craftCost > 0) {
            sum += (n.craftCost / (n.amountResult || 1)) * n.amount;
          }
        } else {
          sum += n.buyPrice * n.amount;
        }
        if (
          checked &&
          n.children &&
          n.children.length > 0 &&
          !(n.isCraftable && n.craftCost > 0)
        ) {
          walk(n.children, key);
        }
      });
    };
    walk(craftSimData.tree as CraftSimNodeData[], "");
    return sum;
  }, [craftSimData, craftSimChecked]);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onOpenChange(false)}
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
                    {formatGil(Math.round(total))} {gilUnit(Math.round(total))}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Sell price: </span>
                  <span className="text-green-600 dark:text-green-400 font-medium">
                    {formatGil(craftSimData.sellPrice)}{" "}
                    {gilUnit(craftSimData.sellPrice)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Profit: </span>
                  <span
                    className={
                      craftSimData.sellPrice - total >= 0
                        ? "text-green-600 dark:text-green-400 font-medium"
                        : "text-red-600 dark:text-red-400 font-medium"
                    }
                  >
                    {formatGil(Math.round(craftSimData.sellPrice - total))}{" "}
                    {gilUnit(Math.round(craftSimData.sellPrice - total))}
                  </span>
                </div>
                {total > 0 && (
                  <div>
                    <span className="text-muted-foreground">Margin: </span>
                    <span>
                      {(
                        ((craftSimData.sellPrice - total) / total) *
                        100
                      ).toFixed(1)}
                      %
                    </span>
                  </div>
                )}
              </div>
              <div className="space-y-1">
                {craftSimData.tree.map((node, i) => (
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
  );
}
