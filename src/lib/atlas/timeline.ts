import type { Body } from "./types";
import { GALAXY_ZEMI, type Scope } from "./scopes";
import { daysSinceEpoch } from "./position";

/**
 * The timeline transport's own filter. A body belongs on the map once its own
 * creation has happened — nothing about *where* it is drawn changes here, only
 * *whether* it is. See `placeBodies` in `position.ts`: positions come from the
 * full set, and this is the only thing the clock is allowed to touch.
 */
export function bodyVisibleAt(body: Body, clockDay: number, scope: Scope = GALAXY_ZEMI): boolean {
  return daysSinceEpoch(body.bornAt, scope.epoch) <= clockDay;
}

export function visibleBodyIds(
  bodies: Body[],
  clockDay: number,
  scope: Scope = GALAXY_ZEMI,
): Set<string> {
  return new Set(
    bodies.filter((b) => bodyVisibleAt(b, clockDay, scope)).map((b) => b.id),
  );
}

/** Playback speeds, in simulated days advanced per real second of play. */
export const TIMELINE_SPEEDS = [1, 4, 14, 30] as const;
export type TimelineSpeed = (typeof TIMELINE_SPEEDS)[number];
export const DEFAULT_TIMELINE_SPEED: TimelineSpeed = 4;

/** One playback tick: elapsed real seconds, at a speed, clamped to the span. */
export function advanceClockDay(
  currentDay: number,
  elapsedSeconds: number,
  speed: number,
  daySpan: number,
): number {
  return Math.min(daySpan, Math.max(0, currentDay + elapsedSeconds * speed));
}

/** The calendar date the clock reads at a given day offset from the epoch. */
export function dateAtDay(day: number, epoch: string): string {
  return new Date(Date.parse(epoch) + day * 86_400_000).toISOString().slice(0, 10);
}
