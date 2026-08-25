import type { Body, Vec3 } from "./types";
import { SOLAR_SYSTEM_ZEMI, type Scope } from "./scopes";
import { daysSinceEpoch, placeBodies, polar } from "./position";

export interface PlanetPlacement {
  arm: string;
  center: Vec3;
  /** Drawn radius in world units. Not equal across planets — see below. */
  radius: number;
  bodyCount: number;
}

/**
 * Planet size is deliberately NOT proportional to body count. Foundations holds
 * the most repositories and the least significance; Products holds four shipped
 * ventures. Weighting by count would give nineteen tutorials more screen area
 * than the company. Size is driven by summed magnitude instead, which `kind:
 * 'system'` already pins for flagships.
 *
 * These are LAYOUT units, the same ones `radiusScale` produces — so a radius is
 * comparable against a centre without a conversion. The renderer multiplies both
 * by its own scene scale. Sized so the widest pair of neighbours (Foundations and
 * Products, 12.6 apart) clears by an order of magnitude.
 */
const SIZE = { base: 0.3, perMoon: 0.055, perDwarfPlanet: 0.006, max: 0.75 } as const;

/**
 * How far the galaxy reaches, in layout units. Derived from the bodies alone —
 * not from the planets, which would make it circular, and not from a number
 * someone typed when the world happened to be a different size. The renderer
 * scales its own furniture off this, so the map stays a pure function of dates.
 */
export function deriveWorldRadius(bodies: Body[], scope: Scope = SOLAR_SYSTEM_ZEMI): number {
  return Math.max(
    ...placeBodies(bodies, scope).map((p) => Math.hypot(p.position.x, p.position.z)),
  );
}

export function derivePlanets(bodies: Body[], scope: Scope = SOLAR_SYSTEM_ZEMI): PlanetPlacement[] {
  const placements = placeBodies(bodies, scope);
  const byId = new Map(placements.map((p) => [p.id, p]));

  return Object.keys(scope.arms).map((arm) => {
    // Filtered by arm, NOT by parent, and that is load-bearing. A planet's mass
    // is its whole subtree: the four shipped systems are parented to
    // planet:products, so filtering on parent would take Products' own mass away
    // from it and it would stop being the largest planet — with nothing thrown
    // and no test failing but the one in planets.test.ts.
    const inArm = bodies.filter((b) => b.arm === arm);

    // The planet sits at the centroid radius of its arm, on the arm spine — so
    // a dense-at-the-core arm sits inside a dense-at-the-frontier one, and the
    // map's radial story survives at planet scale.
    const meanRadius =
      inArm.reduce(
        (sum, b) => sum + Math.hypot(byId.get(b.id)!.position.x, byId.get(b.id)!.position.z),
        0,
      ) / Math.max(1, inArm.length);

    const moons = inArm.filter((b) => b.kind === "moon").length;
    const dwarfPlanets = inArm.length - moons;

    return {
      arm,
      center: polar(arm, meanRadius, scope),
      radius: Math.min(SIZE.max, SIZE.base + moons * SIZE.perMoon + dwarfPlanets * SIZE.perDwarfPlanet),
      bodyCount: inArm.length,
    };
  });
}

export interface PlanetGrowth extends PlanetPlacement {
  /** False until the arm's first repository is born; the map draws nothing there. */
  visible: boolean;
}

/**
 * A planet's mass at a moment in the galaxy's history, per §3.8 of the surface
 * design spec: positions come from the full set, and only mass and visibility
 * come from the clock. `center` is read once from `derivePlanets` over the
 * FULL body set and never recomputed here — a planet is a landmark, and a
 * landmark that drifts as later repositories are born is unreadable. Only
 * `radius`, `bodyCount` and `visible` are time-filtered, and radius is
 * monotonic in the born count, so it can never shrink as the clock advances.
 */
export function planetGrowthAt(
  bodies: Body[],
  clockDay: number,
  scope: Scope = SOLAR_SYSTEM_ZEMI,
): PlanetGrowth[] {
  const frozen = derivePlanets(bodies, scope);

  return frozen.map((planet) => {
    const born = bodies.filter(
      (b) => b.arm === planet.arm && daysSinceEpoch(b.bornAt, scope.epoch) <= clockDay,
    );
    const moons = born.filter((b) => b.kind === "moon").length;
    const dwarfPlanets = born.length - moons;

    return {
      ...planet,
      bodyCount: born.length,
      radius:
        born.length === 0
          ? 0
          : Math.min(SIZE.max, SIZE.base + moons * SIZE.perMoon + dwarfPlanets * SIZE.perDwarfPlanet),
      visible: born.length > 0,
    };
  });
}
