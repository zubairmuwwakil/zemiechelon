import type { Body, ScopeId } from "./types";
import {
  GALAXY_ZEMI,
  SOLAR_SYSTEMS,
  SOLAR_SYSTEM_ZEMI,
  moonScopeId,
  planetScopeId,
  validateGalaxy,
  type Scope,
} from "./galaxy";
import { allBodies, bodiesFor, loadBodies } from "./bodies";
import { ARM_META } from "@/data/arms";

export {
  GALAXY_ZEMI,
  SOLAR_SYSTEMS,
  SOLAR_SYSTEM_ZEMI,
  moonScopeId,
  planetScopeId,
  solarSystemScopeId,
  systemName,
  type Scope,
} from "./galaxy";

/**
 * A planet is a frame as soon as something shipped in its arm.
 *
 * Nothing is authored per planet. The epoch is the oldest child's birth, so
 * `radiusScale` restarts cleanly inside the planet rather than inheriting a
 * solar-system epoch that means nothing there. The single arm is named for the
 * solar system's arm so a moon's own `arm` still resolves and `placeBodies`
 * runs unchanged in the frame.
 *
 * `system` is the frame these planets belong to. It carries the parent id and
 * the wind rate, both of which used to be read off `SOLAR_SYSTEM_ZEMI`
 * directly — which is what made this function answer for exactly one solar
 * system rather than for the one it was given.
 */
export function derivePlanetScopes(
  bodies: Body[] = loadBodies(),
  system: Scope = SOLAR_SYSTEM_ZEMI,
): Scope[] {
  const byArm = new Map<string, Body[]>();
  for (const body of bodies) {
    if (body.kind !== "moon") continue;
    byArm.set(body.arm, [...(byArm.get(body.arm) ?? []), body]);
  }

  return [...byArm.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([arm, children]) => ({
      id: planetScopeId(arm),
      kind: "planet" as const,
      parent: system.id,
      label: ARM_META[arm]?.name ?? arm,
      epoch: children.map((c) => c.bornAt).sort()[0],
      arms: { [arm]: 0 },
      windRate: system.windRate,
    }));
}

/**
 * A shipped system is a frame, by the same rule that makes a planet one.
 *
 * Stated over `kind === "moon"` rather than as a list, so a fifth venture
 * becomes a frame by adding a row — the same predicate `deriveMoons` uses, and
 * `bodies.test.ts` already holds the two together. The epoch is the body's own
 * birth, so `radiusScale` restarts cleanly inside the moon rather than
 * inheriting a solar-system epoch that means nothing there.
 */
export function deriveMoonScopes(
  bodies: Body[] = loadBodies(),
  system: Scope = SOLAR_SYSTEM_ZEMI,
): Scope[] {
  return bodies
    .filter((body) => body.kind === "moon")
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((body) => ({
      id: moonScopeId(body.id),
      kind: "moon" as const,
      parent: planetScopeId(body.arm),
      label: body.label || body.id,
      epoch: body.bornAt,
      // Named for the solar system's arm so a body's own `arm` still resolves
      // and `placeBodies` runs unchanged in the frame, exactly as planet
      // scopes do.
      arms: { [body.arm]: 0 },
      windRate: system.windRate,
    }));
}

/**
 * The whole tree, as a fold over the registry.
 *
 * Written as a fold rather than as a spread of four literals so that adding a
 * solar system is a row in `SOLAR_SYSTEMS` and nothing here. The previous
 * spelling named `SOLAR_SYSTEM_ZEMI` three times, which is three places to
 * remember when there are two of them.
 */
export const SCOPES: Record<ScopeId, Scope> = {
  [GALAXY_ZEMI.id]: GALAXY_ZEMI,
  ...Object.fromEntries(
    SOLAR_SYSTEMS.flatMap((system) => {
      const bodies = bodiesFor(system);
      return [
        [system.id, system] as const,
        ...derivePlanetScopes(bodies, system).map((s) => [s.id, s] as const),
        ...deriveMoonScopes(bodies, system).map((s) => [s.id, s] as const),
      ];
    }),
  ),
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

// Fail the build, not the render. Two systems claiming one arm, or two bodies
// claiming one id, must surface the way an unassigned arm already does — see
// `validateGalaxy` for why flat scope ids need this to be checked rather than
// observed. Placed here, at the bottom, exactly as `ideals.ts` places its own.
validateGalaxy(SOLAR_SYSTEMS, allBodies());
