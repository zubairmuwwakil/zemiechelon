import { GALAXY_ZEMI, type Scope } from "./galaxy";

/**
 * How the world moves, as pure numbers.
 *
 * Here rather than in the scene builder for the reason `moons.ts` and
 * `planets.ts` are here: a rate is a derivation. It needs no scene, no camera
 * and no three.js to state, and `arms.ts` already records that pulling three.js
 * into the data layer is the thing to avoid.
 *
 * Motion is applied strictly ABOVE placement in the transform hierarchy.
 * Nothing in this file may ever be consulted by `placeBodies`, `derivePlanets`
 * or `deriveMoons` when deciding where something IS.
 */

/**
 * The galaxy's pattern period. One revolution per thirty minutes.
 *
 * Sized against the pointer rather than against taste. At the derived galaxy
 * pose this is 2.53 px/s at a 725 px rim, so a planet pin about 100 px wide
 * takes roughly forty seconds to slide its own width. The binding precedent is
 * `ORRERY_RATE`, cut from 0.28 to 0.1 because a bead "crossed the frame in a
 * couple of seconds and slid out from under the pointer" — the same failure
 * mode, one altitude up.
 */
export const PATTERN_PERIOD_SECONDS = 30 * 60;

/** Radians per second. One rate for every radius: see `patternAngle`. */
export const PATTERN_RATE = (2 * Math.PI) / PATTERN_PERIOD_SECONDS;

/**
 * The pattern's angle at a moment.
 *
 * A pure function of elapsed time and nothing else — no radius argument, and
 * that absence is the design. A rate that varied with radius would be
 * differential rotation, which winds an arm through a full arm-spacing in
 * eleven seconds at any rate fast enough to see.
 */
export function patternAngle(elapsedSeconds: number): number {
  return PATTERN_RATE * elapsedSeconds;
}

/** Radians. A planet's spin axis never leans further than this from its frame's +Y. */
export const MAX_OBLIQUITY = (28 * Math.PI) / 180;

/**
 * Radians. A moon's orbit never inclines further than this.
 *
 * Lower than the planets' ceiling because this one reaches a frame a visitor
 * stands on: a moon group rides its inclined orbit, so the ground tilts with
 * it. `surfaceCamera.test.ts`'s fifteen-degree off-axis assertion is the gate
 * on this number — if it fails, this comes down.
 */
export const MAX_INCLINATION = (12 * Math.PI) / 180;

/** A lean: how far from +Y, and which way round. */
export interface AxisTilt {
  /** Radians from the frame's own +Y. Never exceeds the relevant ceiling. */
  magnitude: number;
  /** Radians about +Y — the direction the pole leans toward. */
  azimuth: number;
}

function baseAngle(arm: string, scope: Scope): number {
  const base = scope.arms[arm];
  if (base === undefined) {
    // Loud, not defaulted — the same rule an unassigned arm already follows.
    throw new Error(`unknown arm "${arm}"`);
  }
  return base;
}

/**
 * A planet's axial tilt, derived from its arm's own base angle.
 *
 * Same source the ideals rings already read, for the reason recorded there:
 * "Reading the arm's own base angle gives every planet a different plane, and a
 * sixth arm gets one without anybody choosing a number."
 *
 * The RANGE is what is new. `armAngle` reaches 8π/5, so the ideals' bare
 * `armAngle * 0.28` yields up to 80.7° — a decorative lean on a ring, and a
 * toppled world on a planet. Magnitude is mapped into
 * `[0.45, 1] * MAX_OBLIQUITY` so no planet is left upright and none is knocked
 * over; azimuth is the arm angle itself, so no two lean the same way.
 */
export function obliquityFor(arm: string, scope: Scope = GALAXY_ZEMI): AxisTilt {
  const base = baseAngle(arm, scope);
  const turn = (base / (2 * Math.PI)) % 1;
  return {
    magnitude: MAX_OBLIQUITY * (0.45 + 0.55 * turn),
    azimuth: base,
  };
}
