import type { Body } from "./types";
import { daysSinceEpoch } from "./position";

export const MOON_MAGNITUDE = 4;
const BASE = 0.6;
const SATELLITE_K = 0.25;

/** Days of visible temperature falloff. Beyond this a body reads as fully cold. */
const COOLING_DAYS = 180;

/**
 * Brightness. Deliberately NOT derived from repository size: `diskUsage` reports
 * the Obsidian vault at 25MB against MoneyTalks at 1.7MB, which would make a
 * private notes vault the brightest object in the galaxy. Lifespan is the honest
 * signal — how long a repository stayed alive — and flagships are pinned because
 * lifespan under-weights recent work (PickMe is four days old).
 */
export function magnitude(body: Body): number {
  if (body.kind === "moon") return MOON_MAGNITUDE;
  const lifespanDays = daysSinceEpoch(body.lastTouchedAt) - daysSinceEpoch(body.bornAt);
  return BASE + Math.sqrt(lifespanDays) * 0.12 + SATELLITE_K * (body.satellites?.length ?? 0);
}

/** 1 = pushed today, 0 = untouched for COOLING_DAYS or more. */
export function temperature(body: Body, today: string): number {
  const idle = daysSinceEpoch(today) - daysSinceEpoch(body.lastTouchedAt);
  return Math.max(0, Math.min(1, 1 - idle / COOLING_DAYS));
}
