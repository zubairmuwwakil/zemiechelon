# Zemí Motion — Design

**Date:** 2026-08-22
**Status:** Approved for R4
**Amends:** `2026-08-20-zemi-world-design.md` (the scene is no longer still) and
`2026-08-20-zemi-scope-nesting-design.md` §5, which recorded that planet scope
groups are "deliberately axis-aligned… not a place to hide a tilt". That
decision **stands**; §3.5 below explains where the tilt goes instead.
Everything else in both documents holds.

---

## 1. Problem

The universe is still. Not slow — still. And the reason is not the one it looks
like from the outside.

The obvious diagnosis is that nothing travels: planets sit where they were
placed and never move. The real diagnosis is that at the framing every visitor
lands on, **four independent systems are frozen at once**, and orbital transit
is the hardest and riskiest of the four to fix.

At the derived galaxy pose — camera 295 scene units out, 42° vertical FOV, an
800 px viewport — the scene resolves at **3.538 px per scene unit**, or 37.3 px
per layout unit. Human smooth-motion detection sits at roughly **1 px/s**: below
that a visitor registers that something *has moved* but never sees it moving.
Everything on screen was measured against that bar.

| System | State today | On screen |
|---|---|---|
| The field — 12,000 sky points + 4,500 arm dust | static `PointsMaterial`, no per-point animation | **0 px/s**, and it is most of the pixels |
| The light | one `DirectionalLight` at a fixed `[30, 60, 30]`; the planet shader hardcodes its lambert as `normalize(vec3(0.6, 0.7, 0.4))` | no terminator anywhere, ever |
| The five planets | identical orientation, every pole at world +Y; shader spin 0.004–0.026 rad/s at a 12 px drawn radius | **≈0 px/s**, reads as dots not worlds |
| The moons | `BASE_RATE = 0.03` rad/s at a 37–44 px orbit | **1.16–1.31 px/s**, exactly at threshold |

The moons are the tell. `moons.ts` states the intent outright — *"Nothing here
is fast enough to notice moving, only fast enough to have moved."* That was a
deliberate choice, correctly implemented, and it is the choice this document
reverses.

---

## 2. What the measurements established

Three findings changed the design, each of which would have been invisible
without the arithmetic.

**Differential rotation cannot work here, and moving the arms does not save
it.** Advecting the arm spine with the flow does fix the obvious failure —
bodies sliding off their drawn curve — and fixes it completely. It cannot fix
winding, because winding *is* differential rotation. Body radii span 1.90 to
19.45 layout units, a **10.24:1 ratio**, so under Kepler the innermost body
orbits **32.7×** faster than the outermost. Even at a glacial 30 minutes per
revolution at the rim, the core laps in 55 seconds and an arm winds through a
full 72° arm-spacing — enough to overlap its neighbour — in **11 seconds**.
There is no rate both legible and alive. This is the winding dilemma, and the
resolution adopted here is the one astrophysics reached: the arms are a pattern,
not a material, and the pattern rotates rigidly.

**Epicycles are invisible.** A bounded oscillation about each body's placement
was the first design, and it is wrong. To stay collision-safe the amplitude must
sit well under the crowd-run spacing `placeBodies` already guarantees
(`ROOM.star = 0.5` layout units of arc). At 10–20% of that spacing the excursion
is 1.9–3.7 px and runs at **0.12–0.50 px/s**. Pushing it to 40% of spacing over
a 30-second period reaches 0.99 px/s — still at threshold, and by then the
amplitude is close enough to the collision cap to be unsafe. It is a correct
mechanism nobody can see. **Cut.**

**Rotating `rootGroup` produces exactly zero perceived motion.** The 12,000-point
sky shell is added to `rootGroup` alongside everything else
(`WorldSceneBuilder.buildBackgroundField`). Rotation is only perceptible against
something that is not rotating, so turning the root turns the reference with it
and the two cancel. This is the single most dangerous thing in the work: it
looks correct in code, in review, and in every unit test, and renders as a still
image.

---

## 3. Decisions

### 3.1 Motion is five independent layers

Each layer has one owner, one rate, and one switch. Nothing composes implicitly.

| | Layer | What moves | Rate | Perceived | Touches placement? |
|---|---|---|---|---|---|
| **L1** | Pattern | all galaxy content about the core, rigidly | 30 min/rev | 2.53 px/s at rim | no |
| **L2** | Obliquity | planet spin axes | static | orientation | no |
| **L3** | System | moon orbits, now inclined | existing, retuned | 1.2 px/s and up | no |
| **L4** | Light | the sun on an arc, its direction passed to the shader | ~8 min/circuit | terminator crawl | no |
| **L5** | Field | 16,500 points twinkle and breathe | per-point phase | shimmer | no |

The rightmost column is the point. **No layer moves a body relative to its
placement.** `placeBodies` remains the sole authority on where anything is, and
motion is applied strictly above it in the transform hierarchy.

### 3.2 The pattern is rigid, and that is what preserves every reading

L1 applies one `rotation.y` about the core. Because it is rigid, no relative
angle between any two objects changes and no radius is touched. Angle still
means which arm; radius still means when. A planet never leaves its arm, an arm
never reaches its neighbour, and the astrolabe — whose rings are month
boundaries — stays a valid scale, since concentric rings are rotationally
symmetric and riding L1 is invisible to them.

This is the density-wave answer, and it is honest rather than a compromise: real
spiral arms survive because they are a traffic jam rotating at one pattern speed
while material passes through, not because every star keeps its neighbours.

### 3.3 The sky shell is the fixed reference

`background-field` is counter-rotated by `−Ωₚ·t` so it holds still in world
space while the galaxy wheels past it. The shell is what makes L1 perceptible at
all (§2).

Counter-rotation rather than reparenting the shell out of `rootGroup`. Lifting
it would entangle `setScopeCull`, which walks `contains(root, node)` to hide the
field at surface altitude and would have to learn about a second root. One line
against a structural change, for the same result.

### 3.4 Ωₚ is sized against the pointer, not against taste

**Ωₚ = 30 min/rev = 0.00349 rad/s**, giving 2.53 px/s at a 725 px rim.

The binding constraint is not visibility, it is whether a visitor can still hit
what they are aiming at. `ORRERY_RATE` was cut from 0.28 to 0.1 rad/s on
2026-08-22 with the note that at 0.28 "a bead crossed the frame in a couple of
seconds and slid out from under the pointer." That is the same failure mode, one
altitude up. A planet pin is on the order of 100 px wide, so at 2.53 px/s it
takes about **40 seconds to slide its own width** — two orders of magnitude
clear of the failure already observed.

### 3.5 Obliquity goes between the camera frames, which stay level

A new `tilt:<arm>` group is inserted as the sole child of `planet:<arm>`, and the
planet instance, the ideals rings and the moon pivots move inside it.

```
rootGroup                      L1: rotation.y = Ωₚ·t
├── background-field (12k)     counter-rotated −Ωₚ·t — the fixed reference
├── arm-dust (4.5k)            L5
├── astrolabe rings            rides L1; rotationally symmetric, so invisible
├── bodies, trails, core
└── planet:<arm>               LEVEL — camera frame, unchanged
    └── tilt:<arm>             NEW — L2 lives here and only here
        ├── planet instance    tilted spin axis
        ├── ideals rings       existing lean, now relative to the tilt
        └── moon pivot         L3, inclined
            └── moon:<id>      counter-levelled — landing frame, unchanged
```

This **honours** the axis-aligned decision rather than reversing it. Both frames
the camera uses stay level, so `descend()`, `landOnSurface()` and every
assertion in `surfaceCamera.test.ts` are untouched by the tilt. A moon rides an
inclined orbit while its own ground stays level underfoot — which is also the
correct visitor experience, since `landOnSurface` composes its pose in frame-
local space and `camera.lookAt` resolves roll against world up. A tilted landing
frame would present the shard as a slope.

The planet's tilt costs nothing in the shader. `PlanetSurfaces` notes that "the
sphere is rotationally symmetric, so spinning the pattern and spinning the sphere
are indistinguishable" — the pattern turns about **local** Y, so tilting the
instance matrix tilts the spin axis with it and the banding starts reading as
latitude.

### 3.6 Obliquity is a bounded map of the arm's base angle

The source is the one the ideals rings already use, for the reason already
recorded there: *"Reading the arm's own base angle gives every planet a different
plane, and a sixth arm gets one without anybody choosing a number."* Nothing is
authored, and a sixth arm is a row of data.

The *range* is new. `armAngle` reaches 8π/5 = 5.027 rad, so the ideals' bare
`armAngle * 0.28` yields up to **80.7°** — correct as a decorative lean on a
ring, wrong as an obliquity, and catastrophic as an orbital inclination. L2 and
L3 map the same input through a bounded function with an explicit ceiling:
**obliquity ≤ 28°** and **orbital inclination ≤ 12°**. Obliquity sits near the
terrestrial range (Earth 23.4°, Mars 25.2°) because that is what reads as a
tilted world rather than a toppled one. Inclination is held lower because the
moon labels were fanned on a flat plane and Track D has to re-check them against
it; at a 40 px orbit, 12° buys about 8 px of vertical separation.

### 3.7 Positions become live reads

Six consumers currently treat a planet's position as a constant. L1 makes that
false, so each reads the scene graph instead.

| Consumer | Today | After |
|---|---|---|
| `PLANET_CENTERS` | module constant, read every frame | retained as the **layout** constant; consumers that need a *drawn* position stop using it |
| HTML planet pins | project from those constants | project from `groupFor(...)`'s world matrix |
| `hitObjects[].position` | frozen at build | derived from `mesh.matrixWorld` |
| `descend()` | snapshots a world position once | re-reads the frame's matrix each `update()` |
| planet pick spheres | static world position | parented into `tilt:<arm>`, ride for free |
| planet annotations | static world position | same |
| `landOnSurface()` | frame-local already | **unchanged** |

`landOnSurface` needing no change is not luck. The commit *"land on a surface,
and hold the parent while the frame moves"* built a landed camera driven from
its frame's matrix rather than from a pose captured on arrival, precisely so the
frame could move. L1 is the first caller to actually exercise it.

**`descend()` is a live bug, not new work.** It reads
`target.getWorldPosition()` once and freezes the desired pose. Moons already
orbit — so clicking a moon today flies the camera to where that moon *was* at
the moment of the click. The error is currently small (≈1.2 px/s across a ~1 s
flight) and every layer here makes it larger. It is fixed as part of L1 because
L1 is what makes it visible.

### 3.8 The light moves, and the shader is told where it is

`directionalSun` travels a slow arc instead of sitting at a fixed corner, and
its real direction is passed to the planet material as a uniform, replacing the
hardcoded `normalize(vec3(0.6, 0.7, 0.4))`.

One uniform buys a terminator on every sphere in the scene — the strongest
available cue that a thing is a body in space rather than a shaded circle. It
also composes with work already done, though not for free: `castShadow` is
already true on both the sun and the planet mesh and a 2048² shadow map is
already allocated — but the shadow camera is sized `d = 35` with `far = 150`,
against a galaxy of radius 205. As configured it cannot reach the planets at
all. Track B therefore has to size the shadow frustum to the frame in view, the
same rule `setFrameScale` and `setFogReference` already follow for the near/far
planes and the fog. Small machinery, but not zero, and the claim that moons cast
onto planets is unproven until it is built.

The day/night palettes keep their two authored sun positions; the arc is applied
as an offset from whichever position the transition currently interpolates to,
so `DayNightController`'s existing lerp is preserved rather than replaced.

**The core does not become a lamp.** Direction A made the origin "gold leaf on
paper — the densest mark on the map rather than the brightest light on it", and
the earlier emissive plasma sun was removed deliberately. L4 moves the existing
directional light; it does not relight the scene from the core.

### 3.9 The field is where liveness actually lives

L5 replaces the two `PointsMaterial` layers with a shader carrying a per-point
phase, giving twinkle and a gentle radial breath across 16,500 points.

This is semantically free, and the reason is worth stating so it is not
re-litigated. No individual field point encodes anything: `buildFieldGeometry`
scatters both layers with a seeded `mulberry32`, and points are anonymous by
construction. The one ordering that *is* load-bearing is the arm dust buffer,
which is sorted by anchor birth day so the timeline transport can gate it with a
plain `setDrawRange` prefix. **L5 must never reorder that buffer** — phase is
carried as a parallel attribute, and displacement is computed in the shader, so
the buffer is read-only to this layer.

Phase is seeded from the same `mulberry32` stream, so the field stays
deterministic and reproducible.

### 3.10 Reduced motion removes travel, never orientation

Following the rule both prior specs already hold: **L1, L4 and L5 are off** under
`prefers-reduced-motion`. **L2 stays on** — obliquity is orientation, not motion,
and disabling it would remove content rather than travel. L3 predates this work
and is unchanged; `landingMode()` already routes reduced-motion visitors to a
panel rather than a surface.

### 3.11 Ωₚ is wall-clock, not the transport clock

Coupling the pattern angle to the timeline clock is tempting — the galaxy would
have turned a derived number of times since the epoch, and scrubbing would wind
it back. It is rejected because the transport parks at today by default, which
would leave the galaxy **still** in exactly the state this document exists to
fix.

The division from `2026-08-21-zemi-surface-design.md` §3.8 is preserved intact:
the clock decides only *what is drawn*. Motion decides only *which way things
face*. Neither touches placement.

---

## 4. What a visitor sees

**At galaxy framing.** The field shimmers. The galaxy wheels slowly against a
sky that does not, so the map reads as an object suspended in something rather
than a diagram printed on it. Five planets are visibly distinct worlds, each on
its own axis, each with a terminator creeping across it. Moons swing on inclined
orbits, separated in depth as well as in phase.

**At planet framing.** The tilt is unmistakable at this distance, and the moon
plane's inclination against it makes the group read as a system rather than a
diagram. Shadows cross the planet as moons pass between it and the sun.

**On a surface.** The sun rises and sets over the shard. This is the payoff that
justifies L4 above all the others: `2026-08-21-zemi-surface-design.md` records
that the first landed spike "read as a white void," and a moving terminator gives
the ground a time of day out of the same uniform that lit the planets.

---

## 5. Tracks

Ordered so each lands independently and the riskiest goes last.

| Track | Layer | Scope |
|---|---|---|
| **A** | L2 | `tilt:<arm>` group; bounded obliquity; reparent instance, ideals, moon pivots; counter-level `moon:<id>` |
| **B** | L4 | sun on an arc; light direction as a shader uniform; verify moon→planet shadows |
| **C** | L5 | field shader with per-point phase; buffer order preserved |
| **D** | L3 | moon orbital inclination; rate retune against the 1 px/s threshold |
| **E** | L1 | pattern group; sky counter-rotation; live position reads; `descend()` re-aim |

A–D change nothing outside the scene builder and its materials. E is the one
that touches the camera, the pins and the hit objects, and it is deliberately
last so it lands against a scene already proven alive.

---

## 6. Testing

| Area | Assertion |
|---|---|
| Placement parity | `sceneParity.test.ts` golden unchanged. It captures before `update()` — as its own comment records, "a golden taken after a frame would encode elapsed time" — so any layer that shifts a *placement* fails here |
| L1 is rigid | after 60 s of `update()`, every pairwise angle between bodies is unchanged and every radius from the core is unchanged, to within float tolerance |
| Sky is fixed | after 60 s, `background-field` world positions are unchanged while a body's are not — this is the test that catches the cancellation in §2 |
| Camera frames level | `planet:<arm>` and `moon:<id>` world quaternions stay identity-about-Y; `surfaceCamera.test.ts` passes unmodified |
| Obliquity bounded | every derived tilt and inclination is within its stated ceiling, for all five arms and for a synthetic sixth |
| `descend()` tracks | descending onto an orbiting moon, then advancing the clock, leaves the moon within the frustum and near frame centre |
| Field order | arm dust buffer is byte-identical after L5; `cullAndClock.test.ts` drawRange gating unaffected |
| Reduced motion | with the flag set, L1/L4/L5 produce zero displacement after 60 s; L2 tilt is still applied |
| Perceptibility | Ωₚ yields 2.4–2.7 px/s at the rim at the derived galaxy pose — a regression guard on the one number a visitor actually experiences |

---

## 7. Risks

| # | Risk | Mitigation | Likelihood |
|---|---|---|---|
| 1 | **The rotation cancels and ships as a still image.** `rootGroup` holds the sky shell; the bug is invisible in code review and in every placement test. | The "sky is fixed" assertion in §6 exists solely for this. | High without the test, near zero with it. |
| 2 | **Pins slide out from under the pointer.** Already observed once at close range with the orrery beads. | Ωₚ sized at §3.4 to ~40 s per pin width; the perceptibility test guards the number both ways. | Low. |
| 3 | **A reparent moves something by a fraction of a unit.** Track A moves three object sets into a new group; drift is invisible per frame and fatal to a map claiming to be derived. | The parity golden is the acceptance criterion, not a nicety — the same rule `2026-08-20-zemi-scope-nesting-design.md` §6 set for the previous reparent. | Medium, caught. |
| 4 | **L5 reorders the arm dust buffer** and the timeline gate silently starts drawing the wrong points. | Phase as a parallel attribute; displacement in-shader; buffer read-only to L5, asserted byte-identical. | Low, caught. |
| 5 | **Frame budget.** L5 adds a custom shader over 16,500 points; L4 adds shadow work. | The field is already `frustumCulled = false` and measured at 120 fps; shadow map is already allocated. Measure before and after Track C and Track B. | Low. |
| 6 | **Tilt makes moon labels harder to read**, having been fanned on a flat plane to separate them. | Track D bounds inclination and re-checks label separation at galaxy framing, where the fan was tuned. | Medium. |

---

## 8. Out of scope

- **Epicycles.** Cut on measurement, not deferred (§2). At 0.12–0.99 px/s they
  are below the perceptibility threshold, and reaching threshold requires an
  amplitude close enough to the collision cap to be unsafe.
- **Differential and Keplerian rotation.** Cut (§2). An arm winds through a full
  arm-spacing in 11 seconds even at the slowest rate that is visible at all.
- **Coupling rotation to the timeline transport.** Cut (§3.11).
- **Relighting the scene from the core.** Cut (§3.8). Direction A removed the
  emissive sun on purpose.
- **Camera idle drift.** Not attempted. The camera already orbits under the
  visitor's hand, and automatic camera motion competes with an affordance the
  visitor already owns rather than adding one.
- **Body-level motion of any kind.** `placeBodies` stays the sole authority on
  where anything is.

---

## 9. Consequences

The map keeps every claim it makes. Radius is still `√days × 1.15`; angle still
names an arm; the astrolabe is still a scale and not decoration; a planet is
still a landmark that does not wander. Motion is applied strictly above
placement in the transform hierarchy, which is what makes that guarantee
structural rather than a matter of care.

What changes is that the instrument is now clearly a *place*. The strongest
single contributor is not the layer that was originally asked for: L1 makes the
galaxy wheel, but L4 is what gives every sphere a lit side and a dark one, and
gives a visitor standing on a shard a time of day.
