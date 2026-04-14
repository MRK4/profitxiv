"use client";

import { useEffect, useMemo, useState } from "react";
import { Github, Moon, Star, Sun } from "lucide-react";
import Image from "next/image";
import { useTheme } from "next-themes";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { BrailleSpinner } from "@/components/braille-spinner";

interface HeaderProps {
  githubStars: number | null;
  statusText?: string | null;
  statusLoading?: boolean;
}

interface StatusTickerProps {
  text?: string | null;
  loading?: boolean;
}

function StatusTicker({ text, loading }: StatusTickerProps) {
  const [current, setCurrent] = useState<string | null>(text ?? null);
  const [previous, setPrevious] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "out" | "in">("idle");
  const [key, setKey] = useState(0);

  const displayText = useMemo(() => text?.trim() || null, [text]);

  useEffect(() => {
    if (displayText === current) return;
    // Pas de texte => on efface simplement sans animation complexe
    if (!displayText) {
      setPrevious(current);
      setPhase("out");
      const timeout = setTimeout(() => {
        setCurrent(null);
        setPrevious(null);
        setPhase("idle");
      }, 200);
      return () => clearTimeout(timeout);
    }

    setPrevious(current);
    setPhase("out");
    const timeout = setTimeout(() => {
      setCurrent(displayText);
      setPhase("in");
      setKey((k) => k + 1);
      const timeoutIn = setTimeout(() => {
        setPrevious(null);
        setPhase("idle");
      }, 220);
      return () => clearTimeout(timeoutIn);
    }, 200);

    return () => clearTimeout(timeout);
  }, [displayText, current]);

  if (!current && !previous) return null;

  return (
    <span
      className="status-flip-container hidden items-center gap-1 text-[11px] sm:inline-flex sm:text-xs text-muted-foreground"
      aria-live="polite"
    >
      {loading && (
        <BrailleSpinner name="braille">
          <span className="sr-only">Market status</span>
        </BrailleSpinner>
      )}
      <span className="relative overflow-hidden leading-tight">
        {previous && (
          <span className="status-flip-item status-flip-out">
            {previous}
          </span>
        )}
        {current && (
          <span
            key={key}
            className={`status-flip-item ${
              phase === "in" ? "status-flip-in" : ""
            }`}
          >
            {current}
          </span>
        )}
      </span>
    </span>
  );
}

export function Header({ githubStars, statusText, statusLoading }: HeaderProps) {
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
        <span className="flex items-center gap-2">
          <span>ProfitXIV</span>
          <StatusTicker text={statusText} loading={statusLoading} />
        </span>
      </h1>
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() =>
                setTheme(resolvedTheme === "dark" ? "light" : "dark")
              }
              className="flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
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
              href="https://github.com/clementpdr/profitxiv"
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
