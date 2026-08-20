import type { ScopeId } from "./types";

/**
 * A coordinate frame. Bodies are laid out within their parent's frame, and the
 * camera composes frames as it descends. `arms` and `windRate` were module
 * constants in position.ts; they live here so a second galaxy is a row of data
 * rather than a navigation mode.
 */
export interface Scope {
  id: ScopeId;
  kind: "galaxy" | "system" | "planet";
  parent?: ScopeId;
  label: string;
  /** ISO date. Radius zero. */
  epoch: string;
  /** Arm name -> base angle in radians. */
  arms: Record<string, number>;
  /** How far an arm sweeps per e-fold of radius. Higher = tighter spiral. */
  windRate: number;
}

export const GALAXY_ZEMI: Scope = {
  id: "galaxy:zemi",
  kind: "galaxy",
  label: "Zemí Echelon",
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

export const SCOPES: Record<ScopeId, Scope> = {
  [GALAXY_ZEMI.id]: GALAXY_ZEMI,
};

export function getScope(id: ScopeId): Scope {
  const scope = SCOPES[id];
  if (!scope) {
    // Loud, not defaulted. A body in an unknown frame would render at the
    // origin and look like a layout bug, exactly as an unassigned arm would.
    throw new Error(`unknown scope "${id}"`);
  }
  return scope;
}

/** Root-first, so callers can compose transforms outermost to innermost. */
export function scopeChain(id: ScopeId): Scope[] {
  const chain: Scope[] = [];
  let cursor: ScopeId | undefined = id;
  while (cursor !== undefined) {
    const scope = getScope(cursor);
    chain.unshift(scope);
    cursor = scope.parent;
  }
  return chain;
}
