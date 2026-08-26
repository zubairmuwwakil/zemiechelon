import type { Vec3 } from "./types";
import { GALAXY_ZEMI, SOLAR_SYSTEMS, systemName, type Scope } from "./galaxy";
import { bodiesFor } from "./bodies";
import { deriveWorldRadius } from "./planets";
import { daysSinceEpoch, polar, radiusScale } from "./position";
import { SCENE_SCALE } from "./scale";

/**
 * Radians. A solar system's plane never leans further than this from the
 * galactic plane.
 *
 * Bounded by the surface camera, not by taste. `surfaceCamera.test.ts` asserts
 * a standing visitor keeps the parent within 15 degrees off-axis, and
 * `MAX_INCLINATION` (12 degrees) already spends most of that: a tilted
 * ancestor spends more, because `leveledFrameMatrix` levels the camera against
 * WORLD up while the ground rides its own frame.
 *
 * Today nothing spends it at all — see `tiltFor`, which is zero at the core,
 * and the core is the only system that declares surfaces. **A future system
 * that earns ground must re-measure this number.**
 */
export const MAX_SYSTEM_TILT = (10 * Math.PI) / 180;

/** How far a system's own bodies reach from its centre, in scene units. */
export function systemReach(system: Scope): number {
  return deriveWorldRadius(bodiesFor(system), system) * SCENE_SCALE;
}

/** A system's distance from the galactic core, in LAYOUT units. */
function layoutRadius(system: Scope): number {
  return radiusScale(daysSinceEpoch(system.epoch, GALAXY_ZEMI.epoch));
}

/** A system's direction from the core, in layout units, on its galaxy arm. */
function direction(system: Scope): Vec3 {
  return polar(systemName(system.id), layoutRadius(system), GALAXY_ZEMI);
}

/**
 * Layout units -> scene units, in the GALAXY's frame.
 *
 * The counterpart of `SCENE_SCALE` one level up, and derived by the same kind
 * of argument: a requirement solved for the quotient rather than a number that
 * framed the world on the day it was typed.
 *
 * The requirement is that no two systems' discs intersect — for every pair,
 * the centres are at least `reach(A) + reach(B) + min(reach(A), reach(B))`
 * apart, so they clear each other by the smaller one's own radius.
 *
 * Separating systems at the BODY scale does not satisfy this and must not be
 * re-attempted. The atlas reaches 205 scene units — the astrolabe's outermost
 * ring, which is what `SCENE_SCALE` is solved to land it on. The channel's
 * epoch falls 118 days after the galaxy's, so `radiusScale(118)` is 12.49
 * layout units: 132 scene units at the body scale, comfortably INSIDE the
 * atlas's own disc. The two orreries would intersect. The galaxy is a frame in
 * its own right and needs a quotient of its own, and this is it.
 *
 * Stated over planar distance and checked over the full 3D distance, which is
 * never smaller: lifting a system out of the plane can only increase the
 * clearance this guarantees.
 */

/**
 * How much clearance the solve demands beyond the bare minimum that keeps
 * two discs from touching. 1 would place the closest pair exactly rim to
 * rim — technically clear, visually crowded from the galaxy view the whole
 * point of this level is to show off. This is breathing room, not a second
 * requirement: it multiplies the same `need` the solve already clears
 * against, so `GALAXY_SPREAD` stays a single solved quotient rather than a
 * minimum plus an unrelated fudge applied after.
 */
export const GALAXY_SPACING_PADDING = 1.2;

// Currently resolves to 48.94 against the seeded channel (40.78 unpadded).
export const GALAXY_SPREAD: number = (() => {
  // Each system's direction and reach once, not once per pair. `systemReach`
  // lays out the whole body set behind it, and this runs at module load on the
  // render path — 2N² full layouts for a fact that is a pure function of N.
  const systems = SOLAR_SYSTEMS.map((system) => ({
    system,
    direction: direction(system),
    reach: systemReach(system),
  }));

  let required = 0;
  for (const a of systems) {
    for (const b of systems) {
      if (a === b) continue;
      const separation = Math.hypot(
        a.direction.x - b.direction.x,
        a.direction.z - b.direction.z,
      );
      // Two systems founded the same day would share a layout point; the
      // registry cannot produce that today, and a zero divisor must not be
      // reached quietly if it ever can.
      if (separation < 1e-9) {
        throw new Error(
          `solar systems "${a.system.id}" and "${b.system.id}" occupy the same point in the galaxy`,
        );
      }
      const need = GALAXY_SPACING_PADDING * (a.reach + b.reach + Math.min(a.reach, b.reach));
      required = Math.max(required, need / separation);
    }
  }
  // A galaxy with one system has no pair to satisfy. The quotient is then
  // unobservable — its only system sits at the core — so any positive value
  // will do, and the body scale keeps the two frames commensurable.
  return required === 0 ? SCENE_SCALE : required;
})();

/** The maximum leaning radius, so `tiltFor` can normalise against it. */
const MAX_LAYOUT_RADIUS = Math.max(...SOLAR_SYSTEMS.map(layoutRadius));

/**
 * How far a system leans, and therefore how far it rises.
 *
 * Scaled by radius so the core is in the galactic plane BY CONSTRUCTION. That
 * is not a nicety: the atlas is the only system that declares surfaces, and a
 * tilt there would eat the surface camera's off-axis budget (see
 * `MAX_SYSTEM_TILT`). A rule that happens to give zero is worth more than a
 * special case that asserts it.
 */
function tiltFor(system: Scope): number {
  if (MAX_LAYOUT_RADIUS === 0) return 0;
  return MAX_SYSTEM_TILT * (layoutRadius(system) / MAX_LAYOUT_RADIUS);
}

export interface SystemPlacement {
  /** The system's origin in the galaxy's frame, in scene units. */
  center: Vec3;
  /** Radians its own plane leans off the galactic plane. */
  tilt: number;
}

/**
 * Where a solar system sits, and how it leans.
 *
 * The direction comes from `polar()` — the same function that places a
 * repository on an arm and a moon around a planet — so the map's rule that
 * angle means arm and radius means time reaches the root rather than stopping
 * one level short of it.
 *
 * A system leans by the same angle it rises out of the galactic plane: one
 * number with two readings, the shape `obliquityFor` already uses for a
 * planet's axis.
 */
export function placeSolarSystem(system: Scope): SystemPlacement {
  const d = direction(system);
  const tilt = tiltFor(system);
  const planar = Math.hypot(d.x, d.z) * GALAXY_SPREAD;
  return {
    center: {
      x: d.x * GALAXY_SPREAD,
      y: planar * Math.sin(tilt),
      z: d.z * GALAXY_SPREAD,
    },
    tilt,
  };
}

/**
 * The sky shell's inner and outer radius, as multiples of `GALAXY_REACH`.
 *
 * Kept here rather than inside the builder that draws them because the CAMERA
 * has to know how far the sky reaches: `setFrameScale`'s far plane is
 * contracted to reach the whole world, and since this task the sky is the
 * outermost thing in it. Two readers, one fact.
 *
 * The multiples themselves are unchanged from the shell this replaced — only
 * what they multiply is different, which is what makes "the sky got bigger"
 * the whole of the visible change.
 */
export const SKY_SHELL_INNER = 1.5;
export const SKY_SHELL_DEPTH = 1.3;

/**
 * How far the galaxy reaches, in scene units — the outermost rim of the
 * outermost system. What the galaxy camera pose is sized against, exactly as
 * `SOLAR_SYSTEM_POSE` is sized against `ASTROLABE_OUTER`.
 */
export const GALAXY_REACH: number = Math.max(
  ...SOLAR_SYSTEMS.map((system) => {
    const c = placeSolarSystem(system).center;
    return Math.hypot(c.x, c.y, c.z) + systemReach(system);
  }),
);

/** How far the sky reaches, in scene units. The outermost thing in the world. */
export const GALAXY_SKY_OUTER: number = GALAXY_REACH * (SKY_SHELL_INNER + SKY_SHELL_DEPTH);
