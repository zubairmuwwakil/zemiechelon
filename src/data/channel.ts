import type { ArmId } from "@/lib/atlas/types";

/**
 * The channel's arms, in the order they read in the nav dock.
 *
 * Angles are NOT here. `galaxy.ts` spaces them evenly from this list, so a
 * fifth arm is one row and nobody chooses a number.
 */
export const CHANNEL_ARM_IDS = ["vlogs", "shorts", "tutorials", "devlogs"] as const;

export interface ChannelItem {
  /** Stable slug. Unique across the whole galaxy — `validateGalaxy` asserts it. */
  id: string;
  title: string;
  arm: ArmId;
  /** ISO date. For an unpublished idea, the date you had it. */
  publishedAt: string;
  /** ISO date it was re-pinned, re-shared or revisited. Defaults to `publishedAt`. */
  resurfacedAt?: string;
  /** Required for a published video. Absent for an idea. */
  runtimeSeconds?: number;
  /** Present ⇒ a moon. Absent ⇒ a dwarf planet. `kind` is derived, never authored. */
  url?: string;
  blurb?: string;
}

/**
 * The channel, hand-maintained. There is no YouTube API here and none planned.
 *
 * Replace these with your own items. The shape is what matters: a published
 * video carries a `url` and a `runtimeSeconds`; an idea carries neither.
 */
export const CHANNEL_ITEMS: ChannelItem[] = [
  {
    id: "channel-trailer",
    title: "Channel trailer",
    arm: "vlogs",
    publishedAt: "2026-03-04",
    runtimeSeconds: 96,
    url: "https://www.youtube.com/watch?v=REPLACE_ME_1",
    blurb: "What this channel is for.",
  },
  {
    id: "building-the-atlas",
    title: "Building the Zemí atlas",
    arm: "devlogs",
    publishedAt: "2026-04-18",
    runtimeSeconds: 1_940,
    url: "https://www.youtube.com/watch?v=REPLACE_ME_2",
    blurb: "Turning a GitHub account into a solar system.",
  },
  {
    id: "deterministic-engines",
    title: "Deterministic engines, end to end",
    arm: "tutorials",
    publishedAt: "2026-06-02",
    resurfacedAt: "2026-08-01",
    runtimeSeconds: 2_705,
    url: "https://www.youtube.com/watch?v=REPLACE_ME_3",
    blurb: "Why PickMe's recommendation engine has no network calls.",
  },
  {
    id: "sixty-second-swiftdata",
    title: "SwiftData in sixty seconds",
    arm: "shorts",
    publishedAt: "2026-07-11",
    runtimeSeconds: 58,
    url: "https://www.youtube.com/watch?v=REPLACE_ME_4",
  },
  {
    id: "orrery-teardown",
    title: "Teardown: how the orrery is drawn",
    arm: "devlogs",
    publishedAt: "2026-08-09",
  },
];

/**
 * The channel's epoch: its oldest item's date.
 *
 * Derived rather than typed, exactly as `derivePlanetScopes` derives a planet's
 * epoch from its oldest child. The first item is the origin of this system's
 * time, which is what an epoch means everywhere else in this map.
 *
 * Lives in the data module, not in `lib/atlas/channel.ts`, so `galaxy.ts` can
 * read it without importing a module that imports `galaxy.ts` back.
 */
export function channelEpoch(items: ChannelItem[]): string {
  if (items.length === 0) {
    // Loud, not defaulted. An invented epoch would place every later item at a
    // radius that means nothing.
    throw new Error("the channel declares no items — it has no epoch");
  }
  return items.map((i) => i.publishedAt).sort()[0];
}
