# Zemí Channel — Second Solar System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a second solar system — a YouTube channel — as a sibling of the
repository atlas under `GALAXY_ZEMI`, drawn as a real second orrery, with
galaxy-level camera and journey navigation to fly between the two.

**Architecture:** Approach B of the spec. `WorldSceneBuilder` takes a
solar-system `Scope` and its own body set and is instantiated twice under a new
galaxy root `Object3D`. Scope ids stay flat, protected by the module-load
`validateGalaxy` guard that Phase 0 already landed. The repository atlas's
epoch is the galaxy epoch, so it sits at galactic radius zero and **does not
move** — every existing camera preset, pin anchor and golden position fixture
keeps describing the scene it describes today.

**Tech Stack:** TypeScript, Next.js, three.js, vitest.

**Spec:** `docs/superpowers/specs/2026-08-25-zemi-channel-solar-system-design.md`

**Already done — do not redo.** Phase 0 landed as commit `cab1aa4`:
the `SOLAR_SYSTEMS` registry, `GALAXY_ZEMI.arms` derived from it, `SCOPES` as a
fold, `derivePlanetScopes`/`deriveMoonScopes` taking a system scope,
`bodiesFor`/`allBodies`, `validateGalaxy` at module load, and `SCENE_SCALE`
unified into `src/lib/atlas/scale.ts`.

## Global Constraints

- **`radiusScale` is never re-derived.** Distance is always
  `Math.sqrt(Math.max(0, days)) * 1.15`, from `src/lib/atlas/position.ts`.
- **Nothing authored that can be derived.** Every number added by this plan is
  a date, a count, or a ratio with a written reason. If a task tempts you to
  type a coordinate, you have the wrong task.
- **Loud, not defaulted.** Bad data throws at module load. The rule
  `loadBodies`, `getScope`, `validateIdeals`, `shardRadiusFor` and
  `validateGalaxy` all follow.
- **`MAX_SYSTEM_TILT = (10 * Math.PI) / 180`** — bounded by
  `surfaceCamera.test.ts:107`'s 15° off-axis assertion.
- **`RUNTIME_PIVOT_MINUTES = 10`** — a ten-minute video reads exactly as bright
  as a shipped repository.
- **`SHARD_RADIUS_MULTIPLE`, `MOON_ORBIT`, `MAX_INCLINATION`, `MAX_OBLIQUITY`,
  `ASTROLABE_OUTER = 205`** are unchanged. Do not retune them.
- **Motion is applied strictly above placement.** Nothing in `motion.ts` may be
  consulted when deciding where something *is*.
- **The atlas must not move.** `positionParity.test.ts` passes unmodified at
  every commit in this plan. If it fails, you have changed placement, not
  presentation — stop and re-read the spec's §6.1.
- **Verification per task:** `npx vitest run`, `npx tsc --noEmit`, and
  `npx eslint --max-warnings 0` all clean before the commit.

## File Structure

| File | Responsibility |
|---|---|
| `src/data/channel.ts` | **Create.** Hand-maintained channel items and the arm id list. No logic. |
| `src/lib/atlas/channel.ts` | **Create.** `ChannelItem[]` → `Body[]`, plus validation. |
| `src/lib/atlas/galaxyPlacement.ts` | **Create.** Where a solar system sits in the galaxy: centre, tilt, rise, `GALAXY_SPREAD`, `galaxyReach`. |
| `src/components/world/GalaxyBuilder.ts` | **Create.** The galaxy frame's own furniture — today, the sky shell. |
| `src/lib/atlas/galaxy.ts` | Add `SOLAR_SYSTEM_CHANNEL`, register it. |
| `src/lib/atlas/types.ts` | Add `Body.runtimeSeconds`. |
| `src/lib/atlas/bodies.ts` | Add the channel's `BODY_SOURCES` row. |
| `src/lib/atlas/magnitude.ts` | Runtime branch. |
| `src/lib/atlas/timeline.ts` | Absolute calendar dates. |
| `src/lib/atlas/journey.ts` | `galaxy` and identified `solarSystem` positions. |
| `src/data/arms.ts`, `src/components/world/PlanetSurfaces.ts`, `src/components/world/planetPins.ts` | Four channel arm entries each. |
| `src/components/world/WorldSceneBuilder.ts` | Take a scope; stop owning the sky. |
| `src/components/world/WorldCameraManager.ts` | Galaxy pose; solar-system framing. |
| `src/components/world/WorldCanvas.tsx` | Galaxy root; two builders; new framing branches. |
| `src/components/hud/WorldHUD.tsx`, `src/app/page.tsx` | System switcher; derived arm dock. |

---

### Task 1: Channel data and its loader

The schema, the validation and the `Body` mapping. The channel is **not**
registered as a solar system yet, so this task changes nothing the app draws.

**Files:**
- Create: `src/data/channel.ts`
- Create: `src/lib/atlas/channel.ts`
- Modify: `src/lib/atlas/types.ts`
- Test: `src/lib/atlas/__tests__/channel.test.ts`

**Interfaces:**
- Consumes: `Body`, `ArmId` from `src/lib/atlas/types.ts`; `planetScopeId`,
  `solarSystemScopeId` from `src/lib/atlas/galaxy.ts`.
- Produces:
  - `CHANNEL_ARM_IDS: readonly string[]` (data/channel.ts)
  - `CHANNEL_ITEMS: ChannelItem[]` (data/channel.ts)
  - `interface ChannelItem` (data/channel.ts)
  - `channelEpoch(items: ChannelItem[]): string` (data/channel.ts — lives here
    so `galaxy.ts` can read it without importing `lib/atlas/channel.ts`, which
    imports `galaxy.ts` back)
  - `validateChannelItems(items: ChannelItem[]): void` (lib/atlas/channel.ts)
  - `toChannelBodies(items: ChannelItem[], systemId: ScopeId): Body[]` (lib/atlas/channel.ts)
  - `loadChannelBodies(): Body[]` (lib/atlas/channel.ts)

- [ ] **Step 1: Write the failing test**

Create `src/lib/atlas/__tests__/channel.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { channelEpoch, type ChannelItem } from "@/data/channel";
import { toChannelBodies, validateChannelItems } from "../channel";
import { planetScopeId, solarSystemScopeId } from "../galaxy";

const SYSTEM = solarSystemScopeId("channel");

const published: ChannelItem = {
  id: "first-build-log",
  title: "First build log",
  arm: "devlogs",
  publishedAt: "2026-03-04",
  runtimeSeconds: 640,
  url: "https://example.test/first-build-log",
};

const idea: ChannelItem = {
  id: "someday-teardown",
  title: "Someday: a teardown",
  arm: "tutorials",
  publishedAt: "2026-04-01",
};

describe("toChannelBodies", () => {
  it("makes a published item a moon, parented to its arm's planet", () => {
    const [body] = toChannelBodies([published], SYSTEM);
    expect(body.kind).toBe("moon");
    expect(body.parent).toBe(planetScopeId("devlogs"));
    expect(body.links.live).toBe(published.url);
  });

  it("makes an unpublished item a dwarf planet, parented to the system", () => {
    const [body] = toChannelBodies([idea], SYSTEM);
    expect(body.kind).toBe("dwarfPlanet");
    expect(body.parent).toBe(SYSTEM);
    expect(body.links.live).toBeUndefined();
  });

  it("carries runtime through so magnitude can read it", () => {
    expect(toChannelBodies([published], SYSTEM)[0].runtimeSeconds).toBe(640);
  });

  it("ends a trail at the resurfaced date, and at the publish date without one", () => {
    const [plain] = toChannelBodies([published], SYSTEM);
    expect(plain.lastTouchedAt).toBe(published.publishedAt);

    const [revived] = toChannelBodies(
      [{ ...published, resurfacedAt: "2026-06-01" }],
      SYSTEM,
    );
    expect(revived.lastTouchedAt).toBe("2026-06-01");
  });
});

describe("validateChannelItems", () => {
  it("accepts a well-formed set", () => {
    expect(() => validateChannelItems([published, idea])).not.toThrow();
  });

  it("rejects a published item with no runtime", () => {
    const { runtimeSeconds: _drop, ...noRuntime } = published;
    expect(() => validateChannelItems([noRuntime])).toThrow(/runtimeSeconds/);
  });

  it("rejects an arm the channel does not declare", () => {
    expect(() =>
      validateChannelItems([{ ...idea, arm: "products" }]),
    ).toThrow(/arm "products"/);
  });

  it("rejects a duplicate id", () => {
    expect(() => validateChannelItems([idea, idea])).toThrow(/someday-teardown/);
  });
});

describe("channelEpoch", () => {
  it("is the oldest item's date, so the first item is the origin of time", () => {
    expect(channelEpoch([published, idea])).toBe("2026-03-04");
  });

  it("throws on an empty channel rather than inventing an epoch", () => {
    expect(() => channelEpoch([])).toThrow(/no items/);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/lib/atlas/__tests__/channel.test.ts`
Expected: FAIL — `Failed to resolve import "@/data/channel"`.

- [ ] **Step 3: Add `runtimeSeconds` to `Body`**

In `src/lib/atlas/types.ts`, inside `interface Body`, directly after `milestone`:

```ts
  /**
   * Seconds of finished runtime, for a body that is a recording rather than a
   * repository. Read by `magnitude`: a video is published once and never
   * touched, so its lifespan is zero by construction and cannot be the honest
   * signal that lifespan is for a repository. Absent for an idea, because
   * nothing has been made yet.
   */
  runtimeSeconds?: number;
```

- [ ] **Step 4: Write `src/data/channel.ts`**

```ts
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
```

- [ ] **Step 5: Write `src/lib/atlas/channel.ts`**

```ts
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
```

- [ ] **Step 6: Run the tests and the whole suite**

Run: `npx vitest run src/lib/atlas/__tests__/channel.test.ts`
Expected: PASS, 10 tests.

Run: `npx vitest run && npx tsc --noEmit && npx eslint --max-warnings 0`
Expected: all clean. The existing 621 tests are untouched — nothing is
registered yet.

- [ ] **Step 7: Commit**

```bash
git add src/data/channel.ts src/lib/atlas/channel.ts src/lib/atlas/types.ts src/lib/atlas/__tests__/channel.test.ts
git commit -m "feat(channel): a hand-maintained channel, as bodies

A published video is a moon and an idea is a dwarf planet, derived from
whether a link exists — the same rule the atlas uses for a shipped venture,
so publishing an idea is one field rather than two.

The epoch is the oldest item's date, derived exactly as a planet's is from
its oldest child. Nothing here is registered as a solar system yet."
```

---

### Task 2: Register the channel as a solar system

The point where the galaxy has two children. Nothing draws it yet; `SCOPES`,
`PLANET_CENTERS` and the guard all start seeing it.

**Files:**
- Modify: `src/lib/atlas/galaxy.ts`
- Modify: `src/lib/atlas/bodies.ts`
- Modify: `src/data/arms.ts`
- Modify: `src/components/world/PlanetSurfaces.ts`
- Modify: `src/components/world/planetPins.ts`
- Modify: `src/components/world/__tests__/planetSurfaces.test.ts:10`
- Test: `src/lib/atlas/__tests__/galaxyRegistry.test.ts` (extend)

**Interfaces:**
- Consumes: `CHANNEL_ARM_IDS`, `CHANNEL_ITEMS`, `channelEpoch` (Task 1);
  `loadChannelBodies` (Task 1).
- Produces: `SOLAR_SYSTEM_CHANNEL: Scope` from `src/lib/atlas/galaxy.ts`,
  registered second in `SOLAR_SYSTEMS`.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/atlas/__tests__/galaxyRegistry.test.ts`:

```ts
import { SOLAR_SYSTEM_CHANNEL } from "../galaxy";
import { CHANNEL_ARM_IDS } from "@/data/channel";
import { bodiesFor } from "../bodies";

describe("the channel solar system", () => {
  it("is registered as the galaxy's second system", () => {
    expect(SOLAR_SYSTEMS[1]).toBe(SOLAR_SYSTEM_CHANNEL);
    expect(SOLAR_SYSTEM_CHANNEL.parent).toBe(GALAXY_ZEMI.id);
  });

  it("declares exactly the channel's arms, evenly spaced", () => {
    const arms = Object.keys(SOLAR_SYSTEM_CHANNEL.arms);
    expect(arms.sort()).toEqual([...CHANNEL_ARM_IDS].sort());
    CHANNEL_ARM_IDS.forEach((arm, i) => {
      expect(SOLAR_SYSTEM_CHANNEL.arms[arm]).toBeCloseTo(
        (i / CHANNEL_ARM_IDS.length) * 2 * Math.PI,
        10,
      );
    });
  });

  it("takes its epoch from its oldest item, not from a typed date", () => {
    const oldest = bodiesFor(SOLAR_SYSTEM_CHANNEL)
      .map((b) => b.bornAt)
      .sort()[0];
    expect(SOLAR_SYSTEM_CHANNEL.epoch).toBe(oldest);
  });

  it("collides with nothing the atlas declares", () => {
    // The guard would have thrown at import. This states why it matters.
    const atlasArms = Object.keys(SOLAR_SYSTEM_ZEMI.arms);
    for (const arm of Object.keys(SOLAR_SYSTEM_CHANNEL.arms)) {
      expect(atlasArms, arm).not.toContain(arm);
    }
  });

  it("serves its own bodies through bodiesFor", () => {
    expect(bodiesFor(SOLAR_SYSTEM_CHANNEL).length).toBeGreaterThan(0);
    expect(bodiesFor(SOLAR_SYSTEM_CHANNEL)).not.toEqual(bodiesFor(SOLAR_SYSTEM_ZEMI));
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/lib/atlas/__tests__/galaxyRegistry.test.ts`
Expected: FAIL — `SOLAR_SYSTEM_CHANNEL` is not exported.

- [ ] **Step 3: Declare and register the system**

In `src/lib/atlas/galaxy.ts`, add the import at the top:

```ts
import { CHANNEL_ARM_IDS, CHANNEL_ITEMS, channelEpoch } from "@/data/channel";
```

Then, directly after `SOLAR_SYSTEM_ZEMI` and **before** `SOLAR_SYSTEMS`:

```ts
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
```

Change the registry line to:

```ts
export const SOLAR_SYSTEMS: Scope[] = [SOLAR_SYSTEM_ZEMI, SOLAR_SYSTEM_CHANNEL];
```

- [ ] **Step 4: Register the body source**

In `src/lib/atlas/bodies.ts`, add the import:

```ts
import { loadChannelBodies } from "./channel";
```

and the row, changing `BODY_SOURCES` to:

```ts
const BODY_SOURCES: Record<ScopeId, () => Body[]> = {
  [SOLAR_SYSTEM_ZEMI.id]: loadBodies,
  [SOLAR_SYSTEM_CHANNEL.id]: loadChannelBodies,
};
```

and widen the `galaxy` import on the first line to include
`SOLAR_SYSTEM_CHANNEL`.

- [ ] **Step 5: Give the four arms their editorial copy**

In `src/data/arms.ts`, append to the `ARMS` array (keeping the existing five
first, so the atlas's dock order is unchanged):

```ts
  {
    id: "vlogs",
    name: "Vlogs",
    shortName: "Vlogs",
    icon: "Video",
    tagline: "Talking, unedited",
    description:
      "The channel's least produced arm: what the week was, said out loud. Shortest to make and the first thing anyone watches.",
    themeColor: DIRECTION_A.verdigris,
  },
  {
    id: "shorts",
    name: "Shorts",
    shortName: "Shorts",
    icon: "Zap",
    tagline: "One idea, under a minute",
    description:
      "A single technique with nothing around it. The arm reads small on the map because runtime is what sizes a body, and that is exactly right.",
    themeColor: DIRECTION_A.gold,
  },
  {
    id: "tutorials",
    name: "Tutorials",
    shortName: "Tutorials",
    icon: "GraduationCap",
    tagline: "Long-form, start to finish",
    description:
      "The heaviest bodies in the channel. A tutorial is measured in tens of minutes, and the map says so without being told.",
    themeColor: DIRECTION_A.oxide,
  },
  {
    id: "devlogs",
    name: "Dev-logs",
    shortName: "Dev-logs",
    icon: "Hammer",
    tagline: "The work as it happens",
    description:
      "The arm that points back at the repository atlas: the same systems, being built, narrated while they are still wrong.",
    themeColor: DIRECTION_A.ink,
  },
```

- [ ] **Step 6: Give the four arms surfaces and pin heights**

In `src/components/world/PlanetSurfaces.ts`, add four entries to
`SURFACE_FAMILIES`. Patterns cycle through the four the shader already
implements; rotation rates ascend with how produced the arm is.

```ts
  vlogs: {
    arm: "vlogs",
    pattern: 0,
    rotationRate: 0.006,
    baseColor: DIRECTION_A.verdigris,
    accentColor: DIRECTION_A.rule,
  },
  shorts: {
    arm: "shorts",
    pattern: 3,
    rotationRate: 0.022,
    baseColor: DIRECTION_A.gold,
    accentColor: DIRECTION_A.ink,
  },
  tutorials: {
    arm: "tutorials",
    pattern: 1,
    rotationRate: 0.009,
    baseColor: DIRECTION_A.oxide,
    accentColor: DIRECTION_A.gold,
  },
  devlogs: {
    arm: "devlogs",
    pattern: 2,
    rotationRate: 0.014,
    baseColor: DIRECTION_A.ink,
    accentColor: DIRECTION_A.verdigris,
  },
```

In `src/components/world/planetPins.ts`, add to `PIN_HEIGHTS`:

```ts
  vlogs: 5.6,
  shorts: 5.2,
  tutorials: 6.4,
  devlogs: 6.0,
```

- [ ] **Step 7: Widen the surface-family test**

`src/components/world/__tests__/planetSurfaces.test.ts:10` asserts the families
cover exactly the atlas's arms. It must now cover the union across the
registry. Replace that line's assertion with:

```ts
    const declared = SOLAR_SYSTEMS.flatMap((s) => Object.keys(s.arms));
    expect(Object.keys(SURFACE_FAMILIES).sort()).toEqual(declared.sort());
```

and change the file's import to
`import { SOLAR_SYSTEMS } from "@/lib/atlas/scopes";`.

- [ ] **Step 8: Run everything**

Run: `npx vitest run && npx tsc --noEmit && npx eslint --max-warnings 0`
Expected: all clean.

**If `presetFraming.test.ts` or `planetPinAnchors.test.ts` fail**, the channel
is wider than the atlas and has taken over `SCENE_SCALE` — see
`src/lib/atlas/scale.ts`. That is the spec's §13 first risk arriving. Stop and
report the numbers rather than retuning; the fix is a data question, not a code
one.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(channel): register The Channel as the galaxy's second system

The galaxy now has two children. Nothing draws the second one yet — this is
SCOPES, bodiesFor, the arm copy, the surface families and the pin heights
catching up with a registry that has two rows in it.

validateGalaxy passing at import is the proof that flat scope ids still
identify exactly one planet and one body each."
```

---

### Task 3: Runtime brightness

**Files:**
- Modify: `src/lib/atlas/magnitude.ts`
- Test: `src/lib/atlas/__tests__/magnitude.test.ts` (extend; do not alter the
  existing five tests)

**Interfaces:**
- Consumes: `Body.runtimeSeconds` (Task 1).
- Produces: `RUNTIME_PIVOT_MINUTES: number` from `src/lib/atlas/magnitude.ts`.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/atlas/__tests__/magnitude.test.ts`:

```ts
import { RUNTIME_PIVOT_MINUTES } from "../magnitude";
import { loadChannelBodies } from "../channel";

describe("runtime brightness", () => {
  const channel = loadChannelBodies();
  const withRuntime = channel.filter((b) => b.runtimeSeconds !== undefined);

  it("makes a video at the pivot exactly as bright as a shipped repository", () => {
    const pivot = { ...withRuntime[0], runtimeSeconds: RUNTIME_PIVOT_MINUTES * 60 };
    expect(magnitude(pivot)).toBeCloseTo(MOON_MAGNITUDE, 10);
  });

  it("ranks a long tutorial above a short", () => {
    const short = { ...withRuntime[0], runtimeSeconds: 58 };
    const tutorial = { ...withRuntime[0], runtimeSeconds: 2_705 };
    expect(magnitude(tutorial)).toBeGreaterThan(magnitude(short));
  });

  it("beats the moon pin, because a video that is a moon still has a runtime", () => {
    // The branch order is the whole point: `kind === "moon"` would flatten
    // every published video to MOON_MAGNITUDE and delete the arm's texture.
    const short = { ...withRuntime[0], kind: "moon" as const, runtimeSeconds: 58 };
    expect(magnitude(short)).toBeLessThan(MOON_MAGNITUDE);
  });

  it("leaves an idea, which has no runtime, on the lifespan rule", () => {
    const idea = channel.find((b) => b.runtimeSeconds === undefined)!;
    expect(magnitude(idea)).toBeGreaterThan(0);
    expect(magnitude(idea)).toBeLessThan(MOON_MAGNITUDE);
  });

  it("is positive for every channel body", () => {
    for (const b of channel) expect(magnitude(b), b.id).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/lib/atlas/__tests__/magnitude.test.ts`
Expected: FAIL — `RUNTIME_PIVOT_MINUTES` is not exported.

- [ ] **Step 3: Add the branch**

In `src/lib/atlas/magnitude.ts`, add above `magnitude`:

```ts
/**
 * Minutes of runtime that read exactly as bright as a shipped repository.
 *
 * The one calibration the runtime rule needs. At ten minutes a video sits on
 * `MOON_MAGNITUDE`; a 58-second short falls to 0.89 and a 45-minute tutorial
 * rises to 8.5. Square root rather than linear, for the reason `radiusScale`
 * is: the long tail would otherwise dominate everything shorter.
 */
export const RUNTIME_PIVOT_MINUTES = 10;
```

and make the first statement of `magnitude`:

```ts
  // FIRST, deliberately. A published video IS a moon, so the `kind` test below
  // would flatten every one of them to MOON_MAGNITUDE and take the texture out
  // of the arm. Lifespan is the honest signal for a repository because a
  // repository stays alive; a video is published once and never touched, so its
  // lifespan is zero by construction. Runtime is the same claim one domain
  // over: how much was made.
  if (body.runtimeSeconds !== undefined) {
    return MOON_MAGNITUDE * Math.sqrt(body.runtimeSeconds / 60 / RUNTIME_PIVOT_MINUTES);
  }
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run && npx tsc --noEmit && npx eslint --max-warnings 0`
Expected: all clean. The five original `magnitude` tests pass **unmodified** —
they iterate `loadBodies()`, which has no runtimes in it.

- [ ] **Step 5: Commit**

```bash
git add src/lib/atlas/magnitude.ts src/lib/atlas/__tests__/magnitude.test.ts
git commit -m "feat(channel): size a video by its runtime

Lifespan cannot carry over. A video is published once and never touched, so
its lifespan is zero by construction and every video would be the dimmest
object in the galaxy. Runtime is the same kind of claim: how much was made.

The branch runs before the moon pin, because a published video is a moon and
the pin would otherwise flatten a 58-second short and a 45-minute tutorial to
the same value."
```

---

### Task 4: Where a solar system sits in the galaxy

Pure geometry. Nothing consumes it yet.

**Files:**
- Create: `src/lib/atlas/galaxyPlacement.ts`
- Test: `src/lib/atlas/__tests__/galaxyPlacement.test.ts`

**Interfaces:**
- Consumes: `SOLAR_SYSTEMS`, `GALAXY_ZEMI`, `SOLAR_SYSTEM_ZEMI` from
  `src/lib/atlas/galaxy.ts`; `polar`, `radiusScale`, `daysSinceEpoch` from
  `src/lib/atlas/position.ts`; `deriveWorldRadius` from
  `src/lib/atlas/planets.ts`; `bodiesFor` from `src/lib/atlas/bodies.ts`;
  `SCENE_SCALE` from `src/lib/atlas/scale.ts`; `systemName` from
  `src/lib/atlas/galaxy.ts`.
- Produces, all from `src/lib/atlas/galaxyPlacement.ts`:
  - `MAX_SYSTEM_TILT: number`
  - `GALAXY_SPREAD: number`
  - `interface SystemPlacement { center: Vec3; tilt: number }`
  - `systemReach(system: Scope): number`
  - `placeSolarSystem(system: Scope): SystemPlacement`
  - `GALAXY_REACH: number`

- [ ] **Step 1: Write the failing test**

Create `src/lib/atlas/__tests__/galaxyPlacement.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  GALAXY_REACH,
  GALAXY_SPREAD,
  MAX_SYSTEM_TILT,
  placeSolarSystem,
  systemReach,
} from "../galaxyPlacement";
import { SOLAR_SYSTEMS, SOLAR_SYSTEM_CHANNEL, SOLAR_SYSTEM_ZEMI } from "../galaxy";

const length = (v: { x: number; y: number; z: number }) => Math.hypot(v.x, v.y, v.z);

describe("placeSolarSystem", () => {
  it("puts the repository atlas exactly at the galactic core", () => {
    // Its epoch IS the galaxy epoch, so radiusScale(0) is 0. This is what lets
    // the entire existing scene stay where it is.
    expect(length(placeSolarSystem(SOLAR_SYSTEM_ZEMI).center)).toBe(0);
  });

  it("leaves the atlas exactly unleaned", () => {
    // Tilt scales with radius, so the core is in the galactic plane by
    // construction — which is what keeps surfaceCamera.test.ts's 15 degree
    // off-axis budget entirely unspent.
    expect(placeSolarSystem(SOLAR_SYSTEM_ZEMI).tilt).toBe(0);
  });

  it("puts a later system further out", () => {
    expect(length(placeSolarSystem(SOLAR_SYSTEM_CHANNEL).center)).toBeGreaterThan(0);
  });

  it("leans a system no further than the ceiling", () => {
    for (const s of SOLAR_SYSTEMS) {
      expect(placeSolarSystem(s).tilt, s.id).toBeLessThanOrEqual(MAX_SYSTEM_TILT);
      expect(placeSolarSystem(s).tilt, s.id).toBeGreaterThanOrEqual(0);
    }
  });

  it("lifts a leaning system out of the galactic plane and nothing else", () => {
    const atlas = placeSolarSystem(SOLAR_SYSTEM_ZEMI);
    expect(atlas.center.y).toBe(0);
    const channel = placeSolarSystem(SOLAR_SYSTEM_CHANNEL);
    expect(channel.center.y).toBeGreaterThan(0);
  });

  it("never lets two systems' discs overlap", () => {
    for (const a of SOLAR_SYSTEMS) {
      for (const b of SOLAR_SYSTEMS) {
        if (a === b) continue;
        const ca = placeSolarSystem(a).center;
        const cb = placeSolarSystem(b).center;
        const gap = Math.hypot(ca.x - cb.x, ca.y - cb.y, ca.z - cb.z);
        const needed = systemReach(a) + systemReach(b) + Math.min(systemReach(a), systemReach(b));
        expect(gap, `${a.id} vs ${b.id}`).toBeGreaterThanOrEqual(needed - 1e-6);
      }
    }
  });
});

describe("scale", () => {
  it("makes the galaxy frame wider than the body frame", () => {
    // If this ever fails, systems are being separated at body scale and their
    // discs will intersect. See the spec's 6.2.
    expect(GALAXY_SPREAD).toBeGreaterThan(0);
  });

  it("reaches past the outermost system's rim", () => {
    for (const s of SOLAR_SYSTEMS) {
      const d = length(placeSolarSystem(s).center);
      expect(GALAXY_REACH).toBeGreaterThanOrEqual(d + systemReach(s) - 1e-6);
    }
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/lib/atlas/__tests__/galaxyPlacement.test.ts`
Expected: FAIL — cannot resolve `../galaxyPlacement`.

- [ ] **Step 3: Write the module**

Create `src/lib/atlas/galaxyPlacement.ts`:

```ts
import type { Vec3 } from "./types";
import { GALAXY_ZEMI, SOLAR_SYSTEMS, systemName, type Scope } from "./galaxy";
import { bodiesFor } from "./bodies";
import { deriveWorldRadius } from "./planets";
import { daysSinceEpoch, polar, radiusScale } from "./position";
import { SCENE_SCALE } from "./scale";

/**
 * Radians. A solar system's plane never leans further than this from the
 * galactic plane.
 *
 * Bounded by the surface camera, not by taste. `surfaceCamera.test.ts` asserts
 * a standing visitor keeps the parent within 15 degrees off-axis, and
 * `MAX_INCLINATION` (12 degrees) already spends most of that: a tilted
 * ancestor spends more, because `leveledFrameMatrix` levels the camera against
 * WORLD up while the ground rides its own frame.
 *
 * Today nothing spends it at all — see `tiltFor`, which is zero at the core,
 * and the core is the only system that declares surfaces. **A future system
 * that earns ground must re-measure this number.**
 */
export const MAX_SYSTEM_TILT = (10 * Math.PI) / 180;

/** How far a system's own bodies reach from its centre, in scene units. */
export function systemReach(system: Scope): number {
  return deriveWorldRadius(bodiesFor(system), system) * SCENE_SCALE;
}

/** A system's distance from the galactic core, in LAYOUT units. */
function layoutRadius(system: Scope): number {
  return radiusScale(daysSinceEpoch(system.epoch, GALAXY_ZEMI.epoch));
}

/** A system's direction from the core, in layout units, on its galaxy arm. */
function direction(system: Scope): Vec3 {
  return polar(systemName(system.id), layoutRadius(system), GALAXY_ZEMI);
}

/**
 * Layout units -> scene units, in the GALAXY's frame.
 *
 * The counterpart of `SCENE_SCALE` one level up, and derived by the same kind
 * of argument: a requirement solved for the quotient rather than a number that
 * framed the world on the day it was typed.
 *
 * The requirement is that no two systems' discs intersect — for every pair,
 * the centres are at least `reach(A) + reach(B) + min(reach(A), reach(B))`
 * apart, so they clear each other by the smaller one's own radius.
 *
 * Separating systems at the BODY scale does not satisfy this and must not be
 * re-attempted. The atlas reaches 205 scene units; a channel founded in
 * February 2026 is 87 days from the galaxy epoch, so `radiusScale(87)` is
 * 10.72 layout units — 113 scene units at the body scale, comfortably inside
 * the atlas's own disc.
 *
 * Stated over planar distance and checked over the full 3D distance, which is
 * never smaller: lifting a system out of the plane can only increase the
 * clearance this guarantees.
 */
export const GALAXY_SPREAD: number = (() => {
  let required = 0;
  for (const a of SOLAR_SYSTEMS) {
    for (const b of SOLAR_SYSTEMS) {
      if (a === b) continue;
      const da = direction(a);
      const db = direction(b);
      const separation = Math.hypot(da.x - db.x, da.z - db.z);
      // Two systems founded the same day would share a layout point; the
      // registry cannot produce that today, and a zero divisor must not be
      // reached quietly if it ever can.
      if (separation < 1e-9) {
        throw new Error(
          `solar systems "${a.id}" and "${b.id}" occupy the same point in the galaxy`,
        );
      }
      const need =
        systemReach(a) + systemReach(b) + Math.min(systemReach(a), systemReach(b));
      required = Math.max(required, need / separation);
    }
  }
  // A galaxy with one system has no pair to satisfy. The quotient is then
  // unobservable — its only system sits at the core — so any positive value
  // will do, and the body scale keeps the two frames commensurable.
  return required === 0 ? SCENE_SCALE : required;
})();

/** The maximum leaning radius, so `tiltFor` can normalise against it. */
const MAX_LAYOUT_RADIUS = Math.max(...SOLAR_SYSTEMS.map(layoutRadius));

/**
 * How far a system leans, and therefore how far it rises.
 *
 * Scaled by radius so the core is in the galactic plane BY CONSTRUCTION. That
 * is not a nicety: the atlas is the only system that declares surfaces, and a
 * tilt there would eat the surface camera's off-axis budget (see
 * `MAX_SYSTEM_TILT`). A rule that happens to give zero is worth more than a
 * special case that asserts it.
 */
function tiltFor(system: Scope): number {
  if (MAX_LAYOUT_RADIUS === 0) return 0;
  return MAX_SYSTEM_TILT * (layoutRadius(system) / MAX_LAYOUT_RADIUS);
}

export interface SystemPlacement {
  /** The system's origin in the galaxy's frame, in scene units. */
  center: Vec3;
  /** Radians its own plane leans off the galactic plane. */
  tilt: number;
}

/**
 * Where a solar system sits, and how it leans.
 *
 * The direction comes from `polar()` — the same function that places a
 * repository on an arm and a moon around a planet — so the map's rule that
 * angle means arm and radius means time reaches the root rather than stopping
 * one level short of it.
 *
 * A system leans by the same angle it rises out of the galactic plane: one
 * number with two readings, the shape `obliquityFor` already uses for a
 * planet's axis.
 */
export function placeSolarSystem(system: Scope): SystemPlacement {
  const d = direction(system);
  const tilt = tiltFor(system);
  const planar = Math.hypot(d.x, d.z) * GALAXY_SPREAD;
  return {
    center: {
      x: d.x * GALAXY_SPREAD,
      y: planar * Math.sin(tilt),
      z: d.z * GALAXY_SPREAD,
    },
    tilt,
  };
}

/**
 * How far the galaxy reaches, in scene units — the outermost rim of the
 * outermost system. What the galaxy camera pose is sized against, exactly as
 * `SOLAR_SYSTEM_POSE` is sized against `ASTROLABE_OUTER`.
 */
export const GALAXY_REACH: number = Math.max(
  ...SOLAR_SYSTEMS.map((system) => {
    const c = placeSolarSystem(system).center;
    return Math.hypot(c.x, c.y, c.z) + systemReach(system);
  }),
);
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run && npx tsc --noEmit && npx eslint --max-warnings 0`
Expected: all clean.

- [ ] **Step 5: Record the actual numbers**

Run:

```bash
npx vitest run src/lib/atlas/__tests__/galaxyPlacement.test.ts --reporter=verbose
```

Then add a one-line comment above `GALAXY_SPREAD`'s IIFE recording the value it
resolves to for the current data, in the form
`// Currently resolves to N.NN against the seeded channel.` This is a fact
about the data, not a constant — it exists so a later reader can tell at a
glance whether the geometry moved.

- [ ] **Step 6: Commit**

```bash
git add src/lib/atlas/galaxyPlacement.ts src/lib/atlas/__tests__/galaxyPlacement.test.ts
git commit -m "feat(galaxy): place a solar system by its own founding date

Direction comes from polar(), the same function that places a repository on
an arm — so radius means time at every level of the tree instead of stopping
one short of the root.

Separation is measured in the galaxy's own frame, with the quotient solved
from a non-overlap requirement rather than typed. At body scale a February
2026 channel lands 113 scene units out, inside the atlas's own 205-unit disc;
the comment records that so it is not re-attempted.

Tilt scales with radius, so the atlas is unleaned at the core by construction
and the surface camera's off-axis budget stays entirely unspent."
```

---

### Task 5: The clock becomes a calendar date

Two systems have two epochs, so "days since the epoch" no longer names a
moment. Each system resolves an absolute date against its own epoch.

**Files:**
- Modify: `src/lib/atlas/timeline.ts`
- Modify: `src/lib/atlas/magnitude.ts:20`
- Modify: `src/components/world/WorldSceneBuilder.ts` (`setClockDay` →
  `setClockDate`)
- Modify: `src/components/world/WorldCanvas.tsx` (`clockDay` prop →
  `clockDate`)
- Modify: `src/components/hud/TimelineTransport.tsx`
- Modify: `src/app/page.tsx`
- Test: `src/lib/atlas/__tests__/timeline.test.ts` (extend)

**Interfaces:**
- Produces, from `src/lib/atlas/timeline.ts`:
  - `bodyVisibleOn(body: Body, date: string, scope?: Scope): boolean`
  - `visibleBodyIdsOn(bodies: Body[], date: string, scope?: Scope): Set<string>`
  - `THE_END: string` — the sentinel meaning "show everything", replacing
    `Infinity`.
- The existing `bodyVisibleAt` / `visibleBodyIds` stay, unchanged, expressed in
  terms of the new pair. Existing tests must not be edited.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/atlas/__tests__/timeline.test.ts`:

```ts
import { bodyVisibleOn, visibleBodyIdsOn, THE_END } from "../timeline";
import { SOLAR_SYSTEM_CHANNEL } from "../scopes";
import { loadChannelBodies } from "../channel";

describe("an absolute clock over two epochs", () => {
  const atlas = loadBodies();
  const channel = loadChannelBodies();

  it("hides a body born after the date, in either system", () => {
    const early = "2025-12-01";
    expect(channel.every((b) => !bodyVisibleOn(b, early, SOLAR_SYSTEM_CHANNEL))).toBe(true);
    expect(atlas.some((b) => bodyVisibleOn(b, early, SOLAR_SYSTEM_ZEMI))).toBe(true);
  });

  it("shows everything at THE_END", () => {
    expect(visibleBodyIdsOn(atlas, THE_END, SOLAR_SYSTEM_ZEMI).size).toBe(atlas.length);
    expect(visibleBodyIdsOn(channel, THE_END, SOLAR_SYSTEM_CHANNEL).size).toBe(channel.length);
  });

  it("resolves one date against each system's own epoch", () => {
    // The whole point: one calendar date, two epochs, and each system filters
    // its own bodies correctly without the caller converting anything.
    const date = SOLAR_SYSTEM_CHANNEL.epoch;
    expect(visibleBodyIdsOn(channel, date, SOLAR_SYSTEM_CHANNEL).size).toBeGreaterThan(0);
    expect(visibleBodyIdsOn(atlas, date, SOLAR_SYSTEM_ZEMI).size).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/lib/atlas/__tests__/timeline.test.ts`
Expected: FAIL — `bodyVisibleOn` is not exported.

- [ ] **Step 3: Add the date-based pair**

In `src/lib/atlas/timeline.ts`, add:

```ts
/**
 * The sentinel for "show everything", as a date rather than as `Infinity`.
 *
 * A far-future ISO date rather than a magic number, so it flows through
 * `daysSinceEpoch` and every comparison below without a branch of its own —
 * the same reason `clockDay` used `Infinity` before there were two epochs to
 * resolve a day against.
 */
export const THE_END = "9999-12-31";

/**
 * Whether a body exists on a given calendar date.
 *
 * Absolute, not an offset. Two solar systems have two epochs, so a day count
 * no longer names a moment: the same `clockDay` would mean March in one system
 * and July in the other. The date is resolved against each system's own epoch
 * here, once, so no caller ever converts.
 */
export function bodyVisibleOn(
  body: Body,
  date: string,
  scope: Scope = SOLAR_SYSTEM_ZEMI,
): boolean {
  return bodyVisibleAt(body, daysSinceEpoch(date, scope.epoch), scope);
}

export function visibleBodyIdsOn(
  bodies: Body[],
  date: string,
  scope: Scope = SOLAR_SYSTEM_ZEMI,
): Set<string> {
  return visibleBodyIds(bodies, daysSinceEpoch(date, scope.epoch), scope);
}
```

- [ ] **Step 4: Scope the one unscoped `daysSinceEpoch`**

`src/lib/atlas/magnitude.ts:20` computes a lifespan as a **difference** of two
`daysSinceEpoch` calls, so the epoch cancels and the value is already correct.
Add the comment that says so, so a future reader does not "fix" it:

```ts
  // A difference, so the epoch cancels and the default is harmless — this is
  // a duration, not a position. Do not thread a scope through it.
```

- [ ] **Step 5: Rename the builder's clock**

In `src/components/world/WorldSceneBuilder.ts`, rename `setClockDay(day: number)`
to `setClockDate(date: string)`, and make its first two lines:

```ts
  public setClockDate(date: string): void {
    this.clockDate = date;
    const day = daysSinceEpoch(date, this.scope.epoch);
```

leaving the rest of the method's body unchanged — it already works in days
within one scope, which is correct now that the scope is the builder's own.
Change the field `private clockDay = Infinity;` to
`private clockDate = THE_END;` and the call in `build()` to
`this.setClockDate(this.clockDate);`.

`this.scope` arrives in Task 7. Until then, use `SOLAR_SYSTEM_ZEMI` explicitly
at that one line and leave a `// Task 7 replaces this with this.scope.` comment.

- [ ] **Step 6: Thread the date through the components**

- `src/components/world/WorldCanvas.tsx`: rename the prop `clockDay?: number`
  to `clockDate?: string`, default `THE_END`, rename `clockDayRef` to
  `clockDateRef`, and change the sync effect body to
  `sceneBuilderRef.current?.setClockDate(clockDate);`.
- `src/components/hud/TimelineTransport.tsx:101`: it already converts a day to
  a date with `dateAtDay(clockDay, SOLAR_SYSTEM_ZEMI.epoch)`. The transport
  keeps scrubbing in days internally — its slider is a day offset over the
  atlas's span — and now **reports a date**. Change its `onChange` callback
  type to emit `dateAtDay(day, SOLAR_SYSTEM_ZEMI.epoch)`.
- `src/app/page.tsx`: change `const [clockDay, setClockDay] = useState(Infinity)`
  to `const [clockDate, setClockDate] = useState(THE_END)` and pass
  `clockDate={clockDate}` to `WorldCanvas`.

- [ ] **Step 7: Run everything**

Run: `npx vitest run && npx tsc --noEmit && npx eslint --max-warnings 0`
Expected: all clean.

- [ ] **Step 8: Verify in the browser**

Start the dev server, scrub the timeline transport, and confirm bodies still
appear and disappear as the date advances and the readout still shows a date.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor(timeline): scrub a calendar date, not an offset

Two solar systems have two epochs, so a day count no longer names a moment —
the same clockDay would mean March in one system and July in the other. The
date is resolved against each system's own epoch inside the builder, so no
caller converts anything."
```

---

### Task 6: Give the galaxy its own frame and its own sky

**Files:**
- Create: `src/components/world/GalaxyBuilder.ts`
- Modify: `src/components/world/WorldSceneBuilder.ts` (remove `skyShell` and
  its counter-rotation; move `buildBackgroundField`'s sky half)
- Test: `src/components/world/__tests__/galaxyFrame.test.ts`

**Interfaces:**
- Produces, from `src/components/world/GalaxyBuilder.ts`:
  - `class GalaxyBuilder`
  - `readonly rootGroup: THREE.Group` — the galaxy's frame, named
    `GALAXY_ZEMI.id`
  - `build(): void`
  - `update(elapsed: number, delta: number): void`
  - `attach(system: Scope, group: THREE.Object3D): void` — parents a solar
    system's root at its `placeSolarSystem` centre and tilt
  - `dispose(): void`

- [ ] **Step 1: Write the failing test**

Create `src/components/world/__tests__/galaxyFrame.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { GalaxyBuilder } from "../GalaxyBuilder";
import { GALAXY_ZEMI, SOLAR_SYSTEM_CHANNEL, SOLAR_SYSTEM_ZEMI } from "@/lib/atlas/scopes";
import { placeSolarSystem } from "@/lib/atlas/galaxyPlacement";

function built() {
  const scene = new THREE.Scene();
  const galaxy = new GalaxyBuilder(scene);
  galaxy.build();
  return { scene, galaxy };
}

describe("the galaxy frame", () => {
  it("names itself for the galaxy scope", () => {
    expect(built().galaxy.rootGroup.name).toBe(GALAXY_ZEMI.id);
  });

  it("never rotates, so the sky needs no counter-rotation", () => {
    // The whole reason skyShell.rotation.y = -pattern existed: the sky rode a
    // rotating root. It does not any more.
    const { galaxy } = built();
    galaxy.update(120, 1 / 60);
    expect(galaxy.rootGroup.rotation.y).toBe(0);
  });

  it("attaches a system at its derived centre", () => {
    const { galaxy } = built();
    const group = new THREE.Group();
    galaxy.attach(SOLAR_SYSTEM_CHANNEL, group);
    const expected = placeSolarSystem(SOLAR_SYSTEM_CHANNEL).center;
    expect(group.position.x).toBeCloseTo(expected.x, 6);
    expect(group.position.y).toBeCloseTo(expected.y, 6);
    expect(group.position.z).toBeCloseTo(expected.z, 6);
    expect(group.parent).toBe(galaxy.rootGroup);
  });

  it("leaves the repository atlas at the origin, unrotated", () => {
    // If this fails, every camera preset and pin anchor in the app is wrong.
    const { galaxy } = built();
    const group = new THREE.Group();
    galaxy.attach(SOLAR_SYSTEM_ZEMI, group);
    expect(group.position.length()).toBe(0);
    expect(group.rotation.x).toBe(0);
    expect(group.rotation.z).toBe(0);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/components/world/__tests__/galaxyFrame.test.ts`
Expected: FAIL — cannot resolve `../GalaxyBuilder`.

- [ ] **Step 3: Write `GalaxyBuilder`**

Create `src/components/world/GalaxyBuilder.ts`. Move the sky-shell half of
`WorldSceneBuilder.buildBackgroundField` here verbatim — the `THREE.Points`
built from `BACKGROUND_STAR_COUNT`, its geometry, its material and its
`scene`/`rootGroup` parenting. Leave the arm dust where it is; that belongs to
a solar system.

```ts
import * as THREE from "three";
import { GALAXY_ZEMI, type Scope } from "@/lib/atlas/scopes";
import { placeSolarSystem } from "@/lib/atlas/galaxyPlacement";

/**
 * The galaxy's own frame, and the only furniture that belongs to it.
 *
 * The sky lives here because it is the galaxy's sky, not the atlas's.
 * `WorldSceneBuilder` used to own the 12,000-point shell and hand it back the
 * pattern rotation every frame — `skyShell.rotation.y = -pattern` — because
 * the shell rode a rotating solar-system root and rotation is only perceptible
 * against something that is not rotating. With a frame above the rotation,
 * that correction has nothing to correct and is gone. Net behaviour is
 * identical; one fewer fact represented twice.
 *
 * This frame does not rotate. Solar systems do not revolve around the core —
 * pattern rotation stays inside each system, which is what lets the sky be the
 * fixed reference it was always meant to be.
 */
export class GalaxyBuilder {
  public readonly rootGroup = new THREE.Group();
  private skyShell: THREE.Points | null = null;

  constructor(private scene: THREE.Scene) {}

  public build(): void {
    this.rootGroup.name = GALAXY_ZEMI.id;
    this.scene.add(this.rootGroup);
    this.buildSky();
  }

  private buildSky(): void {
    // [MOVED VERBATIM from WorldSceneBuilder.buildBackgroundField's sky half.]
    // Parent the resulting THREE.Points to `this.rootGroup` and assign it to
    // `this.skyShell`.
  }

  /**
   * Parent a solar system's root at its place in the galaxy.
   *
   * The atlas's epoch is the galaxy epoch, so its centre is the origin and its
   * tilt is zero — it is attached by exactly this call and does not move,
   * which is what keeps every camera preset and pin anchor correct.
   */
  public attach(system: Scope, group: THREE.Object3D): void {
    const { center, tilt } = placeSolarSystem(system);
    group.position.set(center.x, center.y, center.z);
    // Leaned about the axis pointing back at the core, so the lean is a lean
    // rather than a yaw — a rotation about +Y would only spin the system in
    // its own plane and change nothing you can see.
    const bearing = Math.atan2(center.z, center.x);
    group.rotation.set(0, 0, 0);
    group.rotateY(bearing);
    group.rotateZ(tilt);
    group.rotateY(-bearing);
    this.rootGroup.add(group);
  }

  public update(_elapsed: number, _delta: number): void {
    // Deliberately empty. The galaxy frame is static; see the class comment.
  }

  public dispose(): void {
    this.skyShell?.geometry.dispose();
    (this.skyShell?.material as THREE.Material | undefined)?.dispose();
    this.scene.remove(this.rootGroup);
  }
}
```

- [ ] **Step 4: Strip the sky from `WorldSceneBuilder`**

Delete the `skyShell` field, its construction inside `buildBackgroundField`,
and these two lines from `update`:

```ts
    // The sky is the fixed reference the pattern is seen against. It rides the
    // root like everything else, so it has to be given the rotation back.
    if (this.skyShell) this.skyShell.rotation.y = -pattern;
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run && npx tsc --noEmit && npx eslint --max-warnings 0`
Expected: all clean. If a test referenced `skyShell`, it is asserting the
counter-rotation that no longer exists — delete that assertion and note the
deletion in the commit message.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(world): the sky belongs to the galaxy, not the atlas

skyShell.rotation.y = -pattern existed only because the 12,000-star shell
rode a rotating solar-system root. With a frame above the rotation there is
nothing to correct, and the line deletes itself at identical net behaviour.

GalaxyBuilder.attach is where a solar system is parented at its derived
centre and lean. The atlas resolves to the origin, unleaned, so it does not
move."
```

---

### Task 7: `WorldSceneBuilder` takes a solar system

**Files:**
- Modify: `src/components/world/WorldSceneBuilder.ts`
- Test: `src/components/world/__tests__/twoSystems.test.ts`

**Interfaces:**
- Produces: `WorldSceneBuilder`'s constructor gains a `scope: Scope` parameter,
  **second**, after `scene`:
  `constructor(scene, scope, bodies, today, fieldDensity = 1, reducedMotion = false)`.
  A public `readonly scope: Scope` getter is exposed for `WorldCanvas`.

- [ ] **Step 1: Write the failing test**

Create `src/components/world/__tests__/twoSystems.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { WorldSceneBuilder } from "../WorldSceneBuilder";
import { bodiesFor } from "@/lib/atlas/bodies";
import { SOLAR_SYSTEM_CHANNEL, SOLAR_SYSTEM_ZEMI, planetScopeId } from "@/lib/atlas/scopes";

function build(scope: typeof SOLAR_SYSTEM_ZEMI) {
  const scene = new THREE.Scene();
  const builder = new WorldSceneBuilder(scene, scope, bodiesFor(scope), "2026-08-25");
  builder.build();
  return builder;
}

describe("a builder per solar system", () => {
  it("names its root for the system it was given", () => {
    expect(build(SOLAR_SYSTEM_CHANNEL).rootGroup.name).toBe(SOLAR_SYSTEM_CHANNEL.id);
    expect(build(SOLAR_SYSTEM_ZEMI).rootGroup.name).toBe(SOLAR_SYSTEM_ZEMI.id);
  });

  it("builds only its own system's planet groups", () => {
    const channel = build(SOLAR_SYSTEM_CHANNEL);
    expect(channel.scopeGroups.has(planetScopeId("products"))).toBe(false);
    const atlas = build(SOLAR_SYSTEM_ZEMI);
    expect(atlas.scopeGroups.has(planetScopeId("vlogs"))).toBe(false);
  });

  it("gives the channel no surfaces, by the rule already written", () => {
    // No engine ships behind a video, so surfaceScopeIds returns nothing for
    // this system and no guard is needed anywhere.
    const channel = build(SOLAR_SYSTEM_CHANNEL);
    expect(channel.surfaceTargets(null)).toEqual([]);
  });

  it("keeps the two scene graphs entirely separate", () => {
    const channel = build(SOLAR_SYSTEM_CHANNEL);
    const atlas = build(SOLAR_SYSTEM_ZEMI);
    for (const id of channel.scopeGroups.keys()) {
      if (id === SOLAR_SYSTEM_CHANNEL.id) continue;
      expect(atlas.scopeGroups.has(id), id).toBe(false);
    }
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/components/world/__tests__/twoSystems.test.ts`
Expected: FAIL — the constructor takes `(scene, bodies, today, ...)`.

- [ ] **Step 3: Thread the scope through**

In `src/components/world/WorldSceneBuilder.ts`:

1. Add `private readonly scopeRef: Scope` as the second constructor parameter,
   named `scope`, and expose `public get scope(): Scope { return this.scopeRef; }`.
2. In `registerScopeGroups`, replace both uses of `SOLAR_SYSTEM_ZEMI` with
   `this.scope`, and pass `this.scope` to `derivePlanets` and
   `derivePlanetScopes`.
3. Replace every remaining `SOLAR_SYSTEM_ZEMI` in the file — lines 67, 470,
   521, 746, 840, 916, 917, 1113, 1124, 1159 in the pre-change file — with
   `this.scope`. Line 67's is a module-level default on
   `buildFieldGeometry`; leave that signature default alone and pass
   `this.scope` at the call site instead.
4. Replace the Task 5 placeholder in `setClockDate` with `this.scope.epoch`.
5. Pass `this.scope` as the second argument to `deriveWorldRadius`,
   `derivePlanets`, `planetGrowthAt`, `deriveMoons`, `placeBodies` and
   `deriveRingAnnotation`/`derivePlanetAnnotation` at every call site in the
   file.

- [ ] **Step 4: Run everything**

Run: `npx vitest run && npx tsc --noEmit && npx eslint --max-warnings 0`
Expected: all clean. Existing world tests construct the builder positionally
and will need `SOLAR_SYSTEM_ZEMI` inserted as the second argument — that is a
mechanical edit to the call, **not** a change to any assertion. If an
assertion needs changing, stop: the atlas has moved.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(world): a scene builder builds the system it is given

Every SOLAR_SYSTEM_ZEMI inside the builder was the assumption that there is
one solar system. They are all this.scope now, so the same code draws the
second orrery — which is the whole reason not to write a second builder."
```

---

### Task 8: Two orreries in one scene

**Files:**
- Modify: `src/components/world/WorldCanvas.tsx`

**Interfaces:**
- Consumes: `GalaxyBuilder` (Task 6), the scoped `WorldSceneBuilder` (Task 7),
  `SOLAR_SYSTEMS`, `bodiesFor`.
- Produces: `sceneBuildersRef: Map<ScopeId, WorldSceneBuilder>` inside
  `WorldCanvas`, and a `builderFor(scopeId)` helper used by the framing switch
  in Task 10.

- [ ] **Step 1: Build both systems under the galaxy**

In the scene-construction effect of `src/components/world/WorldCanvas.tsx`,
replace the single builder construction with:

```tsx
    const galaxy = new GalaxyBuilder(scene);
    galaxy.build();
    galaxyBuilderRef.current = galaxy;

    const builders = new Map<ScopeId, WorldSceneBuilder>();
    for (const system of SOLAR_SYSTEMS) {
      const builder = new WorldSceneBuilder(
        scene,
        system,
        bodiesFor(system),
        today,
        fieldDensityFor(width),
        reducedMotion,
      );
      builder.build();
      // The builder adds its root to the scene; re-parent it into the galaxy's
      // frame, which is also what applies its centre and lean.
      galaxy.attach(system, builder.rootGroup);
      builders.set(system.id, builder);
    }
    sceneBuildersRef.current = builders;
```

- [ ] **Step 2: Drive both from the render loop**

Every call currently made on the single builder — `update`, `setClockDate`,
`setCosmicMode`, `setLightDirection`, `setResolution` — now iterates
`sceneBuildersRef.current.values()`. `galaxy.update(elapsed, delta)` is called
once, before them.

- [ ] **Step 3: Dispose both**

In the effect's cleanup, dispose every builder in the map and then the galaxy.
The pre-change cleanup disposed one; leaving it that way leaks the second
system's geometry on every day/night toggle.

- [ ] **Step 4: Point hit-testing at the union**

The raycaster currently reads one builder's `hitObjects`. Concatenate across
the map, preserving order (atlas first, so an ambiguous hit resolves the way it
does today).

- [ ] **Step 5: Point the pin projection at the union**

`planetPinAnchors(builder)` is called once per frame. Call it per builder and
concatenate. `PIN_HEIGHTS` is keyed by arm and `validateGalaxy` guarantees arm
ids are unique, so the union has no collisions.

- [ ] **Step 6: Run and verify in the browser**

Run: `npx vitest run && npx tsc --noEmit && npx eslint --max-warnings 0`

Then start the dev server and confirm: the repository atlas looks **exactly as
it does today**, and the channel's orrery is visible in the distance when you
orbit out. Take a screenshot.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(world): draw both solar systems in one scene

Two instances of one builder under a galaxy root, rather than a second
builder — so what a solar system is stays defined in exactly one place.

Disposal now covers both; the pre-change cleanup disposed one builder and
would have leaked the second system's geometry on every day/night toggle."
```

---

### Task 9: The journey reaches the galaxy

**Files:**
- Modify: `src/lib/atlas/journey.ts`
- Modify: `src/lib/atlas/__tests__/journey.test.ts:130-136` — **delete the
  carve-out**
- Test: `src/lib/atlas/__tests__/journey.test.ts` (extend)

**Interfaces:**
- Produces, from `src/lib/atlas/journey.ts`:
  - `Position` gains `{ kind: "galaxy" }`; its `solarSystem` case gains
    `id: ScopeId`.
  - `Framing` gains `{ kind: "galaxy" }`; its `solarSystem` case gains
    `scope: ScopeId`.
  - `AT_GALAXY: Journey`
  - `JourneyEvent` gains `{ type: "selectSolarSystem"; id: ScopeId }`
  - `AT_SOLAR_SYSTEM` keeps its name and now carries
    `position: { kind: "solarSystem", id: SOLAR_SYSTEM_ZEMI.id }`.

- [ ] **Step 1: Delete the carve-out and add the tests**

In `src/lib/atlas/__tests__/journey.test.ts`, delete these lines from the
"agrees with the scope tree" test:

```ts
      // The solar system itself is excluded: it has a parent (the galaxy), but
      // `Position` has no galaxy-level state to ascend into yet — that state is
      // deliberately deferred until a second solar system exists to navigate
      // between. See docs/superpowers/plans/... galaxy wrapper notes.
      if (!scope.parent || scope.id === SOLAR_SYSTEM_ZEMI.id) continue;
```

replacing them with:

```ts
      if (!scope.parent) continue;
```

Then append:

```ts
describe("the galaxy level", () => {
  it("ascends from a solar system to the galaxy", () => {
    expect(ascendFrom({ kind: "solarSystem", id: SOLAR_SYSTEM_ZEMI.id }, bodies))
      .toEqual({ kind: "galaxy" });
  });

  it("stays at the galaxy, because there is nowhere further out", () => {
    expect(ascendFrom({ kind: "galaxy" }, bodies)).toEqual({ kind: "galaxy" });
  });

  it("ascends from a planet to its OWN solar system, read from the tree", () => {
    // Not to a remembered system: a stored copy of a derived fact is the shape
    // every drift in this scene has taken.
    expect(ascendFrom({ kind: "planet", arm: "vlogs", mode: "orbit" }, bodies))
      .toEqual({ kind: "solarSystem", id: SOLAR_SYSTEM_CHANNEL.id });
    expect(ascendFrom({ kind: "planet", arm: "products", mode: "orbit" }, bodies))
      .toEqual({ kind: "solarSystem", id: SOLAR_SYSTEM_ZEMI.id });
  });

  it("frames the galaxy and a named system distinctly", () => {
    expect(framingFor({ ...AT_GALAXY })).toEqual({ kind: "galaxy" });
    expect(framingFor(AT_SOLAR_SYSTEM))
      .toEqual({ kind: "solarSystem", scope: SOLAR_SYSTEM_ZEMI.id });
  });

  it("arrives at a system, putting down whatever was open", () => {
    const journey = journeyReducer(
      { position: { kind: "planet", arm: "products", mode: "panel" }, card: "PickMe", console: "pickme" },
      { type: "selectSolarSystem", id: SOLAR_SYSTEM_CHANNEL.id },
    );
    expect(journey.position).toEqual({ kind: "solarSystem", id: SOLAR_SYSTEM_CHANNEL.id });
    expect(journey.card).toBeNull();
    expect(journey.console).toBeNull();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/lib/atlas/__tests__/journey.test.ts`
Expected: FAIL — several, including the un-carved-out anti-drift test.

- [ ] **Step 3: Widen the unions**

In `src/lib/atlas/journey.ts`:

```ts
export type Position =
  | { kind: "galaxy" }
  | { kind: "solarSystem"; id: ScopeId }
  | { kind: "planet"; arm: string; mode: PlanetMode }
  | { kind: "moon"; bodyId: string; mode: MoonMode };

export type Framing =
  | { kind: "galaxy" }
  | { kind: "solarSystem"; scope: ScopeId }
  | { kind: "planet"; arm: string }
  | { kind: "moon"; scope: ScopeId }
  | { kind: "surface"; scope: ScopeId };

export const AT_GALAXY: Journey = { position: { kind: "galaxy" }, card: null, console: null };

export const AT_SOLAR_SYSTEM: Journey = {
  position: { kind: "solarSystem", id: SOLAR_SYSTEM_ZEMI.id },
  card: null,
  console: null,
};
```

Note that `planet` and `moon` gain **no** system field. `planetScopeId(arm)` and
`moonScopeId(bodyId)` are globally unique — `validateGalaxy` is what makes that
true — so which system they belong to is read off `Scope.parent`. Add that as a
comment above the union.

- [ ] **Step 4: Extend the four functions**

```ts
export function positionFor(scopeId: ScopeId): Position {
  if (scopeId.startsWith("moon:")) {
    return { kind: "moon", bodyId: scopeId.slice("moon:".length), mode: "flyby" };
  }
  if (scopeId.startsWith("planet:")) {
    return { kind: "planet", arm: scopeId.slice("planet:".length), mode: "orbit" };
  }
  if (scopeId.startsWith("solarSystem:")) return { kind: "solarSystem", id: scopeId };
  return { kind: "galaxy" };
}

export function scopeIdFor(position: Position): ScopeId | null {
  switch (position.kind) {
    case "galaxy":
      return GALAXY_ZEMI.id;
    case "solarSystem":
      return position.id;
    case "planet": {
      const id = planetScopeId(position.arm);
      return SCOPES[id] ? id : null;
    }
    case "moon":
      return moonScopeId(position.bodyId);
  }
}

export function ascendFrom(position: Position, bodies: Body[] = loadBodies()): Position {
  switch (position.kind) {
    case "galaxy":
      return { kind: "galaxy" };
    case "solarSystem":
      return { kind: "galaxy" };
    case "planet": {
      // The system the tree says this planet is in. An arm with no scope is
      // drawn but not somewhere you can be inside, so it falls back to the
      // atlas — the same answer it gave before there were two systems.
      const scope = SCOPES[planetScopeId(position.arm)];
      return { kind: "solarSystem", id: scope?.parent ?? SOLAR_SYSTEM_ZEMI.id };
    }
    case "moon": {
      const arm = bodyArm(position.bodyId, bodies);
      return arm
        ? { kind: "planet", arm, mode: "orbit" }
        : { kind: "solarSystem", id: SOLAR_SYSTEM_ZEMI.id };
    }
  }
}

export function framingFor(journey: Journey): Framing {
  const { position } = journey;
  switch (position.kind) {
    case "galaxy":
      return { kind: "galaxy" };
    case "solarSystem":
      return { kind: "solarSystem", scope: position.id };
    case "planet": {
      const scope = scopeIdFor(position);
      if (position.mode === "surface" && scope) return { kind: "surface", scope };
      return { kind: "planet", arm: position.arm };
    }
    case "moon": {
      const scope = moonScopeId(position.bodyId);
      return position.mode === "surface"
        ? { kind: "surface", scope }
        : { kind: "moon", scope };
    }
  }
}
```

Update `activeArm` and `isStanding` for the new `galaxy` case — `isStanding`'s
guard becomes
`position.kind !== "galaxy" && position.kind !== "solarSystem" && position.mode === "surface"`.

Add the reducer case:

```ts
    case "selectSolarSystem":
      return { position: { kind: "solarSystem", id: event.id }, card: null, console: null };
```

- [ ] **Step 5: Run everything**

Run: `npx vitest run && npx tsc --noEmit && npx eslint --max-warnings 0`
Expected: all clean, **with the carve-out gone**. That is the acceptance
criterion for this task: the anti-drift guard now covers every scope in the
galaxy with no exceptions.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(journey): a position can name the galaxy, and which system

Position could not say which solar system it meant, because there was only
one. Both new cases are read from the scope tree rather than stored: a planet
ascends to the system Scope.parent names, so nothing has to be kept in step
by hand.

journey.test.ts's carve-out is deleted. The anti-drift guard now covers every
scope in the galaxy with no exceptions, which is what it was written to do."
```

---

### Task 10: The camera flies between systems

**Files:**
- Modify: `src/components/world/WorldCameraManager.ts`
- Modify: `src/components/world/planetFrames.ts`
- Modify: `src/components/world/WorldCanvas.tsx` (`frameRef.current`)
- Test: `src/components/world/__tests__/galaxyFraming.test.ts`

**Interfaces:**
- Produces:
  - `GALAXY_POSE: CameraPose` and `CAMERA_PRESETS.galaxy` from
    `WorldCameraManager.ts`
  - `framedSystem(builders, scopeId): FramedBody | null` from
    `planetFrames.ts`

- [ ] **Step 1: Write the failing test**

Create `src/components/world/__tests__/galaxyFraming.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CAMERA_PRESETS, WorldCameraManager } from "../WorldCameraManager";
import { GALAXY_REACH } from "@/lib/atlas/galaxyPlacement";

describe("the galaxy pose", () => {
  it("is registered as a preset", () => {
    expect(CAMERA_PRESETS.galaxy).toBeDefined();
  });

  it("stands far enough back to hold the whole galaxy", () => {
    const pose = CAMERA_PRESETS.galaxy;
    expect(pose.position.length()).toBeGreaterThan(GALAXY_REACH);
  });

  it("aims at the galactic core", () => {
    expect(CAMERA_PRESETS.galaxy.target.length()).toBe(0);
  });

  it("keeps the far plane past the far rim", () => {
    const m = new WorldCameraManager(1200, 800);
    m.setFrameScale(GALAXY_REACH);
    expect(m.depth.far).toBeGreaterThan(GALAXY_REACH * 2);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/components/world/__tests__/galaxyFraming.test.ts`
Expected: FAIL — `CAMERA_PRESETS.galaxy` is undefined.

- [ ] **Step 3: Add the galaxy pose**

In `src/components/world/WorldCameraManager.ts`, after `SOLAR_SYSTEM_POSE`:

```ts
/**
 * The galaxy's framing.
 *
 * A fixed `CameraPose`, legitimately — unlike a planet's. `setPreset`'s doc
 * warns that a preset naming a body must not come through it, because the
 * pattern carries bodies and two frozen vectors would frame where a thing
 * stood at t=0. The galaxy frame does not rotate and solar systems do not
 * revolve in it, so its pose is a place rather than a body.
 *
 * Sized against `GALAXY_REACH` with the same ratios `SOLAR_SYSTEM_POSE` uses,
 * so widening the galaxy reframes it rather than cropping it.
 */
const GALAXY_POSE: CameraPose = {
  position: new THREE.Vector3(0, GALAXY_REACH * 0.9, GALAXY_REACH * 1.12),
  target: new THREE.Vector3(0, 0, 0),
};
```

and add `galaxy: GALAXY_POSE` to the first object literal passed to
`Object.assign` in `CAMERA_PRESETS`. Import `GALAXY_REACH` from
`@/lib/atlas/galaxyPlacement`.

Change `ascend()` so it no longer hardcodes the solar system:

```ts
  /** The named inverse of descend: back to the frame the scope sits in. */
  public ascend(preset: CameraTargetPreset = "solarSystem"): void {
    this.surface = null;
    this.descended = null;
    this.setFrameScale(preset === "galaxy" ? GALAXY_REACH : ASTROLABE_OUTER);
    this.setPreset(preset);
  }
```

- [ ] **Step 4: Let `planetFrames` resolve a system**

Add to `src/components/world/planetFrames.ts`:

```ts
/**
 * A whole solar system, as something to frame.
 *
 * Its radius is the system's own reach, so descending on a system frames the
 * disc rather than the sun at its centre — the same rule `framedBody` follows
 * for a planet, one level up.
 */
export function framedSystem(
  builders: Map<ScopeId, WorldSceneBuilder>,
  scopeId: ScopeId,
): FramedBody | null {
  const builder = builders.get(scopeId);
  if (!builder) return null;
  return {
    frame: builder.rootGroup,
    offset: new THREE.Vector3(),
    radius: systemReach(getScope(scopeId)),
  };
}
```

- [ ] **Step 5: Add the two framing branches**

In `WorldCanvas.tsx`'s `frameRef.current`, after the `surface` branch and
before the `solarSystem` one:

```tsx
    if (framing.kind === "galaxy") {
      camera.ascend("galaxy");
      return;
    }

    if (framing.kind === "solarSystem") {
      const target = framedSystem(sceneBuildersRef.current, framing.scope);
      // A system this scene does not draw is framed from the galaxy rather
      // than throwing — the same answer the pins already give.
      if (target) camera.descend(target.frame, target.radius, target.offset);
      else camera.ascend("galaxy");
      return;
    }
```

Delete the old `if (framing.kind === "solarSystem") { camera.ascend(); return; }`
branch. `dayNightRef.current?.setShadowReach(ASTROLABE_OUTER)` above it becomes
`setShadowReach(framing.kind === "galaxy" ? GALAXY_REACH : ASTROLABE_OUTER)`.

- [ ] **Step 6: Run and verify in the browser**

Run: `npx vitest run && npx tsc --noEmit && npx eslint --max-warnings 0`

Then start the dev server. Confirm: clicking a planet still frames it; the
brand badge still resets to the atlas; and a `selectSolarSystem` dispatched
from the console flies to the channel. Screenshot the galaxy pose.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(camera): a galaxy pose, and a solar system you can fly to

The galaxy pose is a fixed CameraPose, legitimately: setPreset warns against
freezing a pose for anything the pattern carries, and the galaxy frame does
not rotate. Sized against GALAXY_REACH with SOLAR_SYSTEM_POSE's own ratios,
so a third system reframes it rather than being cropped out of it."
```

---

### Task 11: The system switcher

**Files:**
- Modify: `src/components/hud/WorldHUD.tsx`
- Modify: `src/app/page.tsx`
- Test: `src/components/hud/__tests__/worldHUD.test.tsx` (extend)

**Interfaces:**
- Consumes: `SOLAR_SYSTEMS`, `activeArm`, `AT_GALAXY`, the
  `selectSolarSystem` event.
- Produces: `WorldHUDProps` gains
  `activeSystem: ScopeId`, `onSelectSolarSystem: (id: ScopeId) => void`,
  and `onAscendToGalaxy: () => void`.

- [ ] **Step 1: Write the failing test**

Append to `src/components/hud/__tests__/worldHUD.test.tsx`:

```tsx
import { SOLAR_SYSTEMS, SOLAR_SYSTEM_CHANNEL, SOLAR_SYSTEM_ZEMI } from "@/lib/atlas/scopes";

describe("the system switcher", () => {
  it("names every registered solar system", () => {
    render(<WorldHUD {...baseProps} activeSystem={SOLAR_SYSTEM_ZEMI.id} />);
    for (const s of SOLAR_SYSTEMS) {
      expect(screen.getByRole("button", { name: s.label })).toBeInTheDocument();
    }
  });

  it("shows the active system's arms and no others", () => {
    render(<WorldHUD {...baseProps} activeSystem={SOLAR_SYSTEM_CHANNEL.id} />);
    expect(screen.getByRole("button", { name: "Tutorials" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Foundations" })).toBeNull();
  });

  it("reports which system was chosen", async () => {
    const onSelectSolarSystem = vi.fn();
    render(
      <WorldHUD
        {...baseProps}
        activeSystem={SOLAR_SYSTEM_ZEMI.id}
        onSelectSolarSystem={onSelectSolarSystem}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: SOLAR_SYSTEM_CHANNEL.label }));
    expect(onSelectSolarSystem).toHaveBeenCalledWith(SOLAR_SYSTEM_CHANNEL.id);
  });
});
```

Add `activeSystem`, `onSelectSolarSystem` and `onAscendToGalaxy` to the file's
existing `baseProps` object so the other tests keep compiling.

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/components/hud/__tests__/worldHUD.test.tsx`
Expected: FAIL — no such buttons.

- [ ] **Step 3: Derive the arm dock**

In `src/components/hud/WorldHUD.tsx`, replace the hardcoded `sectors` array:

```tsx
  // Derived from the system the visitor is in, not typed. A fifth arm in
  // either system appears here by being declared in that system's `arms`.
  const sectors = Object.keys(getScope(activeSystem).arms).map((arm) => ({
    id: arm,
    label: ARM_META[arm]?.name ?? arm,
  }));
```

- [ ] **Step 4: Add the switcher above the dock**

Render, directly above the existing `<nav>`, a second small `<nav>` mapping
`SOLAR_SYSTEMS` to buttons labelled `system.label`, each calling
`onSelectSolarSystem(system.id)`, with the active one styled by the same
`layoutId` spring pattern the arm dock uses (use a distinct `layoutId`, e.g.
`activeSystemPill`, so the two pills do not animate into each other).

- [ ] **Step 5: Wire the page**

In `src/app/page.tsx`:

```tsx
  const activeSystem = useMemo(() => {
    const scope = scopeIdFor(journey.position);
    // The system the current position sits in, whatever the depth — read off
    // the tree with scopeChain rather than tracked alongside the journey.
    return scope
      ? (scopeChain(scope).find((s) => s.kind === "solarSystem")?.id ?? SOLAR_SYSTEM_ZEMI.id)
      : SOLAR_SYSTEM_ZEMI.id;
  }, [journey]);

  const handleSelectSolarSystem = useCallback((id: ScopeId) => {
    sound.playClick(520, 0.05);
    travel({ type: "selectSolarSystem", id });
  }, []);
```

and pass `activeSystem`, `onSelectSolarSystem={handleSelectSolarSystem}` and
`onAscendToGalaxy={() => travel({ type: "ascend" })}` to `WorldHUD`.

- [ ] **Step 6: Run and verify in the browser**

Run: `npx vitest run && npx tsc --noEmit && npx eslint --max-warnings 0`

Then start the dev server and click through: atlas → The Channel → a channel
planet → back up to the galaxy. Screenshot each. Confirm the arm dock's
contents change with the system and that the atlas still looks unchanged.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(hud): a system switcher, and an arm dock that follows it

The dock was five typed rows. It is the active system's own arms now, so a
fifth arm in either system appears by being declared rather than by being
added here too.

Which system the visitor is in is read from the scope chain rather than
tracked beside the journey — the same rule that keeps Position free of a
system field."
```

---

## Self-Review

**Spec coverage.** §5 scope tree → Task 2. §6.1 placement, §6.2 separation,
§6.3 rise and lean → Task 4. §7 data → Task 1. §8.1 brightness → Task 3. §8.2
time → Task 5. §8.3 scale → **Phase 0, `cab1aa4`**. §9 scene → Tasks 6, 7, 8.
§10 journey, camera, HUD → Tasks 9, 10, 11. §11 guards → **Phase 0**, plus
Task 1's channel-specific validation. §12's eleven test claims each map to a
task: atlas unmoved (Tasks 4, 6, 7), at the core and unleaned (Task 4),
no overlap (Task 4), ascent agrees with the tree (Task 9), one root
(Phase 0), ids unique (Phase 0), never landable (Task 7), short dimmer than
tutorial (Task 3), repository brightness unchanged (Task 3), sky not
counter-rotated (Task 6). §13's risks are handled at Task 2 step 8 (scale
takeover), Task 8 step 3 (disposal) and Task 5 (clock boundaries). §14 is
respected: no revolution, no video surfaces, no core body, no API, no third
system, no qualified ids, and the only extraction is `GalaxyBuilder`.

**Placeholders.** One deliberate marker remains: Task 6 step 3's
`// [MOVED VERBATIM ...]` in `buildSky`, which names an exact existing code
block to relocate rather than describing code to invent. Task 5 step 5 carries
a `// Task 7 replaces this` comment that Task 7 step 4 explicitly removes.

**Type consistency.** `setClockDate(date: string)` is introduced in Task 5 and
used identically in Task 8. `WorldSceneBuilder`'s constructor order —
`(scene, scope, bodies, today, fieldDensity, reducedMotion)` — is defined in
Task 7 and used in that order in Task 8. `placeSolarSystem` returns
`{ center, tilt }` in Task 4 and is destructured as exactly that in Task 6.
`systemReach` is defined in Task 4 and consumed in Task 10. `framedSystem`
takes `(builders, scopeId)` in Task 10 and is called that way in the same task.
`AT_GALAXY`, `selectSolarSystem` and the `activeSystem` prop are defined in
Task 9 and consumed in Task 11.
