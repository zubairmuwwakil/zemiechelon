import type { Body, Vec3 } from "./types";
import { GALAXY_ZEMI, type Scope } from "./scopes";
import { placeBodies, polar } from "./position";

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
const SIZE = { base: 0.3, perSystem: 0.055, perStar: 0.006, max: 0.75 } as const;

/**
 * How far the galaxy reaches, in layout units. Derived from the bodies alone —
 * not from the planets, which would make it circular, and not from a number
 * someone typed when the world happened to be a different size. The renderer
 * scales its own furniture off this, so the map stays a pure function of dates.
 */
export function deriveWorldRadius(bodies: Body[], scope: Scope = GALAXY_ZEMI): number {
  return Math.max(
    ...placeBodies(bodies, scope).map((p) => Math.hypot(p.position.x, p.position.z)),
  );
}

export function derivePlanets(bodies: Body[], scope: Scope = GALAXY_ZEMI): PlanetPlacement[] {
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

    const systems = inArm.filter((b) => b.kind === "system").length;
    const stars = inArm.length - systems;

    return {
      arm,
      center: polar(arm, meanRadius, scope),
      radius: Math.min(SIZE.max, SIZE.base + systems * SIZE.perSystem + stars * SIZE.perStar),
      bodyCount: inArm.length,
    };
  });
}
