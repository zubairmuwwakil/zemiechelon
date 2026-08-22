import generated from "@/data/bodies.generated.json";
import { OVERRIDES } from "@/data/bodies.overrides";
import type { Body } from "./types";
import { GALAXY_ZEMI, planetScopeId } from "./galaxy";

/** Re-exported from the galaxy scope so the epoch is declared once. */
export const EPOCH = GALAXY_ZEMI.epoch;

export function loadBodies(): Body[] {
  return generated.bodies.map((g) => {
    const o = OVERRIDES[g.id];
    if (!o) {
      // Build-time failure, not a silent default. An unassigned repo would
      // otherwise render at the origin and look like a layout bug.
      throw new Error(`no arm assigned for repo "${g.id}" — add it to bodies.overrides.ts`);
    }
    const kind = o.kind ?? ("star" as const);
    // A shipped system belongs to its planet, not to the galaxy. This is the same
    // predicate deriveMoons uses; bodies.test.ts holds the two together.
    const parent = kind === "system" ? planetScopeId(o.arm) : GALAXY_ZEMI.id;

    if (g.anonymous) {
      return {
        id: g.id,
        parent,
        label: o.label ?? "Private repository",
        arm: o.arm,
        bornAt: g.bornAt,
        lastTouchedAt: g.lastTouchedAt,
        kind: "star" as const,
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
