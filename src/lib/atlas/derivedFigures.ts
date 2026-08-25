import type { Body } from "./types";
import { SOLAR_SYSTEM_ZEMI, planetScopeId, type Scope } from "./scopes";
import { loadBodies } from "./bodies";
import { deriveWorldRadius, derivePlanets, type PlanetPlacement } from "./planets";
import { deriveMoons, type MoonPlacement } from "./moons";
import { daysSinceEpoch, radiusScale } from "./position";
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
export function deriveDaySpan(bodies: Body[] = loadBodies(), scope: Scope = SOLAR_SYSTEM_ZEMI): number {
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
  scope: Scope = SOLAR_SYSTEM_ZEMI,
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
  shippedCount: number;
  dwarfPlanetCount: number;
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
  /** Total shipped moons (kind: "moon"), e.g. 5 */
  shippedMoonsCount: number;
  /** Total learned supporting repositories (kind: "dwarfPlanet"), e.g. 40 */
  learnedDwarfPlanetsCount: number;
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
    shippedCount: number;
    dwarfPlanetCount: number;
  };
  /** Products specific figures for immediate reference */
  products: {
    arm: string;
    name: string;
    total: number;
    shipped: number;
    dwarfPlanets: number;
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
  scope: Scope = SOLAR_SYSTEM_ZEMI,
  ideals: Ideal[] = IDEALS,
): LegendFigures {
  const worldRadius = deriveWorldRadius(bodies, scope);
  const daySpan = radiusToDays(worldRadius);
  const astrolabe = deriveAstrolabeRings(bodies, scope, DAYS_PER_MONTH);
  const planets = derivePlanets(bodies, scope);
  const moons = deriveMoons(bodies, scope);

  const totalBodies = bodies.length;
  const shippedMoonsCount = bodies.filter((b) => b.kind === "moon").length;
  const learnedDwarfPlanetsCount = bodies.filter((b) => b.kind === "dwarfPlanet").length;
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
    const shippedCount = armBodies.filter((b) => b.kind === "moon").length;
    const dwarfPlanetCount = armBodies.length - shippedCount;
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
      shippedCount,
      dwarfPlanetCount,
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
  const largestShipped = largestBodies.filter((b) => b.kind === "moon").length;

  const productsArm = arms.find((a) => a.id === "products")!;

  return {
    worldRadius,
    daySpan,
    epoch: scope.epoch,
    radiusFormula: "r = √days × 1.15",
    astrolabe,
    totalBodies,
    shippedMoonsCount,
    learnedDwarfPlanetsCount,
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
      shippedCount: largestShipped,
      dwarfPlanetCount: largest.bodyCount - largestShipped,
    },
    products: {
      arm: "products",
      name: productsArm.name,
      total: productsArm.bodyCount,
      shipped: productsArm.shippedCount,
      dwarfPlanets: productsArm.dwarfPlanetCount,
      moons: productsArm.moonCount,
      ideals: productsArm.idealCount,
      planetRadius: productsArm.planetRadius,
    },
  };
}

export interface ElementAnnotation {
  id: string;
  title: string;
  subtitle: string;
}

/**
 * Derives the annotation figure for an astrolabe month ring or frontier boundary.
 */
export function deriveRingAnnotation(
  month: number | "frontier",
  bodies: Body[] = loadBodies(),
  scope: Scope = SOLAR_SYSTEM_ZEMI,
  daysPerMonth: number = DAYS_PER_MONTH,
): ElementAnnotation {
  const daySpan = deriveDaySpan(bodies, scope);
  if (month === "frontier") {
    return {
      id: "ring-frontier",
      title: "Galactic Frontier",
      subtitle: `${daySpan} days out`,
    };
  }
  const days = month * daysPerMonth;
  return {
    id: `ring-month-${month}`,
    title: `Month ${month}`,
    subtitle: `${days} days out`,
  };
}

/**
 * Derives what a planet is made of: its shipped moons count and learning repositories count.
 */
export function derivePlanetAnnotation(
  arm: string,
  bodies: Body[] = loadBodies(),
  scope: Scope = SOLAR_SYSTEM_ZEMI,
): ElementAnnotation {
  if (arm === "solarSystem") {
    return {
      id: "planet-solarSystem",
      title: "Ancestral Anchor Core",
      subtitle: `Epoch ${scope.epoch} · Origin of time`,
    };
  }
  const meta = ARM_META[arm];
  const armBodies = bodies.filter((b) => b.arm === arm);
  const moonCount = armBodies.filter((b) => b.kind === "moon").length;
  const dwarfPlanetCount = armBodies.length - moonCount;
  const moonUnit = moonCount === 1 ? "moon" : "moons";
  const dwarfPlanetUnit = dwarfPlanetCount === 1 ? "learning repository" : "learning repositories";

  return {
    id: `planet-${arm}`,
    title: `Planet ${meta?.name ?? arm}`,
    subtitle: `${moonCount} shipped ${moonUnit} · ${dwarfPlanetCount} ${dwarfPlanetUnit}`,
  };
}

/**
 * Derives the arm identity and composition for hovering an arm's dust.
 */
export function deriveArmAnnotation(
  arm: string,
  bodies: Body[] = loadBodies(),
): ElementAnnotation {
  const meta = ARM_META[arm];
  const armBodies = bodies.filter((b) => b.arm === arm);
  const moonCount = armBodies.filter((b) => b.kind === "moon").length;
  const dwarfPlanetCount = armBodies.length - moonCount;
  const total = armBodies.length;

  return {
    id: `arm-${arm}`,
    title: `${meta?.name ?? arm} Arm`,
    subtitle: `${meta?.tagline ?? ""} (${total} repos · ${moonCount} shipped, ${dwarfPlanetCount} learned)`.trim(),
  };
}

export interface TimelineMilestone {
  /** The repository that names this moment. */
  id: string;
  /** Editorial caption, from `bodies.overrides.ts`. */
  title: string;
  /** Days since the galaxy epoch, derived from the body's own `bornAt`. */
  day: number;
  /** The body's own `bornAt`, unchanged. */
  date: string;
  /** How many repositories existed at or before this moment. */
  bodyCount: number;
}

/**
 * The timeline transport's own figures, per §3.8: a repository may name the
 * moment it represents, but the day, date and count behind that name are
 * always derived from the body set — never typed, per §3.6.
 */
export function deriveTimelineMilestones(
  bodies: Body[] = loadBodies(),
  scope: Scope = SOLAR_SYSTEM_ZEMI,
): TimelineMilestone[] {
  return bodies
    .filter((b): b is Body & { milestone: string } => Boolean(b.milestone))
    .map((b) => {
      const day = daysSinceEpoch(b.bornAt, scope.epoch);
      return {
        id: b.id,
        title: b.milestone,
        day,
        date: b.bornAt,
        bodyCount: bodies.filter((x) => daysSinceEpoch(x.bornAt, scope.epoch) <= day).length,
      };
    })
    .sort((a, b) => a.day - b.day || a.id.localeCompare(b.id));
}
