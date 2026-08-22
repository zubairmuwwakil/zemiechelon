"use client";

import React from "react";
import type { Body, ScreenPoint } from "@/lib/atlas/types";
import { sound } from "@/lib/audio";
import { ARM_META } from "@/data/arms";
import { loadBodies } from "@/lib/atlas/bodies";
import { derivePlanetAnnotation } from "@/lib/atlas/derivedFigures";
import { DIRECTION_A } from "@/lib/theme/directionA";
import type { CosmicMode } from "./DayNightController";

/**
 * The pin is the only thing on screen a visitor can compare a planet against,
 * so its dot has to be the planet's own colour. This used to hold a third copy
 * of the palette — bg-sky-500, bg-purple-500, bg-rose-500 — which meant
 * restating `ARM_META.themeColor` against Direction A changed nothing anyone
 * could see. Labels come from `ARM_META` for the same reason.
 *
 * The core is not an arm, so it is the one entry here.
 */
const CORE_PIN = { label: "Nodes", color: DIRECTION_A.gold } as const;

function pinFor(id: string): { label: string; color: string } | null {
  if (id === "galaxy") return CORE_PIN;
  const arm = ARM_META[id];
  return arm ? { label: arm.shortName, color: arm.themeColor } : null;
}

interface PlanetPinsOverlayProps {
  points: ScreenPoint[];
  activePreset: string;
  cosmicMode?: CosmicMode;
  bodies?: Body[];
  onSelectPlanet: (id: string) => void;
  onHoverPlanet?: (id: string | null) => void;
}

export function PlanetPinsOverlay({
  points,
  activePreset,
  cosmicMode = "day",
  bodies = loadBodies(),
  onSelectPlanet,
  onHoverPlanet,
}: PlanetPinsOverlayProps) {
  // Only show planetary labels in Macro Galaxy / Overview view
  const isGalaxyView = activePreset === "galaxy" || activePreset === "overview";
  if (!isGalaxyView) return null;

  const isDay = cosmicMode === "day";

  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden select-none">
      {points.map((pt) => {
        const pin = pinFor(pt.id);
        if (!pin) return null;

        const annotation = derivePlanetAnnotation(pt.id, bodies);
        const accessibleName = `${annotation.title}: ${annotation.subtitle}`;

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
              onMouseEnter={() => onHoverPlanet?.(pt.id)}
              onMouseLeave={() => onHoverPlanet?.(null)}
              onFocus={() => onHoverPlanet?.(pt.id)}
              onBlur={() => onHoverPlanet?.(null)}
              aria-label={accessibleName}
              title={accessibleName}
              className={`group flex items-center gap-1.5 rounded-full px-3 py-1 shadow-lg backdrop-blur-md transition-all duration-200 hover:scale-108 active:scale-95 border focus-visible:outline focus-visible:outline-2 ${
                isDay
                  ? "border-zinc-200/80 bg-white/92 text-zinc-900 shadow-zinc-900/5 hover:bg-white"
                  : "border-white/15 bg-zinc-900/85 text-zinc-100 shadow-black/50 hover:bg-zinc-800"
              }`}
            >
              <span className="text-xs font-semibold tracking-tight">{pin.label}</span>
              <span
                className="size-1.5 rounded-full"
                style={{ backgroundColor: pin.color }}
              />
            </button>
          </div>
        );
      })}
    </div>
  );
}

