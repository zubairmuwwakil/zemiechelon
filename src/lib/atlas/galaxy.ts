import type { Body, ScopeId } from "./types";
import { CHANNEL_ARM_IDS, CHANNEL_ITEMS, channelEpoch } from "@/data/channel";

/**
 * A coordinate frame. Bodies are laid out within their parent's frame, and the
 * camera composes frames as it descends. `arms` and `windRate` were module
 * constants in position.ts; they live here so a second solar system is a row
 * of data rather than a navigation mode.
 */
export interface Scope {
  id: ScopeId;
  kind: "galaxy" | "solarSystem" | "planet" | "moon";
  parent?: ScopeId;
  label: string;
  /** ISO date. Radius zero. */
  epoch: string;
  /** Arm name -> base angle in radians. */
  arms: Record<string, number>;
  /** How far an arm sweeps per e-fold of radius. Higher = tighter spiral. */
  windRate: number;
}

/**
 * Spelled before `GALAXY_ZEMI` so a solar system can name its parent without
 * the galaxy having to exist first — which it cannot, since its own arm table
 * is derived from the systems below.
 */
const GALAXY_ID: ScopeId = "galaxy:zemi";

/** The repository atlas: the first solar system in the Zemí galaxy. */
export const SOLAR_SYSTEM_ZEMI: Scope = {
  id: "solarSystem:atlas",
  kind: "solarSystem",
  parent: GALAXY_ID,
  label: "Repository Atlas",
  epoch: "2025-11-06",
  arms: {
    foundations: 0,
    products: (2 * Math.PI) / 5,
    labs: (4 * Math.PI) / 5,
    self: (6 * Math.PI) / 5,
    creative: (8 * Math.PI) / 5,
  },
  windRate: 0.55,
};

/**
 * The channel: the second solar system in the Zemí galaxy.
 *
 * Its arms are spaced evenly from `CHANNEL_ARM_IDS`, so a fifth arm is one row
 * in that list and nobody chooses an angle. Its epoch is its oldest item's
 * date — derived, exactly as a planet's epoch is derived from its oldest
 * child — so the first video is the origin of this system's time.
 *
 * `windRate` matches the atlas's. One wind rate for the whole map: the arms of
 * two systems seen together in one frame must curve the same way, or the
 * spiral stops reading as a property of the map and starts reading as a
 * property of whichever system you are in.
 */
export const SOLAR_SYSTEM_CHANNEL: Scope = {
  id: "solarSystem:channel",
  kind: "solarSystem",
  parent: GALAXY_ID,
  label: "The Channel",
  epoch: channelEpoch(CHANNEL_ITEMS),
  arms: Object.fromEntries(
    CHANNEL_ARM_IDS.map((arm, i) => [arm, (i / CHANNEL_ARM_IDS.length) * 2 * Math.PI]),
  ),
  windRate: SOLAR_SYSTEM_ZEMI.windRate,
};

/**
 * Every solar system in the galaxy, in the order they were founded.
 *
 * The registry is the single place a system is declared. `GALAXY_ZEMI.arms`,
 * `SCOPES` and the uniqueness guard are all folds over this array, so a second
 * system is one row rather than an edit in four files.
 */
export const SOLAR_SYSTEMS: Scope[] = [SOLAR_SYSTEM_ZEMI, SOLAR_SYSTEM_CHANNEL];

/** e.g. solarSystemScopeId("atlas") -> "solarSystem:atlas". One spelling, one place. */
export function solarSystemScopeId(name: string): ScopeId {
  return `solarSystem:${name}`;
}

/** The inverse. Loud rather than defaulted, the rule `getScope` already follows. */
export function systemName(scopeId: ScopeId): string {
  if (!scopeId.startsWith("solarSystem:")) {
    throw new Error(`scope "${scopeId}" is not a solar system`);
  }
  return scopeId.slice("solarSystem:".length);
}

/**
 * The universe root, and a real frame.
 *
 * Its arms are **derived from the registry** — one per solar system, named for
 * it, evenly spaced — rather than authored, so the galaxy's own table cannot
 * fall out of step with the systems it describes. That is what lets a solar
 * system be placed by `polar()`, the same function that places a repository on
 * an arm and a moon around a planet: the map's one rule, that angle means arm
 * and radius means time, now holds at every level of the tree instead of
 * stopping one short of the root.
 *
 * The galaxy holds no bodies of its own. Nothing is parented here.
 */
export const GALAXY_ZEMI: Scope = {
  id: GALAXY_ID,
  kind: "galaxy",
  label: "Zemí Echelon",
  epoch: "2025-11-06",
  arms: Object.fromEntries(
    SOLAR_SYSTEMS.map((s, i) => [systemName(s.id), (i / SOLAR_SYSTEMS.length) * 2 * Math.PI]),
  ),
  // One wind rate for the whole map, so the galaxy's arms curve exactly as the
  // arms inside its systems do. Unobservable while the only system sits at the
  // core at radius zero; the first system placed off-centre is what shows it.
  windRate: SOLAR_SYSTEM_ZEMI.windRate,
};

/** e.g. planetScopeId("products") -> "planet:products". One spelling, one place. */
export function planetScopeId(arm: string): ScopeId {
  return `planet:${arm}`;
}

/** e.g. moonScopeId("PickMe") -> "moon:PickMe". Here, not in moons.ts, so that
 * scopes.ts can spell a moon's id without importing the module that imports it. */
export function moonScopeId(bodyId: string): ScopeId {
  return `moon:${bodyId}`;
}

/**
 * What makes flat scope ids safe rather than lucky.
 *
 * `planet:products` and `moon:PickMe` carry no system segment. Two systems
 * claiming one arm name would therefore collide on a single planet scope, and
 * two bodies sharing an id would collide on a single moon scope *and* on the
 * `#/<id>` deep link — a video quietly answering a repository's URL. Both are
 * true-by-inspection today and would stay true by coincidence.
 *
 * So the coincidence is asserted at module load. Loud, not defaulted: the rule
 * `loadBodies`, `getScope`, `validateIdeals` and `shardRadiusFor` already
 * follow. Qualifying the ids instead (`planet:channel/vlogs`) is the other way
 * to buy this, and costs a format change across the deep links, the pins and
 * every test — worth doing at three systems, not at two.
 */
export function validateGalaxy(systems: Scope[], bodies: Body[]): void {
  const armOwner = new Map<string, ScopeId>();
  for (const system of systems) {
    for (const arm of Object.keys(system.arms)) {
      const owner = armOwner.get(arm);
      if (owner !== undefined) {
        throw new Error(
          `arm "${arm}" is declared by both "${owner}" and "${system.id}" — ` +
            `they would collide on the single scope "${planetScopeId(arm)}"`,
        );
      }
      armOwner.set(arm, system.id);
    }
  }

  const seen = new Set<string>();
  for (const body of bodies) {
    if (seen.has(body.id)) {
      throw new Error(
        `body "${body.id}" is declared twice in the galaxy — ` +
          `they would collide on "${moonScopeId(body.id)}" and on the deep link "#/${body.id}"`,
      );
    }
    seen.add(body.id);
  }
}
