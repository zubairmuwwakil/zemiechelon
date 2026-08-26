import type { Body } from "./types";
import { daysSinceEpoch } from "./position";

export const MOON_MAGNITUDE = 4;
const BASE = 0.6;
const SATELLITE_K = 0.25;

/** Days of visible temperature falloff. Beyond this a body reads as fully cold. */
const COOLING_DAYS = 180;

/**
 * Minutes of runtime that read exactly as bright as a shipped repository.
 *
 * The one calibration the runtime rule needs. At ten minutes a video sits on
 * `MOON_MAGNITUDE`; a 58-second short falls to 0.89 and a 45-minute tutorial
 * rises to 8.5. Square root rather than linear, for the reason `radiusScale`
 * is: the long tail would otherwise dominate everything shorter.
 */
export const RUNTIME_PIVOT_MINUTES = 10;

/**
 * Brightness. Deliberately NOT derived from repository size: `diskUsage` reports
 * the Obsidian vault at 25MB against MoneyTalks at 1.7MB, which would make a
 * private notes vault the brightest object in the galaxy. Lifespan is the honest
 * signal — how long a repository stayed alive — and flagships are pinned because
 * lifespan under-weights recent work (PickMe is four days old).
 */
export function magnitude(body: Body): number {
  // FIRST, deliberately. A published video IS a moon, so the `kind` test below
  // would flatten every one of them to MOON_MAGNITUDE and take the texture out
  // of the arm. Lifespan is the honest signal for a repository because a
  // repository stays alive; a video is published once and never touched, so its
  // lifespan is zero by construction. Runtime is the same claim one domain
  // over: how much was made.
  if (body.runtimeSeconds !== undefined) {
    return MOON_MAGNITUDE * Math.sqrt(body.runtimeSeconds / 60 / RUNTIME_PIVOT_MINUTES);
  }
  if (body.kind === "moon") return MOON_MAGNITUDE;
  // A difference, so the epoch cancels and the default is harmless — this is
  // a duration, not a position. Do not thread a scope through it.
  const lifespanDays = daysSinceEpoch(body.lastTouchedAt) - daysSinceEpoch(body.bornAt);
  return BASE + Math.sqrt(lifespanDays) * 0.12 + SATELLITE_K * (body.satellites?.length ?? 0);
}

/** 1 = pushed today, 0 = untouched for COOLING_DAYS or more. */
export function temperature(body: Body, today: string): number {
  const idle = daysSinceEpoch(today) - daysSinceEpoch(body.lastTouchedAt);
  return Math.max(0, Math.min(1, 1 - idle / COOLING_DAYS));
}
