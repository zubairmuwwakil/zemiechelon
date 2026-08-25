import type { Body, ScopeId } from "./types";
import { planetScopeId } from "./galaxy";
import { CHANNEL_ARM_IDS, CHANNEL_ITEMS, type ChannelItem } from "@/data/channel";

/**
 * The channel's items, as bodies.
 *
 * `kind` is derived from the presence of a link, exactly as the repository
 * atlas derives a moon from a shipped venture's live URL — so publishing an
 * idea is one field, not two. Parenting follows the same predicate
 * `bodies.ts` uses: a moon belongs to its planet, a dwarf planet to the solar
 * system directly, the way a real dwarf planet orbits the sun rather than
 * another planet.
 */
export function toChannelBodies(items: ChannelItem[], systemId: ScopeId): Body[] {
  return items.map((item) => {
    const kind = item.url ? ("moon" as const) : ("dwarfPlanet" as const);
    return {
      id: item.id,
      label: item.title,
      parent: kind === "moon" ? planetScopeId(item.arm) : systemId,
      arm: item.arm,
      bornAt: item.publishedAt,
      // A video is published once. Without a resurfacing this equals the birth
      // date, the trail has zero length, and nothing draws one.
      lastTouchedAt: item.resurfacedAt ?? item.publishedAt,
      kind,
      anonymous: false,
      blurb: item.blurb,
      links: item.url ? { live: item.url } : {},
      runtimeSeconds: item.runtimeSeconds,
    };
  });
}

/** Fail the build, not the render — the rule `loadBodies` already follows. */
export function validateChannelItems(items: ChannelItem[]): void {
  const arms = new Set<string>(CHANNEL_ARM_IDS);
  const seen = new Set<string>();

  for (const item of items) {
    if (seen.has(item.id)) {
      throw new Error(`channel item "${item.id}" is declared twice`);
    }
    seen.add(item.id);

    if (!arms.has(item.arm)) {
      throw new Error(
        `channel item "${item.id}" uses arm "${item.arm}", which the channel does not declare`,
      );
    }
    if (item.url && item.runtimeSeconds === undefined) {
      throw new Error(
        `channel item "${item.id}" is published but has no runtimeSeconds — ` +
          `runtime is what sizes it, so it would render as the dimmest object in its arm`,
      );
    }
  }
}

validateChannelItems(CHANNEL_ITEMS);

/** The channel's bodies. Registered as a `BODY_SOURCES` row in `bodies.ts`. */
export function loadChannelBodies(): Body[] {
  return toChannelBodies(CHANNEL_ITEMS, "solarSystem:channel");
}
