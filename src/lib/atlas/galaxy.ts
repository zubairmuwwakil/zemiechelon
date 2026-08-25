import type { ScopeId } from "./types";

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
 * The universe root. Holds no bodies of its own — a solar system is one row of
 * data under it, added when it is actually built, not scaffolded ahead of one
 * existing. `arms`/`windRate` sit unused here; nothing places a body directly
 * in the galaxy's own frame.
 */
export const GALAXY_ZEMI: Scope = {
  id: "galaxy:zemi",
  kind: "galaxy",
  label: "Zemí Echelon",
  epoch: "2025-11-06",
  arms: {},
  windRate: 0,
};

/** The repository atlas: the first solar system in the Zemí galaxy. */
export const SOLAR_SYSTEM_ZEMI: Scope = {
  id: "solarSystem:atlas",
  kind: "solarSystem",
  parent: GALAXY_ZEMI.id,
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

/** e.g. planetScopeId("products") -> "planet:products". One spelling, one place. */
export function planetScopeId(arm: string): ScopeId {
  return `planet:${arm}`;
}

/** e.g. moonScopeId("PickMe") -> "moon:PickMe". Here, not in moons.ts, so that
 * scopes.ts can spell a moon's id without importing the module that imports it. */
export function moonScopeId(bodyId: string): ScopeId {
  return `moon:${bodyId}`;
}

/** e.g. solarSystemScopeId("atlas") -> "solarSystem:atlas". One spelling, one place. */
export function solarSystemScopeId(name: string): ScopeId {
  return `solarSystem:${name}`;
}
