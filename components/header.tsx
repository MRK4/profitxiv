"use client";

import { useState } from "react";
import { Github, Info, Moon, Star, Sun } from "lucide-react";
import Image from "next/image";
import { useTheme } from "next-themes";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const GITHUB_REPO = "https://github.com/MRK4/profitxiv";
const DISCORD_NAME = "_mrk";

interface HeaderProps {
  githubStars: number | null;
}

export function Header({ githubStars }: HeaderProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [infoOpen, setInfoOpen] = useState(false);

  return (
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
      <div className="flex items-center gap-1">
        <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                  aria-label="About"
                >
                  <Info className="size-5" />
                </button>
              </DialogTrigger>
            </TooltipTrigger>
            <TooltipContent>About</TooltipContent>
          </Tooltip>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-mono">About ProfitXIV</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-3 font-mono text-sm">
              <div>
                <span className="text-muted-foreground">GitHub repository:</span>{" "}
                <a
                  href={GITHUB_REPO}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {GITHUB_REPO}
                </a>
              </div>
              <div>
                <span className="text-muted-foreground">Discord:</span>{" "}
                {DISCORD_NAME}
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() =>
                setTheme(resolvedTheme === "dark" ? "light" : "dark")
              }
              className="flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label={
                resolvedTheme === "dark"
                  ? "Switch to light mode"
                  : "Switch to dark mode"
              }
            >
              {resolvedTheme === "dark" ? (
                <Sun className="size-5" />
              ) : (
                <Moon className="size-5" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent>
            {resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
          </TooltipContent>
        </Tooltip>
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
    </div>
  );
}
