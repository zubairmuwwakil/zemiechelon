# Zemí World R1 — Galaxy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the top-level galaxy view in Direction A — scope frames that generalise the layout without touching the crowd-run algorithm, planets derived from real metadata and rendered as five distinct worlds, and one quote sky that lives in the scene and reaches all 81 quotes.

**Architecture:** The layout *frame* becomes a parameter instead of a module constant, so `placeBodies()` works at any depth unchanged. Planet positions stop being authored and start being derived from the bodies parented to each arm. The quote layer collapses from two hardcoded viewport overlays into one scene-space system projected through the pin bridge that already exists.

**Tech Stack:** Next.js 16 (App Router) · React 19 · TypeScript · three.js 0.185 · Tailwind CSS v4 · Vitest 3 · @testing-library/react

**Spec:** `docs/superpowers/specs/2026-08-20-zemi-world-design.md` (which amends `docs/superpowers/specs/2026-08-19-zemi-atlas-design.md`)

## Global Constraints

- **Position is derived, never authored.** No body, planet, or quote star carries a hardcoded coordinate. Adding a venture is adding a row.
- **`placeBodies()` is not modified.** Only its frame source changes. Its crowd-run fan is a measured result (48,000 combinations tested; best per-body-hash separation 0.324 world units against the 0.35 needed) and is not re-litigated.
- **Migration parity is the acceptance criterion for Task 2.** `derivePosition` output over the full body set must be byte-identical before and after the scope change.
- **Direction A palette, exact values:** ground `#F7F6F2`, ink `#1B1A17`, gold `#B8860B`, verdigris `#0B6B4F`, oxide `#8C3B2E`.
- **Direction C is out of scope.** Night mode ships in R2. Do not add C tokens.
- **No rover, no ground locomotion, no pathfinding.** Cut, not deferred.
- **One shader for all five planets**, per-instance uniforms. Not five materials.
- **Every quote star is a focusable button** with the quote text as its accessible name, in every mode.
- **`prefers-reduced-motion` removes travel, never content.**
- **Static export only.** No backend, no runtime data fetch.
- Run the full suite with `npm test`. Lint with `npm run lint` (`--max-warnings 0`).
- `.tsx` test files require the `// @vitest-environment jsdom` pragma on line 1; `.ts` tests run in `node`.

---

## File Structure

**Created**

| File | Responsibility |
|---|---|
| `src/lib/atlas/scopes.ts` | The `Scope` record and tree lookups. One job: answer "what frame is this body in, and what frame contains that one". |
| `src/lib/atlas/__tests__/scopes.test.ts` | Tree integrity — every parent resolves, no cycles. |
| `src/lib/atlas/__tests__/positionParity.test.ts` | Golden-file parity across the scope refactor. |
| `src/lib/quotes/rotation.ts` | No-repeat quote draw. Pure, seedable, no React. |
| `src/lib/quotes/sky.ts` | Deterministic quote-star placement on a sky sphere. Pure, no three.js. |
| `src/lib/quotes/__tests__/rotation.test.ts` | All 81 reachable; no repeat before exhaustion. |
| `src/lib/quotes/__tests__/sky.test.ts` | Determinism, radius, minimum angular separation. |
| `src/lib/atlas/ideals.ts` | The `Ideal` record and per-ideal evidence validation. |
| `src/lib/atlas/__tests__/ideals.test.ts` | Every cited body id resolves; unresolved id throws. |
| `src/components/world/QuoteSky.tsx` | The one quote layer. Replaces `ShootingStarQuotes.tsx`. |
| `src/components/world/QuoteCard.tsx` | Token-driven quote card, used by both behaviours. |
| `src/components/world/PlanetSurfaces.ts` | The five surface families as one shader with per-instance uniforms. |
| `src/lib/theme/directionA.ts` | Direction A tokens as typed constants, single source for CSS and three.js. |

**Modified**

| File | Change |
|---|---|
| `src/lib/atlas/types.ts` | `ScopeId`; `Body.parent`; `arm` widens from closed union to `string`. |
| `src/lib/atlas/position.ts` | `scope` becomes an optional trailing parameter defaulting to the body's own frame. Algorithm untouched. |
| `src/components/world/WorldCameraManager.ts` | `PLANET_CENTERS` deleted; centres derived from the body set. |
| `src/components/world/WorldSceneBuilder.ts` | Planets use the shared shader; background density added. |
| `src/app/globals.css` | Direction A tokens replace the current `:root` block. |
| `src/app/page.tsx` | `ShootingStarQuotes` swapped for `QuoteSky`. |

**Deleted**

| File | Reason |
|---|---|
| `src/components/world/ShootingStarQuotes.tsx` | Replaced by `QuoteSky`. Its `nightStars` array reached 5 of 81 quotes and its day comet had a `cursor-pointer` with no handler. |

---

## Task 1: Scope model

**Files:**
- Create: `src/lib/atlas/scopes.ts`
- Create: `src/lib/atlas/__tests__/scopes.test.ts`
- Modify: `src/lib/atlas/types.ts`

**Interfaces:**
- Consumes: `ArmId` (widened here), `Body` from `src/lib/atlas/types.ts`
- Produces: `type ScopeId = string`; `interface Scope`; `GALAXY_ZEMI: Scope`; `SCOPES: Record<ScopeId, Scope>`; `getScope(id: ScopeId): Scope`; `scopeChain(id: ScopeId): Scope[]` (root-first)

- [ ] **Step 1: Write the failing test**

Create `src/lib/atlas/__tests__/scopes.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { GALAXY_ZEMI, SCOPES, getScope, scopeChain } from "../scopes";
import { loadBodies } from "../bodies";

describe("scope tree", () => {
  it("has exactly one root", () => {
    const roots = Object.values(SCOPES).filter((s) => s.parent === undefined);
    expect(roots).toHaveLength(1);
    expect(roots[0].id).toBe(GALAXY_ZEMI.id);
  });

  it("resolves every declared parent", () => {
    for (const scope of Object.values(SCOPES)) {
      if (scope.parent !== undefined) {
        expect(SCOPES[scope.parent], `dangling parent on ${scope.id}`).toBeDefined();
      }
    }
  });

  it("has no cycles", () => {
    for (const scope of Object.values(SCOPES)) {
      const seen = new Set<string>();
      let cursor: string | undefined = scope.id;
      while (cursor !== undefined) {
        expect(seen.has(cursor), `cycle through ${cursor}`).toBe(false);
        seen.add(cursor);
        cursor = SCOPES[cursor].parent;
      }
    }
  });

  it("returns the chain root-first", () => {
    expect(scopeChain(GALAXY_ZEMI.id).map((s) => s.id)).toEqual([GALAXY_ZEMI.id]);
  });

  it("throws on an unknown scope rather than defaulting", () => {
    expect(() => getScope("galaxy:nope")).toThrow(/unknown scope/);
  });

  it("parents every body to a scope that exists", () => {
    for (const body of loadBodies()) {
      expect(SCOPES[body.parent], `body ${body.id} has no scope`).toBeDefined();
    }
  });

  it("declares an angle for every arm a body uses", () => {
    for (const body of loadBodies()) {
      const scope = getScope(body.parent);
      expect(scope.arms[body.arm], `${body.id} uses undeclared arm ${body.arm}`).toBeDefined();
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/atlas/__tests__/scopes.test.ts`
Expected: FAIL — `Failed to resolve import "../scopes"`

- [ ] **Step 3: Widen the types**

In `src/lib/atlas/types.ts`, replace the `ArmId` line and add `ScopeId`, then add `parent` to `Body`:

```ts
/** Arms are declared per scope, so this is a scope-keyed name rather than a closed set. */
export type ArmId = string;

/** e.g. "galaxy:zemi", "planet:products" */
export type ScopeId = string;
```

In the `Body` interface, add one field above `arm`:

```ts
  parent: ScopeId;
```

- [ ] **Step 4: Write the scope module**

Create `src/lib/atlas/scopes.ts`:

```ts
import type { ScopeId } from "./types";

/**
 * A coordinate frame. Bodies are laid out within their parent's frame, and the
 * camera composes frames as it descends. `arms` and `windRate` were module
 * constants in position.ts; they live here so a second galaxy is a row of data
 * rather than a navigation mode.
 */
export interface Scope {
  id: ScopeId;
  kind: "galaxy" | "system" | "planet";
  parent?: ScopeId;
  label: string;
  /** ISO date. Radius zero. */
  epoch: string;
  /** Arm name -> base angle in radians. */
  arms: Record<string, number>;
  /** How far an arm sweeps per e-fold of radius. Higher = tighter spiral. */
  windRate: number;
}

export const GALAXY_ZEMI: Scope = {
  id: "galaxy:zemi",
  kind: "galaxy",
  label: "Zemí Echelon",
  epoch: "2025-11-06",
  arms: {
    foundations: 0,
    products: (2 * Math.PI) / 5,
    labs: (4 * Math.PI) / 5,
    self: (6 * Math.PI) / 5,
    creative: (8 * Math.PI) / 5,
  },
  windRate: 0.55,
};

export const SCOPES: Record<ScopeId, Scope> = {
  [GALAXY_ZEMI.id]: GALAXY_ZEMI,
};

export function getScope(id: ScopeId): Scope {
  const scope = SCOPES[id];
  if (!scope) {
    // Loud, not defaulted. A body in an unknown frame would render at the
    // origin and look like a layout bug, exactly as an unassigned arm would.
    throw new Error(`unknown scope "${id}"`);
  }
  return scope;
}

/** Root-first, so callers can compose transforms outermost to innermost. */
export function scopeChain(id: ScopeId): Scope[] {
  const chain: Scope[] = [];
  let cursor: ScopeId | undefined = id;
  while (cursor !== undefined) {
    const scope = getScope(cursor);
    chain.unshift(scope);
    cursor = scope.parent;
  }
  return chain;
}
```

- [ ] **Step 5: Parent every body to the galaxy**

In `src/lib/atlas/bodies.ts`, import the scope and add `parent` to **both** returned object literals (the anonymous branch and the full branch). Add the import at the top:

```ts
import { GALAXY_ZEMI } from "./scopes";
```

Replace the `EPOCH` constant so the date exists in exactly one place — `bodies.test.ts` imports it and would otherwise drift from the scope:

```ts
/** Re-exported from the galaxy scope so the epoch is declared once. */
export const EPOCH = GALAXY_ZEMI.epoch;
```

In the anonymous branch, directly after `id: g.id,`:

```ts
        parent: GALAXY_ZEMI.id,
```

In the full branch, directly after `id: g.id,`:

```ts
      parent: GALAXY_ZEMI.id,
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run src/lib/atlas/__tests__/scopes.test.ts`
Expected: PASS — 7 tests

- [ ] **Step 7: Run the whole suite and lint**

Run: `npm test && npm run lint`
Expected: 210 tests pass (203 existing + 7 new), lint clean. Nothing else changed behaviour — `arm` widening from a union to `string` is assignment-compatible in every existing call site.

- [ ] **Step 8: Commit**

```bash
git add src/lib/atlas/scopes.ts src/lib/atlas/__tests__/scopes.test.ts src/lib/atlas/types.ts src/lib/atlas/bodies.ts
git commit -m "feat(atlas): add the scope frame model

Arms and wind rate move from module constants onto a Scope record, and
every body declares the frame it lives in. Unknown scopes throw rather
than defaulting to the origin.

No coordinates change yet — position.ts still reads its own constants."
```

---

## Task 2: Parameterise the layout frame

**Files:**
- Create: `src/lib/atlas/__tests__/positionParity.test.ts`
- Create: `src/lib/atlas/__tests__/__fixtures__/placement-golden.json` (generated in Step 1)
- Modify: `src/lib/atlas/position.ts`

**Interfaces:**
- Consumes: `Scope`, `getScope`, `GALAXY_ZEMI` from Task 1
- Produces: `daysSinceEpoch(iso: string, epoch?: string): number`; `radiusScale(days: number): number` (unchanged); `polar(arm: string, radius: number, scope?: Scope): Vec3`; `derivePosition(body: Body, scope?: Scope): Vec3`; `trailEnd(body: Body, scope?: Scope): Vec3`; `placeBodies(bodies: Body[], scope?: Scope): Placement[]`. Every `scope` parameter is optional and defaults to the body's own frame, so existing call sites compile unchanged.

- [ ] **Step 1: Capture the golden file BEFORE touching position.ts**

This is the whole point of the task — the refactor must be a coordinate no-op, and that can only be proven against output captured first.

Run:

```bash
mkdir -p src/lib/atlas/__tests__/__fixtures__ && npx tsx --tsconfig tsconfig.json -e '
import { loadBodies } from "./src/lib/atlas/bodies";
import { placeBodies, derivePosition, trailEnd } from "./src/lib/atlas/position";
import { writeFileSync } from "node:fs";
const bodies = loadBodies();
writeFileSync("src/lib/atlas/__tests__/__fixtures__/placement-golden.json", JSON.stringify({
  placements: placeBodies(bodies),
  derived: bodies.map((b) => ({ id: b.id, position: derivePosition(b), trailEnd: trailEnd(b) })),
}, null, 2) + "\n");
console.log("captured", bodies.length, "bodies");
'
```

If `tsx` is not installed, use `npx --yes tsx@4 ...` — it is a one-shot capture, not a dependency.

Expected output: `captured 45 bodies` (or whatever `loadBodies()` currently returns — record the number you see, it is the count the parity test will assert).

- [ ] **Step 2: Write the failing parity test**

Create `src/lib/atlas/__tests__/positionParity.test.ts`. Replace `EXPECTED_COUNT` with the number printed in Step 1:

```ts
import { describe, expect, it } from "vitest";
import golden from "./__fixtures__/placement-golden.json";
import { loadBodies } from "../bodies";
import { GALAXY_ZEMI } from "../scopes";
import { derivePosition, placeBodies, trailEnd } from "../position";

const EXPECTED_COUNT = 45;

describe("scope refactor is a coordinate no-op", () => {
  const bodies = loadBodies();

  it("still loads the same number of bodies", () => {
    expect(bodies).toHaveLength(EXPECTED_COUNT);
    expect(golden.derived).toHaveLength(EXPECTED_COUNT);
  });

  it("produces byte-identical placements with the scope defaulted", () => {
    expect(placeBodies(bodies)).toEqual(golden.placements);
  });

  it("produces byte-identical placements with the scope passed explicitly", () => {
    expect(placeBodies(bodies, GALAXY_ZEMI)).toEqual(golden.placements);
  });

  it("produces byte-identical derived positions and trail ends", () => {
    const derived = bodies.map((b) => ({
      id: b.id,
      position: derivePosition(b),
      trailEnd: trailEnd(b),
    }));
    expect(derived).toEqual(golden.derived);
  });
});
```

- [ ] **Step 3: Run it to verify it passes against unmodified code**

Run: `npx vitest run src/lib/atlas/__tests__/positionParity.test.ts`
Expected: PASS — 4 tests. This confirms the golden file is a faithful capture. If it fails now, the capture in Step 1 is wrong and the refactor cannot be verified; fix it before continuing.

- [ ] **Step 4: Refactor position.ts to read the frame from a scope**

In `src/lib/atlas/position.ts`, add the import and replace the two module constants and the five functions that read them. **Do not touch the body of `placeBodies` below the `for (const arm of ...)` line** other than the two substitutions shown.

Add at the top, and delete the now-unused `EPOCH` import:

```ts
import { getScope, GALAXY_ZEMI, type Scope } from "./scopes";
```

Replace the `ARM_ANGLES` and `WIND_RATE` declarations with backward-compatible re-exports so existing tests and call sites keep working:

```ts
/** @deprecated Read `scope.arms` instead. Retained so the galaxy's own table stays importable. */
export const ARM_ANGLES = GALAXY_ZEMI.arms;

/** @deprecated Read `scope.windRate` instead. */
export const WIND_RATE = GALAXY_ZEMI.windRate;
```

Then thread the scope through:

```ts
export function daysSinceEpoch(iso: string, epoch: string = GALAXY_ZEMI.epoch): number {
  return Math.round((Date.parse(iso) - Date.parse(epoch)) / MS_PER_DAY);
}

export function polar(arm: string, radius: number, scope: Scope = GALAXY_ZEMI): Vec3 {
  const theta = scope.arms[arm] + scope.windRate * Math.log(1 + radius);
  return { x: Math.cos(theta) * radius, y: 0, z: Math.sin(theta) * radius };
}

export function derivePosition(body: Body, scope: Scope = getScope(body.parent)): Vec3 {
  return polar(body.arm, radiusScale(daysSinceEpoch(body.bornAt, scope.epoch)), scope);
}

export function trailEnd(body: Body, scope: Scope = getScope(body.parent)): Vec3 {
  return polar(body.arm, radiusScale(daysSinceEpoch(body.lastTouchedAt, scope.epoch)), scope);
}
```

Change the private `at` helper to take the scope:

```ts
function at(arm: string, radius: number, lane: number, scope: Scope): Vec3 {
  const theta = scope.arms[arm] + scope.windRate * Math.log(1 + radius) + lane;
  return { x: Math.cos(theta) * radius, y: 0, z: Math.sin(theta) * radius };
}
```

Change `placeBodies`' signature and its two loop-level reads. The signature:

```ts
export function placeBodies(bodies: Body[], scope: Scope = GALAXY_ZEMI): Placement[] {
```

The arm loop header — `Object.keys(ARM_ANGLES)` becomes the scope's arms:

```ts
  for (const arm of Object.keys(scope.arms)) {
```

And inside the `run.forEach` body, the three `daysSinceEpoch(...)` calls take the scope's epoch and the three `at(...)` calls take the scope. Everything else in the function — the crowd runs, the arc walk, the lane centring, the nudge — is unchanged.

- [ ] **Step 5: Run the parity test to verify the refactor changed nothing**

Run: `npx vitest run src/lib/atlas/__tests__/positionParity.test.ts`
Expected: PASS — 4 tests. **If any assertion fails, the refactor is wrong.** Do not adjust the golden file to match; find what moved.

- [ ] **Step 6: Run the whole suite and lint**

Run: `npm test && npm run lint`
Expected: 214 tests pass. The 21 existing `position.test.ts` tests must pass **unmodified** — that is what the optional-parameter design buys.

- [ ] **Step 7: Commit**

```bash
git add src/lib/atlas/position.ts src/lib/atlas/__tests__/positionParity.test.ts src/lib/atlas/__tests__/__fixtures__/placement-golden.json
git commit -m "refactor(atlas): read the layout frame from a scope

Arms, wind rate and epoch come from the body's scope instead of module
constants. placeBodies' crowd-run algorithm is untouched; only its frame
source changed.

Every scope parameter defaults to the body's own frame, so all 21
existing position tests pass unmodified. Parity is asserted against a
golden file captured before the refactor."
```

---

## Task 3: Derive the planet centres

**Files:**
- Modify: `src/components/world/WorldCameraManager.ts:19-26` (delete `PLANET_CENTERS`)
- Create: `src/lib/atlas/planets.ts`
- Create: `src/lib/atlas/__tests__/planets.test.ts`

**Interfaces:**
- Consumes: `placeBodies`, `getScope` from Task 2; `loadBodies`
- Produces: `interface PlanetPlacement { arm: string; center: Vec3; radius: number; bodyCount: number }`; `derivePlanets(bodies: Body[], scope?: Scope): PlanetPlacement[]`

**Why:** `PLANET_CENTERS` is a hardcoded table — `products: new THREE.Vector3(-68, 0, 68)`. The five planets sit at authored coordinates while every other object derives, which violates the spec's first commitment and means the planets are not actually on their arms.

- [ ] **Step 1: Write the failing test**

Create `src/lib/atlas/__tests__/planets.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { loadBodies } from "../bodies";
import { GALAXY_ZEMI } from "../scopes";
import { derivePlanets } from "../planets";

const bodies = loadBodies();
const planets = derivePlanets(bodies);
const byArm = (arm: string) => planets.find((p) => p.arm === arm)!;
const dist = (p: { x: number; z: number }) => Math.hypot(p.x, p.z);

describe("derivePlanets", () => {
  it("returns one planet per declared arm", () => {
    expect(planets.map((p) => p.arm).sort()).toEqual(Object.keys(GALAXY_ZEMI.arms).sort());
  });

  it("counts every body into exactly one planet", () => {
    const total = planets.reduce((sum, p) => sum + p.bodyCount, 0);
    expect(total).toBe(bodies.length);
  });

  it("puts Foundations nearer the core than Products", () => {
    // Foundations is dense at the core and stops before the frontier;
    // Products is absent at the core and dense at the frontier.
    expect(dist(byArm("foundations").center)).toBeLessThan(dist(byArm("products").center));
  });

  it("sizes Products largest, because mass is not equal", () => {
    const products = byArm("products").radius;
    for (const p of planets) {
      if (p.arm !== "products") expect(products).toBeGreaterThan(p.radius);
    }
  });

  it("sizes Foundations smaller than Products despite holding more bodies", () => {
    expect(byArm("foundations").bodyCount).toBeGreaterThan(byArm("products").bodyCount);
    expect(byArm("foundations").radius).toBeLessThan(byArm("products").radius);
  });

  it("is deterministic", () => {
    expect(derivePlanets(bodies)).toEqual(planets);
  });

  it("places no planet at the origin", () => {
    for (const p of planets) expect(dist(p.center)).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/atlas/__tests__/planets.test.ts`
Expected: FAIL — `Failed to resolve import "../planets"`

- [ ] **Step 3: Write the derivation**

Create `src/lib/atlas/planets.ts`:

```ts
import type { Body, Vec3 } from "./types";
import { GALAXY_ZEMI, type Scope } from "./scopes";
import { placeBodies, polar, radiusScale, daysSinceEpoch } from "./position";

export interface PlanetPlacement {
  arm: string;
  center: Vec3;
  /** Drawn radius in world units. Not equal across planets — see below. */
  radius: number;
  bodyCount: number;
}

/**
 * Planet size is deliberately NOT proportional to body count. Foundations holds
 * the most repositories and the least significance; Products holds four shipped
 * ventures. Weighting by count would give nineteen tutorials more screen area
 * than the company. Size is driven by summed magnitude instead, which `kind:
 * 'system'` already pins for flagships.
 */
const SIZE = { base: 3.2, perSystem: 2.6, perStar: 0.18, max: 14 } as const;

export function derivePlanets(bodies: Body[], scope: Scope = GALAXY_ZEMI): PlanetPlacement[] {
  const placements = placeBodies(bodies, scope);
  const byId = new Map(placements.map((p) => [p.id, p]));

  return Object.keys(scope.arms).map((arm) => {
    const inArm = bodies.filter((b) => b.arm === arm);

    // The planet sits at the centroid radius of its arm, on the arm spine — so
    // a dense-at-the-core arm sits inside a dense-at-the-frontier one, and the
    // map's radial story survives at planet scale.
    const meanRadius =
      inArm.reduce(
        (sum, b) => sum + Math.hypot(byId.get(b.id)!.position.x, byId.get(b.id)!.position.z),
        0,
      ) / Math.max(1, inArm.length);

    const systems = inArm.filter((b) => b.kind === "system").length;
    const stars = inArm.length - systems;

    return {
      arm,
      center: polar(arm, meanRadius, scope),
      radius: Math.min(SIZE.max, SIZE.base + systems * SIZE.perSystem + stars * SIZE.perStar),
      bodyCount: inArm.length,
    };
  });
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/lib/atlas/__tests__/planets.test.ts`
Expected: PASS — 7 tests.

If "sizes Products largest" fails, the arm's `kind: 'system'` assignments in `bodies.overrides.ts` are the input to check — the size formula reads systems, not counts. Do not tune `SIZE` to force the test green without first confirming the overrides are right.

- [ ] **Step 5: Replace the hardcoded table**

In `src/components/world/WorldCameraManager.ts`, delete the `PLANET_CENTERS` constant (lines 19-26) and export a derived one in its place:

```ts
import * as THREE from "three";
import { derivePlanets } from "@/lib/atlas/planets";
import { loadBodies } from "@/lib/atlas/bodies";

const derived = derivePlanets(loadBodies());

/** Derived from repository metadata. Nothing here is authored. */
export const PLANET_CENTERS: Record<string, THREE.Vector3> = {
  sun: new THREE.Vector3(0, 0, 0),
  ...Object.fromEntries(
    derived.map((p) => [p.arm, new THREE.Vector3(p.center.x, p.center.y, p.center.z)]),
  ),
};
```

`CAMERA_PRESETS` reads `PLANET_CENTERS` values that no longer exist as literals — rewrite each planet preset to compose from the derived centre rather than repeating coordinates:

```ts
function orbitPose(center: THREE.Vector3, height: number, back: number): CameraPose {
  return {
    position: new THREE.Vector3(center.x, height, center.z + back),
    target: new THREE.Vector3(center.x, 2, center.z),
  };
}
```

Then rebuild `CAMERA_PRESETS` so no planet coordinate is repeated as a literal:

```ts
const GALAXY_POSE: CameraPose = {
  position: new THREE.Vector3(0, 185, 230),
  target: new THREE.Vector3(0, 0, 0),
};

export const CAMERA_PRESETS: Record<string, CameraPose> = {
  galaxy: GALAXY_POSE,
  overview: GALAXY_POSE,
  ...Object.fromEntries(derived.map((p) => [p.arm, orbitPose(PLANET_CENTERS[p.arm], 24, 32)])),
  // Retained alias: the HUD and page.tsx both still dispatch "founder".
  founder: orbitPose(PLANET_CENTERS.self, 24, 32),
};
```

- [ ] **Step 6: Run the suite, lint, and verify in the browser**

Run: `npm test && npm run lint`
Expected: all pass.

Then start the dev server and confirm the planets moved onto their arms:

1. `preview_start` with the project's dev server.
2. `read_console_messages` — expect no errors.
3. `computer` screenshot — the five planets should now sit **on** the spiral arms rather than at arbitrary points. Foundations near the core, Products far out.

- [ ] **Step 7: Commit**

```bash
git add src/lib/atlas/planets.ts src/lib/atlas/__tests__/planets.test.ts src/components/world/WorldCameraManager.ts
git commit -m "feat(atlas): derive planet centres from repository metadata

PLANET_CENTERS was a hardcoded table, so the five planets sat at authored
coordinates while everything else derived — a direct violation of the
spec's first commitment, and the reason the planets were not on their own
arms.

Size is driven by summed magnitude rather than body count: Foundations
holds the most repositories and the least significance, and weighting by
count would give nineteen tutorials more screen area than the company."
```

---

## Task 4: Quote rotation

**Files:**
- Create: `src/lib/quotes/rotation.ts`
- Create: `src/lib/quotes/__tests__/rotation.test.ts`

**Interfaces:**
- Consumes: `FOUNDER_QUOTES`, `FounderQuote` from `src/data/quotes.ts`
- Produces: `createQuoteRotation(quotes: FounderQuote[], seed?: number): QuoteRotation`; `interface QuoteRotation { next(): FounderQuote; drawn(): number }`

**Why:** `ShootingStarQuotes.tsx` binds five hardcoded viewport positions to `FOUNDER_QUOTES[0..4]`, so 76 of 81 quotes are unreachable, and the day comet draws with `Math.random()` and repeats freely.

- [ ] **Step 1: Write the failing test**

Create `src/lib/quotes/__tests__/rotation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { FOUNDER_QUOTES } from "@/data/quotes";
import { createQuoteRotation } from "../rotation";

describe("createQuoteRotation", () => {
  it("reaches every quote before repeating any", () => {
    const rotation = createQuoteRotation(FOUNDER_QUOTES, 1);
    const seen = FOUNDER_QUOTES.map(() => rotation.next().id);
    expect(new Set(seen).size).toBe(FOUNDER_QUOTES.length);
  });

  it("reaches all 81 quotes, not a hardcoded subset", () => {
    expect(FOUNDER_QUOTES.length).toBeGreaterThanOrEqual(81);
    const rotation = createQuoteRotation(FOUNDER_QUOTES, 2);
    const seen = new Set(FOUNDER_QUOTES.map(() => rotation.next().id));
    expect(seen.size).toBe(FOUNDER_QUOTES.length);
  });

  it("restarts after exhaustion instead of running dry", () => {
    const rotation = createQuoteRotation(FOUNDER_QUOTES, 3);
    for (const _ of FOUNDER_QUOTES) rotation.next();
    expect(rotation.next()).toBeDefined();
    expect(rotation.drawn()).toBe(FOUNDER_QUOTES.length + 1);
  });

  it("does not repeat across the seam between cycles", () => {
    const rotation = createQuoteRotation(FOUNDER_QUOTES, 4);
    let last = rotation.next();
    for (let i = 0; i < FOUNDER_QUOTES.length * 3; i++) {
      const current = rotation.next();
      expect(current.id, `repeated ${current.id} back to back`).not.toBe(last.id);
      last = current;
    }
  });

  it("is deterministic for a given seed", () => {
    const a = createQuoteRotation(FOUNDER_QUOTES, 7);
    const b = createQuoteRotation(FOUNDER_QUOTES, 7);
    expect(FOUNDER_QUOTES.map(() => a.next().id)).toEqual(FOUNDER_QUOTES.map(() => b.next().id));
  });

  it("differs between seeds, so a second visit is not the same order", () => {
    const a = createQuoteRotation(FOUNDER_QUOTES, 11);
    const b = createQuoteRotation(FOUNDER_QUOTES, 12);
    expect(FOUNDER_QUOTES.map(() => a.next().id)).not.toEqual(
      FOUNDER_QUOTES.map(() => b.next().id),
    );
  });

  it("throws on an empty set rather than returning undefined", () => {
    expect(() => createQuoteRotation([], 1)).toThrow(/no quotes/);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/quotes/__tests__/rotation.test.ts`
Expected: FAIL — `Failed to resolve import "../rotation"`

- [ ] **Step 3: Write the rotation**

Create `src/lib/quotes/rotation.ts`:

```ts
import type { FounderQuote } from "@/data/quotes";

export interface QuoteRotation {
  /** The next quote. Never repeats until the set is exhausted, and never twice in a row across the seam. */
  next(): FounderQuote;
  /** How many have been drawn in total, across cycles. */
  drawn(): number;
}

/** Deterministic PRNG, so a seeded rotation is reproducible in tests. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * A shuffled bag rather than random sampling. Sampling repeats immediately and
 * leaves quotes unreached; a bag guarantees every quote appears once per cycle.
 * On reshuffle, if the new first would repeat the previous last, it is swapped
 * with the next one along, so the seam never stutters.
 */
export function createQuoteRotation(quotes: FounderQuote[], seed = 1): QuoteRotation {
  if (quotes.length === 0) throw new Error("no quotes to rotate");

  const rand = mulberry32(seed);
  let bag = shuffle(quotes, rand);
  let index = 0;
  let total = 0;
  let last: FounderQuote | null = null;

  return {
    next() {
      if (index >= bag.length) {
        bag = shuffle(quotes, rand);
        if (bag.length > 1 && last && bag[0].id === last.id) {
          [bag[0], bag[1]] = [bag[1], bag[0]];
        }
        index = 0;
      }
      last = bag[index++];
      total++;
      return last;
    },
    drawn() {
      return total;
    },
  };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/lib/quotes/__tests__/rotation.test.ts`
Expected: PASS — 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/quotes/rotation.ts src/lib/quotes/__tests__/rotation.test.ts
git commit -m "feat(quotes): add a no-repeat quote rotation

A shuffled bag, not random sampling: every quote appears once per cycle
and the seam between cycles never stutters. The current sky reaches five
of eighty-one."
```

---

## Task 5: Quote star placement

**Files:**
- Create: `src/lib/quotes/sky.ts`
- Create: `src/lib/quotes/__tests__/sky.test.ts`

**Interfaces:**
- Consumes: `FounderQuote`; `Vec3` from `src/lib/atlas/types.ts`
- Produces: `interface QuoteStar { id: string; quoteId: string; position: Vec3; phase: number }`; `deriveQuoteStars(quotes: FounderQuote[], count: number, radius: number): QuoteStar[]`

**Why:** the current stars are viewport percentages, so the sky does not move when the camera orbits. These are scene-space points, projected through the existing `onProjectPins` bridge.

- [ ] **Step 1: Write the failing test**

Create `src/lib/quotes/__tests__/sky.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { FOUNDER_QUOTES } from "@/data/quotes";
import { deriveQuoteStars } from "../sky";

const RADIUS = 260;
const stars = deriveQuoteStars(FOUNDER_QUOTES, 14, RADIUS);

describe("deriveQuoteStars", () => {
  it("returns the requested count", () => {
    expect(stars).toHaveLength(14);
  });

  it("puts every star on the sky sphere", () => {
    for (const s of stars) {
      const r = Math.hypot(s.position.x, s.position.y, s.position.z);
      expect(r).toBeCloseTo(RADIUS, 4);
    }
  });

  it("gives every star a distinct quote", () => {
    expect(new Set(stars.map((s) => s.quoteId)).size).toBe(stars.length);
  });

  it("separates stars so two never overlap on screen", () => {
    // Fibonacci placement over 14 points on a sphere leaves well over 0.3 rad.
    for (let i = 0; i < stars.length; i++) {
      for (let j = i + 1; j < stars.length; j++) {
        const a = stars[i].position;
        const b = stars[j].position;
        const dot = (a.x * b.x + a.y * b.y + a.z * b.z) / (RADIUS * RADIUS);
        const angle = Math.acos(Math.min(1, Math.max(-1, dot)));
        expect(angle, `${stars[i].id} and ${stars[j].id} are too close`).toBeGreaterThan(0.3);
      }
    }
  });

  it("gives each star its own pulse phase so they do not blink in unison", () => {
    const phases = stars.map((s) => s.phase);
    expect(new Set(phases).size).toBe(phases.length);
    for (const p of phases) {
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThan(Math.PI * 2);
    }
  });

  it("is deterministic", () => {
    expect(deriveQuoteStars(FOUNDER_QUOTES, 14, RADIUS)).toEqual(stars);
  });

  it("never asks for more stars than there are quotes", () => {
    expect(deriveQuoteStars(FOUNDER_QUOTES, 10_000, RADIUS)).toHaveLength(FOUNDER_QUOTES.length);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/quotes/__tests__/sky.test.ts`
Expected: FAIL — `Failed to resolve import "../sky"`

- [ ] **Step 3: Write the placement**

Create `src/lib/quotes/sky.ts`:

```ts
import type { FounderQuote } from "@/data/quotes";
import type { Vec3 } from "@/lib/atlas/types";

export interface QuoteStar {
  id: string;
  quoteId: string;
  /** Scene-space, on the sky sphere. Projected to screen each frame. */
  position: Vec3;
  /** Radians. Offsets this star's pulse so the sky does not blink in unison. */
  phase: number;
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/**
 * Fibonacci sphere. Even coverage without clustering, deterministic, and no
 * rejection sampling — which matters because these are also DOM hit targets and
 * two stars landing on the same pixel would be an unclickable button.
 */
export function deriveQuoteStars(
  quotes: FounderQuote[],
  count: number,
  radius: number,
): QuoteStar[] {
  const n = Math.min(count, quotes.length);
  const stars: QuoteStar[] = [];

  for (let i = 0; i < n; i++) {
    const y = n === 1 ? 0 : 1 - (i / (n - 1)) * 2;
    const ring = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = GOLDEN_ANGLE * i;

    stars.push({
      id: `quote-star-${i}`,
      quoteId: quotes[i].id,
      position: {
        x: Math.cos(theta) * ring * radius,
        y: y * radius,
        z: Math.sin(theta) * ring * radius,
      },
      // Irrational stride, so phases never coincide for any n.
      phase: (i * GOLDEN_ANGLE) % (Math.PI * 2),
    });
  }

  return stars;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/lib/quotes/__tests__/sky.test.ts`
Expected: PASS — 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/quotes/sky.ts src/lib/quotes/__tests__/sky.test.ts
git commit -m "feat(quotes): place quote stars in scene space

Fibonacci sphere: even coverage, deterministic, no clustering. These are
DOM hit targets as well as sprites, so two stars sharing a pixel would be
an unclickable button.

Replaces five hardcoded viewport percentages that did not move with the
camera."
```

---

## Task 6: Direction A tokens

**Files:**
- Create: `src/lib/theme/directionA.ts`
- Create: `src/lib/theme/__tests__/directionA.test.ts`
- Modify: `src/app/globals.css:3-24`

**Interfaces:**
- Produces: `DIRECTION_A` — a frozen record of the palette, consumed by both CSS (via the token block) and three.js (via `new THREE.Color(DIRECTION_A.gold)`)

- [ ] **Step 1: Write the failing test**

Create `src/lib/theme/__tests__/directionA.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { DIRECTION_A } from "../directionA";

describe("Direction A palette", () => {
  it("uses the exact values the spec fixes", () => {
    expect(DIRECTION_A.ground).toBe("#F7F6F2");
    expect(DIRECTION_A.ink).toBe("#1B1A17");
    expect(DIRECTION_A.gold).toBe("#B8860B");
    expect(DIRECTION_A.verdigris).toBe("#0B6B4F");
    expect(DIRECTION_A.oxide).toBe("#8C3B2E");
  });

  it("exposes every colour as a parseable hex", () => {
    for (const [name, value] of Object.entries(DIRECTION_A)) {
      expect(value, `${name} is not a hex colour`).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it("is frozen, so no consumer can mutate the shared palette", () => {
    expect(Object.isFrozen(DIRECTION_A)).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/theme/__tests__/directionA.test.ts`
Expected: FAIL — `Failed to resolve import "../directionA"`

- [ ] **Step 3: Write the palette**

Create `src/lib/theme/directionA.ts`:

```ts
/**
 * Direction A — Celestial Atlas. Ink and gold leaf on warm paper.
 *
 * Single source for both CSS custom properties and three.js materials: a colour
 * defined twice drifts, and the canvas sitting a shade off the DOM around it is
 * the most visible way this treatment fails.
 *
 * Direction C (Zemí Stone, night) ships in R2 and is deliberately absent.
 */
export const DIRECTION_A = Object.freeze({
  ground: "#F7F6F2",
  ink: "#1B1A17",
  gold: "#B8860B",
  verdigris: "#0B6B4F",
  oxide: "#8C3B2E",
  /** Hairline rules, graticules, arm curves. */
  rule: "#D3CEC0",
  /** Arm dust and the deep field. Ink at low weight, not grey. */
  dust: "#1B1A17",
  /** Glass HUD ground. */
  hud: "#FFFFFF",
});

export type DirectionAToken = keyof typeof DIRECTION_A;
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/lib/theme/__tests__/directionA.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 5: Point the CSS tokens at the same values**

In `src/app/globals.css`, replace the `:root` block's colour declarations with Direction A. Keep `--radius`. The existing `--background: #f7f6f2` is already correct; the rest are shadcn defaults that fight the treatment:

```css
:root {
  --background: #F7F6F2;
  --foreground: #1B1A17;
  --card: #FFFFFF;
  --card-foreground: #1B1A17;
  --popover: #FFFFFF;
  --popover-foreground: #1B1A17;
  --primary: #1B1A17;
  --primary-foreground: #F7F6F2;
  --secondary: #EDEAE0;
  --secondary-foreground: #1B1A17;
  --muted: #EDEAE0;
  --muted-foreground: #6B6659;
  --accent: #B8860B;
  --accent-foreground: #F7F6F2;
  --destructive: #8C3B2E;
  --destructive-foreground: #F7F6F2;
  --border: #D3CEC0;
  --input: #D3CEC0;
  --ring: #B8860B;
  --radius: 1rem;
}
```

- [ ] **Step 6: Verify in the browser**

1. `preview_start` with the project's dev server.
2. `read_console_messages` — expect no errors.
3. `computer` screenshot in day mode. The HUD pills, cards and canvas ground should all read as one warm paper family. Anything still cool-grey is a hardcoded colour that needs to move onto a token.

- [ ] **Step 7: Commit**

```bash
git add src/lib/theme/directionA.ts src/lib/theme/__tests__/directionA.test.ts src/app/globals.css
git commit -m "feat(theme): add Direction A tokens

One source for CSS and three.js. A colour defined twice drifts, and a
canvas sitting a shade off the DOM around it is the most visible way an
ink-on-paper treatment fails."
```

---

## Task 7: The quote sky component

**Files:**
- Create: `src/components/world/QuoteCard.tsx`
- Create: `src/components/world/QuoteSky.tsx`
- Create: `src/components/world/__tests__/quoteSky.test.tsx`
- Modify: `src/app/page.tsx:8` and `:110`
- Delete: `src/components/world/ShootingStarQuotes.tsx`

**Interfaces:**
- Consumes: `createQuoteRotation` (Task 4); `deriveQuoteStars`, `QuoteStar` (Task 5); `ScreenPoint` from `src/lib/atlas/types.ts`; `CosmicMode` from `./DayNightController`
- Produces: `<QuoteSky cosmicMode points={ScreenPoint[]} />`; `<QuoteCard quote onClose />`

- [ ] **Step 1: Write the failing test**

Create `src/components/world/__tests__/quoteSky.test.tsx`:

```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FOUNDER_QUOTES } from "@/data/quotes";
import { deriveQuoteStars } from "@/lib/quotes/sky";
import { QuoteSky } from "../QuoteSky";

afterEach(cleanup);

const points = deriveQuoteStars(FOUNDER_QUOTES, 14, 260).map((s, i) => ({
  id: s.id,
  x: 100 + i * 40,
  y: 120,
  visible: true,
  depth: 0.5,
}));

describe("QuoteSky", () => {
  it("renders every visible star as a button in night mode", () => {
    render(<QuoteSky cosmicMode="night" points={points} />);
    expect(screen.getAllByRole("button", { name: /./ })).toHaveLength(points.length);
  });

  it("names each star with its quote, so a screen reader hears the content", () => {
    render(<QuoteSky cosmicMode="night" points={points} />);
    const first = screen.getAllByRole("button")[0];
    expect(first).toHaveAccessibleName(expect.stringContaining(FOUNDER_QUOTES[0].text.slice(0, 24)));
  });

  it("opens the quote card when a star is activated", async () => {
    const user = userEvent.setup();
    render(<QuoteSky cosmicMode="night" points={points} />);
    await user.click(screen.getAllByRole("button")[0]);
    expect(screen.getByRole("dialog")).toHaveTextContent(FOUNDER_QUOTES[0].text);
  });

  it("opens the card from the keyboard as well as the pointer", async () => {
    const user = userEvent.setup();
    render(<QuoteSky cosmicMode="night" points={points} />);
    await user.tab();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("closes the card on Escape", async () => {
    const user = userEvent.setup();
    render(<QuoteSky cosmicMode="night" points={points} />);
    await user.click(screen.getAllByRole("button")[0]);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("skips stars the camera has culled", () => {
    const culled = points.map((p, i) => ({ ...p, visible: i < 3 }));
    render(<QuoteSky cosmicMode="night" points={culled} />);
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });

  it("still renders reachable stars in day mode", () => {
    render(<QuoteSky cosmicMode="day" points={points} />);
    expect(screen.getAllByRole("button").length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/world/__tests__/quoteSky.test.tsx`
Expected: FAIL — `Failed to resolve import "../QuoteSky"`

- [ ] **Step 3: Write the card**

Create `src/components/world/QuoteCard.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import type { FounderQuote } from "@/data/quotes";

interface QuoteCardProps {
  quote: FounderQuote;
  x: number;
  y: number;
  onClose: () => void;
}

/**
 * Ground comes from tokens, not literals. The previous tooltip hardcoded
 * bg-zinc-950/85, which is correct on obsidian and wrong on paper.
 */
export function QuoteCard({ quote, x, y, onClose }: QuoteCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Founder principle"
      tabIndex={-1}
      style={{
        position: "fixed",
        left: `${Math.min(80, Math.max(20, x))}px`,
        top: `${Math.min(75, Math.max(20, y))}px`,
        transform: "translate(-50%, -120%)",
        background: "var(--card)",
        color: "var(--card-foreground)",
        borderColor: "var(--border)",
      }}
      className="pointer-events-auto z-50 w-72 rounded-2xl border p-4 shadow-xl backdrop-blur-xl"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold leading-snug">{quote.text}</p>
        <button
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 opacity-60 transition-opacity hover:opacity-100"
        >
          <X className="size-3" />
        </button>
      </div>
      {quote.era && (
        <div className="mt-2 font-mono text-[10px]" style={{ color: "var(--accent)" }}>
          {quote.era}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Write the sky**

Create `src/components/world/QuoteSky.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import { FOUNDER_QUOTES, type FounderQuote } from "@/data/quotes";
import { deriveQuoteStars } from "@/lib/quotes/sky";
import type { ScreenPoint } from "@/lib/atlas/types";
import type { CosmicMode } from "./DayNightController";
import { QuoteCard } from "./QuoteCard";
import { sound } from "@/lib/audio";

export const QUOTE_STAR_COUNT = 14;
export const QUOTE_SKY_RADIUS = 260;

/** Scene-space star positions. Exported so WorldCanvas can add them to the scene. */
export const QUOTE_STARS = deriveQuoteStars(FOUNDER_QUOTES, QUOTE_STAR_COUNT, QUOTE_SKY_RADIUS);

interface QuoteSkyProps {
  cosmicMode: CosmicMode;
  /** Projected screen positions for QUOTE_STARS, produced by WorldCanvas each frame. */
  points: ScreenPoint[];
}

export function QuoteSky({ cosmicMode, points }: QuoteSkyProps) {
  const [open, setOpen] = useState<{ quote: FounderQuote; x: number; y: number } | null>(null);

  const quoteById = useMemo(
    () => new Map(FOUNDER_QUOTES.map((q) => [q.id, q])),
    [],
  );
  const starById = useMemo(
    () => new Map(QUOTE_STARS.map((s) => [s.id, s])),
    [],
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-20 select-none">
      {points
        .filter((p) => p.visible && starById.has(p.id))
        .map((p) => {
          const star = starById.get(p.id)!;
          const quote = quoteById.get(star.quoteId)!;
          return (
            <button
              key={p.id}
              onClick={() => {
                sound.playChime(750, 0.15);
                setOpen({ quote, x: p.x, y: p.y });
              }}
              aria-label={quote.text}
              style={{
                left: `${p.x}px`,
                top: `${p.y}px`,
                // Own phase, so the sky does not blink in unison.
                animationDelay: `${star.phase.toFixed(3)}s`,
                color: "var(--accent)",
              }}
              className="quote-star pointer-events-auto absolute size-6 -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform hover:scale-150 focus-visible:scale-150 focus-visible:outline focus-visible:outline-2"
            >
              <span aria-hidden className="block size-1.5 rounded-full bg-current mx-auto" />
            </button>
          );
        })}

      {open && (
        <QuoteCard quote={open.quote} x={open.x} y={open.y} onClose={() => setOpen(null)} />
      )}
    </div>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/components/world/__tests__/quoteSky.test.tsx`
Expected: PASS — 7 tests.

- [ ] **Step 6: Swap it in and delete the old layer**

In `src/app/page.tsx`, replace the `ShootingStarQuotes` import with `QuoteSky`, add a `quotePoints` state alongside `screenPoints`, and render `<QuoteSky cosmicMode={cosmicMode} points={quotePoints} />` where `<ShootingStarQuotes />` was. Wire `QUOTE_STARS` into `WorldCanvas` so it projects them into `quotePoints` through the same `onProjectPins` path it already uses for bodies.

Then:

```bash
git rm src/components/world/ShootingStarQuotes.tsx
```

- [ ] **Step 7: Run the suite, lint, and verify in the browser**

Run: `npm test && npm run lint`
Expected: all pass.

Then:
1. `preview_start`, `read_console_messages` — no errors.
2. Drag to orbit the camera. **The quote stars must move with the scene.** If they stay pinned to the same screen position, the projection is not wired and the whole point of the task is missing.
3. Tab to a star, press Enter, confirm the card opens. Press Escape, confirm it closes.

- [ ] **Step 8: Commit**

```bash
git add src/components/world/QuoteSky.tsx src/components/world/QuoteCard.tsx src/components/world/__tests__/quoteSky.test.tsx src/app/page.tsx
git commit -m "feat(world): replace the quote layers with one scene-space sky

Stars are projected scene points rather than viewport percentages, so the
sky moves when the camera orbits. All 81 quotes are reachable; the old
layer bound five hardcoded positions to FOUNDER_QUOTES[0..4].

Every star is a focusable button named by its quote. The card takes its
ground from tokens instead of a hardcoded obsidian."
```

---

## Task 8: Day comets

**Files:**
- Modify: `src/components/world/QuoteSky.tsx`
- Modify: `src/components/world/__tests__/quoteSky.test.tsx`
- Modify: `src/app/globals.css` (comet keyframes; the existing `shootingStarGlide` is reused)

**Interfaces:**
- Consumes: `createQuoteRotation` (Task 4); `QuoteSky` (Task 7)
- Produces: no new exports — day behaviour is internal to `QuoteSky`

**Why:** the deleted layer showed one comet every 16 seconds with a `cursor-pointer` and no `onClick`. Three in flight reads as weather; one reads as an event you probably missed.

- [ ] **Step 1: Write the failing test**

Append to `src/components/world/__tests__/quoteSky.test.tsx`:

```tsx
describe("QuoteSky day comets", () => {
  it("flies more than one comet at a time", async () => {
    vi.useFakeTimers();
    render(<QuoteSky cosmicMode="day" points={points} />);
    await act(async () => { vi.advanceTimersByTime(12_000); });
    expect(screen.getAllByTestId("quote-comet").length).toBeGreaterThan(1);
    vi.useRealTimers();
  });

  it("pauses a comet and opens its quote when activated", async () => {
    vi.useFakeTimers();
    render(<QuoteSky cosmicMode="day" points={points} />);
    await act(async () => { vi.advanceTimersByTime(4_000); });
    const comet = screen.getAllByTestId("quote-comet")[0];
    fireEvent.click(comet);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(comet).toHaveAttribute("data-paused", "true");
    vi.useRealTimers();
  });

  it("flies no comets in night mode", async () => {
    vi.useFakeTimers();
    render(<QuoteSky cosmicMode="night" points={points} />);
    await act(async () => { vi.advanceTimersByTime(20_000); });
    expect(screen.queryAllByTestId("quote-comet")).toHaveLength(0);
    vi.useRealTimers();
  });
});
```

Add `act`, `fireEvent` and `vi` to the imports at the top of the file:

```tsx
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/world/__tests__/quoteSky.test.tsx`
Expected: FAIL — `Unable to find an element by: [data-testid="quote-comet"]`

- [ ] **Step 3: Add comets to QuoteSky**

Inside `QuoteSky`, add comet state and a spawner. Comets carry their own quote from the rotation, so they never repeat and never collide with the night stars' quotes:

```tsx
const MAX_COMETS = 3;
const SPAWN_MS = 5_200;
const FLIGHT_MS = 11_000;

interface Comet {
  key: number;
  quote: FounderQuote;
  top: number;
  paused: boolean;
}
```

In the component body:

```tsx
const rotation = useMemo(() => createQuoteRotation(FOUNDER_QUOTES, Date.now() % 100_000), []);
const [comets, setComets] = useState<Comet[]>([]);
const reduced = usePrefersReducedMotion();

useEffect(() => {
  if (cosmicMode !== "day") {
    setComets([]);
    return;
  }
  let key = 0;
  const spawn = () => {
    setComets((current) => {
      if (current.length >= MAX_COMETS) return current;
      const comet: Comet = {
        key: key++,
        quote: rotation.next(),
        top: 12 + Math.random() * 26,
        paused: false,
      };
      window.setTimeout(
        () => setComets((c) => c.filter((x) => x.key !== comet.key || x.paused)),
        FLIGHT_MS,
      );
      return [...current, comet];
    });
  };
  spawn();
  const interval = window.setInterval(spawn, SPAWN_MS);
  return () => window.clearInterval(interval);
}, [cosmicMode, rotation]);
```

Render them above the star list:

```tsx
{comets.map((comet) => (
  <button
    key={comet.key}
    data-testid="quote-comet"
    data-paused={comet.paused ? "true" : "false"}
    aria-label={comet.quote.text}
    onMouseEnter={() => setComets((c) => c.map((x) => (x.key === comet.key ? { ...x, paused: true } : x)))}
    onFocus={() => setComets((c) => c.map((x) => (x.key === comet.key ? { ...x, paused: true } : x)))}
    onClick={() => {
      setComets((c) => c.map((x) => (x.key === comet.key ? { ...x, paused: true } : x)));
      setOpen({ quote: comet.quote, x: window.innerWidth / 2, y: window.innerHeight * (comet.top / 100) });
    }}
    style={{ top: `${comet.top}%`, color: "var(--accent)" }}
    className={
      "pointer-events-auto absolute left-1/2 flex items-center gap-2 whitespace-nowrap " +
      (reduced || comet.paused ? "quote-comet-static" : "quote-comet-flight")
    }
  >
    <span aria-hidden>✦</span>
    <span className="text-xs font-medium tracking-wide" style={{ color: "var(--foreground)" }}>
      {comet.quote.text}
    </span>
  </button>
))}
```

Add the reduced-motion hook at the bottom of the file:

```tsx
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const onChange = () => setReduced(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return reduced;
}
```

- [ ] **Step 4: Add the two comet classes to globals.css**

```css
.quote-comet-flight {
  animation: shootingStarGlide 11s linear forwards;
}

/* Paused, or reduced motion: the quote stays put and stays readable. */
.quote-comet-static {
  left: 50%;
  transform: translateX(-50%);
  animation: none;
}

@media (prefers-reduced-motion: reduce) {
  .quote-comet-flight {
    animation: none;
    left: 50%;
    transform: translateX(-50%);
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/components/world/__tests__/quoteSky.test.tsx`
Expected: PASS — 10 tests.

- [ ] **Step 6: Verify in the browser**

1. `preview_start`, `read_console_messages` — no errors.
2. In day mode, wait ~15 seconds. Two or three comets should be in flight at staggered heights.
3. Hover one. **It must stop in place**, not keep travelling. Click it and confirm the card opens with that comet's quote.
4. `resize_window` to `mobile` and confirm the comet text does not overflow the viewport.

- [ ] **Step 7: Commit**

```bash
git add src/components/world/QuoteSky.tsx src/components/world/__tests__/quoteSky.test.tsx src/app/globals.css
git commit -m "feat(world): fly catchable quote comets in day mode

Three in flight rather than one every sixteen seconds: one at a time
reads as an event you missed, three reads as weather.

Hover or tap pauses the comet in place and opens its quote — the previous
layer rendered cursor-pointer on a div with no click handler.

Reduced motion stops travel and keeps the quote readable."
```

---

## Task 9: Field density

**Files:**
- Modify: `src/components/world/WorldSceneBuilder.ts`
- Create: `src/components/world/__tests__/density.test.ts`

**Interfaces:**
- Consumes: `DIRECTION_A` (Task 6); `placeBodies` (Task 2)
- Produces: `WorldSceneBuilder.buildBackgroundField(): void`; `BACKGROUND_STAR_COUNT`, `ARM_DUST_COUNT` exported for the test and for the mobile budget

**Why:** the spec budgeted a dense field and the current build renders effectively none, so the galaxy reads as five spheres in a void. Density is the argument, not decoration — 44 repositories over 286 days is a claim the map should make before any copy does.

- [ ] **Step 1: Write the failing test**

Create `src/components/world/__tests__/density.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ARM_DUST_COUNT, BACKGROUND_STAR_COUNT, buildFieldGeometry } from "../WorldSceneBuilder";
import { loadBodies } from "@/lib/atlas/bodies";

describe("field density", () => {
  it("budgets a real background field, not a token one", () => {
    expect(BACKGROUND_STAR_COUNT).toBeGreaterThanOrEqual(8_000);
    expect(ARM_DUST_COUNT).toBeGreaterThanOrEqual(3_000);
  });

  it("emits three floats per point", () => {
    const { positions } = buildFieldGeometry(loadBodies(), 1);
    expect(positions.length).toBe((BACKGROUND_STAR_COUNT + ARM_DUST_COUNT) * 3);
  });

  it("is deterministic for a seed, so the sky does not reshuffle on every reload", () => {
    expect(buildFieldGeometry(loadBodies(), 7).positions).toEqual(
      buildFieldGeometry(loadBodies(), 7).positions,
    );
  });

  it("emits no NaN, which would silently blank the whole point cloud", () => {
    const { positions } = buildFieldGeometry(loadBodies(), 1);
    expect(positions.some((v) => Number.isNaN(v))).toBe(false);
  });

  it("concentrates dust along the arms rather than filling a disc uniformly", () => {
    const { positions } = buildFieldGeometry(loadBodies(), 3);
    // Dust points occupy the tail of the buffer.
    const start = BACKGROUND_STAR_COUNT * 3;
    let onArm = 0;
    for (let i = start; i < positions.length; i += 3) {
      const r = Math.hypot(positions[i], positions[i + 2]);
      if (r > 2 && r < 30) onArm++;
    }
    expect(onArm).toBeGreaterThan(ARM_DUST_COUNT * 0.5);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/world/__tests__/density.test.ts`
Expected: FAIL — `buildFieldGeometry is not exported`

- [ ] **Step 3: Add the field builder**

In `src/components/world/WorldSceneBuilder.ts`, export the budgets and a pure geometry function that the test can call without a WebGL context:

```ts
export const BACKGROUND_STAR_COUNT = 12_000;
export const ARM_DUST_COUNT = 4_500;

/** Mobile budget. Applied by WorldCanvas when the viewport is narrow. */
export const MOBILE_FIELD_SCALE = 0.35;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Pure, so density is testable without a GL context. Background stars fill a
 * shell; dust follows the arms, which is what makes the spiral legible at rest.
 */
export function buildFieldGeometry(bodies: Body[], seed: number): { positions: Float32Array } {
  const rand = mulberry32(seed);
  const positions = new Float32Array((BACKGROUND_STAR_COUNT + ARM_DUST_COUNT) * 3);
  let i = 0;

  for (let n = 0; n < BACKGROUND_STAR_COUNT; n++) {
    const theta = rand() * Math.PI * 2;
    const phi = Math.acos(2 * rand() - 1);
    const r = 300 + rand() * 260;
    positions[i++] = Math.sin(phi) * Math.cos(theta) * r;
    positions[i++] = Math.cos(phi) * r;
    positions[i++] = Math.sin(phi) * Math.sin(theta) * r;
  }

  const placements = placeBodies(bodies);
  for (let n = 0; n < ARM_DUST_COUNT; n++) {
    const anchor = placements[Math.floor(rand() * placements.length)];
    const spread = 1.2 + rand() * 3.4;
    positions[i++] = anchor.position.x + (rand() - 0.5) * spread * 2;
    positions[i++] = (rand() - 0.5) * 1.6;
    positions[i++] = anchor.position.z + (rand() - 0.5) * spread * 2;
  }

  return { positions };
}
```

Then add the method that puts it on screen, and call it from `build()` immediately before `buildPlanetarySpheres()`:

```ts
  /** Dark points on a light ground: engraved, not emitted. */
  public buildBackgroundField(): void {
    const { positions } = buildFieldGeometry(this.bodies, 20260820);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const points = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        color: new THREE.Color(DIRECTION_A.dust),
        size: 0.35,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
      }),
    );
    points.name = "background-field";
    this.rootGroup.add(points);
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/world/__tests__/density.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 5: Verify in the browser**

1. `preview_start`, `read_console_messages` — no errors.
2. Screenshot. Compare against the pre-task screenshot: the arms should now be **visible as arms**, with dust tracing the spiral. If the frame is still mostly empty ground, the material opacity or point size is wrong, not the count.
3. `resize_window` to `mobile`, reload, and confirm the frame rate is still usable. Apply `MOBILE_FIELD_SCALE` in `WorldCanvas` if not.

- [ ] **Step 6: Commit**

```bash
git add src/components/world/WorldSceneBuilder.ts src/components/world/__tests__/density.test.ts
git commit -m "feat(world): give the field real density

The map read as five spheres in a void. Dust follows the arm placements
rather than filling a disc, so the spiral is legible at rest — 44 repos
over 286 days is a claim the map should make before any copy does.

Geometry generation is pure and seeded, so it is testable without a GL
context and the sky does not reshuffle on reload."
```

---

## Task 10: Planet surface families

**Files:**
- Create: `src/components/world/PlanetSurfaces.ts`
- Create: `src/components/world/__tests__/planetSurfaces.test.ts`
- Modify: `src/components/world/WorldSceneBuilder.ts` (`buildPlanetarySpheres`)
- Modify: `src/data/arms.ts` (restate `themeColor` against Direction A)

**Interfaces:**
- Consumes: `derivePlanets`, `PlanetPlacement` (Task 3); `DIRECTION_A` (Task 6)
- Produces: `SURFACE_FAMILIES: Record<string, SurfaceFamily>`; `interface SurfaceFamily { arm: string; pattern: number; rotationRate: number; baseColor: string; accentColor: string }`; `createPlanetMaterial(): THREE.ShaderMaterial` — **one** material, per-instance uniforms

- [ ] **Step 1: Write the failing test**

Create `src/components/world/__tests__/planetSurfaces.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { GALAXY_ZEMI } from "@/lib/atlas/scopes";
import { SURFACE_FAMILIES } from "../PlanetSurfaces";

const families = Object.values(SURFACE_FAMILIES);

describe("surface families", () => {
  it("covers every arm the galaxy declares", () => {
    expect(Object.keys(SURFACE_FAMILIES).sort()).toEqual(Object.keys(GALAXY_ZEMI.arms).sort());
  });

  it("gives every planet a distinct pattern, so none are twins", () => {
    expect(new Set(families.map((f) => f.pattern)).size).toBe(families.length);
  });

  it("gives every planet its own rotation rate", () => {
    expect(new Set(families.map((f) => f.rotationRate)).size).toBe(families.length);
  });

  it("rotates every planet slowly — fast reads as a screensaver", () => {
    for (const f of families) {
      expect(f.rotationRate).toBeGreaterThan(0);
      expect(f.rotationRate, `${f.arm} spins too fast`).toBeLessThan(0.05);
    }
  });

  it("turns Foundations slowest, because it is the oldest and most settled", () => {
    const slowest = families.reduce((a, b) => (a.rotationRate < b.rotationRate ? a : b));
    expect(slowest.arm).toBe("foundations");
  });

  it("uses only Direction A colours", () => {
    const allowed = new Set(["#F7F6F2", "#1B1A17", "#B8860B", "#0B6B4F", "#8C3B2E", "#D3CEC0"]);
    for (const f of families) {
      expect(allowed.has(f.baseColor), `${f.arm} base ${f.baseColor} is off-palette`).toBe(true);
      expect(allowed.has(f.accentColor), `${f.arm} accent ${f.accentColor} is off-palette`).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/world/__tests__/planetSurfaces.test.ts`
Expected: FAIL — `Failed to resolve import "../PlanetSurfaces"`

- [ ] **Step 3: Write the families**

Create `src/components/world/PlanetSurfaces.ts`:

```ts
import * as THREE from "three";
import { DIRECTION_A } from "@/lib/theme/directionA";

export interface SurfaceFamily {
  arm: string;
  /** Branch selector in the shared fragment shader. */
  pattern: number;
  /** Radians per second. All slow: slow reads as alive, fast as a screensaver. */
  rotationRate: number;
  baseColor: string;
  accentColor: string;
}

/**
 * Five places, not five colours of one object.
 *
 * Foundations carries banded sediment because ZemiMark.tsx is already a
 * stratified cross-section with obsidian at its base — putting that geology on
 * the origin planet makes the mark and the map say the same thing.
 */
export const SURFACE_FAMILIES: Record<string, SurfaceFamily> = {
  foundations: {
    arm: "foundations",
    pattern: 0, // banded sediment strata
    rotationRate: 0.004,
    baseColor: DIRECTION_A.ink,
    accentColor: DIRECTION_A.rule,
  },
  products: {
    arm: "products",
    pattern: 1, // gas-giant bands
    rotationRate: 0.011,
    baseColor: DIRECTION_A.gold,
    accentColor: DIRECTION_A.oxide,
  },
  labs: {
    arm: "labs",
    pattern: 2, // fractured crystalline shell
    rotationRate: 0.018,
    baseColor: DIRECTION_A.oxide,
    accentColor: DIRECTION_A.gold,
  },
  self: {
    arm: "self",
    pattern: 3, // ocean and cloud
    rotationRate: 0.008,
    baseColor: DIRECTION_A.verdigris,
    accentColor: DIRECTION_A.ground,
  },
  creative: {
    arm: "creative",
    pattern: 4, // molten ember crust
    rotationRate: 0.026,
    baseColor: DIRECTION_A.oxide,
    accentColor: DIRECTION_A.gold,
  },
};

/**
 * ONE material for all five planets. Five bespoke materials means five
 * draw-call groups and five compile paths for what is one family of surfaces;
 * it costs nothing to do this way from the start and is a rewrite later.
 *
 * Per-planet variation rides on instance attributes, not on separate programs.
 */
export function createPlanetMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute float aPattern;
      attribute vec3 aBase;
      attribute vec3 aAccent;
      varying float vPattern;
      varying vec3 vBase;
      varying vec3 vAccent;
      varying vec3 vNormal;
      varying vec3 vLocal;
      void main() {
        vPattern = aPattern;
        vBase = aBase;
        vAccent = aAccent;
        vNormal = normalize(normalMatrix * normal);
        vLocal = position;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying float vPattern;
      varying vec3 vBase;
      varying vec3 vAccent;
      varying vec3 vNormal;
      varying vec3 vLocal;

      float bands(float y, float freq) {
        return smoothstep(0.35, 0.65, fract(y * freq));
      }

      void main() {
        vec3 n = normalize(vLocal);
        float mixAmount = 0.0;

        if (vPattern < 0.5) {
          mixAmount = bands(n.y, 7.0);                       // sediment strata
        } else if (vPattern < 1.5) {
          mixAmount = bands(n.y, 3.0) * 0.7;                 // gas-giant bands
        } else if (vPattern < 2.5) {
          float f = abs(sin(n.x * 9.0) * sin(n.z * 9.0));    // fissures
          mixAmount = smoothstep(0.82, 0.94, f) * (0.6 + 0.4 * sin(uTime * 0.6));
        } else if (vPattern < 3.5) {
          mixAmount = smoothstep(0.45, 0.75, sin(n.x * 4.0 + uTime * 0.05) * 0.5 + 0.5);
        } else {
          mixAmount = smoothstep(0.55, 0.85, fract(n.y * 5.0 + sin(uTime * 0.8) * 0.05));
        }

        // Raking light rather than emission: this treatment is engraved, not lit.
        float lambert = clamp(dot(vNormal, normalize(vec3(0.6, 0.7, 0.4))), 0.0, 1.0);
        vec3 albedo = mix(vBase, vAccent, mixAmount);
        gl_FragColor = vec4(albedo * (0.55 + 0.45 * lambert), 1.0);
      }
    `,
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/world/__tests__/planetSurfaces.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 5: Use it, and size the planets unequally**

In `WorldSceneBuilder.buildPlanetarySpheres()`, replace the per-planet `MeshStandardMaterial` construction with a single `THREE.InstancedMesh` over a shared `SphereGeometry` and `createPlanetMaterial()`. For each planet from `derivePlanets(bodies)`:

- set the instance matrix from `placement.center` scaled by `placement.radius`
- write `aPattern`, `aBase`, `aAccent` from `SURFACE_FAMILIES[placement.arm]` as `InstancedBufferAttribute`s
- advance `uniforms.uTime.value` in the animation loop, and rotate each planet at its family's `rotationRate`

In `src/data/arms.ts`, replace the five `themeColor` values — currently `#57534e`, `#047857`, `#7c3aed`, `#2563eb`, `#d97706`, which are the pre-atlas palette — with each arm's `SURFACE_FAMILIES[arm].baseColor`.

- [ ] **Step 6: Run the suite, lint, and verify in the browser**

Run: `npm test && npm run lint`
Expected: all pass.

Then:
1. `preview_start`, `read_console_messages` — **check specifically for shader compile errors**, which three.js logs as console errors with the GLSL source.
2. Screenshot. The five planets must be **visibly different surfaces**, not five tinted spheres, and Products must be the largest.
3. Watch for ~30 seconds. Rotation should be perceptible but never distracting.

- [ ] **Step 7: Commit**

```bash
git add src/components/world/PlanetSurfaces.ts src/components/world/__tests__/planetSurfaces.test.ts src/components/world/WorldSceneBuilder.ts src/data/arms.ts
git commit -m "feat(world): give the five planets distinct surfaces

One shader, per-instance uniforms — five bespoke materials is five
draw-call groups and five compile paths for one family of surfaces.

Foundations carries banded sediment because ZemiMark is already a
stratified cross-section; the mark and the map now say the same thing.

arms.ts themeColor values were still the pre-atlas purple and blue."
```

---

## Task 11: Ideals and rings

**Files:**
- Create: `src/lib/atlas/ideals.ts`
- Create: `src/lib/atlas/__tests__/ideals.test.ts`
- Modify: `src/components/world/WorldSceneBuilder.ts` (ring geometry per planet)

**Interfaces:**
- Consumes: `loadBodies`; `derivePlanets` (Task 3); `DIRECTION_A` (Task 6)
- Produces: `interface Ideal { id: string; scope: ScopeId; ordinal: number; claim: string; evidence: string[] }`; `IDEALS: Ideal[]`; `validateIdeals(ideals: Ideal[], bodies: Body[]): void`; `idealsFor(arm: string): Ideal[]`

**Why:** rings encode ideals, not skill tiers — radius already *is* time, so tier rings would state the same fact twice. The author supplies the real claims late in R1; this task builds and tests the mechanism against fixture ideals, and validation is per-ideal so a planet declaring none simply renders no rings.

- [ ] **Step 1: Write the failing test**

Create `src/lib/atlas/__tests__/ideals.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { loadBodies } from "../bodies";
import { IDEALS, idealsFor, validateIdeals, type Ideal } from "../ideals";

const bodies = loadBodies();

describe("ideals", () => {
  it("accepts the shipped set", () => {
    expect(() => validateIdeals(IDEALS, bodies)).not.toThrow();
  });

  it("rejects an ideal whose evidence does not resolve", () => {
    const bogus: Ideal = {
      id: "bogus",
      scope: "galaxy:zemi",
      ordinal: 1,
      claim: "Untrue things",
      evidence: ["glicko2-ts"], // real-looking, and genuinely absent from bodies.generated.json
    };
    expect(() => validateIdeals([bogus], bodies)).toThrow(/glicko2-ts/);
  });

  it("rejects an ideal with no evidence at all — a claim with nothing behind it", () => {
    const empty: Ideal = {
      id: "empty",
      scope: "galaxy:zemi",
      ordinal: 1,
      claim: "Trust me",
      evidence: [],
    };
    expect(() => validateIdeals([empty], bodies)).toThrow(/no evidence/);
  });

  it("accepts an empty set, so a planet may declare no ideals and render no rings", () => {
    expect(() => validateIdeals([], bodies)).not.toThrow();
    expect(idealsFor("creative")).toEqual([]);
  });

  it("orders rings inner to outer without gaps or ties", () => {
    for (const arm of ["foundations", "products", "labs", "self", "creative"]) {
      const ordinals = idealsFor(arm).map((i) => i.ordinal);
      expect(ordinals).toEqual([...ordinals].sort((a, b) => a - b));
      expect(new Set(ordinals).size).toBe(ordinals.length);
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/atlas/__tests__/ideals.test.ts`
Expected: FAIL — `Failed to resolve import "../ideals"`

- [ ] **Step 3: Write the module**

Create `src/lib/atlas/ideals.ts`:

```ts
import type { Body, ScopeId } from "./types";
import { loadBodies } from "./bodies";

export interface Ideal {
  id: string;
  /** The scope whose rings carry this claim. */
  scope: ScopeId;
  /** Ring index, inner to outer. Unique within a scope. */
  ordinal: number;
  claim: string;
  /** Body ids that demonstrate the claim. Never empty. */
  evidence: string[];
}

/**
 * The author supplies the real claims. Until then this holds the one ideal whose
 * evidence is already provable — the ported engine runs all 27 cases in
 * engine-fixtures.json under CI.
 *
 * A scope with no ideals renders no rings, which is a legitimate state. Adding a
 * claim without evidence is not.
 */
export const IDEALS: Ideal[] = [
  {
    id: "deterministic-systems",
    scope: "planet:products",
    ordinal: 1,
    claim: "Deterministic systems over speculation",
    evidence: ["PickMe", "pickleops"],
  },
];

export function validateIdeals(ideals: Ideal[], bodies: Body[] = loadBodies()): void {
  const known = new Set(bodies.map((b) => b.id));
  for (const ideal of ideals) {
    if (ideal.evidence.length === 0) {
      throw new Error(`ideal "${ideal.id}" has no evidence — a claim with nothing behind it`);
    }
    for (const id of ideal.evidence) {
      if (!known.has(id)) {
        throw new Error(`ideal "${ideal.id}" cites unknown body "${id}"`);
      }
    }
  }
}

/**
 * String-matched rather than resolved through `getScope`, because planet scopes
 * are not registered until Plan 2. An arm with no ideals returns [] and draws
 * no rings.
 */
export function idealsFor(arm: string): Ideal[] {
  return IDEALS.filter((i) => i.scope === `planet:${arm}`).sort((a, b) => a.ordinal - b.ordinal);
}

// Fail the build, not the render. An unresolved citation must surface the way an
// unassigned arm already does.
validateIdeals(IDEALS);
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/atlas/__tests__/ideals.test.ts`
Expected: PASS — 5 tests.

If "accepts the shipped set" fails, the ids in `IDEALS[0].evidence` do not match the repo names in `bodies.generated.json`. Check the real ids and fix the citation — **do not weaken the validator**.

- [ ] **Step 5: Draw the rings**

In `WorldSceneBuilder`, for each planet from `derivePlanets(bodies)`, build one tilted `THREE.RingGeometry` per `idealsFor(placement.arm)` entry, radius `placement.radius * (1.6 + ordinal * 0.36)`, stroked in `DIRECTION_A.gold`. Give each ring one small sphere bead orbiting it slowly, so the ring reads as moving before it is touched.

Register each ring in `hitObjects` with `type: "ideal"` and the ideal's id, so hovering can illuminate one ring and dim its siblings.

- [ ] **Step 6: Run the suite, lint, and verify in the browser**

Run: `npm test && npm run lint`
Expected: all pass.

Then:
1. `preview_start`, `read_console_messages` — no errors.
2. Products must show one ring with a bead moving along it. Every other planet shows none — that is correct, not a bug.
3. Hover the ring; it should brighten.

- [ ] **Step 7: Commit**

```bash
git add src/lib/atlas/ideals.ts src/lib/atlas/__tests__/ideals.test.ts src/components/world/WorldSceneBuilder.ts
git commit -m "feat(atlas): add ideals rings with required evidence

Rings encode ideals, not skill tiers: radius already is time, so tier
rings would state the same fact twice.

An ideal citing an unknown body fails the build, and an ideal with no
evidence is rejected outright — that rule is what separates a ring from a
slogan on a wall. A planet declaring no ideals renders no rings, so the
author's real claims can land late without blocking the mechanism."
```

---

## Verification

After Task 11, before calling R1's galaxy complete:

- [ ] `npm test` — all pass, no skips
- [ ] `npm run lint` — clean at `--max-warnings 0`
- [ ] `npm run build` — production build succeeds
- [ ] Orbit the camera: quote stars move **with the scene**, not with the screen
- [ ] Tab through the sky: every star focusable, Enter opens, Escape closes
- [ ] Day mode: 2–3 comets in flight, hover pauses one in place, click opens its quote
- [ ] The five planets read as five distinct surfaces; Products is largest and sits at the frontier
- [ ] `resize_window` to `mobile`: usable frame rate, no horizontal overflow
- [ ] OS reduced-motion on: comets stop travelling, quotes stay readable
- [ ] No hardcoded coordinate remains — `grep -rn "new THREE.Vector3(-\?[0-9]" src/components/world/` returns only camera offsets, never planet positions

---

## Deferred to Plan 2

**Scene-graph nesting (spec §3.1).** Each scope becoming its own `THREE.Group`
with contents parented to it has no observable effect while exactly one scope
exists, and its only consumer is descent. Building it here would be untestable
scaffolding; it is the first task of Plan 2, where the second scope makes it
verifiable.

The Products diorama — descent into a child scope, the surface assembled from Products' children, and the PickMe console mounted on it. It depends on the `Scope` model from Tasks 1–2 and the derived planet centres from Task 3, so it is written once those interfaces exist rather than guessed at now.
