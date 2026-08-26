import type { Body } from "./types";
import { SOLAR_SYSTEM_ZEMI, type Scope } from "./scopes";
import { MAX_INCLINATION } from "./motion";

export interface MoonPlacement {
  id: string;
  label: string;
  arm: string;
  /** Orbit radius as a multiple of the planet's drawn radius. */
  orbit: number;
  /** Radians. Fanned across the arm's moons, not authored per body. */
  phase: number;
  /** Radians per second. Outer orbits are slower. */
  rate: number;
  /**
   * Radians the orbit plane tilts off its planet's own. Fanned across the arm's
   * moons, not authored and not hashed — the same rule `phase` follows, and for
   * the same reason: only knowing the neighbours can guarantee they do not
   * stack. Fanning also separates the labels in depth, which a shared tilt
   * would not.
   */
  inclination: number;
}

/**
 * Drawn geometry, not metadata: the band a moon may occupy. `inner` clears the
 * ideals rings, which reach 1.6 + ordinal * 0.36 planet radii. The band is wide
 * because the labels have to fan far enough apart to be read at galaxy framing,
 * which is the whole point of putting them there.
 */
export const MOON_ORBIT = { inner: 3.2, outer: 5.6 } as const;

/**
 * Radians per second for a moon at `MOON_ORBIT.inner`. All slow, like the
 * planets. `moons.test.ts`'s "orbits too fast" ceiling (0.05 rad/s) looks
 * like the binding constraint but is not: the tighter one is
 * `surfaceCamera.test.ts`'s "holds the parent in frame for a minute of
 * orbit" — landing on a moon does not track the parent, so past ~0.034 here
 * the parent drifts more than 2° off-axis within sixty seconds and the shot
 * the previous spike paid for breaks again. This keeps real headroom under
 * that.
 */
const BASE_RATE = 0.032;

/**
 * A shipped system orbits its arm's planet.
 *
 * Stated as a rule rather than as "Products has four moons", because the four
 * the spec names are exactly the `kind: 'system'` bodies in that arm — so a
 * fifth venture becomes a moon by adding a row, and Labs' one system gets the
 * same treatment without a second code path.
 *
 * Orbit radius is ordered by birth date, so the map's one rule — radius is
 * time — holds at planet scale as well as at galaxy scale. Phase is fanned
 * across the arm's set rather than hashed per body, for the same reason
 * `placeBodies` is a function of the set: only knowing the neighbours can
 * guarantee they do not stack.
 */
export function deriveMoons(bodies: Body[], scope: Scope = SOLAR_SYSTEM_ZEMI): MoonPlacement[] {
  const out: MoonPlacement[] = [];

  for (const arm of Object.keys(scope.arms)) {
    const systems = bodies
      .filter((b) => b.arm === arm && b.kind === "moon")
      .sort((a, b) => a.bornAt.localeCompare(b.bornAt) || a.id.localeCompare(b.id));

    systems.forEach((body, i) => {
      // A lone system sits mid-band rather than dividing by zero at the rim.
      const t = systems.length === 1 ? 0.5 : i / (systems.length - 1);
      const orbit = MOON_ORBIT.inner + t * (MOON_ORBIT.outer - MOON_ORBIT.inner);

      out.push({
        id: body.id,
        label: body.label || body.id,
        arm,
        orbit,
        // Off the arm's own base angle, so two planets' moons are never in step.
        phase: scope.arms[arm] + (i / systems.length) * Math.PI * 2,
        // Kepler: further out is slower. Nothing here is fast enough to notice
        // moving, only fast enough to have moved.
        rate: BASE_RATE * Math.pow(MOON_ORBIT.inner / orbit, 1.5),
        // `t` already runs 0..1 across the arm's set. Mapped to -1..1 so the
        // fan straddles the planet's plane rather than leaning off one side.
        inclination: MAX_INCLINATION * (systems.length === 1 ? 0 : t * 2 - 1),
      });
    });
  }

  return out;
}

/** The ids drawn in orbit rather than on the arm, so the map draws each body once. */
export function moonIds(bodies: Body[], scope: Scope = SOLAR_SYSTEM_ZEMI): Set<string> {
  return new Set(deriveMoons(bodies, scope).map((m) => m.id));
}
