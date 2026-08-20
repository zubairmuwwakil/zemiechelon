"use client";

import React from "react";
import type { ScreenPoint } from "@/lib/atlas/types";
import { sound } from "@/lib/audio";
import type { CosmicMode } from "./DayNightController";

interface PlanetPinData {
  id: string;
  label: string;
  dotColor: string;
}

const PLANET_METADATA: Record<string, PlanetPinData> = {
  galaxy: {
    id: "galaxy",
    label: "Nodes",
    dotColor: "bg-amber-500",
  },
  self: {
    id: "self",
    label: "Self",
    dotColor: "bg-emerald-500",
  },
  foundations: {
    id: "foundations",
    label: "Foundations",
    dotColor: "bg-sky-500",
  },
  products: {
    id: "products",
    label: "Products",
    dotColor: "bg-amber-500",
  },
  labs: {
    id: "labs",
    label: "Labs",
    dotColor: "bg-purple-500",
  },
  creative: {
    id: "creative",
    label: "Creative",
    dotColor: "bg-rose-500",
  },
};

interface PlanetPinsOverlayProps {
  points: ScreenPoint[];
  activePreset: string;
  cosmicMode?: CosmicMode;
  onSelectPlanet: (id: string) => void;
}

export function PlanetPinsOverlay({
  points,
  activePreset,
  cosmicMode = "day",
  onSelectPlanet,
}: PlanetPinsOverlayProps) {
  // Only show planetary labels in Macro Galaxy / Overview view
  const isGalaxyView = activePreset === "galaxy" || activePreset === "overview";
  if (!isGalaxyView) return null;

  const isDay = cosmicMode === "day";

  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden select-none">
      {points.map((pt) => {
        const meta = PLANET_METADATA[pt.id];
        if (!meta) return null;

        return (
          <div
            key={pt.id}
            style={{
              position: "absolute",
              left: `${pt.x}px`,
              top: `${pt.y}px`,
              transform: "translate(-50%, -100%) translateY(-10px)",
            }}
            className="pointer-events-auto transition-all duration-300 animate-in fade-in zoom-in-95"
          >
            <button
              onClick={() => {
                sound.playClick(600, 0.05);
                onSelectPlanet(pt.id);
              }}
              className={`group flex items-center gap-1.5 rounded-full px-3 py-1 shadow-lg backdrop-blur-md transition-all duration-200 hover:scale-108 active:scale-95 border ${
                isDay
                  ? "border-zinc-200/80 bg-white/92 text-zinc-900 shadow-zinc-900/5 hover:bg-white"
                  : "border-white/15 bg-zinc-900/85 text-zinc-100 shadow-black/50 hover:bg-zinc-800"
              }`}
            >
              <span className="text-xs font-semibold tracking-tight">{meta.label}</span>
              <span className={`size-1.5 rounded-full ${meta.dotColor}`} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
