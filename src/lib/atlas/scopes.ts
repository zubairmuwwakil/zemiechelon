import type { ScopeId } from "./types";
import { GALAXY_ZEMI, type Scope } from "./galaxy";

export { GALAXY_ZEMI, planetScopeId, type Scope } from "./galaxy";

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
