"use client";

import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface DataCenterWithWorlds {
  name: string;
  region: string;
  worlds: string[];
}

export default function Home() {
  const [dataCenters, setDataCenters] = useState<DataCenterWithWorlds[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDataCenter, setSelectedDataCenter] = useState<string>("");
  const [selectedWorld, setSelectedWorld] = useState<string>("");

  const selectedDC = dataCenters.find((dc) => dc.name === selectedDataCenter);
  const worlds = selectedDC?.worlds ?? [];

  useEffect(() => {
    fetch("/api/universalis/regions")
      .then((res) => res.json())
      .then((data) => {
        setDataCenters(data.dataCenters ?? []);
      })
      .catch(() => setDataCenters([]))
      .finally(() => setLoading(false));
  }, []);

  const handleDataCenterChange = (value: string) => {
    setSelectedDataCenter(value);
    setSelectedWorld("");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background font-sans">
      <main className="flex w-full max-w-md flex-col gap-8 p-8">
        <h1 className="font-mono text-2xl font-bold tracking-tight">
          ProfitXIV
        </h1>

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
              onValueChange={setSelectedWorld}
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

        <Button
          disabled={!selectedDataCenter || !selectedWorld}
          className="w-full font-mono sm:w-auto"
        >
          <Search className="size-4" />
          Search
        </Button>
      </main>
    </div>
  );
}
