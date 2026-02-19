"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

export interface CompareWorldData {
  worldName: string;
  minPrice: number;
  currentAveragePrice: number;
  listingsCount: number;
}

export interface CompareData {
  worlds: CompareWorldData[];
  itemId: number;
}

interface DataCenterWithWorlds {
  name: string;
  region: string;
  worlds: string[];
}

interface CompareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  compareItemId: number | null;
  itemNames: Record<number, string>;
  compareData: CompareData | null;
  compareLoading: boolean;
  compareDataCenter: string;
  onDataCenterChange: (dataCenter: string) => void;
  dataCenters: DataCenterWithWorlds[];
  formatGil: (n: number) => string;
  gilUnit: (n: number) => string;
}

export function CompareDialog({
  open,
  onOpenChange,
  compareItemId,
  itemNames,
  compareData,
  compareLoading,
  compareDataCenter,
  onDataCenterChange,
  dataCenters,
  formatGil,
  gilUnit,
}: CompareDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onOpenChange(false)}
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
              onValueChange={onDataCenterChange}
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
                    {formatGil(compareData.worlds[0].minPrice)}{" "}
                    {gilUnit(compareData.worlds[0].minPrice)}
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
                          {formatGil(Math.round(w.currentAveragePrice))}{" "}
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
  );
}
