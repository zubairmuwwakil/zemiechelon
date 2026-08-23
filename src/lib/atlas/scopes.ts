import type { Body, ScopeId } from "./types";
import { GALAXY_ZEMI, moonScopeId, planetScopeId, type Scope } from "./galaxy";
import { loadBodies } from "./bodies";
import { ARM_META } from "@/data/arms";

export { GALAXY_ZEMI, moonScopeId, planetScopeId, type Scope } from "./galaxy";

/**
 * A planet is a frame as soon as something shipped in its arm.
 *
 * Nothing is authored per planet. The epoch is the oldest child's birth, so
 * `radiusScale` restarts cleanly inside the planet rather than inheriting a
 * galaxy epoch that means nothing there. The single arm is named for the galaxy
 * arm so a moon's own `arm` still resolves and `placeBodies` runs unchanged in
 * the frame.
 */
export function derivePlanetScopes(bodies: Body[] = loadBodies()): Scope[] {
  const byArm = new Map<string, Body[]>();
  for (const body of bodies) {
    if (body.kind !== "system") continue;
    byArm.set(body.arm, [...(byArm.get(body.arm) ?? []), body]);
  }

  return [...byArm.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([arm, children]) => ({
      id: planetScopeId(arm),
      kind: "planet" as const,
      parent: GALAXY_ZEMI.id,
      label: ARM_META[arm]?.name ?? arm,
      epoch: children.map((c) => c.bornAt).sort()[0],
      arms: { [arm]: 0 },
      windRate: GALAXY_ZEMI.windRate,
    }));
}

/**
 * A shipped system is a frame, by the same rule that makes a planet one.
 *
 * Stated over `kind === "system"` rather than as a list, so a fifth venture
 * becomes a frame by adding a row — the same predicate `deriveMoons` uses, and
 * `bodies.test.ts` already holds the two together. The epoch is the body's own
 * birth, so `radiusScale` restarts cleanly inside the moon rather than
 * inheriting a galaxy epoch that means nothing there.
 */
export function deriveMoonScopes(bodies: Body[] = loadBodies()): Scope[] {
  return bodies
    .filter((body) => body.kind === "system")
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((body) => ({
      id: moonScopeId(body.id),
      kind: "system" as const,
      parent: planetScopeId(body.arm),
      label: body.label || body.id,
      epoch: body.bornAt,
      // Named for the galaxy arm so a body's own `arm` still resolves and
      // `placeBodies` runs unchanged in the frame, exactly as planet scopes do.
      arms: { [body.arm]: 0 },
      windRate: GALAXY_ZEMI.windRate,
    }));
}

export const SCOPES: Record<ScopeId, Scope> = {
  [GALAXY_ZEMI.id]: GALAXY_ZEMI,
  ...Object.fromEntries(derivePlanetScopes().map((s) => [s.id, s])),
  ...Object.fromEntries(deriveMoonScopes().map((s) => [s.id, s])),
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
