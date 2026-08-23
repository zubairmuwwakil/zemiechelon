"use client";

import React, { useEffect, useRef } from "react";
import { PickMeConsole } from "./PickMeConsole";
import type { CosmicMode } from "@/components/world/DayNightController";

/**
 * The console, switched on.
 *
 * Spec §3.1: the console is a thing you approach and switch on, not a sidebar
 * that appears. The approaching happens in the scene — it stands at the point
 * the camera orbits, and the visitor walks around it — and this is what
 * switching it on looks like.
 *
 * It is deliberately not `LandedConsolePanel`. That one is scoped to a planet,
 * carries every arm's content, and slides in from the edge because it *is* the
 * drawer §3.1 replaces; it survives as the narrow-viewport and reduced-motion
 * fallback and nothing more. This opens in front of the visitor, at the thing
 * they switched on, and holds one console: the one this ground has evidence for.
 */

/** Which console each id renders. One entry, and the registry says why. */
const CONSOLES: Record<string, (isDay: boolean) => React.ReactNode> = {
  pickme: (isDay) => <PickMeConsole isDay={isDay} />,
};

interface SurfaceConsolePanelProps {
  /** The console to render, or null when nothing is switched on. */
  consoleId: string | null;
  cosmicMode?: CosmicMode;
  onClose: () => void;
}

export function SurfaceConsolePanel({
  consoleId,
  cosmicMode = "day",
  onClose,
}: SurfaceConsolePanelProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  // Escape switches it off, the same key that leaves every other depth.
  useEffect(() => {
    if (!consoleId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Stopped here so the surface below does not also read it and ascend:
      // switching the console off and leaving the moon are different acts.
      e.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [consoleId, onClose]);

  // Focus moves to the panel on open, or a keyboard visitor is left standing
  // outside the thing they just switched on.
  useEffect(() => {
    if (consoleId) closeRef.current?.focus();
  }, [consoleId]);

  if (!consoleId) return null;
  const render = CONSOLES[consoleId];
  if (!render) return null;

  const isDay = cosmicMode === "day";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Console"
      className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center p-4 sm:p-8"
    >
      <div
        className={`absolute inset-0 backdrop-blur-sm ${isDay ? "bg-zinc-900/20" : "bg-black/50"}`}
        onClick={onClose}
        aria-hidden
      />
      <div
        className={`relative flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-2xl border shadow-2xl ${
          isDay
            ? "border-zinc-200 bg-white/95 text-zinc-900"
            : "border-white/10 bg-zinc-950/95 text-zinc-100"
        }`}
      >
        <div
          className={`flex items-center justify-between gap-4 border-b px-5 py-3 ${
            isDay ? "border-zinc-200" : "border-white/10"
          }`}
        >
          <span className="text-xs font-semibold uppercase tracking-[0.14em] opacity-60">
            Console
          </span>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Switch off the console"
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 ${
              isDay
                ? "border-zinc-300 hover:bg-zinc-100"
                : "border-white/15 hover:bg-white/10"
            }`}
          >
            Switch off
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{render(isDay)}</div>
      </div>
    </div>
  );
}
