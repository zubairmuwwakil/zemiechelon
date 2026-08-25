# Zemí Journey — Design

**Date:** 2026-08-24
**Status:** Implemented
**Amends:** `2026-08-22-zemi-motion-design.md` §3.7, which enumerated the
consumers that must read positions live. This document is about a different
axis of the same failure: not where a thing *is*, but where the *visitor* is.

---

## 1. Problem

Five `useState` slots in `page.tsx` encoded one fact — where the visitor is:

| slot | type |
|---|---|
| `activePreset` | `CameraTargetPreset` (a string) |
| `activeLandingPlanet` | `ScopeId \| null` |
| `flybyScope` | `ScopeId \| null` |
| `standingScope` | `ScopeId \| null` |
| `flybyReturn` | `ScopeId \| null` |

They were mutually exclusive in intent and independent in type. Six handlers
wrote **twenty-four assignments** between them, and each was responsible for
clearing the slots it was not setting. `WorldCanvas` then re-derived precedence
from four of them as a fall-through chain — so the rule about which frame wins
existed in two files, neither checked by the compiler.

Three defects of the same shape were found in one reading:

- **Live.** `setPreset()` cleared the framed frame but not the standing one, and
  `leaveSurface()` off a moon ascends to the parent *planet*, so `ascend()` never
  runs. The camera stayed on ground the visitor had asked to leave.
- **Latent.** Selecting the core left `standingScope` set, so the request to go
  back to the galaxy would have been a no-op from a surface.
- **Latent.** `leaveSurface()` cleared three slots and left `flybyScope`.

Two were unreachable through today's UI. That is the argument for the change,
not against it: they were unreachable by coincidence of which handlers exist,
and each new handler is another chance to reach them.

---

## 2. What the reading established

**`flybyReturn` was a stored copy of a derived fact.** `deriveMoonScopes` sets
`Scope.parent = planetScopeId(body.arm)`; `resolveBodySelection` computes
`ascendTo = planetScopeId(body.arm)`. The same value, derived twice, one copy
then held in React state — and it is the copy `leaveSurface` failed to keep in
step. `scopeChain()` has existed since the scope tree landed and no navigation
code read it.

**Every drift in this scene has one signature: a fact represented twice.**
`PLANET_CENTERS` against the world matrix (the pins, then the camera).
`ascendTo` against `Scope.parent`. Five state slots against one location.
Each pair was correct on the day it was written.

**The chrome had the same shape.** Two overlays were gated on an identical
five-term negation, written out twice, with a four-term variant in a third
place. Every panel added since has had to be remembered at each site.

---

## 3. Decisions

### 3.1 One value, and a union that cannot spell an illegal state

```ts
type Position =
  | { kind: "galaxy" }
  | { kind: "planet"; arm: string; mode: "orbit" | "panel" | "surface" }
  | { kind: "moon"; bodyId: string; mode: "flyby" | "surface" };

interface Journey { position: Position; card: string | null; console: string | null }
```

"Standing on the galaxy" and "flying past a planet" stop needing to be ruled out
by hand at six call sites, because they cannot be written. Every reducer branch
returns a whole `Journey`, so there is no way to set where you are and forget to
put down what the last place had open.

### 3.2 A planet is named by its arm, not by a scope

Three of the five arms have no scope: all five are drawn, only the ones that
have shipped enough are places you can be *inside*. `arm` is therefore the only
name that fits every planet the nav can select, and `scopeIdFor()` returns null
for the rest rather than throwing. This is the same distinction `planetFrames.ts`
already draws for the pins.

### 3.3 Ascent is derived from the scope tree, never stored

`ascendFrom()` reads the map's own nesting. `flybyReturn` is deleted. A stored
stack was considered and rejected for the reason §2 gives: it would be a second
representation of a tree the codebase already derives, which is the failure this
document exists to remove. `journey.test.ts` asserts `ascendFrom` agrees with
`Scope.parent` for **every scope that has one**, so the two cannot separate
quietly — and a third level in the map fails that test rather than silently
ascending too far.

### 3.4 `Framing` is coarser than `Position`, and that is the point

`orbit` and `panel` frame a planet identically; they differ only in what is
drawn over the scene. The collapse happens once, in `framingFor()`. It used to
happen inside the canvas, as a chain of guards over four props keyed on
`scopeGroups.has(...)` — which is how two of the five arms came to take a
different camera path from the other three for two commits.

`WorldCanvas` now takes one `framing` prop and switches on it exhaustively.

### 3.5 The model is pure, and lives in `lib/atlas/`

No React, no THREE, no canvas. This is not a stylistic preference: the render
loop runs inside a WebGL context jsdom cannot create, which is the stated reason
`navigation.ts`, `surfaces.ts` and `planetPins.ts` are already separate modules.
Navigation state was the last piece of that logic still trapped in a component.

### 3.6 What stays out

`isDossierOpen`, `isLegendOpen` and `isTerminalOpen` are chrome, not location,
and keep their own state. The duplicated negation is collapsed to one named
`sceneIsClear` predicate rather than folded into the union.

---

## 4. Consequences

| Before | After |
|---|---|
| 5 state slots, 24 assignments across 6 handlers | 1 reducer, every branch total |
| precedence decided in `page.tsx` **and** `WorldCanvas` | decided once, in `framingFor` |
| 4 camera props | 1 |
| `founder → self` known in 2 places | 1 (`journey.ts`) |
| navigation logic untestable without WebGL | 38 tests, no renderer |

`presetArm()` and the unreachable `CAMERA_PRESETS.founder` row were removed as
part of this: both became orphans, and `presetArm` held a second copy of the
`founder` alias.

**Not fixed, and worth naming.** `landingMode()` routes a reduced-motion visitor
to a panel when they select an *arm*, but selecting a *body* consults
`declaresSurface` directly and can still put them on a moon's surface. Motion
design §3.10 claims otherwise. Behaviour is preserved here rather than silently
changed; it is a decision for its own commit.

---

## 5. Testing

| Area | Assertion |
|---|---|
| Ascent matches the map | `ascendFrom` agrees with `Scope.parent` for every scope that has one |
| Arrival is total | arriving anywhere leaves no card or console from the last place |
| Landing modes | narrow viewport, reduced motion, and a scope with no ground each fall back to the panel |
| Framing collapse | a panelled planet and an orbited one resolve to the same `Framing` |
| Frame resolution | `framedBody` answers for all five arms and for a moon, at the radius each is drawn |
| Nav framing tracks | an arm framed from the nav stays within half its radius of frame centre after 600 s of pattern |
| Surface release | an explicit preset releases a standing frame |
| Deep link | the URL names the moon underfoot, nothing on a planet's surface, the card otherwise |
| Placement parity | `sceneParity.test.ts` golden unchanged |
