# Zemí World — Design

**Date:** 2026-08-20
**Status:** Approved for R1
**Amends:** `2026-08-19-zemi-atlas-design.md` §5 (layer architecture), §7 (R1 scope),
§9 (visual treatment), §10 (out of scope). Everything else in that document stands,
including §3 (coordinate system), §4 (data model), §6 (console contract) and §8 (testing).

---

## 1. Problem

The atlas design is sound and its coordinate system is built. Two things it did not
resolve have now become blocking:

**The map has no second altitude.** The spec's descent was "camera pushes toward the
node, Field dims and blurs, Console fades up." What shipped is
`CleanPlanetLandingModal` — a `<div>` over a still scene. Landing on a planet is
currently a modal, which is the same *theatre* the spec set out to eliminate. A
visitor never arrives anywhere.

**The sky is inert.** Quote stars are `position: fixed` DOM at viewport
percentages, so they do not move when the camera orbits — they are painted on the
monitor, not hung in the world. `nightStars` in `ShootingStarQuotes.tsx` is a
hardcoded array of five entries bound to `FOUNDER_QUOTES[0..4]`; the file exports 81
quotes, so 76 are unreachable. The day comet carries `cursor-pointer` with no
`onClick` — a pointer cursor on a dead affordance.

Separately, the aesthetic shipped as glow-on-black, which the atlas spec explicitly
argued against and which the site's own token file contradicts
(`--background: #f7f6f2`).

## 2. Decision

Three decisions, taken together.

**2.1 — Two altitudes, one mechanism.** The galaxy is wayfinding; a planet surface
is arrival. Descent is not a modal and not a mode: it is the camera entering a
child coordinate frame. Ascent pops back out. The same operation works at every
depth, which is what makes a sixth planet — or a second galaxy — cost a row of data
rather than a navigation mode.

**2.2 — Direction A by day, Direction C by night; A ships first, alone.**

| | Ground | Ink | Gold | Accent | Reserved |
|---|---|---|---|---|---|
| **A · Celestial Atlas** (day) | `#F7F6F2` | `#1B1A17` | `#B8860B` | Verdigris `#0B6B4F` | Oxide `#8C3B2E` |
| **C · Zemí Stone** (night) | `#151110` | `#EDE4D4` | `#C9962C` | Jade `#3E7C63` | Ochre `#A9552F` |

A and C are one world at two hours: both warm, both material, one light and one
dark. That is what makes the day/night control a *place* rather than a theme
picker. A cool-grey dark direction was designed, scored and rejected — not on
aesthetics but on strategy: a borrowed visual language argues against the claim
that Zemí Echelon is a company with a point of view.

A ships first because light is the harder ground. It exposes weak geometry that
dark forgives, and it is what the existing tokens already assume. If the treatment
does not land, that must be discovered in week one, not after C is built on top of
it.

**2.3 — The quote sky is one system.** Not a day layer and a night layer. One
`QuoteSky` over all 81 quotes, positioned in the scene, with mode selecting
behaviour.

### 2.1.1 Why the island geometry returns

`SceneBuilder.ts` was deleted for a correct reason — as the *top* level it hardcoded
geometry per sector, so venture #12 needed a twelfth build method. That reasoning
applies to the top level and only to the top level.

One altitude down, a hand-built surface is right: its scope is bounded by a single
planet, and a place you stand in is meant to be specific. The constraint that keeps
it honest is §5.3 — a diorama is assembled from its planet's children, so props are
data-driven even though the vocabulary is authored.

---

## 3. Scope frames

The atlas model is flat: `Body.arm` is a closed union of five, `ARM_ANGLES` is a
module constant, `EPOCH` is a module constant. Nothing can exist above a body or
beside the galaxy.

**What does not change:** `placeBodies()` stays exactly as written. It is a pure
function of the body set that sweeps each arm, groups mutually-crowded bodies into
runs, and fans each run across the arm. Its header comment documents a measured
rejection of the per-body-hash alternative — 48,000 (seed, arm width) combinations,
best minimum separation 0.324 world units against the 0.35 two glyphs need. That
result is not re-litigated here.

**What changes:** the *frame* becomes a parameter instead of a module constant.

```ts
type ScopeId = string                    // "galaxy:zemi", "planet:products"

interface Scope {
  id: ScopeId
  kind: 'galaxy' | 'system' | 'planet'
  parent?: ScopeId
  label: string
  epoch: string                          // was a module constant
  arms: Record<string, number>           // was ARM_ANGLES
  windRate: number                       // was WIND_RATE
  ideals?: Ideal[]                       // §6
}

// Body gains one field; `arm` widens from a closed union to a scope-keyed string.
interface Body {
  parent: ScopeId                        // defaults to "galaxy:zemi"
  arm: string
  /* ...unchanged... */
}

placeBodies(bodies: Body[], scope: Scope): Placement[]
```

A body's world position is its placement within its parent's frame; the camera
composes frames as it descends. A second galaxy is a `Scope` row with
`parent: undefined`. A solar system is a `Scope` with `kind: 'system'`.

**Migration is mechanical.** All 45 existing bodies get
`parent: "galaxy:zemi"`; `ARM_ANGLES` and `WIND_RATE` move into that scope's row;
`ArmId` becomes `string`. No coordinate changes, so the `derivePosition` snapshot
test must produce identical output before and after — that is the migration's
acceptance criterion.

### 3.1 Scene graph

The renderer mirrors the scope tree. `WorldSceneBuilder` currently flattens
everything into one `rootGroup` and computes absolute positions, which is why
descent had to be faked with a modal.

Each scope becomes its own `THREE.Group` with its contents parented to it.
Descent is then literally moving the camera into that group's local space; the
transform composition is `Object3D`'s job, not ours. This is the single change
that converts landing from a modal into a place.

---

## 4. Quote sky

One component. One data set: all 81 entries of `FOUNDER_QUOTES`.

**Positions are scene-space.** Quote stars are points on a sky sphere in the
galaxy scope, projected to screen through the bridge that already exists
(`WorldCanvas` → `onProjectPins` → `ScreenPoint`). They parallax when the camera
orbits. This is the mechanism, and it is why the current layer feels dead: nothing
else about it is wrong.

**Selection is derived, not authored.** Quote-bearing stars are drawn from the full
set through a session-level no-repeat set, so a second visit is not the same five
quotes. The hardcoded `nightStars` array is deleted.

**Night behaviour.** ~14 quote-bearing stars among the field, each on a slow pulse
at its own phase — synchronised pulsing reads as a loading state. Click opens the
card.

**Day behaviour.** The same stars travel as comets. **2–3 in flight** on staggered
intervals, not one every 16 seconds: one at a time reads as an event, three reads
as weather. **Hover or tap pauses the comet in place** and opens the card. This
fixes the dead `cursor-pointer` and makes the quote catchable rather than a race
the visitor loses.

**One card, token-driven.** The existing tooltip hardcodes `bg-zinc-950/85`, which
is wrong on paper. The card takes its ground from the active direction's tokens.

**Reduced motion.** `prefers-reduced-motion` stops comet travel; comets become slow
drifting stars. Content stays reachable; only motion is removed. Every quote star
is a real focusable button with the quote as its accessible name, so the sky is
keyboard- and screen-reader-navigable in both modes.

---

## 5. Planet identity

Five planets must read as five places, not five colours of one object. Identity
comes from four stacked signals.

### 5.1 Surface families

| Planet | Surface | Signature motion | Rationale |
|---|---|---|---|
| **Foundations** | Banded sediment strata | Slowest rotation | `ZemiMark.tsx` is already a stratified cross-section, obsidian at its base. Putting that geology on the origin planet makes the mark and the map say the same thing. |
| **Products** | Gas-giant bands + ideals rings | Four moons in real orbit, labelled from orbit | Largest body at the frontier. The ecosystem must read from orbit with zero clicks. The flow *pulse* between moons is R2 (§9); R1 ships the orbit and the labels. |
| **Labs** | Fractured crystalline shell | Fissures glow and fade | Work that exists to answer whether a thing can be built. |
| **Self** | Ocean and cloud shell | Cloud layer rotating off the surface rate | The arm that points at a person. |
| **Creative** | Molten ember crust | Ember flicker | Youngest, hottest, two bodies, an arm still forming. |

Rotation rates differ per planet and are all **slow**. Slow reads as alive; fast
reads as a screensaver.

### 5.2 Unequal mass

Planets are not peers. Products renders largest, ringed, at the frontier, with its
four ventures as visible labelled moons. Foundations renders small, dense and near
the core. Nineteen learning repositories and four shipped products must not occupy
equal screen area — that composition serves the engineering audience and actively
misleads the commercial one.

`ARM_META.themeColor` currently carries `#7c3aed`, `#2563eb`, `#d97706` — the
pre-atlas palette. These are restated against §2.2.

### 5.3 Ideals rings

Rings encode **ideals**, not skill tiers. Radius already *is* time
(`radiusScale(bornAt)`), so tier rings would state the same fact twice.

```ts
interface Ideal {
  id: string
  ordinal: number          // ring index, inner to outer
  claim: string            // "Deterministic systems over speculation"
  evidence: string[]       // body ids that demonstrate it
}
```

**An ideal without evidence fails the build.** That rule is what separates this from
a slogan on a wall: every ring is a falsifiable claim with repositories behind it.
Ring interaction — hovering illuminates one ring and dims its siblings, opening the
claim with its cited bodies — is what makes a ring an instrument rather than
decoration. Each ring carries one slow-orbiting bead so the ring reads as moving
before it is touched.

### 5.4 Performance constraint

All five planets share **one shader with per-instance uniforms**, not five
materials. Mobile is a first-class surface (§7.2), and five bespoke materials is
where the frame budget goes.

---

## 6. Diorama

A diorama is the surface of one planet: a floating shard in space, orbit-only
camera, no locomotion.

**No rover, no pathfinding, no collision, no ground traversal.** Locomotion was
designed and cut. A half-good rover is worse than none, because bad movement is the
first thing a visitor touches; and neither an engineer nor an investor needs to
drive. The two spectacle beats are arrival (galaxy resolving) and descent (landing).
After those, everything on screen is evidence.

**Props are assembled from the planet's children.** The vocabulary is authored —
plates, slabs, towers, monument, in the low-poly language of the previous island
build. The *arrangement* is derived from the bodies parented to that scope, so a new
venture appears as a new plate without a new build method.

**Ascent** returns to the parent scope through the same camera mechanism as descent.

---

## 7. R1 scope

Direction A only. Day only. One diorama.

| Track | Contents |
|---|---|
| **A · Frames** | `Scope` model; `placeBodies(bodies, scope)`; scene-graph nesting; camera descent/ascent between frames |
| **B · Treatment** | Direction A tokens across canvas, HUD and cards; density (background star field and arm dust, currently absent); the five surface families; unequal mass |
| **C · Quote sky** | One `QuoteSky`, scene-space, all 81 quotes, day comets with pause-on-hover, token-driven card, reduced-motion and keyboard paths |
| **D · Products diorama** | The one surface, assembled from Products' children, with the existing PickMe console |

**Why Products alone.** It is the only planet whose evidence already exists — the
ported engine passes all 27 cases in `engine-fixtures.json`. A diorama for a planet
with nothing real on it rebuilds the theatre problem.

### 7.1 Time-to-evidence

The governing metric is not load time. It is **seconds until something provable is
on screen**, and the headline fact — 286 days, first website to distributed systems
— must require zero clicks. If the map does not read at rest, the interactivity is
decoration.

### 7.2 Mobile

Mobile is a surface, not a degradation. Both target audiences open links from email
and LinkedIn on a phone. Free 3D orbit there is poor, so: tap-to-focus instead of
orbit, reduced particle budget, and the Dossier list reachable in one tap.

---

## 8. Testing

Extending §8 of the atlas design.

- **Migration parity.** `derivePosition` snapshots over the full body set must be
  byte-identical before and after the `Scope` change. The refactor is a no-op on
  coordinates or it is wrong.
- **Ideal evidence completeness.** Every `Ideal.evidence` id resolves to a real
  body. An unresolved id fails the build, as an unassigned arm already does.
- **Scope tree integrity.** Every `Body.parent` resolves; no cycles; every scope
  except the root has a parent that exists.
- **Quote coverage.** The selection function reaches all 81 quotes over a bounded
  number of draws — a regression to a hardcoded subset fails.
- **Reduced motion and keyboard.** Every quote star is focusable and activatable by
  keyboard in both modes; `prefers-reduced-motion` removes travel without removing
  content.
- **Fixture parity** (unchanged) — 27 cases, CI-gated.

---

## 9. Out of scope for R1

Listed so they are not smuggled in.

- Direction C and night mode — R2
- The four remaining dioramas — R2+
- Rover, click-to-move, or any ground locomotion — **cut, not deferred**
- Cross-product flow choreography — R2, and still bounded by the atlas spec's note
  that it is a narrative device on this site only, never an implied production
  integration
- Consoles beyond PickMe — R3+
- A second galaxy or solar system. The `Scope` model must *support* one; R1 ships
  exactly one galaxy. Building the second to prove the first is scope creep.
- Any live backend. The site remains a static export.

---

## 10. Risks

| # | Risk | Mitigation | Residual |
|---|---|---|---|
| 1 | **Direction A executed at 80% reads dated, not crafted.** Light exposes every soft shadow and material seam that dark forgives. This is the largest R1 risk and it is a design risk. | Prototype the treatment on a static frame before the live Field layer. C is the designed fallback, so failure costs a week, not a direction. | Real. Accept and monitor. |
| 2 | **Diorama scope creep.** "One more prop" is how a bounded surface becomes an island city again. | Props derive from the planet's children; adding one is adding a body. The vocabulary is fixed at R1. | Manageable. |
| 3 | **Scope refactor regresses layout.** `placeBodies` is subtle and load-bearing. | It is not modified — only its frame source changes. Snapshot parity is the acceptance criterion. | Low. |
| 4 | **Five surface families cost mobile frame budget.** | One shared shader, per-instance uniforms; particle budget reduced on narrow viewports. | Manageable. |
| 5 | **Ideals read as slogans.** A ring that says "deterministic systems" and cites nothing is worse than no ring. | Evidence is required by the build. | Resolved by design. |

---

## 11. Consequences

**Gained:** a second altitude that is a place rather than a modal; a sky that moves
with the camera and reaches all 81 quotes rather than five; planets that read as
five distinct worlds; ideals that cite their own evidence; a frame model that
absorbs a new planet, system or galaxy as data.

**Lost:** the rover, and the explorable-world reading of the Bruno Simon reference.
What survives of it is arrival and tactility, which is the part that served the
goals.

**Deferred:** night mode, four dioramas, and the flow that makes the ecosystem
legible as an ecosystem. R1 proves the two altitudes; it does not complete the
story.
