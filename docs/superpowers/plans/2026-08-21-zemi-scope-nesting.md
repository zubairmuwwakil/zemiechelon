# Zemí Scope Nesting — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Products a place the camera can fly into — scope-shaped scene graph, derived planet scopes, and descent/ascent between frames — without moving a single body on screen.

**Architecture:** Each scope becomes a `THREE.Group`; descent composes those groups' world matrices rather than computing absolute positions. The scope tree stops being a typed table and becomes a function of the repository set. `Body.parent` stops being decoration and starts deciding which frame a body is laid out in.

**Tech Stack:** Next.js 16 (App Router) · React 19 · TypeScript · three.js 0.185 · Tailwind CSS v4 · Vitest 3 · @testing-library/react

**Spec:** `docs/superpowers/specs/2026-08-20-zemi-scope-nesting-design.md` (which amends `docs/superpowers/specs/2026-08-20-zemi-world-design.md` §3.1)

## Global Constraints

- **Position is derived, never authored.** No body, planet, moon or scope carries a hardcoded coordinate.
- **`placeBodies()` is not modified.** Only its frame source changes.
- **Parity is the acceptance criterion.** World positions for all 45 bodies must be byte-identical before and after Task 5. A nesting refactor that moves anything has failed.
- **A planet's mass aggregates its whole subtree**, never its direct children.
- **Nothing assumes the galaxy is the root.** Every frame and camera signature takes an arbitrary parent/child pair, so a `universe` root lands later as data.
- **`prefers-reduced-motion` removes travel, never content.**
- **Direction A palette, exact values:** ground `#F7F6F2`, ink `#1B1A17`, gold `#B8860B`, verdigris `#0B6B4F`, oxide `#8C3B2E`, rule `#D3CEC0`.
- **Direction C is out of scope.** Night mode ships later. Do not add C tokens.
- **Only the 5 shipped systems reparent.** Products' other 7 repositories stay on the arm — see spec §3.1.
- **No second galaxy, no `universe` row.** Spec §8.
- Run the full suite with `npm test`. Lint with `npm run lint` (`--max-warnings 0`).
- Test environment is `node` by default; a test needing a DOM puts `// @vitest-environment jsdom` on line 1. This works in `.ts` files, not only `.tsx`.

---

## Ordering constraint — read before starting

**Task 1 must be completed and committed before Task 5 touches anything.** The golden file has to capture the *pre-nesting* truth while the pre-nesting code still exists. Generated afterwards it would faithfully record whatever the refactor produced, and the gate would pass while asserting nothing.

Tasks 2, 3 and 4 may run in any order after Task 1. Tasks 5, 6, 7 are strictly sequential.

## Suggested model and effort

| Task | Model | Effort | Why |
|---|---|---|---|
| 1 · Scene parity harness | Sonnet 5 | medium | Mechanical; fails loudly by construction. |
| 2 · Body parent derived | Sonnet 5 | medium | Five lines plus a test that pins it against `moonIds`. |
| 3 · Planet scopes derived | Sonnet 5 | medium | ~30 lines; every existing scope test must still pass untouched. |
| 4 · Mass aggregates subtree | Sonnet 5 | high | Tiny diff, named trap; the test is the deliverable. |
| 5 · One group per scope | **Opus 5** | **high** | Fails silently. Sub-unit drift is invisible per frame. |
| 6 · Camera descent/ascent | Opus 5 | medium | Matrix composition; a wrong camera self-reports immediately. |
| 7 · Wire the flight | Opus 5 | high | Browser judgement and iteration. |

---

## File Structure

**Created**

| File | Responsibility |
|---|---|
| `src/lib/atlas/galaxy.ts` | The galaxy scope literal and the `planet:<arm>` id helper. A leaf module with no local imports — it exists to break the `bodies.ts` ↔ `scopes.ts` cycle. |
| `src/components/world/__tests__/sceneParity.test.ts` | The parity gate. Builds the scene in jsdom and compares every body's world position against a golden file. |
| `src/components/world/__tests__/__fixtures__/scene-golden.json` | Pre-nesting world positions. Generated once, never regenerated. |
| `src/lib/atlas/__tests__/scopeTree.test.ts` | Planet scopes are derived, epochs correct, tree invariants hold. |

**Modified**

| File | Change |
|---|---|
| `src/lib/atlas/scopes.ts` | Re-exports `Scope`/`GALAXY_ZEMI` from `galaxy.ts`; `SCOPES` becomes derived; adds `derivePlanetScopes`. |
| `src/lib/atlas/bodies.ts` | Imports the galaxy from `galaxy.ts`; `parent` derived from `kind`. |
| `src/lib/atlas/ideals.ts` | `idealsFor` uses `planetScopeId` instead of a string template. |
| `src/lib/atlas/planets.ts` | `derivePlanets` sizes from the subtree. |
| `src/components/world/WorldSceneBuilder.ts` | `scopeGroups` map; planet groups named and registered. |
| `src/components/world/WorldCameraManager.ts` | `descend(scopeId)` / `ascend()`. |
| `src/components/world/WorldCanvas.tsx` | Routes planet clicks to descent. |
| `src/app/page.tsx` | Landing modal replaced by descent; consoles stay reachable. |

**Deleted**

| File | Reason |
|---|---|
| `src/components/hud/CleanPlanetLandingModal.tsx` | Replaced by descent. Its consoles move to a panel that opens from the landed frame (Task 7). |

---

## Task 1: Scene parity harness

**Model:** Sonnet 5 · **Effort:** medium

**MUST be committed before Task 5.**

**Files:**
- Create: `src/components/world/__tests__/sceneParity.test.ts`
- Create: `src/components/world/__tests__/__fixtures__/scene-golden.json`

**Interfaces:**
- Consumes: `WorldSceneBuilder` (`rootGroup: THREE.Group`, `bodySprites: Map<string, THREE.Object3D>`, `build(): void`) from `src/components/world/WorldSceneBuilder.ts`; `loadBodies()` from `src/lib/atlas/bodies.ts`
- Produces: `scene-golden.json` — `{ bodies: Array<{ id: string; position: [number, number, number] }> }`, sorted by id, each component rounded to 6 decimals

- [ ] **Step 1: Write the harness**

Create `src/components/world/__tests__/sceneParity.test.ts`:

```ts
// @vitest-environment jsdom
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { loadBodies } from "@/lib/atlas/bodies";
import { WorldSceneBuilder } from "../WorldSceneBuilder";
import golden from "./__fixtures__/scene-golden.json";

const EXPECTED_COUNT = 45;

/**
 * World positions of every drawn body, read straight off the scene graph.
 *
 * Captured before `update()` is ever called: moon pivots rotate on tick, so a
 * golden taken after a frame would encode elapsed time and never reproduce.
 */
function captureWorldPositions(): Array<{ id: string; position: number[] }> {
  const scene = new THREE.Scene();
  const builder = new WorldSceneBuilder(scene, loadBodies(), "2026-08-21");
  builder.build();
  builder.rootGroup.updateMatrixWorld(true);

  const out = [...builder.bodySprites.entries()].map(([id, object]) => ({
    id,
    position: object
      .getWorldPosition(new THREE.Vector3())
      .toArray()
      .map((n) => Number(n.toFixed(6))),
  }));
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

describe("scene graph parity", () => {
  it("draws every body exactly once", () => {
    expect(captureWorldPositions()).toHaveLength(EXPECTED_COUNT);
  });

  it("puts every body where it was before the scope refactor", () => {
    const actual = captureWorldPositions();

    if (process.env.WRITE_GOLDEN) {
      // `__dirname` does not exist under vitest's ESM transform.
      writeFileSync(
        fileURLToPath(new URL("./__fixtures__/scene-golden.json", import.meta.url)),
        `${JSON.stringify({ bodies: actual }, null, 2)}\n`,
      );
    }

    expect(actual).toEqual(golden.bodies);
  });

  it("is deterministic across builds, so the gate cannot pass by luck", () => {
    expect(captureWorldPositions()).toEqual(captureWorldPositions());
  });
});
```

- [ ] **Step 2: Generate the golden file, once**

```bash
mkdir -p src/components/world/__tests__/__fixtures__
echo '{"bodies":[]}' > src/components/world/__tests__/__fixtures__/scene-golden.json
WRITE_GOLDEN=1 npx vitest run src/components/world/__tests__/sceneParity.test.ts
```

Expected: the second test fails on this run (it compares against the empty stub *before* writing). That is fine — the file is now populated.

- [ ] **Step 3: Run again without the flag to verify it passes**

Run: `npx vitest run src/components/world/__tests__/sceneParity.test.ts`
Expected: PASS — 3 tests. Confirm the fixture has 45 entries: `jq '.bodies | length' src/components/world/__tests__/__fixtures__/scene-golden.json` → `45`.

- [ ] **Step 4: Commit**

```bash
git add src/components/world/__tests__/sceneParity.test.ts src/components/world/__tests__/__fixtures__/scene-golden.json
git commit -m "test(world): capture scene-graph positions before nesting

The golden has to record the pre-nesting truth while the pre-nesting code
still exists. Generated after the refactor it would faithfully record
whatever the refactor produced, and the gate would pass while asserting
nothing.

Captured before update() is ever called: moon pivots rotate on tick, so a
golden taken after a frame would encode elapsed time."
```

**Never run with `WRITE_GOLDEN=1` again.** If a later task legitimately changes a position, that is a spec decision, not a regeneration.

---

## Task 2: A body's parent is derived from its kind

**Model:** Sonnet 5 · **Effort:** medium

**Files:**
- Create: `src/lib/atlas/galaxy.ts`
- Modify: `src/lib/atlas/scopes.ts`
- Modify: `src/lib/atlas/bodies.ts`
- Modify: `src/lib/atlas/ideals.ts`
- Modify: `src/lib/atlas/__tests__/bodies.test.ts`

**Interfaces:**
- Consumes: `Body`, `ScopeId` from `src/lib/atlas/types.ts`
- Produces: `planetScopeId(arm: string): ScopeId` returning `` `planet:${arm}` ``; `GALAXY_ZEMI: Scope` and `interface Scope` relocated to `galaxy.ts` and re-exported from `scopes.ts` unchanged

**Why the new file:** `bodies.ts` imports `GALAXY_ZEMI` from `scopes.ts`. Task 3 makes `scopes.ts` derive planet scopes from `loadBodies()`, which would close the loop `scopes.ts → bodies.ts → scopes.ts` and crash at module init, because `SCOPES` is built at the top level. A leaf module both can import breaks it.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/atlas/__tests__/bodies.test.ts`:

```ts
import { moonIds } from "../moons";
import { planetScopeId } from "../galaxy";

describe("body parentage", () => {
  const bodies = loadBodies();

  it("parents every shipped system to its own planet", () => {
    for (const body of bodies.filter((b) => b.kind === "system")) {
      expect(body.parent, `${body.id} is not on its planet`).toBe(planetScopeId(body.arm));
    }
  });

  it("leaves everything else on the galaxy", () => {
    for (const body of bodies.filter((b) => b.kind !== "system")) {
      expect(body.parent, `${body.id} left the galaxy`).toBe("galaxy:zemi");
    }
  });

  it("moves exactly five bodies, so the arms keep their density", () => {
    expect(bodies.filter((b) => b.parent !== "galaxy:zemi")).toHaveLength(5);
  });

  it("agrees with deriveMoons, so the two rules cannot drift apart", () => {
    const parented = new Set(bodies.filter((b) => b.parent !== "galaxy:zemi").map((b) => b.id));
    expect(parented).toEqual(moonIds(bodies));
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/atlas/__tests__/bodies.test.ts`
Expected: FAIL — `Failed to resolve import "../galaxy"`

- [ ] **Step 3: Extract the leaf module**

Create `src/lib/atlas/galaxy.ts` by moving `interface Scope` and `GALAXY_ZEMI` out of `scopes.ts` verbatim, and adding:

```ts
/** e.g. planetScopeId("products") -> "planet:products". One spelling, one place. */
export function planetScopeId(arm: string): ScopeId {
  return `planet:${arm}`;
}
```

In `scopes.ts`, replace the moved declarations with a re-export so all eight existing importers are untouched:

```ts
export { GALAXY_ZEMI, planetScopeId, type Scope } from "./galaxy";
```

- [ ] **Step 4: Derive the parent**

In `src/lib/atlas/bodies.ts`, change the import to `./galaxy` and replace both hardcoded `parent: GALAXY_ZEMI.id` occurrences. The anonymous branch always yields `kind: "star"`, so only the non-anonymous branch can produce a planet parent — write it in both for symmetry:

```ts
const kind = o.kind ?? ("star" as const);
// A shipped system belongs to its planet, not to the galaxy. This is the same
// predicate deriveMoons uses; bodies.test.ts holds the two together.
const parent = kind === "system" ? planetScopeId(o.arm) : GALAXY_ZEMI.id;
```

- [ ] **Step 5: Use the helper where the id was spelled by hand**

In `src/lib/atlas/ideals.ts`, `idealsFor` builds `` `planet:${arm}` `` inline. Replace with `planetScopeId(arm)` and delete the comment about planet scopes not being registered — after Task 3 they are.

- [ ] **Step 6: Run the suite**

Run: `npm test`
Expected: `bodies.test.ts` passes. **`scopes.test.ts` will now fail** on "parents every body to a scope that exists" — that is correct, and Task 3 fixes it. Do not weaken that assertion.

- [ ] **Step 7: Commit**

```bash
git add src/lib/atlas/galaxy.ts src/lib/atlas/scopes.ts src/lib/atlas/bodies.ts src/lib/atlas/ideals.ts src/lib/atlas/__tests__/bodies.test.ts
git commit -m "feat(atlas): derive a body's parent from its kind

Body.parent was written and never read except as a default. A shipped
system now belongs to its planet — the same predicate deriveMoons already
uses, held together by test rather than by convention. Five bodies move
and forty do not.

galaxy.ts exists to break a cycle: bodies.ts imports the galaxy scope,
and the next task makes scopes.ts derive planet scopes from loadBodies(),
which would close the loop and crash at module init."
```

---

## Task 3: Planet scopes are derived, not typed

**Model:** Sonnet 5 · **Effort:** medium

**Files:**
- Modify: `src/lib/atlas/scopes.ts`
- Create: `src/lib/atlas/__tests__/scopeTree.test.ts`

**Interfaces:**
- Consumes: `planetScopeId`, `GALAXY_ZEMI`, `Scope` from `src/lib/atlas/galaxy.ts`; `loadBodies()` from `src/lib/atlas/bodies.ts`
- Produces: `derivePlanetScopes(bodies: Body[]): Scope[]`; `SCOPES: Record<ScopeId, Scope>` now containing the galaxy plus one scope per arm holding a system. `getScope` and `scopeChain` signatures unchanged.

- [ ] **Step 1: Write the failing test**

Create `src/lib/atlas/__tests__/scopeTree.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { loadBodies } from "../bodies";
import { planetScopeId } from "../galaxy";
import { SCOPES, derivePlanetScopes, getScope, scopeChain } from "../scopes";

const bodies = loadBodies();
const planets = derivePlanetScopes(bodies);

describe("derived planet scopes", () => {
  it("registers one scope per arm that ships something, and no others", () => {
    const armsWithSystems = new Set(bodies.filter((b) => b.kind === "system").map((b) => b.arm));
    expect(planets.map((s) => s.id).sort()).toEqual(
      [...armsWithSystems].map(planetScopeId).sort(),
    );
  });

  it("gives Products and Labs a scope, and the other three none", () => {
    expect(planets.map((s) => s.id).sort()).toEqual(["planet:labs", "planet:products"]);
  });

  it("hangs every planet scope off the galaxy", () => {
    for (const scope of planets) {
      expect(scope.parent).toBe("galaxy:zemi");
      expect(scopeChain(scope.id).map((s) => s.id)).toEqual(["galaxy:zemi", scope.id]);
    }
  });

  it("takes each planet's epoch from its oldest child, so radius is time inside too", () => {
    for (const scope of planets) {
      const arm = scope.id.replace("planet:", "");
      const oldest = bodies
        .filter((b) => b.arm === arm && b.kind === "system")
        .map((b) => b.bornAt)
        .sort()[0];
      expect(scope.epoch).toBe(oldest);
    }
  });

  it("declares the arm its children use, so placeBodies can run in the frame", () => {
    for (const scope of planets) {
      const arm = scope.id.replace("planet:", "");
      expect(scope.arms[arm]).toBe(0);
    }
  });

  it("puts the derived scopes in the registry getScope reads", () => {
    for (const scope of planets) {
      // toEqual, not toBe: SCOPES is built from its own derivePlanetScopes()
      // call, so these are equal records and not the same object.
      expect(getScope(scope.id)).toEqual(scope);
      expect(SCOPES[scope.id]).toEqual(scope);
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/atlas/__tests__/scopeTree.test.ts`
Expected: FAIL — `derivePlanetScopes is not exported`

- [ ] **Step 3: Derive the scopes**

In `src/lib/atlas/scopes.ts`, add above `SCOPES`:

```ts
/**
 * A planet is a frame as soon as something shipped in its arm.
 *
 * Nothing is authored per planet. The epoch is the oldest child's birth, so
 * `radiusScale` restarts cleanly inside the planet rather than inheriting a
 * galaxy epoch that means nothing there. The single arm is named for the galaxy
 * arm so a moon's own `arm` still resolves and `placeBodies` runs unchanged in
 * the frame.
 */
export function derivePlanetScopes(bodies: Body[] = loadBodies()): Scope[] {
  const byArm = new Map<string, Body[]>();
  for (const body of bodies) {
    if (body.kind !== "system") continue;
    byArm.set(body.arm, [...(byArm.get(body.arm) ?? []), body]);
  }

  return [...byArm.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([arm, children]) => ({
      id: planetScopeId(arm),
      kind: "planet" as const,
      parent: GALAXY_ZEMI.id,
      label: ARM_META[arm]?.name ?? arm,
      epoch: children.map((c) => c.bornAt).sort()[0],
      arms: { [arm]: 0 },
      windRate: GALAXY_ZEMI.windRate,
    }));
}

export const SCOPES: Record<ScopeId, Scope> = {
  [GALAXY_ZEMI.id]: GALAXY_ZEMI,
  ...Object.fromEntries(derivePlanetScopes().map((s) => [s.id, s])),
};
```

Add the imports `loadBodies` from `./bodies`, `ARM_META` from `@/data/arms`, and `Body` from `./types`.

- [ ] **Step 4: Run both scope suites**

Run: `npx vitest run src/lib/atlas/__tests__/scopeTree.test.ts src/lib/atlas/__tests__/scopes.test.ts`
Expected: PASS — 6 new tests, and all 7 in `scopes.test.ts` green again including "parents every body to a scope that exists" and "declares an angle for every arm a body uses". If either still fails, the arm name or the epoch is wrong — fix the derivation, never the assertion.

- [ ] **Step 5: Run the full suite**

Run: `npm test && npm run lint`
Expected: all pass. If anything imports `SCOPES` at module scope and now sees an empty object, the cycle from Task 2 was not fully broken — check that `bodies.ts` imports from `./galaxy`, not `./scopes`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/atlas/scopes.ts src/lib/atlas/__tests__/scopeTree.test.ts
git commit -m "feat(atlas): derive planet scopes from the repository set

SCOPES was a hand-written record with one entry. It is now the galaxy
plus one scope per arm that ships something — Products and Labs today.
An arm that ships its first product gets a frame by existing, which is
the rule the rest of the atlas already follows.

Each planet's epoch is its oldest child's birth, so radius-is-time
restarts inside the planet instead of inheriting a galaxy epoch that
means nothing there.

Every assertion in scopes.test.ts is untouched. The tree got deeper; none
of its invariants changed."
```

---

## Task 4: A planet's mass is its subtree

**Model:** Sonnet 5 · **Effort:** high

**Files:**
- Modify: `src/lib/atlas/planets.ts`
- Modify: `src/lib/atlas/__tests__/planets.test.ts`

**Interfaces:**
- Consumes: `derivePlanets(bodies, scope): PlanetPlacement[]` from `src/lib/atlas/planets.ts`
- Produces: no signature change. This task adds a guard and its test.

**Why:** `derivePlanets` sizes each planet from `bodies.filter((b) => b.arm === arm)`. It reads `arm`, not `parent`, so it is correct today by luck. The moment someone "tidies" it to filter on `parent` — which looks like the obvious follow-up to Tasks 2 and 3 — Products loses its four systems from its own mass and stops being the largest planet, breaking a §5.2 guarantee with nothing failing and nothing thrown. The test is the real deliverable.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/atlas/__tests__/planets.test.ts`:

```ts
describe("planet mass aggregates the subtree", () => {
  const bodies = loadBodies();

  it("keeps Products the largest planet after the systems reparent", () => {
    const bySize = [...derivePlanets(bodies)].sort((a, b) => b.radius - a.radius);
    expect(bySize[0].arm).toBe("products");
  });

  it("counts a planet's own children toward its mass", () => {
    const products = derivePlanets(bodies).find((p) => p.arm === "products")!;
    // Eleven bodies carry the Products arm: four shipped, seven not.
    expect(products.bodyCount).toBe(11);
  });

  it("does not shrink when a body's parent moves off the galaxy", () => {
    const asGalaxy = derivePlanets(bodies.map((b) => ({ ...b, parent: "galaxy:zemi" })));
    expect(derivePlanets(bodies).map((p) => [p.arm, p.radius])).toEqual(
      asGalaxy.map((p) => [p.arm, p.radius]),
    );
  });
});
```

- [ ] **Step 2: Run it to verify it passes already**

Run: `npx vitest run src/lib/atlas/__tests__/planets.test.ts`
Expected: PASS. **This is the one task whose test starts green**, because the current filter is already correct. The test exists to keep it that way — it is a regression gate, not a driver.

- [ ] **Step 3: Write the rule down where it will be read**

In `src/lib/atlas/planets.ts`, above the `bodies.filter` inside `derivePlanets`:

```ts
    // Filtered by arm, NOT by parent, and that is load-bearing. A planet's mass
    // is its whole subtree: the four shipped systems are parented to
    // planet:products, so filtering on parent would take Products' own mass away
    // from it and it would stop being the largest planet — with nothing thrown
    // and no test failing but the one in planets.test.ts.
    const inArm = bodies.filter((b) => b.arm === arm);
```

- [ ] **Step 4: Run the suite and commit**

Run: `npm test && npm run lint`

```bash
git add src/lib/atlas/planets.ts src/lib/atlas/__tests__/planets.test.ts
git commit -m "test(atlas): pin planet mass to the subtree, not the children

derivePlanets filters by arm and not by parent, which is correct today by
luck. Now that the shipped systems are parented to their planets,
'tidying' that filter to match would take Products' four systems out of
its own mass and it would stop being the largest planet — breaking a
spec guarantee with nothing thrown and nothing failing.

The comment says why and the test makes it stick."
```

---

## Task 5: One `THREE.Group` per scope

**Model:** Opus 5 · **Effort:** high

**Gated on Task 1 being committed.**

**Files:**
- Modify: `src/components/world/WorldSceneBuilder.ts`

**Interfaces:**
- Consumes: `SCOPES`, `getScope` from `src/lib/atlas/scopes.ts`; `derivePlanetScopes` from the same; `planetScopeId` from `src/lib/atlas/galaxy.ts`; `derivePlanets` from `src/lib/atlas/planets.ts`
- Produces: `WorldSceneBuilder.scopeGroups: Map<ScopeId, THREE.Group>`; `WorldSceneBuilder.groupFor(scopeId: ScopeId): THREE.Group`

**Why this is the risky one:** the field, the planets' instance matrices, the ideal rings, the moons, the quote-sky anchors and the pin projection all compute world positions through `toScene()`. Moving objects under a parent group changes their local coordinates. Nothing throws when this is wrong — the map just looks subtly incorrect, and "subtly incorrect" is indistinguishable from "correct" by eye on a spiral.

- [ ] **Step 1: Confirm the gate is armed**

Run: `npx vitest run src/components/world/__tests__/sceneParity.test.ts`
Expected: PASS — 3 tests. If the fixture does not exist, **stop**: Task 1 has not been done, and doing it now would capture post-refactor positions.

- [ ] **Step 2: Add the scope registry**

`WorldSceneBuilder` imports only `type { Body }` from `@/lib/atlas/types` today; add `ScopeId` to that import, and `derivePlanetScopes` to the existing `@/lib/atlas/scopes` import.

In `WorldSceneBuilder`, alongside `rootGroup`:

```ts
  /**
   * The scene graph mirrors the scope tree. `rootGroup` is the galaxy's own
   * group; each planet scope gets a child group at that planet's centre.
   * Descent is then moving the camera into a group's local space, and the
   * transform composition is Object3D's job rather than ours.
   */
  public readonly scopeGroups = new Map<ScopeId, THREE.Group>();

  public groupFor(scopeId: ScopeId): THREE.Group {
    const group = this.scopeGroups.get(scopeId);
    if (!group) {
      // Loud, not defaulted — the same rule an unknown scope already follows.
      throw new Error(`no group built for scope "${scopeId}"`);
    }
    return group;
  }
```

- [ ] **Step 3: Register the galaxy and the planets**

At the top of `build()`, before any builder runs:

```ts
    this.rootGroup.name = GALAXY_ZEMI.id;
    this.scopeGroups.set(GALAXY_ZEMI.id, this.rootGroup);

    const centers = new Map(
      derivePlanets(this.bodies).map((p) => [p.arm, toScene(p.center)]),
    );
    for (const scope of derivePlanetScopes(this.bodies)) {
      const arm = scope.id.replace("planet:", "");
      const center = centers.get(arm);
      if (!center) continue;
      const group = new THREE.Group();
      group.name = scope.id;
      group.position.set(center.x, PLANET_Y, center.z);
      this.rootGroup.add(group);
      this.scopeGroups.set(scope.id, group);
    }
```

- [ ] **Step 4: Hang the moons off their planet's group**

`buildMoons` currently creates its own anonymous group per moon at the planet's centre. Replace that with the registered group, and make the moon's transform **local to it** — the orbit pivot moves from `rootGroup` space into planet space, so its position becomes the origin rather than the planet's centre:

- delete the per-moon `const group = new THREE.Group()` and its `group.position.set(...)`
- take `const group = this.groupFor(planetScopeId(moon.arm))`
- the orbit ring, pivot and label keep the same **local** coordinates they already had, because they were already expressed relative to the planet's centre
- `this.rootGroup.add(group)` becomes nothing — the group is already parented

The label was deliberately added to `rootGroup` in world space; move it to the planet group and drop the `center.x` / `center.z` offsets from its position, keeping only the vertical term.

- [ ] **Step 5: Run the gate**

Run: `npx vitest run src/components/world/__tests__/sceneParity.test.ts`
Expected: PASS. **If it fails, the diff of the failure is the answer** — the reported world position minus the golden tells you exactly which offset was applied twice or not at all. Do not regenerate the fixture.

- [ ] **Step 6: Run the suite, lint, and verify in the browser**

Run: `npm test && npm run lint`

Then:
1. `preview_start`, `read_console_messages` — no errors.
2. Screenshot at galaxy framing. It must be indistinguishable from before this task: same planets, same moons, same labels, same field.
3. Click Products' PickMe moon. The body card must still open — instanced picking and `hitObjects` positions survived the reparent.

- [ ] **Step 7: Commit**

```bash
git add src/components/world/WorldSceneBuilder.ts
git commit -m "refactor(world): mirror the scope tree in the scene graph

Each scope now owns a THREE.Group: rootGroup is the galaxy, and each
planet scope gets a child group at that planet's centre. Descent becomes
moving the camera into a group's local space, and composing the transform
is Object3D's job rather than ours.

Most of this already existed — buildMoons was creating an anonymous group
at the planet's centre and hanging the moons inside it. That group was a
planet scope without a name.

Nothing moved. The parity gate compares every body's world position
against a golden captured before the refactor, which is the only way to
tell 'correct' from 'subtly wrong' on a spiral."
```

---

## Task 6: Camera descent and ascent

**Model:** Opus 5 · **Effort:** medium

**Files:**
- Modify: `src/components/world/WorldCameraManager.ts`
- Create: `src/components/world/__tests__/descent.test.ts`

**Interfaces:**
- Consumes: `scopeChain(id): Scope[]` from `src/lib/atlas/scopes.ts`; `WorldSceneBuilder.groupFor` from Task 5
- Produces: `WorldCameraManager.descend(target: THREE.Object3D, radius: number): void`; `WorldCameraManager.ascend(): void`; `WorldCameraManager.activeScope: ScopeId`

**Note on the signature:** `descend` takes the group and a framing radius rather than a `scopeId`, so the camera never needs to know what a scope *is* — only where a frame sits and how big it is. That is what keeps it usable for a `universe` root later without a signature change.

- [ ] **Step 1: Write the failing test**

Create `src/components/world/__tests__/descent.test.ts`:

```ts
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { WorldCameraManager } from "../WorldCameraManager";

function settled(manager: WorldCameraManager): THREE.Vector3 {
  // Pose lerps toward its target; twenty long frames is well past convergence.
  for (let i = 0; i < 20; i++) manager.update(1);
  return manager.target.clone();
}

describe("descent", () => {
  it("frames an arbitrary group, with no knowledge of the galaxy", () => {
    const manager = new WorldCameraManager(1280, 720);
    const group = new THREE.Group();
    group.position.set(-99.6, 1, 57.3);
    group.updateMatrixWorld(true);

    manager.descend(group, 5.92);
    const target = settled(manager);

    expect(target.x).toBeCloseTo(-99.6, 1);
    expect(target.z).toBeCloseTo(57.3, 1);
  });

  it("composes a nested frame's world matrix rather than its local position", () => {
    const manager = new WorldCameraManager(1280, 720);
    const parent = new THREE.Group();
    parent.position.set(100, 0, 0);
    const child = new THREE.Group();
    child.position.set(10, 0, 0);
    parent.add(child);
    parent.updateMatrixWorld(true);

    manager.descend(child, 4);
    expect(settled(manager).x).toBeCloseTo(110, 1);
  });

  it("returns to the galaxy pose on ascent", () => {
    const manager = new WorldCameraManager(1280, 720);
    const group = new THREE.Group();
    group.position.set(-99.6, 1, 57.3);
    group.updateMatrixWorld(true);

    manager.descend(group, 5.92);
    settled(manager);
    manager.ascend();
    const target = settled(manager);

    expect(target.x).toBeCloseTo(0, 1);
    expect(target.z).toBeCloseTo(0, 1);
  });

  it("arrives without travelling when motion is reduced", () => {
    const manager = new WorldCameraManager(1280, 720, true);
    const group = new THREE.Group();
    group.position.set(-99.6, 1, 57.3);
    group.updateMatrixWorld(true);

    manager.descend(group, 5.92);
    // No update() call at all: reduced motion means arrived, not animating.
    expect(manager.target.x).toBeCloseTo(-99.6, 1);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/world/__tests__/descent.test.ts`
Expected: FAIL — `manager.descend is not a function`

- [ ] **Step 3: Implement**

In `WorldCameraManager`, add a third constructor parameter `private reducedMotion = false`, and:

```ts
  /**
   * Frame any object in the scene graph. Takes the object and its size, not a
   * scope id: the camera never needs to know what a scope is, only where a
   * frame sits and how big it is. That is what lets a `universe` root use this
   * unchanged.
   *
   * The world matrix is read rather than the local position, so a frame nested
   * two deep is composed by Object3D rather than by arithmetic here.
   */
  public descend(target: THREE.Object3D, radius: number): void {
    const center = target.getWorldPosition(new THREE.Vector3());
    this.setPreset("", {
      position: new THREE.Vector3(center.x, radius * 3.6, center.z + radius * 4.8),
      target: new THREE.Vector3(center.x, radius * 0.3, center.z),
    });
    if (this.reducedMotion) this.snap();
  }

  public ascend(): void {
    this.setPreset("galaxy");
    if (this.reducedMotion) this.snap();
  }

  /** Travel removed, content kept. */
  private snap(): void {
    this.currentPose.target.copy(this.desiredPose.target);
    this.target.copy(this.desiredPose.target);
    this.spherical.copy(this.sphericalTarget);
  }
```

Note `setPreset("", customPose)` already accepts a custom pose and syncs `sphericalTarget` from it — reuse that path rather than duplicating the spherical maths.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/world/__tests__/descent.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 5: Run the suite, lint, and commit**

Run: `npm test && npm run lint`

```bash
git add src/components/world/WorldCameraManager.ts src/components/world/__tests__/descent.test.ts
git commit -m "feat(world): give the camera descent and ascent

descend() takes an object and a radius rather than a scope id, so the
camera never needs to know what a scope is — only where a frame sits and
how big it is. A universe root will use it unchanged.

It reads the world matrix rather than the local position, so a frame
nested two deep is composed by Object3D instead of by arithmetic here.

Reduced motion arrives instead of flying: travel goes, nothing else does."
```

---

## Task 7: Fly there, and retire the modal

**Model:** Opus 5 · **Effort:** high

**Files:**
- Modify: `src/components/world/WorldCanvas.tsx`
- Modify: `src/app/page.tsx`
- Delete: `src/components/hud/CleanPlanetLandingModal.tsx`

**Interfaces:**
- Consumes: `WorldCameraManager.descend/ascend` (Task 6); `WorldSceneBuilder.groupFor` and `scopeGroups` (Task 5); `PLANET_RADII` from `src/components/world/WorldCameraManager.ts`
- Produces: no new exports. `WorldCanvasProps` gains `landedScope?: ScopeId | null`.

- [ ] **Step 1: Route a planet click to descent**

In `WorldCanvas.tsx`, add `landedScope` to `WorldCanvasProps` and an effect that acts on it:

```ts
  useEffect(() => {
    const builder = sceneBuilderRef.current;
    const camera = cameraManagerRef.current;
    if (!builder || !camera) return;
    if (landedScope && builder.scopeGroups.has(landedScope)) {
      const arm = landedScope.replace("planet:", "");
      camera.descend(builder.groupFor(landedScope), PLANET_RADII[arm] ?? 6);
    } else {
      camera.ascend();
    }
  }, [landedScope]);
```

Read `prefers-reduced-motion` once when the manager is constructed and pass it as the third argument:

```ts
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cameraManager = new WorldCameraManager(width, height, reduced);
```

- [ ] **Step 2: Replace the modal with a landed panel**

In `src/app/page.tsx`, `activeLandingPlanet` becomes the scope id passed to `WorldCanvas` as `landedScope`. Delete the `CleanPlanetLandingModal` import and element.

The consoles it held must stay reachable — mount them in a dismissible panel rendered when `activeLandingPlanet` is set, using the same console components the modal used. Keep its "Return to Orbit" control, wired to `setActiveLandingPlanet(null)`, and add an Escape handler doing the same.

Only Products and Labs have scopes. A click on an armless planet must still do something sane: it descends to that planet's group if one exists, and otherwise leaves the camera where it is rather than throwing — `builder.scopeGroups.has()` above already guards this.

- [ ] **Step 3: Delete the modal**

```bash
git rm src/components/hud/CleanPlanetLandingModal.tsx
```

Grep for stragglers: `grep -rn "CleanPlanetLandingModal" src/` must return nothing.

- [ ] **Step 4: Run the suite and lint**

Run: `npm test && npm run lint && npm run build`
Expected: all pass.

- [ ] **Step 5: Verify in the browser**

1. `preview_start`, `read_console_messages` — no errors.
2. Click Products. The camera must **fly** to it — planet close up, four moons visible around it — with no modal over a still scene.
3. The PickleOps and PickMe consoles must still be reachable and interactive from the landed state.
4. Escape returns to the galaxy pose.
5. Click Foundations, which has no scope. It must not throw; check the console.
6. `resize_window` to mobile, reload, repeat step 2.
7. Screenshot the landed state and the galaxy state.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(world): land on Products by flying there

Landing was CleanPlanetLandingModal — a div over a still scene, which is
the theatre the atlas spec set out to eliminate. Clicking Products now
moves the camera into its frame: the planet close up with its four moons
around it.

The consoles the modal carried keep their home in a dismissible panel
until Plan 3 mounts them on the surface. Escape ascends.

Foundations, Self and Creative have no planet scope because nothing has
shipped in those arms, and clicking them is a no-op rather than an error —
a scope exists when there is something to put in it."
```

---

## Verification

After Task 7, before calling Plan 2 complete:

- [ ] `npm test` — all pass, no skips
- [ ] `npm run lint` — clean at `--max-warnings 0`
- [ ] `npm run build` — production build succeeds
- [ ] `npx vitest run src/components/world/__tests__/sceneParity.test.ts` — passes against the **original** fixture; `git log --oneline -- src/components/world/__tests__/__fixtures__/scene-golden.json` shows exactly one commit
- [ ] Clicking Products flies the camera there; no modal appears
- [ ] The PickleOps and PickMe consoles are reachable and interactive from the landed state
- [ ] Escape ascends to the galaxy pose
- [ ] Clicking Foundations, Self or Creative does not throw
- [ ] At galaxy framing the map is visually unchanged from R1
- [ ] OS reduced-motion on: descent arrives without travelling, and everything stays reachable
- [ ] `grep -rn "new THREE.Vector3(-\?[0-9]" src/components/world/` returns only camera poses and the origin
- [ ] `grep -rn "CleanPlanetLandingModal" src/` returns nothing

---

## Deferred to Plan 3

The diorama: the surface assembled from Products' children, the plate/slab/tower vocabulary recoverable from the deleted `SceneBuilder.ts` in commit `e0abd4e`, and the PickMe console mounted on it.

Two questions to answer then, against a surface that exists rather than in the abstract: whether Products' seven remaining repositories should follow their four siblings into the planet scope, and whether the moons *are* the landing surface — descent being nothing but getting closer to the same four objects, which is the most honest option and the one this plan deliberately left open (spec §5).

The `universe` root and sibling galaxies land whenever galaxy two is built. Task 6's signature was written so that costs nothing.
