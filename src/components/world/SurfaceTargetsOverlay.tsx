"use client";

import React from "react";
import type { SurfaceTargetPoint } from "./WorldCanvas";
import type { CosmicMode } from "./DayNightController";
import { sound } from "@/lib/audio";

/**
 * Real controls for the things standing on a surface.
 *
 * Spec §6 asks that props, the orrery and the console be focusable with
 * accessible names. Nothing drawn inside a canvas is reachable by keyboard on
 * its own — the planets already solved this by projecting to DOM buttons, and
 * this is the same answer one frame further in.
 *
 * It fixes pointing as well as keyboard access. These are the same sub-fingertip
 * targets the moons were before they got hit proxies: an orrery bead is a few
 * pixels across, and a real button over it is a larger target that also says
 * what it is.
 *
 * The three kinds do not look alike, because they are not the same act. A prop
 * is something to read about, a bead on the orrery is a departure, and the
 * console is what the visitor travelled three frames to reach — so it is the
 * one control here that looks like a primary action.
 */

interface SurfaceTargetsOverlayProps {
  points: SurfaceTargetPoint[];
  cosmicMode?: CosmicMode;
  /** Open a body's card, or launch a flight to it. */
  onActivate: (bodyId: string) => void;
}

export function SurfaceTargetsOverlay({
  points,
  cosmicMode = "day",
  onActivate,
}: SurfaceTargetsOverlayProps) {
  if (points.length === 0) return null;
  const isDay = cosmicMode === "day";

  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden select-none">
      {points.map((pt) => {
        // Behind the camera or well off-screen: no control, so the tab order
        // never contains something the visitor cannot see.
        if (!pt.visible) return null;

        const isDeparture = pt.kind === "moon";
        const isConsole = pt.kind === "console";
        const accessibleName = isConsole
          ? "Switch on the console"
          : isDeparture
            ? `Travel to ${pt.label}`
            : `${pt.label} — open its card`;

        return (
          <div
            key={pt.id}
            style={{
              position: "absolute",
              left: `${pt.x}px`,
              top: `${pt.y}px`,
              transform: "translate(-50%, -100%) translateY(-8px)",
            }}
            className="pointer-events-auto"
          >
            <button
              onClick={() => {
                sound.playClick(isConsole ? 740 : isDeparture ? 660 : 520, 0.05);
                onActivate(pt.bodyId);
              }}
              aria-label={accessibleName}
              title={accessibleName}
              className={`group flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-tight shadow-sm backdrop-blur-md transition-all duration-200 hover:scale-105 active:scale-95 focus-visible:outline focus-visible:outline-2 ${
                isConsole
                  ? "border-transparent bg-zinc-900 px-3 py-1 text-white shadow-md hover:bg-zinc-800"
                  : isDay
                    ? "border-zinc-300/70 bg-white/85 text-zinc-800 hover:bg-white"
                    : "border-white/15 bg-zinc-900/80 text-zinc-100 hover:bg-zinc-800"
              }`}
            >
              <span>{isConsole ? "Switch on" : pt.label}</span>
              {isDeparture && (
                <span aria-hidden className="text-[9px] opacity-70">
                  ↗
                </span>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}
