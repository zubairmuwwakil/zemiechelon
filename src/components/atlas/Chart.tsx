"use client";

import { useMemo } from "react";
import type { Body, ScreenPoint } from "@/lib/atlas/types";
import { loadBodies } from "@/lib/atlas/bodies";
import { magnitude } from "@/lib/atlas/magnitude";

export interface ChartProps {
  bodies?: Body[];
  points: ScreenPoint[];
  selectedId: string | null;
  onSelect: (bodyId: string) => void;
  cameraDistance?: number;
}

const COLLISION_RADIUS = 40; // px

/**
 * Zoom threshold: zoomed out (distance ~400), threshold is ~3.5 so only systems stay visible.
 * Zoomed in (distance <= 40), threshold is 0 so all bodies are visible.
 */
function getMagnitudeThreshold(cameraDistance: number): number {
  if (cameraDistance <= 40) return 0;
  const t = Math.max(0, Math.min(1, (cameraDistance - 40) / 360));
  return t * 3.5;
}

export function Chart({
  bodies: propBodies,
  points,
  selectedId,
  onSelect,
  cameraDistance = 58,
}: ChartProps) {
  const bodies = useMemo(() => propBodies ?? loadBodies(), [propBodies]);
  const bodyMap = useMemo(() => new Map(bodies.map((b) => [b.id, b])), [bodies]);

  const visibleLabels = useMemo(() => {
    const threshold = getMagnitudeThreshold(cameraDistance);

    // 1. Gather all non-anonymous, visible candidate points
    const candidates: Array<{
      body: Body;
      point: ScreenPoint;
      mag: number;
    }> = [];

    for (const point of points) {
      if (!point.visible) continue;
      const body = bodyMap.get(point.id);
      if (!body || body.anonymous) continue;

      const mag = magnitude(body);
      // Systems always pass the threshold, or magnitude >= threshold
      if (body.kind === "system" || mag >= threshold) {
        candidates.push({ body, point, mag });
      }
    }

    // 2. Sort candidates descending by magnitude so flagships/systems are placed first
    candidates.sort((a, b) => {
      if (b.mag !== a.mag) return b.mag - a.mag;
      return a.body.id.localeCompare(b.body.id);
    });

    // 3. Collision resolution: drop points within COLLISION_RADIUS of an already placed label
    const placed: Array<{ x: number; y: number }> = [];
    const result: Array<{
      body: Body;
      point: ScreenPoint;
      mag: number;
    }> = [];

    for (const cand of candidates) {
      const collides = placed.some(
        (p) => Math.hypot(p.x - cand.point.x, p.y - cand.point.y) < COLLISION_RADIUS
      );
      if (!collides) {
        placed.push({ x: cand.point.x, y: cand.point.y });
        result.push(cand);
      }
    }

    return result;
  }, [bodyMap, points, cameraDistance]);

  // `isolate` gives this layer its own stacking context. The per-label z-indexes
  // below run into the thousands to depth-sort the chart against itself; without
  // containment they would also paint over the HUD and the modals, which sit in
  // the tens.
  return (
    <div
      role="region"
      aria-label="Zemí Atlas chart"
      className="pointer-events-none absolute inset-0 overflow-hidden isolate"
    >
      {visibleLabels.map(({ body, point }) => {
        const isSelected = selectedId === body.id;
        const isSystem = body.kind === "system";

        return (
          <div
            key={body.id}
            style={{
              transform: `translate3d(${point.x}px, ${point.y}px, 0) translate(-50%, -100%)`,
              zIndex: Math.round((10 - point.depth) * 1000),
            }}
            className="pointer-events-auto absolute transition-transform duration-75 ease-out"
          >
            {/* eslint-disable-next-line jsx-a11y/role-supports-aria-props */}
            <button
              type="button"
              onClick={() => onSelect(body.id)}
              aria-pressed={isSelected}
              aria-description={
                isSystem
                  ? `System with ${body.satellites?.length ?? 0} satellites`
                  : undefined
              }
              style={{ minHeight: "24px", minWidth: "24px" }}
              className={`group inline-flex min-h-6 min-w-6 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold tracking-tight shadow-sm backdrop-blur-md transition-all duration-150 hover:scale-105 active:scale-95 ${
                isSelected
                  ? "bg-zinc-900 text-white ring-2 ring-zinc-900 ring-offset-2"
                  : "border border-zinc-300/80 bg-white/90 text-zinc-900 hover:bg-white hover:shadow-md"
              }`}
            >
              {isSystem && (
                <span
                  className={`size-1.5 rounded-full ${
                    isSelected ? "bg-amber-400" : "bg-amber-500"
                  }`}
                  aria-hidden="true"
                />
              )}
              <span>{body.label}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
