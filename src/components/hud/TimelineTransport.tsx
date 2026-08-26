"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Pause, Play } from "lucide-react";
import type { Body } from "@/lib/atlas/types";
import { deriveDaySpan, deriveTimelineMilestones } from "@/lib/atlas/derivedFigures";
import {
  DEFAULT_TIMELINE_SPEED,
  TIMELINE_SPEEDS,
  advanceClockDay,
  dateAtDay,
  visibleBodyIds,
  type TimelineSpeed,
} from "@/lib/atlas/timeline";
import { SOLAR_SYSTEM_ZEMI } from "@/lib/atlas/scopes";
import type { CosmicMode } from "@/components/world/DayNightController";
import { sound } from "@/lib/audio";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void): () => void {
  const mql = window.matchMedia(REDUCED_MOTION_QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

function getReducedMotionSnapshot(): boolean {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

/** `window` does not exist during server-side rendering. */
function getReducedMotionServerSnapshot(): boolean {
  return false;
}

export interface TimelineTransportProps {
  bodies: Body[];
  cosmicMode: CosmicMode;
  /** Fires on every clock change — scrub, play tick, or a reduced-motion jump. */
  onClockDayChange: (date: string) => void;
}

/**
 * Play, pause, scrub and speed for the galaxy's own clock (§3.8). Owns its
 * playback state entirely — scrubbing stays in days internally, over the
 * atlas's own span, but the caller only ever learns the resulting calendar
 * date, which is what `WorldCanvas` filters the map by.
 */
export function TimelineTransport({ bodies, cosmicMode, onClockDayChange }: TimelineTransportProps) {
  const isDay = cosmicMode === "day";
  const daySpan = useMemo(() => deriveDaySpan(bodies), [bodies]);
  const milestones = useMemo(() => deriveTimelineMilestones(bodies), [bodies]);

  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  );
  const [clockDay, setClockDay] = useState(daySpan);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<TimelineSpeed>(DEFAULT_TIMELINE_SPEED);

  useEffect(() => {
    onClockDayChange(dateAtDay(clockDay, SOLAR_SYSTEM_ZEMI.epoch));
    // Only the clock's own value should re-fire this — `onClockDayChange`
    // identity is the caller's business, not a reason to re-announce.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clockDay]);

  // Autoplay. A dedicated effect per §3.8's accessibility rule: under reduced
  // motion this never runs at all — scrubbing still works, but play does not
  // animate; it jumps straight to the end instead (`handleTogglePlay` below).
  // Both state updates below happen inside the rAF callback, not the effect
  // body itself, so stopping at the frontier never fires during render.
  useEffect(() => {
    if (!playing || reducedMotion) return;
    let raf: number;
    let last = performance.now();
    const tick = (now: number) => {
      const elapsed = (now - last) / 1000;
      last = now;
      let reachedEnd = false;
      setClockDay((day) => {
        const next = advanceClockDay(day, elapsed, speed, daySpan);
        reachedEnd = next >= daySpan;
        return next;
      });
      if (reachedEnd) {
        setPlaying(false);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, reducedMotion, speed, daySpan]);

  const visibleCount = useMemo(
    () => visibleBodyIds(bodies, clockDay).size,
    [bodies, clockDay],
  );
  const currentDate = dateAtDay(clockDay, SOLAR_SYSTEM_ZEMI.epoch);

  const handleTogglePlay = () => {
    sound.playClick(500, 0.05);
    if (reducedMotion) {
      setClockDay(daySpan);
      return;
    }
    // Pressing play at the frontier replays from the epoch — otherwise there
    // is nothing left to advance, and the button would silently do nothing.
    if (!playing && clockDay >= daySpan) setClockDay(0);
    setPlaying((p) => !p);
  };

  const c = {
    bar: isDay ? "glass-pill-day text-zinc-700" : "glass-pill-night text-zinc-300",
    strong: isDay ? "text-zinc-900" : "text-zinc-50",
    muted: isDay ? "text-zinc-500" : "text-zinc-400",
    track: isDay ? "bg-zinc-200/80" : "bg-zinc-800/80",
    tick: isDay ? "bg-amber-600/70" : "bg-amber-400/70",
    button: isDay
      ? "bg-zinc-900 text-white hover:bg-zinc-700"
      : "bg-white text-zinc-900 hover:bg-zinc-200",
    select: isDay
      ? "border-zinc-200 bg-white text-zinc-700"
      : "border-zinc-700 bg-zinc-900 text-zinc-200",
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-20 flex justify-center px-4 select-none">
      <div
        className={`pointer-events-auto flex w-full max-w-xl flex-col gap-2 rounded-2xl border px-4 py-3 text-xs shadow-lg backdrop-blur-md ${c.bar}`}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleTogglePlay}
            aria-label={playing ? "Pause timeline" : "Play timeline"}
            className={`flex size-8 shrink-0 items-center justify-center rounded-full transition-colors ${c.button}`}
          >
            {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5 pl-0.5" />}
          </button>

          <div className="relative flex-1 pt-1">
            <input
              type="range"
              aria-label="Timeline"
              min={0}
              max={daySpan}
              step={1}
              value={clockDay}
              onChange={(e) => setClockDay(Number(e.target.value))}
              className="w-full accent-amber-600"
            />
            {milestones.map((m) => (
              <span
                key={m.id}
                aria-hidden
                title={`${m.title} — ${m.date}`}
                className={`pointer-events-none absolute top-1 h-3 w-px ${c.tick}`}
                style={{ left: `${(m.day / daySpan) * 100}%` }}
              />
            ))}
          </div>

          <select
            aria-label="Playback speed"
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value) as TimelineSpeed)}
            className={`rounded-lg border px-1.5 py-1 font-mono text-[11px] ${c.select}`}
          >
            {TIMELINE_SPEEDS.map((s) => (
              <option key={s} value={s}>
                {s}×
              </option>
            ))}
          </select>
        </div>

        <div className={`flex items-center justify-between font-mono text-[10px] ${c.muted}`}>
          <span>
            {/* Autoplay advances in fractional days for smooth motion; only the display rounds. */}
            Day <span className={c.strong}>{Math.floor(clockDay)}</span> / {daySpan} · {currentDate}
          </span>
          <span>
            <span className={c.strong} data-testid="timeline-visible-count">
              {visibleCount}
            </span>{" "}
            / {bodies.length} repositories
          </span>
        </div>
      </div>
    </div>
  );
}
