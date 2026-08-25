"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  Calendar,
  Clock,
  Compass,
  Disc,
  Layers,
  Orbit,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import type { Body } from "@/lib/atlas/types";
import { loadBodies } from "@/lib/atlas/bodies";
import { IDEALS, type Ideal } from "@/lib/atlas/ideals";
import { deriveLegendFigures } from "@/lib/atlas/derivedFigures";
import type { CosmicMode } from "@/components/world/DayNightController";
import { DIRECTION_A } from "@/lib/theme/directionA";

export interface LegendModalProps {
  isOpen: boolean;
  onClose: () => void;
  cosmicMode?: CosmicMode;
  bodies?: Body[];
  ideals?: Ideal[];
}

export function LegendModal({
  isOpen,
  onClose,
  cosmicMode = "day",
  bodies,
  ideals,
}: LegendModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  const resolvedBodies = useMemo(() => bodies ?? loadBodies(), [bodies]);
  const resolvedIdeals = useMemo(() => ideals ?? IDEALS, [ideals]);

  const figures = useMemo(
    () => deriveLegendFigures(resolvedBodies, undefined, resolvedIdeals),
    [resolvedBodies, resolvedIdeals],
  );

  useEffect(() => {
    if (!isOpen) return;

    // Save previously focused element to restore on close
    previousActiveElementRef.current = document.activeElement as HTMLElement | null;

    // Focus panel on open
    panelRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      // Restore focus on close
      previousActiveElementRef.current?.focus?.();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isDay = cosmicMode === "day";

  return (
    <div
      data-testid="legend-modal-backdrop"
      onClick={onClose}
      className="fixed inset-0 z-50 overflow-y-auto bg-zinc-900/40 backdrop-blur-md p-3 sm:p-6 lg:p-8 flex justify-center items-start sm:items-center animate-in fade-in duration-200"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="legend-modal-title"
        aria-describedby="legend-modal-description"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full max-w-4xl rounded-3xl border shadow-2xl space-y-6 sm:space-y-8 p-5 sm:p-8 lg:p-10 my-auto max-h-[90vh] overflow-y-auto focus:outline-hidden transition-colors ${
          isDay
            ? "border-zinc-200/90 bg-[#FAF9F6] text-zinc-900"
            : "border-zinc-800 bg-[#12141D] text-zinc-100"
        }`}
      >
        {/* Header: Title, Category pill, Close Button */}
        <div
          className={`flex items-start justify-between gap-4 border-b pb-5 ${
            isDay ? "border-zinc-200/80" : "border-zinc-800"
          }`}
        >
          <div className="space-y-1.5">
            <div
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-mono font-medium ${
                isDay
                  ? "border-amber-200 bg-amber-50/80 text-amber-800"
                  : "border-zinc-700 bg-zinc-900/80 text-amber-400"
              }`}
            >
              <Compass className="size-3.5" />
              <span>CELESTIAL ATLAS GRAMMAR &amp; LEGEND</span>
            </div>
            <h2
              id="legend-modal-title"
              className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${
                isDay ? "text-zinc-900" : "text-white"
              }`}
            >
              How The Map Explains Itself
            </h2>
            <p
              id="legend-modal-description"
              className={`text-xs sm:text-sm max-w-2xl leading-relaxed ${
                isDay ? "text-zinc-600" : "text-zinc-400"
              }`}
            >
              Every rule in the atlas is geometric and derived. No coordinate is authored by hand.
              The map derives its own scale, concentric rings, planetary masses, and citations directly
              from committed repository metadata.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close celestial atlas legend"
            className={`flex size-9 sm:size-10 items-center justify-center rounded-2xl border shadow-xs transition-colors shrink-0 ${
              isDay
                ? "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900"
                : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white"
            }`}
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Four Core Grammar Cards */}
        <div className="grid gap-4 sm:gap-6 sm:grid-cols-2">
          {/* Card 1: Distance is Time */}
          <div
            className={`rounded-2xl border p-5 sm:p-6 space-y-3.5 transition-all ${
              isDay
                ? "bg-white border-zinc-200/80 shadow-xs text-zinc-700"
                : "bg-zinc-900/60 border-zinc-800 text-zinc-300"
            }`}
          >
            <div
              className={`flex items-center gap-2.5 ${
                isDay ? "text-amber-800" : "text-amber-400"
              }`}
            >
              <Clock className="size-4 shrink-0" />
              <h3 className="text-sm font-bold uppercase tracking-wider font-mono">
                Distance is Time
              </h3>
            </div>
            <div className="space-y-2 text-xs sm:text-sm leading-relaxed">
              <p>
                The galaxy spans{" "}
                <strong className={`font-bold ${isDay ? "text-zinc-950" : "text-white"}`}>
                  {figures.daySpan} days
                </strong>{" "}
                from the ancestral epoch ({figures.epoch}) at the core to the active frontier
                reach ({figures.worldRadius.toFixed(2)} layout units).
              </p>
              <div
                className={`rounded-xl border p-3 font-mono text-xs space-y-1 ${
                  isDay
                    ? "border-zinc-200/80 bg-[#F7F6F2] text-zinc-800"
                    : "border-zinc-800 bg-zinc-950/60 text-zinc-200"
                }`}
              >
                <div className={isDay ? "text-zinc-500" : "text-zinc-400"}>
                  Radial scale function:
                </div>
                <div className={`font-bold ${isDay ? "text-zinc-900" : "text-zinc-100"}`}>
                  {figures.radiusFormula}
                </div>
                <div
                  className={`text-[11px] pt-0.5 ${isDay ? "text-zinc-500" : "text-zinc-400"}`}
                >
                  Square root scaling prevents dense recent work from bunching into a hairline rim.
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Astrolabe Month & Quarter Rings */}
          <div
            className={`rounded-2xl border p-5 sm:p-6 space-y-3.5 transition-all ${
              isDay
                ? "bg-white border-zinc-200/80 shadow-xs text-zinc-700"
                : "bg-zinc-900/60 border-zinc-800 text-zinc-300"
            }`}
          >
            <div
              className={`flex items-center gap-2.5 ${
                isDay ? "text-amber-800" : "text-amber-400"
              }`}
            >
              <Disc className="size-4 shrink-0" />
              <h3 className="text-sm font-bold uppercase tracking-wider font-mono">
                Astrolabe Graticule Rings
              </h3>
            </div>
            <div className="space-y-2 text-xs sm:text-sm leading-relaxed">
              <p>
                The concentric graticule lines are month boundaries:{" "}
                <strong className={`font-bold ${isDay ? "text-zinc-950" : "text-white"}`}>
                  {figures.astrolabe.monthRingCount} month rings
                </strong>{" "}
                spaced at {figures.astrolabe.daysPerMonth}-day intervals under the galaxy radius.
              </p>
              <p>
                Every third ring is drawn heavier (
                <strong className={`font-bold ${isDay ? "text-zinc-950" : "text-white"}`}>
                  {figures.astrolabe.quarterRingCount} quarterly rings
                </strong>
                ) to delineate seasons of engineering work. The outermost ring marks the frontier.
              </p>
            </div>
          </div>

          {/* Card 3: Celestial Taxonomy (Gold vs Verdigris) */}
          <div
            className={`rounded-2xl border p-5 sm:p-6 space-y-3.5 transition-all ${
              isDay
                ? "bg-white border-zinc-200/80 shadow-xs text-zinc-700"
                : "bg-zinc-900/60 border-zinc-800 text-zinc-300"
            }`}
          >
            <div
              className={`flex items-center gap-2.5 ${
                isDay ? "text-amber-800" : "text-amber-400"
              }`}
            >
              <Sparkles className="size-4 shrink-0" />
              <h3 className="text-sm font-bold uppercase tracking-wider font-mono">
                Celestial Body Taxonomy
              </h3>
            </div>
            <div className="space-y-2.5 text-xs sm:text-sm leading-relaxed">
              <p>
                <strong className={`font-bold ${isDay ? "text-zinc-950" : "text-white"}`}>
                  {figures.totalBodies} total repositories
                </strong>{" "}
                charted across {figures.armCount} galactic arms:
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span
                    className="size-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: DIRECTION_A.gold }}
                  />
                  <span>
                    <strong className={`font-semibold ${isDay ? "text-zinc-900" : "text-zinc-100"}`}>
                      {figures.shippedMoonsCount} Gold Dots
                    </strong>{" "}
                    · Shipped moons and production ventures.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="size-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: DIRECTION_A.verdigris }}
                  />
                  <span>
                    <strong className={`font-semibold ${isDay ? "text-zinc-900" : "text-zinc-100"}`}>
                      {figures.learnedDwarfPlanetsCount} Verdigris Dots
                    </strong>{" "}
                    · Dwarf planets: learned supporting repositories, libraries and tools.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 4: Planetary Mass & Orbiting Moons */}
          <div
            className={`rounded-2xl border p-5 sm:p-6 space-y-3.5 transition-all ${
              isDay
                ? "bg-white border-zinc-200/80 shadow-xs text-zinc-700"
                : "bg-zinc-900/60 border-zinc-800 text-zinc-300"
            }`}
          >
            <div
              className={`flex items-center gap-2.5 ${
                isDay ? "text-amber-800" : "text-amber-400"
              }`}
            >
              <Orbit className="size-4 shrink-0" />
              <h3 className="text-sm font-bold uppercase tracking-wider font-mono">
                Planetary Mass &amp; Moons
              </h3>
            </div>
            <div className="space-y-2 text-xs sm:text-sm leading-relaxed">
              <p>
                Planet radius comes from what its arm holds (weighted by moon magnitude), not flat
                count.{" "}
                <strong className={`font-bold ${isDay ? "text-zinc-950" : "text-white"}`}>
                  {figures.products.name}
                </strong>{" "}
                is largest ({figures.products.planetRadius.toFixed(2)} layout radius) holding{" "}
                {figures.products.total} repositories ({figures.products.shipped} shipped moons,{" "}
                {figures.products.dwarfPlanets} supporting dwarf planets).
              </p>
              <p>
                <strong className={`font-bold ${isDay ? "text-zinc-950" : "text-white"}`}>
                  {figures.totalMoons} Moons
                </strong>{" "}
                orbit overhead: shipped moons orbit their arm&apos;s planet, while supporting dwarf
                planets remain on the arm ground.
              </p>
            </div>
          </div>
        </div>

        {/* Ideals Ring & Citation Invariant Alert */}
        <div
          className={`rounded-2xl border p-5 sm:p-6 space-y-3 ${
            isDay
              ? "border-amber-200/80 bg-amber-50/60 text-amber-950"
              : "border-amber-900/50 bg-amber-950/20 text-amber-200"
          }`}
        >
          <div
            className={`flex items-center gap-2 font-bold text-xs sm:text-sm font-mono uppercase tracking-wider ${
              isDay ? "text-amber-900" : "text-amber-300"
            }`}
          >
            <ShieldCheck className="size-4 shrink-0" />
            <span>Ideals &amp; Evidence Rings — Build Gate Invariant</span>
          </div>
          <p
            className={`text-xs sm:text-sm leading-relaxed ${
              isDay ? "text-zinc-700" : "text-zinc-300"
            }`}
          >
            A gold ring circling a planet represents an architectural ideal (
            <strong className={`font-semibold ${isDay ? "text-zinc-900" : "text-zinc-100"}`}>
              {figures.totalIdeals} active claim
            </strong>
            ). Every cited repository (
            <span
              className={`font-mono font-semibold ${isDay ? "text-amber-900" : "text-amber-300"}`}
            >
              {figures.citedRepositoryIds.join(", ")}
            </span>
            ) must resolve at build time via{" "}
            <code
              className={`rounded-md px-1.5 py-0.5 font-mono text-[11px] border ${
                isDay
                  ? "bg-white/80 border-amber-200 text-zinc-900"
                  : "bg-zinc-900/80 border-amber-800 text-zinc-100"
              }`}
            >
              validateIdeals()
            </code>{" "}
            or the build fails. No claim exists without verified evidence.
          </p>
        </div>

        {/* Arms Breakdown Table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3
              className={`text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                isDay ? "text-zinc-600" : "text-zinc-400"
              }`}
            >
              <Layers className="size-3.5" />
              <span>Galactic Arms &amp; Holdings Summary ({figures.armCount} Arms)</span>
            </h3>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-5">
            {figures.arms.map((arm) => (
              <div
                key={arm.id}
                className={`rounded-xl border p-3.5 space-y-2 transition-all ${
                  isDay
                    ? "bg-white border-zinc-200/80 shadow-2xs text-zinc-700"
                    : "bg-zinc-900/40 border-zinc-800 text-zinc-300"
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span
                    className={`font-bold text-xs ${
                      isDay ? "text-zinc-900" : "text-zinc-100"
                    }`}
                  >
                    {arm.name}
                  </span>
                  <span
                    className="size-2 rounded-full shrink-0"
                    style={{ backgroundColor: arm.themeColor }}
                  />
                </div>
                <div
                  className={`space-y-1 font-mono text-[11px] ${
                    isDay ? "text-zinc-600" : "text-zinc-400"
                  }`}
                >
                  <div className="flex justify-between">
                    <span>Bodies:</span>
                    <span
                      className={`font-semibold ${
                        isDay ? "text-zinc-900" : "text-zinc-100"
                      }`}
                    >
                      {arm.bodyCount}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Shipped:</span>
                    <span
                      className={`font-semibold ${
                        isDay ? "text-amber-700" : "text-amber-400"
                      }`}
                    >
                      {arm.shippedCount}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Learned:</span>
                    <span
                      className={`font-semibold ${
                        isDay ? "text-emerald-700" : "text-emerald-400"
                      }`}
                    >
                      {arm.dwarfPlanetCount}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Moons:</span>
                    <span
                      className={`font-semibold ${
                        isDay ? "text-zinc-900" : "text-zinc-100"
                      }`}
                    >
                      {arm.moonCount}
                    </span>
                  </div>
                  <div
                    className={`flex justify-between pt-1 border-t ${
                      isDay ? "border-zinc-100" : "border-zinc-800/80"
                    }`}
                  >
                    <span>Radius:</span>
                    <span
                      className={`font-semibold ${
                        isDay ? "text-zinc-900" : "text-zinc-100"
                      }`}
                    >
                      {arm.planetRadius.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer info pill */}
        <div
          className={`flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-[11px] font-mono border-t ${
            isDay ? "text-zinc-600 border-zinc-200/80" : "text-zinc-400 border-zinc-800"
          }`}
        >
          <div className="flex items-center gap-1.5">
            <Calendar className="size-3.5" />
            <span>
              Epoch: {figures.epoch} · Reach: {figures.worldRadius.toFixed(3)} layout units
            </span>
          </div>
          <div>Press ESC or click outside to dismiss</div>
        </div>
      </div>
    </div>
  );
}
