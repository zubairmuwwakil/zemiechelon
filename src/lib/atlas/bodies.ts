import generated from "@/data/bodies.generated.json";
import { OVERRIDES } from "@/data/bodies.overrides";
import type { Body } from "./types";
import {
  SOLAR_SYSTEMS,
  SOLAR_SYSTEM_CHANNEL,
  SOLAR_SYSTEM_ZEMI,
  planetScopeId,
  type Scope,
} from "./galaxy";
import type { ScopeId } from "./types";
import { loadChannelBodies } from "./channel";

/** Re-exported from the galaxy scope so the epoch is declared once. */
export const EPOCH = SOLAR_SYSTEM_ZEMI.epoch;

export function loadBodies(): Body[] {
  return generated.bodies.map((g) => {
    const o = OVERRIDES[g.id];
    if (!o) {
      // Build-time failure, not a silent default. An unassigned repo would
      // otherwise render at the origin and look like a layout bug.
      throw new Error(`no arm assigned for repo "${g.id}" — add it to bodies.overrides.ts`);
    }
    const kind = o.kind ?? ("dwarfPlanet" as const);
    // A moon belongs to its planet; a dwarf planet belongs to the solar system
    // directly, the same way a real dwarf planet orbits the sun rather than
    // another planet. This is the same predicate deriveMoons uses;
    // bodies.test.ts holds the two together.
    const parent = kind === "moon" ? planetScopeId(o.arm) : SOLAR_SYSTEM_ZEMI.id;

    if (g.anonymous) {
      return {
        id: g.id,
        parent,
        label: o.label ?? "Private repository",
        arm: o.arm,
        bornAt: g.bornAt,
        lastTouchedAt: g.lastTouchedAt,
        kind: "dwarfPlanet" as const,
        anonymous: true,
        links: {},
      };
    }
    return {
      id: g.id,
      parent,
      label: o.label ?? g.id,
      arm: o.arm,
      bornAt: g.bornAt,
      lastTouchedAt: g.lastTouchedAt,
      kind,
      anonymous: false,
      blurb: o.blurb ?? g.description ?? undefined,
      stack: o.stack,
      links: {
        github: `https://github.com/zubairmuwwakil/${g.id}`,
        ...(o.live ? { live: o.live } : {}),
        ...(o.appStore ? { appStore: o.appStore } : {}),
      },
      satellites: o.satellites,
      consoleId: o.consoleId,
      milestone: o.milestone,
    };
  });
}

/**
 * Where each solar system's bodies come from.
 *
 * A table rather than a branch, because the thing that varies between systems
 * is only the loader: the atlas reads a generated manifest of repositories, and
 * a later system reads a hand-maintained list. Everything downstream —
 * placement, scoping, gating, framing — takes a `Body[]` and does not care
 * which produced it.
 */
const BODY_SOURCES: Record<ScopeId, () => Body[]> = {
  [SOLAR_SYSTEM_ZEMI.id]: loadBodies,
  [SOLAR_SYSTEM_CHANNEL.id]: loadChannelBodies,
};

/** One solar system's own bodies. Loud rather than empty: a system with no
 * declared source would render as a bare sun and look like a data outage. */
export function bodiesFor(system: Scope): Body[] {
  const source = BODY_SOURCES[system.id];
  if (!source) {
    throw new Error(`solar system "${system.id}" declares no body source`);
  }
  return source();
}

/** Every body in the galaxy. Only the uniqueness guard needs the whole set. */
export function allBodies(): Body[] {
  return SOLAR_SYSTEMS.flatMap(bodiesFor);
}
