"use client";

import { useState } from "react";
import type { CosmicMode } from "../world/DayNightController";
import { sound } from "@/lib/audio";

interface InteractionHintsPillProps {
  cosmicMode: CosmicMode;
}

export function InteractionHintsPill({ cosmicMode }: InteractionHintsPillProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isDay = cosmicMode === "day";

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-20 flex justify-center p-3 select-none">
      <button
        onClick={() => {
          sound.playClick(600, 0.04);
          setIsExpanded((prev) => !prev);
        }}
        className={`pointer-events-auto flex items-center gap-2 rounded-full px-4 py-2 text-xs transition-all duration-300 hover:scale-103 active:scale-95 border ${
          isDay
            ? "glass-pill-day text-zinc-700 hover:text-zinc-900"
            : "glass-pill-night text-zinc-300 hover:text-white"
        }`}
        title="Click to toggle interaction tips"
      >
        <span className="font-semibold">Interaction Hints</span>
        {isExpanded ? (
          <span className="font-mono text-[11px] text-zinc-500 pl-1 border-l border-zinc-300 dark:border-white/10">
            Drag to orbit &middot; Scroll to zoom &middot; Click planet to land
          </span>
        ) : (
          <span className="size-2 rounded-full bg-amber-400/80 animate-pulse" />
        )}
      </button>
    </div>
  );
}
