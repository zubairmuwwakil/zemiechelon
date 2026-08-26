"use client";

import type { ScopeId } from "@/lib/atlas/types";
import { breadcrumbFor, type Position } from "@/lib/atlas/journey";
import { sound } from "@/lib/audio";
import type { CosmicMode } from "../world/DayNightController";

interface WorldBreadcrumbProps {
  position: Position;
  cosmicMode: CosmicMode;
  onGoTo: (scopeId: ScopeId) => void;
}

/**
 * Where the visitor is, as a trail they can walk back up.
 *
 * The trail is `breadcrumbFor`, which is `scopeChain` — deliberately not a
 * second ancestor walk that could drift from the one the camera and the URL
 * already agree on. This component decides nothing about the tree; it renders
 * a list and reports which crumb was activated.
 *
 * Hidden at the galaxy, where the trail is one segment long and says nothing
 * the header does not already say.
 */
export function WorldBreadcrumb({ position, cosmicMode, onGoTo }: WorldBreadcrumbProps) {
  const crumbs = breadcrumbFor(position);
  if (crumbs.length < 2) return null;

  const isDay = cosmicMode === "day";

  return (
    <nav
      aria-label="Where you are"
      className="pointer-events-none fixed left-3 top-20 z-30 flex max-w-[min(90vw,28rem)] select-none sm:left-5 sm:top-24"
    >
      <ol
        className={`pointer-events-auto flex flex-wrap items-center gap-x-1 gap-y-1 rounded-full border px-3 py-1.5 text-[11px] ${
          isDay ? "glass-pill-day text-zinc-700" : "glass-pill-night text-zinc-300"
        }`}
      >
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <li key={crumb.scopeId} className="flex items-center gap-1">
              {i > 0 && (
                <span aria-hidden className="text-zinc-400 dark:text-white/25">
                  ›
                </span>
              )}
              {isLast ? (
                // The place you already are is not a link to it.
                <span aria-current="location" className="font-semibold">
                  {crumb.label}
                </span>
              ) : (
                <button
                  onClick={() => {
                    sound.playClick(500, 0.05);
                    onGoTo(crumb.scopeId);
                  }}
                  className={`rounded-full px-1 transition-colors hover:underline ${
                    isDay ? "hover:text-zinc-900" : "hover:text-white"
                  }`}
                >
                  {crumb.label}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
