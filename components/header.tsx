"use client";

import { Github, Moon, Star, Sun } from "lucide-react";
import Image from "next/image";
import { useTheme } from "next-themes";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface HeaderProps {
  githubStars: number | null;
}

export function Header({ githubStars }: HeaderProps) {
  const { resolvedTheme, setTheme } = useTheme();

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
