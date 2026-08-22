import type { Body } from "./types";
import { GALAXY_ZEMI, planetScopeId, type Scope } from "./scopes";
import { loadBodies } from "./bodies";
import { deriveWorldRadius, derivePlanets, type PlanetPlacement } from "./planets";
import { deriveMoons, type MoonPlacement } from "./moons";
import { radiusScale } from "./position";
import { IDEALS, type Ideal } from "./ideals";
import { ARMS, ARM_META } from "@/data/arms";

/**
 * Astrolabe month boundary cadence in days per ring.
 * Mirrors `DAYS_PER_MONTH` in `WorldSceneBuilder.ts`.
 */
export const DAYS_PER_MONTH = 30;

/**
 * Inverse of `radiusScale(days) = Math.sqrt(Math.max(0, days)) * 1.15`.
 * Computes calendar days from a layout radius.
 */
export function radiusToDays(radius: number): number {
  if (radius <= 0) return 0;
  return Math.round(Math.pow(radius / 1.15, 2));
}

/**
 * Derives the total day span of the galaxy from its layout reach.
 * This is computed from the outermost body placement via `deriveWorldRadius`,
 * ensuring it stays strictly in sync with the map's geometry without typing a literal.
 */
export function deriveDaySpan(bodies: Body[] = loadBodies(), scope: Scope = GALAXY_ZEMI): number {
  const reach = deriveWorldRadius(bodies, scope);
  return radiusToDays(reach);
}

export interface AstrolabeRingsDerivation {
  /** Total month boundary rings that fit inside the world radius. */
  monthRingCount: number;
  /** Heavy quarter boundary rings (month % 3 === 0). */
  quarterRingCount: number;
  /** Interval in days per month ring (30). */
  daysPerMonth: number;
  /** Layout radii of each month ring. */
  radii: number[];
}

/**
 * Derives the astrolabe graticule rings using the exact loop from `WorldSceneBuilder.buildAstrolabeConcentricRings`.
 */
export function deriveAstrolabeRings(
  bodies: Body[] = loadBodies(),
  scope: Scope = GALAXY_ZEMI,
  daysPerMonth: number = DAYS_PER_MONTH,
): AstrolabeRingsDerivation {
  const reach = deriveWorldRadius(bodies, scope);
  const radii: number[] = [];
  let monthRingCount = 0;
  let quarterRingCount = 0;

  for (let month = 1; ; month++) {
    const layoutRadius = radiusScale(month * daysPerMonth);
    if (layoutRadius > reach) break;
    radii.push(layoutRadius);
    monthRingCount++;
    if (month % 3 === 0) {
      quarterRingCount++;
    }
  }

  return {
    monthRingCount,
    quarterRingCount,
    daysPerMonth,
    radii,
  };
}

export interface ArmFigure {
  id: string;
  name: string;
  tagline: string;
  themeColor: string;
  bodyCount: number;
  systemCount: number;
  starCount: number;
  anonymousCount: number;
  planetRadius: number;
  moons: MoonPlacement[];
  moonCount: number;
  ideals: Ideal[];
  idealCount: number;
}

export interface LegendFigures {
  /** Galaxy reach in layout units, e.g. 19.465... */
  worldRadius: number;
  /** Galaxy span in calendar days derived from world radius, e.g. 286 */
  daySpan: number;
  /** Epoch string, e.g. "2025-11-06" */
  epoch: string;
  /** Mathematical formula relating days to layout radius */
  radiusFormula: string;
  /** Astrolabe concentric month and quarter rings */
  astrolabe: AstrolabeRingsDerivation;
  /** Total charted bodies across all arms, e.g. 45 */
  totalBodies: number;
  /** Total shipped systems (kind: "system"), e.g. 5 */
  shippedSystemsCount: number;
  /** Total learned supporting repositories (kind: "star"), e.g. 40 */
  learnedStarsCount: number;
  /** Anonymous/private repositories count */
  anonymousCount: number;
  /** Public repositories count */
  publicCount: number;
  /** Number of declared galactic arms, e.g. 5 */
  armCount: number;
  /** Total moons across all planets, e.g. 5 */
  totalMoons: number;
  /** Total declared ideal claim rings, e.g. 1 */
  totalIdeals: number;
  /** Total unique repositories cited across all ideals, e.g. 2 */
  totalCitedRepositories: number;
  /** List of all cited repository IDs */
  citedRepositoryIds: string[];
  /** Breakdown for every galactic arm */
  arms: ArmFigure[];
  /** Planet placements */
  planets: PlanetPlacement[];
  /** Largest planet by radius */
  largestPlanet: {
    arm: string;
    name: string;
    radius: number;
    bodyCount: number;
    systemCount: number;
    starCount: number;
  };
  /** Products specific figures for immediate reference */
  products: {
    arm: string;
    name: string;
    total: number;
    systems: number;
    stars: number;
    moons: number;
    ideals: number;
    planetRadius: number;
  };
}

/**
 * Derives the complete set of figures and statistics for the Celestial Atlas Legend.
 * Strictly derives every value from geometry and metadata functions with zero hardcoded literals.
 */
export function deriveLegendFigures(
  bodies: Body[] = loadBodies(),
  scope: Scope = GALAXY_ZEMI,
  ideals: Ideal[] = IDEALS,
): LegendFigures {
  const worldRadius = deriveWorldRadius(bodies, scope);
  const daySpan = radiusToDays(worldRadius);
  const astrolabe = deriveAstrolabeRings(bodies, scope, DAYS_PER_MONTH);
  const planets = derivePlanets(bodies, scope);
  const moons = deriveMoons(bodies, scope);

  const totalBodies = bodies.length;
  const shippedSystemsCount = bodies.filter((b) => b.kind === "system").length;
  const learnedStarsCount = bodies.filter((b) => b.kind === "star").length;
  const anonymousCount = bodies.filter((b) => b.anonymous).length;
  const publicCount = totalBodies - anonymousCount;
  const armKeys = Object.keys(scope.arms);
  const armCount = armKeys.length;

  const planetsByArm = new Map(planets.map((p) => [p.arm, p]));
  const moonsByArm = new Map<string, MoonPlacement[]>();
  for (const moon of moons) {
    const list = moonsByArm.get(moon.arm) ?? [];
    list.push(moon);
    moonsByArm.set(moon.arm, list);
  }

  const allCitedIds = new Set<string>();
  for (const ideal of ideals) {
    for (const cited of ideal.evidence) {
      allCitedIds.add(cited);
    }
  }

  const arms: ArmFigure[] = ARMS.map((meta) => {
    const armBodies = bodies.filter((b) => b.arm === meta.id);
    const systemCount = armBodies.filter((b) => b.kind === "system").length;
    const starCount = armBodies.length - systemCount;
    const anon = armBodies.filter((b) => b.anonymous).length;
    const planet = planetsByArm.get(meta.id);
    const armMoons = moonsByArm.get(meta.id) ?? [];
    const armIdeals = ideals.filter((i) => i.scope === planetScopeId(meta.id));

    return {
      id: meta.id,
      name: meta.name,
      tagline: meta.tagline,
      themeColor: meta.themeColor,
      bodyCount: armBodies.length,
      systemCount,
      starCount,
      anonymousCount: anon,
      planetRadius: planet?.radius ?? 0,
      moons: armMoons,
      moonCount: armMoons.length,
      ideals: armIdeals,
      idealCount: armIdeals.length,
    };
  });

  const sortedPlanets = [...planets].sort((a, b) => b.radius - a.radius);
  const largest = sortedPlanets[0];
  const largestArmMeta = ARM_META[largest.arm];
  const largestBodies = bodies.filter((b) => b.arm === largest.arm);
  const largestSystems = largestBodies.filter((b) => b.kind === "system").length;

  const productsArm = arms.find((a) => a.id === "products")!;

  return {
    worldRadius,
    daySpan,
    epoch: scope.epoch,
    radiusFormula: "r = √days × 1.15",
    astrolabe,
    totalBodies,
    shippedSystemsCount,
    learnedStarsCount,
    anonymousCount,
    publicCount,
    armCount,
    totalMoons: moons.length,
    totalIdeals: ideals.length,
    totalCitedRepositories: allCitedIds.size,
    citedRepositoryIds: [...allCitedIds].sort(),
    arms,
    planets,
    largestPlanet: {
      arm: largest.arm,
      name: largestArmMeta?.name ?? largest.arm,
      radius: largest.radius,
      bodyCount: largest.bodyCount,
      systemCount: largestSystems,
      starCount: largest.bodyCount - largestSystems,
    },
    products: {
      arm: "products",
      name: productsArm.name,
      total: productsArm.bodyCount,
      systems: productsArm.systemCount,
      stars: productsArm.starCount,
      moons: productsArm.moonCount,
      ideals: productsArm.idealCount,
      planetRadius: productsArm.planetRadius,
    },
  };
}
