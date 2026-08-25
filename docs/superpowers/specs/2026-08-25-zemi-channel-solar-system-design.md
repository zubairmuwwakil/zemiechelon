# Zemí Channel — A Second Solar System — Design

**Date:** 2026-08-25
**Status:** Approved, not implemented
**Amends:** `2026-08-24-zemi-journey-model-design.md`, whose `Position` and
`Framing` unions stop one level short of the scope tree's root. It builds the
level they stop short of.
**Closes:** the carve-out at `src/lib/atlas/__tests__/journey.test.ts:134`,
which excludes `solarSystem:atlas` from the anti-drift guard because
`Position` has no galaxy-level state to ascend into.

---

## 1. Problem

`GALAXY_ZEMI` is a root with one child. It declares `arms: {}` and
`windRate: 0` and nothing reads either, because nothing is placed in its frame.
Its own comment says so: *"a solar system is one row of data under it, added
when it is actually built, not scaffolded ahead of one existing."*

That row is now being added — a second solar system holding a YouTube channel,
whose planets are Vlogs, Shorts, Tutorials and Dev-logs, whose moons are
published videos and whose dwarf planets are unpublished ideas.

The scope *tree* is ready for it. Almost nothing else is.

| Site | What assumes exactly one solar system |
|---|---|
| `scopes.ts:63` | `SCOPES` is a module const over `loadBodies()`, with `parent: SOLAR_SYSTEM_ZEMI.id` hardcoded at line 29 |
| `WorldCameraManager.ts:21-98` | `SCENE_SCALE`, `PLANET_CENTERS`, `PLANET_RADII`, `CAMERA_PRESETS` are computed **at module load** from `loadBodies()` |
| `WorldSceneBuilder.ts:407` | `rootGroup.name = SOLAR_SYSTEM_ZEMI.id` — the scene's root *is* the solar system. There is no galaxy group |
| `journey.ts:26` | `Position` is `{ kind: "solarSystem" }`. It cannot say *which* |
| `journey.ts:102` | `scopeIdFor` returns `SOLAR_SYSTEM_ZEMI.id` for that case, unconditionally |
| `planetPins.ts:12`, `PlanetSurfaces.ts:26`, `arms.ts:27` | `PIN_HEIGHTS`, `SURFACE_FAMILIES`, `ARM_META` are three global namespaces keyed by bare arm name |
| `magnitude.ts:20` | `daysSinceEpoch` called with no scope, silently assuming the repo epoch |

Roughly twenty-five call sites take `scope: Scope = SOLAR_SYSTEM_ZEMI`. Those
are not the problem — they are already parameterised and the default merely
records which system was first. The problem is the four module-load
singletons and the missing frame.

---

## 2. What the reading established

**The scene graph already mirrors the scope tree.** `scopeGroups` maps a
`ScopeId` to a `THREE.Group`, and descent is a matrix composition rather than
arithmetic. Adding a galaxy group above `rootGroup` is a **one-node** change to
the graph. Everything expensive is downstream of that node, in code that
assumed the root was the solar system.

**The sky is counter-rotated because there is no galaxy frame.**
`WorldSceneBuilder.update` sets `rootGroup.rotation.y = pattern` and then
`skyShell.rotation.y = -pattern`, with a comment explaining that the sky rides
the root and has to be given the rotation back. The 12,000-star shell is the
galaxy's sky, not the atlas's. Once a galaxy frame exists the counter-rotation
has nothing to correct for and deletes itself, at identical net behaviour.

**Surfaces cost nothing to exclude.** `surfaceScopeIds` derives ground from
`consoleId` matched against `ENGINE_IDS`. No engine ships behind a video, so
every video is a flyby by the rule already written. No guard is needed and none
should be added.

**Flat scope ids are safe if uniqueness is enforced rather than assumed.**
`planet:products` carries no system segment, and neither does `moon:PickMe`.
Today the atlas's five arm ids and the channel's four do not collide, and no
video id collides with a repository id. That is true by inspection and would
stay true by luck. A build-time assertion converts it to a guarantee at a cost
of a few lines — which is the trade the codebase already makes at
`loadBodies` and `validateIdeals`.

**Every drift in this scene has one signature: a fact represented twice.**
Stated in `journey.ts`, restated in `planetFrames.ts`, and it is why the two
rejected approaches below are rejected.

---

## 3. Approaches considered

**A — Generalise fully; system-qualified scope ids** (`planet:channel/vlogs`).
Collisions become impossible by construction. The id-format change reaches
deep links, `planetFrame`'s template literal, all three arm-keyed namespaces
and nearly every test file — a large mechanical diff buying nothing at two
systems.

**B — Two builders under a galaxy root; ids kept flat, uniqueness asserted.**
`WorldSceneBuilder` takes a solar-system `Scope` and its own body set and is
instantiated twice. The module-load singletons become per-scope derivations.
**Chosen.**

**C — A separate, lighter `ChannelSceneBuilder`.** Smallest risk to the working
atlas; ships fastest. Also the exact failure this codebase names as its only
enemy: "what a solar system is" would live in two files that begin identical
and diverge on the first change to either.

B is chosen because it leaves **one** definition of what a solar system is,
while keeping the id format — the expensive part of A — until a system count
actually needs it.

---

## 4. Decisions taken

| Question | Decision |
|---|---|
| Galaxy view | Both orreries fully drawn in one scene. Continuous flight between them |
| Spatial layout | 3D — different heights and orbital planes, both **derived** (§6) |
| Separation | Radial distance is `radiusScale(days since the galaxy epoch)`, in the galaxy's own frame |
| Galaxy origin | The repo atlas sits at the galactic core. Its epoch is the galaxy epoch, so its radius is zero and `rootGroup` never moves |
| Naming | `solarSystem:channel`, labelled **The Channel** |
| Arms | `vlogs`, `shorts`, `tutorials`, `devlogs`. Angles derived from the set's size, so a fifth is one row |
| Magnitude | Runtime. A video is published once and has no lifespan to measure |
| Trails | `resurfacedAt`, optional, defaulting to the publish date |
| Body scale | Shared across the galaxy. A younger channel is a visibly smaller disc, which is true |
| Timeline | One clock, absolute calendar dates |
| Navigation | A system switcher above the arm dock, always visible |
| Landing on a video | Not possible, by the rule already written. Nothing to build |

---

## 5. The scope tree

```
galaxy:zemi                epoch 2025-11-06 · arms derived from the registry
├── solarSystem:atlas      epoch 2025-11-06 → galaxy radius 0 → the core
│   ├── planet:foundations · planet:products · planet:labs · planet:self · planet:creative
│   └── moon:MoneyTalks · moon:PickMe · moon:marketdata · moon:pickleops · moon:return-saas
└── solarSystem:channel    epoch = its oldest item's date → out on a galaxy arm
    ├── planet:vlogs · planet:shorts · planet:tutorials · planet:devlogs
    └── moon:<video id> …
```

`SOLAR_SYSTEMS` is a registry array in `galaxy.ts`. `GALAXY_ZEMI.arms` is
**derived from it** — one arm per system, evenly spaced — so the galaxy's arm
table cannot fall out of step with the systems it describes:

```ts
export const GALAXY_ARMS = Object.fromEntries(
  SOLAR_SYSTEMS.map((s, i) => [systemName(s.id), (i / SOLAR_SYSTEMS.length) * 2 * Math.PI]),
);
```

`systemName("solarSystem:channel")` is `"channel"`, spelled once, beside
`solarSystemScopeId` which already spells the inverse.

The channel scope's **epoch is derived from its oldest item**, exactly as
`derivePlanetScopes` derives a planet's epoch from its oldest child. No date is
typed. The first video is the origin of that system's time, which is what an
epoch means everywhere else in this map.

`derivePlanetScopes` and `deriveMoonScopes` take a solar-system scope and a
body set instead of defaulting to the atlas, and `SCOPES` is assembled by
folding over `SOLAR_SYSTEMS`.

---

## 6. Galaxy geometry

### 6.1 Placement

A solar system is placed by `polar()` — the same function that places a repo in
a solar system and a moon on an arm. Nothing new is written to place it.

```
galaxyDays(S)   = daysSinceEpoch(S.epoch, GALAXY_ZEMI.epoch)
layoutRadius(S) = radiusScale(galaxyDays(S))
direction(S)    = polar(systemName(S.id), layoutRadius(S), GALAXY_ZEMI)
```

The atlas's epoch is the galaxy epoch, so `galaxyDays` is 0, `radiusScale(0)`
is 0, and the atlas sits at the origin **where it already is**. This is the
single most load-bearing consequence in this document: `positionParity.test.ts`'s
golden fixture, `CAMERA_PRESETS`, `planetPinAnchors` and every surface-camera
assertion continue to describe a scene that has not moved.

### 6.2 Separation, and why the naive version fails

Placing systems at the **body** scale does not work, and the numbers are worth
recording so it is not re-attempted.

The atlas reaches 19.45 layout units, and `SCENE_SCALE` (205 / 19.45 = 10.541)
lands its outermost repository exactly on the astrolabe's outermost ring. A
channel founded in February 2026 is day 87 from the galaxy epoch, so
`radiusScale(87)` = 10.72 layout units = **113 scene units** at that scale —
comfortably *inside* the atlas's 205-unit disc. The two orreries would
intersect.

The galaxy is therefore its own frame with its own layout-to-scene quotient,
derived from a stated non-overlap requirement:

> For every pair of systems (A, B), the distance between their centres is at
> least `reach(A) + reach(B) + min(reach(A), reach(B))` — the two discs clear
> each other by the smaller one's own radius.

```
reach(S)      = deriveWorldRadius(bodiesFor(S)) * SCENE_SCALE
d(A,B)        = |direction(A) − direction(B)|          // layout units
GALAXY_SPREAD = max over pairs of
                  (reach(A) + reach(B) + min(reach(A), reach(B))) / d(A,B)
```

The centre of a system is then `center(S) = direction(S) * GALAXY_SPREAD`,
in scene units, with the rise of §6.3 supplying its `y`. The requirement is
stated over planar distance and checked over the full 3D distance, which is
never smaller — so lifting a system out of the plane can only increase the
clearance the quotient already guarantees.

`GALAXY_SPREAD` is scene units per layout unit in the galaxy's frame, the exact
counterpart of `SCENE_SCALE` one level up, and it is derived by the same kind of
argument: a stated requirement solved for the quotient, rather than a number
that framed the world on the day it was typed. It generalises to N systems
unchanged.

Worked example with a February 2026 channel spanning 205 days: `reach(atlas)` =
205, `reach(channel)` = 173.6, `d` = 10.72, required separation
205 + 173.6 + 173.6 = 552.2, so `GALAXY_SPREAD` ≈ 51.5 — about five times the
body scale. The channel's centre lands 552 scene units out. Ordering still means
time; a system founded later still sits further out; nothing is authored.

### 6.3 Rise and lean

Both come from one angle:

```ts
/** Radians. A solar system's plane never leans further than this from the galactic plane. */
export const MAX_SYSTEM_TILT = (10 * Math.PI) / 180;

tilt(S) = MAX_SYSTEM_TILT * (layoutRadius(S) / maxLayoutRadius)
rise(S) = layoutRadius(S) * GALAXY_SPREAD * Math.sin(tilt(S))
```

A system's orbital plane leans by the same angle it rises out of the galactic
plane — one number with two readings, in the shape `obliquityFor` already uses
for a planet's axis.

Scaling with radius is not decoration. `surfaceCamera.test.ts:107` asserts the
parent stays within 15° off-axis from a standing pose, and `MAX_INCLINATION`
(12°) already spends most of that budget; a tilted ancestor would spend more,
because `leveledFrameMatrix` levels the camera against **world** up while the
ground rides its frame. Deriving the tilt from radius makes it **exactly zero at
the core**, so the atlas — the only system that declares surfaces — spends none
of the budget, and the existing assertions are untouched.

`MAX_SYSTEM_TILT` is set conservatively at 10° for the same reason
`MAX_INCLINATION` is 12°: the surface-camera assertion is the gate. **Any future
system that earns ground must re-measure it.** A test asserts the atlas's tilt
is exactly zero, which is what actually protects the suite.

---

## 7. Data

`src/data/channel.ts`, hand-maintained, in the shape `bodies.overrides.ts`
already uses. There is no YouTube API and none is planned.

```ts
export interface ChannelItem {
  /** Stable slug. Unique across the whole galaxy — asserted, see §11. */
  id: string;
  title: string;
  arm: ArmId;                 // vlogs | shorts | tutorials | devlogs
  /** ISO date. For an unpublished idea, the date you had it. */
  publishedAt: string;
  /** ISO date the item was re-pinned, re-shared or revisited. Defaults to publishedAt. */
  resurfacedAt?: string;
  /** Required for a published video. Absent for an idea, because nothing was made yet. */
  runtimeSeconds?: number;
  /** Present ⇒ moon. Absent ⇒ dwarf planet. */
  url?: string;
  blurb?: string;
}
```

`kind` is **derived, not authored**: `url ? "moon" : "dwarfPlanet"`. This is the
exact parallel to the atlas's rule that a shipped venture has a live URL, and it
means publishing an idea is one field, not two.

Mapping to `Body`:

| `Body` field | Source |
|---|---|
| `parent` | `kind === "moon" ? planetScopeId(arm) : SOLAR_SYSTEM_CHANNEL.id` — the same predicate `bodies.ts:22` uses |
| `bornAt` | `publishedAt` |
| `lastTouchedAt` | `resurfacedAt ?? publishedAt` |
| `links.live` | `url` |
| `runtimeSeconds` | `runtimeSeconds` |

`Body` gains **one** optional field, `runtimeSeconds`, beside the optional
`stack`, `satellites`, `consoleId` and `milestone` it already carries.

`loadBodies()` stays repository-only. Its name and its `bodies.generated.json`
source both say so, and thirty-odd tests read it as exactly that.
`loadChannelBodies()` sits beside it; `bodiesFor(scope)` dispatches;
`allBodies()` feeds the uniqueness guard.

---

## 8. Derivations that change

### 8.1 Brightness

`magnitude()` grows one branch, placed **first**:

```ts
if (body.runtimeSeconds !== undefined) {
  return MOON_MAGNITUDE * Math.sqrt(body.runtimeSeconds / 60 / RUNTIME_PIVOT_MINUTES);
}
```

`RUNTIME_PIVOT_MINUTES = 10` is the one calibration the number needs: a
ten-minute video reads exactly as bright as a shipped repository. A 30-second
short lands at 0.89, a 45-minute tutorial at 8.5. Shorts stay visibly small as a
class without a rule saying they should.

The branch is first because a published video **is** a moon, and the existing
`kind === "moon"` test would otherwise flatten every video to `MOON_MAGNITUDE`.
The existing reasoning — that lifespan is the honest signal for a repository —
does not survive the port: a video is published once and never touched, so its
lifespan is zero by construction. Runtime is the same kind of claim one domain
over: how much was made.

`magnitude.test.ts:9`, "pins every system to the same bright value", iterates
`loadBodies()` and therefore stays true and unmodified. That is the second
reason the loaders stay separate.

### 8.2 Time

`clockDay` becomes an absolute calendar date. Each system filters its own bodies
against its own epoch, so scrubbing to March fills in repositories and videos
together — which is the whole value of one galaxy with two systems in it.

This also closes a latent bug: `magnitude.ts:20` calls `daysSinceEpoch` with no
scope, silently assuming the repository epoch for any body handed to it.

### 8.3 Scale

`SCENE_SCALE` is derived from the **galaxy's** widest system rather than from
`loadBodies()`:

```
SCENE_SCALE = ASTROLABE_OUTER / max over S of deriveWorldRadius(bodiesFor(S))
```

One day is therefore the same distance in both systems, and the discs are
honestly comparable — the widest system's outermost body still lands exactly on
the astrolabe's outermost ring, which today is the atlas and keeps the quotient
at its present 10.541. This is not circular with §6.2: `SCENE_SCALE` is a
maximum over systems, and `GALAXY_SPREAD` is computed from the reaches it
produces. `PLANET_CENTERS`, `PLANET_RADII` and `CAMERA_PRESETS`
become per-scope derivations keyed by solar-system id.

---

## 9. Scene

`WorldSceneBuilder` takes a solar-system `Scope` and its own body set.
`WorldCanvas` creates a `galaxyGroup`, instantiates the builder once per system,
and parents each `rootGroup` to it at the placement from §6.

**Moves up to the galaxy frame:** the 12,000-star sky shell, into a small
`GalaxyBuilder` module. `skyShell.rotation.y = -pattern` deletes itself — the
sky stops riding a rotating frame, so it stops needing the rotation handed back.
Net behaviour is identical; one fewer fact represented twice.

**Stays per system:** astrolabe rings, arm dust, central core, planet spheres,
moons. The channel's astrolabe simply has fewer rings, which is the younger disc
made literal rather than asserted.

**Costs nothing to exclude:** ideal rings (`IDEALS` is keyed by planet scope;
the channel declares none, and `buildIdealRings` already treats an empty set as
legitimate), surfaces and orreries (§2).

**Solar systems do not revolve** around the galactic core. Pattern rotation
stays inside each system; the galaxy frame is static, which is what lets the sky
be the fixed reference it was always meant to be. `descend` already re-aims from
a live world matrix every frame, so adding revolution later is a rate, not a
redesign.

`GalaxyBuilder` is the only extraction from `WorldSceneBuilder` (1,889 lines)
that this work justifies. A broader split is out of scope — see §14.

---

## 10. Journey, camera and HUD

```ts
export type Position =
  | { kind: "galaxy" }
  | { kind: "solarSystem"; id: ScopeId }
  | { kind: "planet"; arm: string; mode: PlanetMode }
  | { kind: "moon"; bodyId: string; mode: MoonMode };
```

`planet` and `moon` carry **no** system field. `planetScopeId(arm)` and
`moonScopeId(bodyId)` are globally unique, so which system they belong to is
read off `Scope.parent` — from the tree, not from a stored copy. Adding a system
field would be `flybyReturn` all over again.

- `positionFor` handles the `solarSystem:` and `galaxy:` prefixes.
- `scopeIdFor` returns `position.id` for a solar system and `GALAXY_ZEMI.id` for
  the galaxy, instead of `SOLAR_SYSTEM_ZEMI.id` unconditionally.
- `ascendFrom` gains `solarSystem → galaxy` and `galaxy → galaxy`; a planet
  ascends to **its own** system, read from the tree.
- `AT_SOLAR_SYSTEM` keeps its name and gains an id; `AT_GALAXY` joins it.
- A `selectSolarSystem` event joins `JourneyEvent`.

**`journey.test.ts:134`'s carve-out is deleted.** The anti-drift guard then
covers every scope in the galaxy with no exceptions, and that test passing
unmodified is the acceptance criterion for this section.

`Framing` gains `{ kind: "galaxy" }` and `{ kind: "solarSystem"; scope }`.
`WorldCameraManager.ascend()` stops hardcoding `setPreset("solarSystem")` and
resolves the frame it is ascending into. The galaxy pose is a fixed
`CameraPose` — legitimately, because the galaxy frame does not rotate — sized
from `GALAXY_REACH = max over systems of (|center(S)| + reach(S))`, following
`SOLAR_SYSTEM_POSE`'s existing ratios.

**HUD.** A two-item system switcher sits above the arm dock, always visible, so
the channel is discoverable without ascending. `WorldHUD`'s hardcoded
five-element `sectors` array becomes derived from the active system's `arms`.
`ARM_META`, `SURFACE_FAMILIES` and `PIN_HEIGHTS` gain channel entries;
`planetSurfaces.test.ts:10` widens from the atlas's arms to the union across the
registry.

---

## 11. Guards

At module load, throw when:

- two solar systems declare the same arm id;
- two bodies anywhere in the galaxy share an id;
- a channel item has a `url` but no `runtimeSeconds`.

Loud, not defaulted — the rule `loadBodies`, `getScope`, `validateIdeals` and
`shardRadiusFor` already follow. The first two are what make flat scope ids safe
rather than lucky, and the second is specifically what stops a video from
quietly stealing a repository's deep link at `#/<id>`.

---

## 12. Testing

Every claim below is testable without a WebGL context, which is why the
derivations live in `lib/atlas` rather than in the builder.

| Claim | Test |
|---|---|
| The atlas has not moved | `positionParity.test.ts` passes unmodified against its existing golden fixture |
| The atlas is at the galactic core | `|center(solarSystem:atlas)|` is exactly 0 |
| The atlas is unleaned | `tilt(solarSystem:atlas)` is exactly 0 |
| No two systems overlap | For every pair, centre distance ≥ `reach(A) + reach(B) + min(reach)` |
| Ascent agrees with the tree | `journey.test.ts`'s anti-drift guard passes **with the carve-out removed** |
| The tree still has one root | `scopes.test.ts` unmodified |
| Ids are unique | The guard throws on a seeded collision |
| A video is never landable | `declaresSurface(moonScopeId(anyVideo))` is false for every channel item |
| A short is dimmer than a tutorial | `magnitude` over seeded runtimes |
| Repository brightness is unchanged | `magnitude.test.ts` unmodified |
| The sky no longer counter-rotates | The galaxy group's rotation is zero and `skyShell` carries no rotation of its own |

---

## 13. Risks

**The channel has no data yet.** Every number in §6.2 is worked from an assumed
February 2026 epoch and a 205-day span. The derivations do not depend on those
values, but the *look* does — a channel founded last month produces a very small
disc a long way out. Seed `channel.ts` with real items early and re-read the
galaxy framing before tuning anything else.

**`WorldSceneBuilder` is 1,889 lines and is about to be instantiated twice.**
Per-instance state must be audited: `planetMesh`, `planetInstanceIndices`,
`surfaces`, `orreries`, `bodySprites` and the cull bookkeeping are all
instance fields today and should survive, but `setScopeCull` walks
`this.rootGroup.children` and assumes the root is the solar system. That
assumption stays true under this design and must be checked rather than
believed.

**`clockDay` changing meaning touches the transport UI.** It is currently days
since the repository epoch, and `TimelineTransport.tsx:101` converts it back to
a date for display. Moving to absolute dates simplifies that call site but
changes the type crossing four component boundaries.

**Two `InstancedMesh`es and two field clouds.** Negligible on the GPU at these
counts; real in object count and in disposal. Both builders must be torn down on
unmount, and `WorldCanvas`'s cleanup currently disposes one.

---

## 14. Out of scope

- Solar systems revolving around the galactic core.
- Surfaces, consoles or engines for videos.
- A drawn body at the galactic core.
- Any YouTube API, scraping or view-count ingestion.
- A third solar system's data, or system-qualified scope ids (§3, approach A) —
  both become worth doing at three systems, neither at two.
- Any broader decomposition of `WorldSceneBuilder` beyond extracting
  `GalaxyBuilder`.
