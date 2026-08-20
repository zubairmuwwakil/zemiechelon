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
 */
const SIZE = { base: 3.2, perSystem: 2.6, perStar: 0.18, max: 14 } as const;

export function derivePlanets(bodies: Body[], scope: Scope = GALAXY_ZEMI): PlanetPlacement[] {
  const placements = placeBodies(bodies, scope);
  const byId = new Map(placements.map((p) => [p.id, p]));

  return Object.keys(scope.arms).map((arm) => {
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
