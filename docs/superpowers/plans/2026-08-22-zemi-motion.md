# Zemí Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the galaxy read as a living place — planets tilted and lit with a
moving terminator, a shimmering field, inclined moon orbits, and the whole
pattern wheeling against a fixed sky — without any layer moving a body relative
to its derived placement.

**Architecture:** Five independent motion layers applied strictly *above*
placement in the transform hierarchy. `placeBodies` remains the sole authority
on where anything is; motion only changes which way things face and which way
the whole pattern is turned. The pattern rotation (L1) is **rigid** — one
angular rate for every radius — which is what preserves "angle means arm,
radius means time" exactly. Derived numbers live in a new pure module
`src/lib/atlas/motion.ts` with no three.js import, following the existing rule
that the data layer must not pull three.js in.

**Tech Stack:** TypeScript, three.js 0.185, React 19, Next.js 16, Vitest
(`environment: "node"` by default; scene tests opt into jsdom with a
`// @vitest-environment jsdom` pragma on line 1).

**Spec:** `docs/superpowers/specs/2026-08-22-zemi-motion-design.md`

## Global Constraints

- **Nothing authored that can be derived.** Every angle and rate is a function
  of scope data. A sixth arm must get a tilt and an inclination without anyone
  choosing a number.
- **Motion never touches placement.** `placeBodies`, `derivePlanets` and
  `deriveMoons` are read-only to this work. `src/lib/atlas/motion.ts` must never
  be imported by any of them.
- **`sceneParity.test.ts` golden is unchanged, always.** It captures world
  positions *before* `update()` is called. Any task that shifts a placement
  fails here, and the golden is never regenerated during this work.
- **`src/lib/atlas/motion.ts` imports no three.js.** Same rule `arms.ts` records.
- **Unknown inputs throw, never default.** `throw new Error(\`unknown arm "${arm}"\`)`
  — the house rule, "Loud, not defaulted."
- **Ceilings:** `MAX_OBLIQUITY = 28°`, `MAX_INCLINATION = 12°`,
  `PATTERN_PERIOD_SECONDS = 30 * 60`.
- **Reduced motion removes travel, never orientation.** L1, L4, L5 off; L2 on.
- **Run the full suite before every commit:** `npm test`. Lint with
  `npm run lint` (`--max-warnings 0`).

---

## File Structure

**Create:**
- `src/lib/atlas/motion.ts` — pure derived rates and tilts. No three.js. Task 1.
- `src/lib/atlas/__tests__/motion.test.ts` — Task 1.
- `src/components/world/FieldShader.ts` — the points material for L5. Task 6.
- `src/components/world/__tests__/tilt.test.ts` — Task 2.
- `src/components/world/__tests__/light.test.ts` — Tasks 3–5.
- `src/components/world/__tests__/field.test.ts` — Task 6.
- `src/components/world/__tests__/inclination.test.ts` — Task 7.
- `src/components/world/__tests__/patternRotation.test.ts` — Tasks 8–9, 11–12.

**Modify:**
- `src/components/world/PlanetSurfaces.ts` — shader normal through
  `instanceMatrix` (Task 2); world-space light uniform (Task 4).
- `src/components/world/WorldSceneBuilder.ts` — obliquity in instance matrices
  (Task 2), light plumbing (Task 4), field material (Task 6), moon inclination
  (Task 7), pattern rotation + sky counter-rotation (Task 8), live hit positions
  (Task 9), reduced-motion gate (Task 11).
- `src/components/world/DayNightController.ts` — sun on an arc, `sunDirection()`,
  frame-scaled shadow frustum (Tasks 3, 5).
- `src/lib/atlas/moons.ts` — `inclination` on `MoonPlacement` (Task 7).
- `src/components/world/WorldCanvas.tsx` — pins from live world matrices
  (Task 9), reduced-motion flag through to the builder (Task 11).
- `src/components/world/WorldCameraManager.ts` — `descend()` re-aims each frame
  (Task 10).

---

## A note on the "append to" steps

Tasks 4, 5, 9, 11 and 12 append `describe` blocks to a test file an earlier task
created, and the snippets carry the `import` lines those blocks need. **Put
those imports at the top of the file with the others, not in the middle.** ESM
hoists them either way, so the tests pass regardless — but `npm run lint` runs
at `--max-warnings 0`, and a mid-file import is exactly the kind of thing that
trips it.

---

## Two traps found while writing this plan

Read these before Task 2 and Task 8. Both make a layer silently do nothing while
every existing test still passes.

**Trap 1 — `setClockDay` rebuilds every planet instance matrix from scratch.**
`WorldSceneBuilder.setClockDay` does `new THREE.Matrix4().makeScale(r,r,r)` then
`.setPosition(center)` for each planet, and `build()` calls `setClockDay` as its
*last* step. A tilt written in `buildPlanetarySpheres` is therefore erased
before the first frame. The tilt quaternion has to be stored on
`planetInstances` and re-composed in `setClockDay`. Task 2 does this and tests
it.

**Trap 2 — the sky shell lives inside `rootGroup`.** `buildBackgroundField` adds
the 12,000-point `background-field` to `rootGroup` alongside everything else, so
rotating `rootGroup` rotates the reference with the content and the two cancel
to a still image. Task 8 counter-rotates the shell and tests that it does not
move.

---

## Task 1: Derived motion numbers

**Files:**
- Create: `src/lib/atlas/motion.ts`
- Test: `src/lib/atlas/__tests__/motion.test.ts`

**Interfaces:**
- Consumes: `GALAXY_ZEMI`, `Scope` from `src/lib/atlas/galaxy.ts`.
- Produces:
  - `PATTERN_PERIOD_SECONDS: number`
  - `PATTERN_RATE: number`
  - `patternAngle(elapsedSeconds: number): number`
  - `MAX_OBLIQUITY: number`, `MAX_INCLINATION: number`
  - `interface AxisTilt { magnitude: number; azimuth: number }`
  - `obliquityFor(arm: string, scope?: Scope): AxisTilt`

- [x] **Step 1: Write the failing test**

Create `src/lib/atlas/__tests__/motion.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { GALAXY_ZEMI } from "../galaxy";
import {
  MAX_INCLINATION,
  MAX_OBLIQUITY,
  PATTERN_PERIOD_SECONDS,
  PATTERN_RATE,
  obliquityFor,
  patternAngle,
} from "../motion";

const ARMS = Object.keys(GALAXY_ZEMI.arms);

describe("pattern rotation", () => {
  it("turns the galaxy exactly once per period", () => {
    expect(patternAngle(PATTERN_PERIOD_SECONDS)).toBeCloseTo(2 * Math.PI, 10);
  });

  it("is one rate for every radius, which is what makes it rigid", () => {
    // Rigidity is the whole argument: differential rotation winds an arm
    // through a full arm-spacing in 11 seconds (spec §2).
    expect(patternAngle(10)).toBeCloseTo(PATTERN_RATE * 10, 12);
    expect(patternAngle(0)).toBe(0);
  });

  it("turns slowly enough that a pin does not slide out from under a pointer", () => {
    // Precedent: ORRERY_RATE was cut 0.28 -> 0.1 for exactly this failure.
    expect(PATTERN_RATE).toBeLessThan(0.01);
  });
});

describe("obliquity", () => {
  it("leans every arm, and none of them past the ceiling", () => {
    for (const arm of ARMS) {
      const tilt = obliquityFor(arm);
      expect(tilt.magnitude).toBeGreaterThan(0);
      expect(tilt.magnitude).toBeLessThanOrEqual(MAX_OBLIQUITY);
    }
  });

  it("gives no two arms the same lean", () => {
    const leans = ARMS.map((a) => obliquityFor(a).magnitude.toFixed(9));
    expect(new Set(leans).size).toBe(ARMS.length);
  });

  it("gives no two arms the same direction of lean", () => {
    const azimuths = ARMS.map((a) => obliquityFor(a).azimuth.toFixed(9));
    expect(new Set(azimuths).size).toBe(ARMS.length);
  });

  it("gives a sixth arm one without anybody choosing a number", () => {
    const sixth = {
      ...GALAXY_ZEMI,
      arms: { ...GALAXY_ZEMI.arms, ventures: (10 * Math.PI) / 6 },
    };
    const tilt = obliquityFor("ventures", sixth);
    expect(tilt.magnitude).toBeGreaterThan(0);
    expect(tilt.magnitude).toBeLessThanOrEqual(MAX_OBLIQUITY);
  });

  it("is loud about an arm it does not know", () => {
    expect(() => obliquityFor("nope")).toThrow(/unknown arm/);
  });

  it("keeps the moon ceiling well under the planet ceiling", () => {
    // Obliquity never reaches a moon frame (spec §3.5). Inclination does, and
    // it is the ground a visitor stands on.
    expect(MAX_INCLINATION).toBeLessThan(MAX_OBLIQUITY);
  });
});
```

- [x] **Step 2: Run it to make sure it fails**

Run: `npx vitest run src/lib/atlas/__tests__/motion.test.ts`
Expected: FAIL — `Failed to resolve import "../motion"`.

- [x] **Step 3: Write the implementation**

Create `src/lib/atlas/motion.ts`:

```ts
import { GALAXY_ZEMI, type Scope } from "./galaxy";

/**
 * How the world moves, as pure numbers.
 *
 * Here rather than in the scene builder for the reason `moons.ts` and
 * `planets.ts` are here: a rate is a derivation. It needs no scene, no camera
 * and no three.js to state, and `arms.ts` already records that pulling three.js
 * into the data layer is the thing to avoid.
 *
 * Motion is applied strictly ABOVE placement in the transform hierarchy.
 * Nothing in this file may ever be consulted by `placeBodies`, `derivePlanets`
 * or `deriveMoons` when deciding where something IS.
 */

/**
 * The galaxy's pattern period. One revolution per thirty minutes.
 *
 * Sized against the pointer rather than against taste. At the derived galaxy
 * pose this is 2.53 px/s at a 725 px rim, so a planet pin about 100 px wide
 * takes roughly forty seconds to slide its own width. The binding precedent is
 * `ORRERY_RATE`, cut from 0.28 to 0.1 because a bead "crossed the frame in a
 * couple of seconds and slid out from under the pointer" — the same failure
 * mode, one altitude up.
 */
export const PATTERN_PERIOD_SECONDS = 30 * 60;

/** Radians per second. One rate for every radius: see `patternAngle`. */
export const PATTERN_RATE = (2 * Math.PI) / PATTERN_PERIOD_SECONDS;

/**
 * The pattern's angle at a moment.
 *
 * A pure function of elapsed time and nothing else — no radius argument, and
 * that absence is the design. A rate that varied with radius would be
 * differential rotation, which winds an arm through a full arm-spacing in
 * eleven seconds at any rate fast enough to see.
 */
export function patternAngle(elapsedSeconds: number): number {
  return PATTERN_RATE * elapsedSeconds;
}

/** Radians. A planet's spin axis never leans further than this from its frame's +Y. */
export const MAX_OBLIQUITY = (28 * Math.PI) / 180;

/**
 * Radians. A moon's orbit never inclines further than this.
 *
 * Lower than the planets' ceiling because this one reaches a frame a visitor
 * stands on: a moon group rides its inclined orbit, so the ground tilts with
 * it. `surfaceCamera.test.ts`'s fifteen-degree off-axis assertion is the gate
 * on this number — if it fails, this comes down.
 */
export const MAX_INCLINATION = (12 * Math.PI) / 180;

/** A lean: how far from +Y, and which way round. */
export interface AxisTilt {
  /** Radians from the frame's own +Y. Never exceeds the relevant ceiling. */
  magnitude: number;
  /** Radians about +Y — the direction the pole leans toward. */
  azimuth: number;
}

function baseAngle(arm: string, scope: Scope): number {
  const base = scope.arms[arm];
  if (base === undefined) {
    // Loud, not defaulted — the same rule an unassigned arm already follows.
    throw new Error(`unknown arm "${arm}"`);
  }
  return base;
}

/**
 * A planet's axial tilt, derived from its arm's own base angle.
 *
 * Same source the ideals rings already read, for the reason recorded there:
 * "Reading the arm's own base angle gives every planet a different plane, and a
 * sixth arm gets one without anybody choosing a number."
 *
 * The RANGE is what is new. `armAngle` reaches 8π/5, so the ideals' bare
 * `armAngle * 0.28` yields up to 80.7° — a decorative lean on a ring, and a
 * toppled world on a planet. Magnitude is mapped into
 * `[0.45, 1] * MAX_OBLIQUITY` so no planet is left upright and none is knocked
 * over; azimuth is the arm angle itself, so no two lean the same way.
 */
export function obliquityFor(arm: string, scope: Scope = GALAXY_ZEMI): AxisTilt {
  const base = baseAngle(arm, scope);
  const turn = (base / (2 * Math.PI)) % 1;
  return {
    magnitude: MAX_OBLIQUITY * (0.45 + 0.55 * turn),
    azimuth: base,
  };
}
```

- [x] **Step 4: Run it and make sure it passes**

Run: `npx vitest run src/lib/atlas/__tests__/motion.test.ts`
Expected: PASS — 10 tests.

- [x] **Step 5: Confirm no three.js crept into the data layer**

Run: `grep -n "three" src/lib/atlas/motion.ts`
Expected: no output.

- [x] **Step 6: Commit**

```bash
git add src/lib/atlas/motion.ts src/lib/atlas/__tests__/motion.test.ts
git commit -m "feat(motion): derive the pattern rate and every planet's lean"
```

---

## Task 2: L2 — axial tilt

**Files:**
- Modify: `src/components/world/PlanetSurfaces.ts` (vertex shader `vNormal`)
- Modify: `src/components/world/WorldSceneBuilder.ts` (`buildPlanetarySpheres`,
  `planetInstances` field, `setClockDay`)
- Test: `src/components/world/__tests__/tilt.test.ts`

**Interfaces:**
- Consumes: `obliquityFor`, `MAX_OBLIQUITY` from Task 1.
- Produces: `planetInstances` entries gain `tilt: THREE.Quaternion`. Every
  planet instance matrix now decomposes to a non-identity rotation.

- [x] **Step 1: Write the failing test**

Create `src/components/world/__tests__/tilt.test.ts`:

```ts
// @vitest-environment jsdom
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { WorldSceneBuilder } from "../WorldSceneBuilder";
import { loadBodies } from "@/lib/atlas/bodies";
import { GALAXY_ZEMI } from "@/lib/atlas/galaxy";
import { MAX_OBLIQUITY, obliquityFor } from "@/lib/atlas/motion";

const bodies = loadBodies();
const ARMS = Object.keys(GALAXY_ZEMI.arms);
const UP = new THREE.Vector3(0, 1, 0);

function built() {
  const scene = new THREE.Scene();
  const builder = new WorldSceneBuilder(scene, bodies, "2026-08-22", 1);
  builder.build();
  return builder;
}

function instanceMatrix(builder: WorldSceneBuilder, arm: string): THREE.Matrix4 {
  const mesh = builder.rootGroup.getObjectByName("planet-surfaces") as THREE.InstancedMesh;
  const m = new THREE.Matrix4();
  mesh.getMatrixAt(builder.planetInstanceIndex(arm), m);
  return m;
}

function poleOf(builder: WorldSceneBuilder, arm: string): THREE.Vector3 {
  const q = new THREE.Quaternion();
  instanceMatrix(builder, arm).decompose(new THREE.Vector3(), q, new THREE.Vector3());
  return UP.clone().applyQuaternion(q);
}

describe("axial tilt", () => {
  it("leans every planet off world up, by the angle motion.ts derives", () => {
    const builder = built();
    for (const arm of ARMS) {
      const angle = poleOf(builder, arm).angleTo(UP);
      expect(angle).toBeCloseTo(obliquityFor(arm).magnitude, 6);
      expect(angle).toBeLessThanOrEqual(MAX_OBLIQUITY + 1e-9);
    }
  });

  it("gives no two planets the same pole", () => {
    const builder = built();
    for (let i = 0; i < ARMS.length; i++) {
      for (let j = i + 1; j < ARMS.length; j++) {
        expect(poleOf(builder, ARMS[i]).angleTo(poleOf(builder, ARMS[j]))).toBeGreaterThan(0.02);
      }
    }
  });

  it("survives the clock, which rebuilds every instance matrix", () => {
    // setClockDay composes a fresh matrix from scale and position. Written
    // naively it erases the tilt, and build() calls it as its LAST step, so the
    // tilt would never reach a frame. This is the test for that trap.
    const builder = built();
    builder.setClockDay(400);
    for (const arm of ARMS) {
      expect(poleOf(builder, arm).angleTo(UP)).toBeCloseTo(obliquityFor(arm).magnitude, 6);
    }
  });

  it("moves no planet's centre and changes no planet's radius", () => {
    // Tilt is orientation. Placement stays placeBodies' business.
    const builder = built();
    for (const arm of ARMS) {
      const scale = new THREE.Vector3();
      const position = new THREE.Vector3();
      instanceMatrix(builder, arm).decompose(position, new THREE.Quaternion(), scale);
      const hit = builder.hitObjects.find((h) => h.type === "planet" && h.id === arm)!;
      expect(position.distanceTo(hit.position)).toBeLessThan(1e-6);
      expect(scale.x).toBeCloseTo(scale.y, 9);
      expect(scale.y).toBeCloseTo(scale.z, 9);
      expect(scale.x).toBeGreaterThan(0);
    }
  });

  it("composes the instance rotation into the lit normal", () => {
    // `normalMatrix * normal` excludes instanceMatrix, which is correct only
    // for pure scale and translation — uniform scale does not change a normal's
    // direction. A tilted instance lit by the old expression is lit upright.
    const builder = built();
    const mesh = builder.rootGroup.getObjectByName("planet-surfaces") as THREE.InstancedMesh;
    const source = (mesh.material as THREE.ShaderMaterial).vertexShader;
    expect(source).toMatch(/vNormal\s*=\s*normalize\(\s*normalMatrix\s*\*\s*mat3\(\s*instanceMatrix\s*\)\s*\*\s*normal\s*\)/);
  });

  it("leaves the planet scope groups level, because the camera descends into them", () => {
    const builder = built();
    for (const arm of ARMS) {
      const group = builder.groupFor(`planet:${arm}`);
      group.updateWorldMatrix(true, false);
      const q = new THREE.Quaternion();
      group.matrixWorld.decompose(new THREE.Vector3(), q, new THREE.Vector3());
      expect(UP.clone().applyQuaternion(q).angleTo(UP)).toBeLessThan(1e-9);
    }
  });
});
```

- [x] **Step 2: Run it to make sure it fails**

Run: `npx vitest run src/components/world/__tests__/tilt.test.ts`
Expected: FAIL — the pole equals world up, so `angleTo(UP)` is 0 rather than the
derived magnitude.

- [x] **Step 3: Compose the instance rotation into the normal**

In `src/components/world/PlanetSurfaces.ts`, in the vertex shader, replace:

```glsl
        vNormal = normalize(normalMatrix * normal);
```

with:

```glsl
        // Through instanceMatrix as well. `normalMatrix` alone is correct only
        // while instances are pure scale and translation — uniform scale does
        // not change a normal's direction, but a tilt does, and a tilted planet
        // lit by the old expression is lit as though it were upright.
        vNormal = normalize(normalMatrix * mat3(instanceMatrix) * normal);
```

- [x] **Step 4: Store the tilt on each instance and compose it in**

In `src/components/world/WorldSceneBuilder.ts`, add to the imports:

```ts
import { obliquityFor } from "@/lib/atlas/motion";
```

Change the `planetInstances` field declaration to carry the tilt:

```ts
  private readonly planetInstances: Array<{
    arm: string;
    index: number;
    center: THREE.Vector3;
    /** L2. Held here because `setClockDay` rebuilds the matrix and must re-compose it. */
    tilt: THREE.Quaternion;
  }> = [];
```

In `buildPlanetarySpheres`, replace:

```ts
      const center = toScene(planet.center);
      const radius = planet.radius * SCENE_SCALE;
      matrix.makeScale(radius, radius, radius);
      matrix.setPosition(center.x, PLANET_Y, center.z);
      mesh.setMatrixAt(i, matrix);
```

with:

```ts
      const center = toScene(planet.center);
      const radius = planet.radius * SCENE_SCALE;
      // Read the pole off a vector rather than assembling Euler angles by hand.
      // Composing angles by hand is exactly the error that put the surface
      // spike's first landing ninety degrees off its parent.
      const lean = obliquityFor(planet.arm);
      const pole = new THREE.Vector3(
        Math.sin(lean.magnitude) * Math.cos(lean.azimuth),
        Math.cos(lean.magnitude),
        Math.sin(lean.magnitude) * Math.sin(lean.azimuth),
      );
      const tilt = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), pole);
      matrix.compose(
        new THREE.Vector3(center.x, PLANET_Y, center.z),
        tilt,
        new THREE.Vector3(radius, radius, radius),
      );
      mesh.setMatrixAt(i, matrix);
```

and replace the `planetInstances.push` call at the end of the same loop:

```ts
      this.planetInstances.push({
        arm: planet.arm,
        index: i,
        center: new THREE.Vector3(center.x, PLANET_Y, center.z),
        tilt,
      });
```

- [x] **Step 5: Stop the clock from erasing the tilt**

In `setClockDay`, replace:

```ts
        const matrix = new THREE.Matrix4().makeScale(radius, radius, radius);
        matrix.setPosition(instance.center);
```

with:

```ts
        // Composed, not scaled-then-positioned: the instance carries an L2 tilt
        // and this method runs last in `build()`, so a matrix rebuilt without
        // the rotation would erase the tilt before the first frame.
        const matrix = new THREE.Matrix4().compose(
          instance.center,
          instance.tilt,
          new THREE.Vector3(radius, radius, radius),
        );
```

- [x] **Step 6: Run the new test and the full suite**

Run: `npx vitest run src/components/world/__tests__/tilt.test.ts`
Expected: PASS — 6 tests.

Run: `npm test`
Expected: PASS. `sceneParity.test.ts` in particular must be green — Task 2
reparents nothing, so the golden cannot have moved.

- [x] **Step 7: Commit**

```bash
git add src/components/world/PlanetSurfaces.ts src/components/world/WorldSceneBuilder.ts src/components/world/__tests__/tilt.test.ts
git commit -m "feat(motion): give every planet its own axis to turn on"
```

---

## Task 3: L4a — put the sun on an arc

**Files:**
- Modify: `src/components/world/DayNightController.ts`
- Test: `src/components/world/__tests__/light.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `DayNightController.update(deltaSeconds: number): void` — unchanged signature,
    now also advances the arc.
  - `DayNightController.sunDirection(): THREE.Vector3` — unit vector from the
    scene origin toward the sun, in world space. Consumed by Task 4.
  - `DayNightController.setReducedMotion(reduced: boolean): void` — consumed by
    Task 11.
  - `SUN_ARC_PERIOD_SECONDS: number` exported constant.

- [x] **Step 1: Write the failing test**

Create `src/components/world/__tests__/light.test.ts`:

```ts
// @vitest-environment jsdom
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { DayNightController, SUN_ARC_PERIOD_SECONDS } from "../DayNightController";

function controller() {
  return new DayNightController(new THREE.Scene(), "day");
}

/** Advance in one-second steps, the way the render loop does. */
function run(c: DayNightController, seconds: number) {
  for (let i = 0; i < seconds; i++) c.update(1);
}

describe("the sun moves", () => {
  it("reports a unit direction", () => {
    expect(controller().sunDirection().length()).toBeCloseTo(1, 6);
  });

  it("has moved measurably after a minute", () => {
    const c = controller();
    const start = c.sunDirection().clone();
    run(c, 60);
    expect(c.sunDirection().angleTo(start)).toBeGreaterThan(0.02);
  });

  it("comes back to where it started after one circuit", () => {
    const c = controller();
    const start = c.sunDirection().clone();
    run(c, SUN_ARC_PERIOD_SECONDS);
    expect(c.sunDirection().angleTo(start)).toBeLessThan(0.01);
  });

  it("keeps the sun above the plane, so the map is never lit from below", () => {
    const c = controller();
    for (let i = 0; i < SUN_ARC_PERIOD_SECONDS; i += 7) {
      run(c, 7);
      expect(c.sunDirection().y).toBeGreaterThan(0.05);
    }
  });

  it("holds still when the visitor has asked for less motion", () => {
    const c = controller();
    c.setReducedMotion(true);
    const start = c.sunDirection().clone();
    run(c, 300);
    expect(c.sunDirection().angleTo(start)).toBeLessThan(1e-9);
  });
});
```

- [x] **Step 2: Run it to make sure it fails**

Run: `npx vitest run src/components/world/__tests__/light.test.ts`
Expected: FAIL — `sunDirection is not a function`.

- [x] **Step 3: Implement the arc**

In `src/components/world/DayNightController.ts`, add below the palette exports:

```ts
/**
 * Seconds for the sun to travel once around the map.
 *
 * Eight minutes. The terminator has to crawl rather than sweep: what makes a
 * sphere read as a body is that its lit edge is in a different place when you
 * look back, not that you can watch it move.
 */
export const SUN_ARC_PERIOD_SECONDS = 8 * 60;
```

Add these fields to the class, beside `transitionProgress`:

```ts
  /** Radians travelled around the arc. Advanced by `update`, not by the palette. */
  private arcAngle = 0;
  private reducedMotion = false;
  /** Reused so `sunDirection` allocates nothing in the render loop. */
  private readonly sunDir = new THREE.Vector3();
```

Add these methods to the class:

```ts
  /**
   * Travel removed, content kept — the same rule descent already follows. The
   * sun stops where it is; it is not moved to some neutral position, because
   * that would change the lighting rather than only the motion in it.
   */
  public setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
  }

  /**
   * Where the light is, as a unit vector from the origin. World space.
   *
   * The planet shader needs this because it does its own lighting: its lambert
   * term was a hardcoded direction, so no planet had a terminator that moved.
   */
  public sunDirection(): THREE.Vector3 {
    return this.sunDir.copy(this.directionalSun.position).normalize();
  }

  /**
   * Swing the palette's sun position around the vertical axis.
   *
   * The palettes keep their two authored positions and the day/night lerp keeps
   * writing them; the arc is applied on top as a rotation about +Y, so the
   * sun's height and distance are still the palette's to state and only its
   * bearing is this method's. Rotating about +Y is also what keeps the light
   * above the plane at every angle.
   */
  private applyArc(): void {
    const palette = this.currentMode === "day" ? DAY_PALETTE : NIGHT_PALETTE;
    const [x, y, z] = palette.sunPosition;
    const base = new THREE.Vector3(x, y, z);
    if (this.isTransitioning) base.copy(this.directionalSun.position);
    const radius = Math.hypot(base.x, base.z);
    const bearing = Math.atan2(base.z, base.x) + this.arcAngle;
    this.directionalSun.position.set(
      Math.cos(bearing) * radius,
      base.y,
      Math.sin(bearing) * radius,
    );
  }
```

Then extend `update` so the arc advances every frame, not only during a
transition. Replace the whole method body with:

```ts
  public update(deltaSeconds: number): void {
    if (this.isTransitioning) {
      const target = this.currentMode === "day" ? 0 : 1;
      if (Math.abs(this.transitionProgress - target) < 0.01) {
        this.transitionProgress = target;
        this.isTransitioning = false;
      } else {
        this.transitionProgress +=
          Math.sign(target - this.transitionProgress) * this.transitionSpeed * deltaSeconds;
        this.transitionProgress = Math.max(0, Math.min(1, this.transitionProgress));
      }

      this.applyPaletteInterpolation();
    }

    // Outside the transition branch: the sun travels whether or not the palette
    // is changing, which is the difference between a light and a light switch.
    if (!this.reducedMotion) {
      this.arcAngle =
        (this.arcAngle + (2 * Math.PI * deltaSeconds) / SUN_ARC_PERIOD_SECONDS) % (2 * Math.PI);
      this.applyArc();
    }
  }
```

- [x] **Step 4: Run it and make sure it passes**

Run: `npx vitest run src/components/world/__tests__/light.test.ts`
Expected: PASS — 5 tests.

- [x] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add src/components/world/DayNightController.ts src/components/world/__tests__/light.test.ts
git commit -m "feat(motion): let the sun travel, so a lit edge means something"
```

---

## Task 4: L4b — tell the planet shader where the light is

**Files:**
- Modify: `src/components/world/PlanetSurfaces.ts`
- Modify: `src/components/world/WorldSceneBuilder.ts` (`update`, new setter)
- Test: `src/components/world/__tests__/light.test.ts` (append)

**Interfaces:**
- Consumes: `DayNightController.sunDirection()` from Task 3; the
  `mat3(instanceMatrix)` normal from Task 2.
- Produces: `WorldSceneBuilder.setLightDirection(dir: THREE.Vector3): void`.
  The planet material gains a `uLightDir` uniform and a `vWorldNormal` varying.

- [x] **Step 1: Write the failing test**

Append to `src/components/world/__tests__/light.test.ts`:

```ts
import { WorldSceneBuilder } from "../WorldSceneBuilder";
import { loadBodies } from "@/lib/atlas/bodies";

function builtScene() {
  const scene = new THREE.Scene();
  const builder = new WorldSceneBuilder(scene, loadBodies(), "2026-08-22", 1);
  builder.build();
  const mesh = builder.rootGroup.getObjectByName("planet-surfaces") as THREE.InstancedMesh;
  return { builder, material: mesh.material as THREE.ShaderMaterial };
}

describe("the planets are lit by the scene's own sun", () => {
  it("carries a light direction uniform", () => {
    const { material } = builtScene();
    expect(material.uniforms.uLightDir).toBeDefined();
    expect(material.uniforms.uLightDir.value).toBeInstanceOf(THREE.Vector3);
  });

  it("takes the direction it is given", () => {
    const { builder, material } = builtScene();
    builder.setLightDirection(new THREE.Vector3(0, 3, 4));
    // Normalised on the way in, so the shader never divides.
    expect(material.uniforms.uLightDir.value.length()).toBeCloseTo(1, 6);
    expect(material.uniforms.uLightDir.value.y).toBeCloseTo(0.6, 6);
  });

  it("lights against a world normal, so the terminator does not follow the camera", () => {
    const { material } = builtScene();
    expect(material.vertexShader).toContain("vWorldNormal");
    expect(material.fragmentShader).toContain("uLightDir");
    // The hardcoded raking direction is gone.
    expect(material.fragmentShader).not.toContain("vec3(0.6, 0.7, 0.4)");
  });
});
```

- [x] **Step 2: Run it to make sure it fails**

Run: `npx vitest run src/components/world/__tests__/light.test.ts -t "lit by the scene"`
Expected: FAIL — `material.uniforms.uLightDir` is undefined.

- [x] **Step 3: Add the uniform and the world normal**

In `src/components/world/PlanetSurfaces.ts`, in `createPlanetMaterial`:

Replace the uniforms line:

```ts
    uniforms: { uTime: { value: 0 } },
```

with:

```ts
    uniforms: {
      uTime: { value: 0 },
      // Seeded to the day palette's own bearing so the first frame is lit
      // before `setLightDirection` has ever been called.
      uLightDir: { value: new THREE.Vector3(30, 60, 30).normalize() },
    },
```

In the vertex shader, add the varying beside `vNormal`:

```glsl
      varying vec3 vWorldNormal;
```

and set it in `main`, after the `vNormal` line:

```glsl
        // World space, so the lit side belongs to the sun rather than to the
        // viewer. `vNormal` stays view-space for the engraved raking term.
        vWorldNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
```

In the fragment shader, declare both beside the other uniforms and varyings:

```glsl
      uniform vec3 uLightDir;
      varying vec3 vWorldNormal;
```

and replace the lighting line:

```glsl
        float lambert = clamp(dot(vNormal, normalize(vec3(0.6, 0.7, 0.4))), 0.0, 1.0);
```

with:

```glsl
        // The scene's actual sun, not a direction typed into a shader. This is
        // what gives every planet a terminator that crawls — and what puts the
        // planets and the MeshStandardMaterial moons under one light at last.
        float lambert = clamp(dot(normalize(vWorldNormal), uLightDir), 0.0, 1.0);
```

- [x] **Step 4: Plumb it through the builder**

In `src/components/world/WorldSceneBuilder.ts`, add the setter next to
`setCosmicMode`:

```ts
  /**
   * Point the planets at the scene's sun. Called every frame from the render
   * loop, because the sun travels — see `DayNightController.sunDirection`.
   */
  public setLightDirection(direction: THREE.Vector3): void {
    if (!this.planetMaterial) return;
    (this.planetMaterial.uniforms.uLightDir.value as THREE.Vector3)
      .copy(direction)
      .normalize();
  }
```

In `src/components/world/WorldCanvas.tsx`, inside `animate`, immediately after
`dayNight.update(delta);`:

```ts
      sceneBuilder.setLightDirection(dayNight.sunDirection());
```

- [x] **Step 5: Run it and make sure it passes**

Run: `npx vitest run src/components/world/__tests__/light.test.ts`
Expected: PASS — 9 tests.

Run: `npm test && npm run lint`
Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add src/components/world/PlanetSurfaces.ts src/components/world/WorldSceneBuilder.ts src/components/world/WorldCanvas.tsx src/components/world/__tests__/light.test.ts
git commit -m "feat(motion): light the planets with the sun the scene actually has"
```

---

## Task 5: L4c — let the shadows reach the planets

**Files:**
- Modify: `src/components/world/DayNightController.ts`
- Test: `src/components/world/__tests__/light.test.ts` (append)

**Interfaces:**
- Consumes: Task 3's controller.
- Produces: `DayNightController.setShadowReach(radius: number): void`.

**Why:** the shadow camera is configured `d = 35`, `far = 150`, against a galaxy
of radius 205 (`ASTROLABE_OUTER`). As shipped it cannot reach a planet at all,
so `castShadow` on the planet mesh currently buys nothing. Sizing the frustum to
the frame in view follows the rule `setFrameScale` and `setFogReference` already
use.

- [x] **Step 1: Write the failing test**

Append to `src/components/world/__tests__/light.test.ts`:

```ts
import { ASTROLABE_OUTER } from "../WorldCameraManager";

describe("shadows reach what is in frame", () => {
  it("ships with a frustum too small for the galaxy, which is the bug", () => {
    // Recorded so the fix cannot be quietly reverted: 35 against a 205 reach.
    expect(ASTROLABE_OUTER).toBeGreaterThan(150);
  });

  it("grows the shadow frustum to cover the framed radius", () => {
    const c = controller();
    c.setShadowReach(ASTROLABE_OUTER);
    const cam = c.shadowCamera;
    expect(cam.right).toBeGreaterThanOrEqual(ASTROLABE_OUTER);
    expect(cam.top).toBeGreaterThanOrEqual(ASTROLABE_OUTER);
    expect(cam.left).toBeLessThanOrEqual(-ASTROLABE_OUTER);
    expect(cam.far).toBeGreaterThan(ASTROLABE_OUTER * 2);
  });

  it("shrinks again for a landed frame, so the map keeps its shadow resolution", () => {
    const c = controller();
    c.setShadowReach(ASTROLABE_OUTER);
    const wide = c.shadowCamera.right;
    c.setShadowReach(6);
    expect(c.shadowCamera.right).toBeLessThan(wide);
    expect(c.shadowCamera.right).toBeGreaterThan(0);
  });
});
```

- [x] **Step 2: Run it to make sure it fails**

Run: `npx vitest run src/components/world/__tests__/light.test.ts -t "shadows reach"`
Expected: FAIL — `setShadowReach is not a function`.

- [x] **Step 3: Implement**

In `src/components/world/DayNightController.ts`, add to the class:

```ts
  /** The sun's shadow camera, so callers can size it and tests can read it. */
  public get shadowCamera(): THREE.OrthographicCamera {
    return this.directionalSun.shadow.camera;
  }

  /**
   * Size the shadow frustum to the frame being looked at.
   *
   * The constructor's `d = 35` and `far = 150` predate the world being scaled
   * to the astrolabe: against a reach of 205 they put every planet outside the
   * frustum, so `castShadow` on the planet mesh bought nothing at all. This is
   * the same rule `setFrameScale` follows for the near and far planes and
   * `setFogReference` follows for the fog — one number derived from the frame,
   * rather than a constant that was right at one scale.
   *
   * A 2048² map spread over the whole galaxy is coarse, which is why this
   * narrows again on descent rather than being set once to the widest case.
   */
  public setShadowReach(radius: number): void {
    const camera = this.shadowCamera;
    camera.left = -radius;
    camera.right = radius;
    camera.top = radius;
    camera.bottom = -radius;
    // The light sits outside the frame it lights, so the depth range has to
    // cross the frame and then reach the far side of it.
    camera.far = Math.max(150, radius * 4);
    camera.updateProjectionMatrix();
  }
```

- [x] **Step 4: Call it wherever the frame scale is already set**

In `src/components/world/WorldCanvas.tsx`, find the existing call to
`dayNightRef.current?.setFogReference(...)` (there are two: one for a landed
frame, one for `null`). Add a `setShadowReach` beside each, using the same
reference the fog is given:

```ts
      // Landed: the shard's own scale.
      dayNightRef.current?.setShadowReach(shardRadiusFor(standingScope, bodies));
```

```ts
      // Back out to the galaxy.
      dayNightRef.current?.setShadowReach(ASTROLABE_OUTER);
```

Import `ASTROLABE_OUTER` from `./WorldCameraManager` if it is not already
imported there.

- [x] **Step 5: Run it and make sure it passes**

Run: `npx vitest run src/components/world/__tests__/light.test.ts`
Expected: PASS — 12 tests.

Run: `npm test && npm run lint`
Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add src/components/world/DayNightController.ts src/components/world/WorldCanvas.tsx src/components/world/__tests__/light.test.ts
git commit -m "fix(world): size the shadow frustum to the frame, not to 35 units"
```

---

## Task 6: L5 — a field that is alive

**Files:**
- Create: `src/components/world/FieldShader.ts`
- Modify: `src/components/world/WorldSceneBuilder.ts` (`buildBackgroundField`,
  `fieldMaterials` type, `setCosmicMode`, `update`)
- Test: `src/components/world/__tests__/field.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `createFieldMaterial(opts: FieldMaterialOptions): THREE.ShaderMaterial`
  with uniforms `uTime`, `uColor`, `uSize`, `uOpacity`, and an `aPhase` attribute
  the caller must supply. `WorldSceneBuilder.fieldMaterials` becomes
  `THREE.ShaderMaterial[]`.

**Critical constraint:** the arm dust buffer is sorted by anchor birth day so
the timeline transport can gate it with a plain `setDrawRange` prefix. **This
task must not reorder it.** Phase rides a parallel attribute and displacement
happens in the shader, so the position buffer is read-only here.

- [x] **Step 1: Write the failing test**

Create `src/components/world/__tests__/field.test.ts`:

```ts
// @vitest-environment jsdom
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { WorldSceneBuilder, buildFieldGeometry } from "../WorldSceneBuilder";
import { loadBodies } from "@/lib/atlas/bodies";
import { createFieldMaterial } from "../FieldShader";

const bodies = loadBodies();

function built() {
  const scene = new THREE.Scene();
  const builder = new WorldSceneBuilder(scene, bodies, "2026-08-22", 1);
  builder.build();
  return builder;
}

function points(builder: WorldSceneBuilder, name: string): THREE.Points {
  return builder.rootGroup.getObjectByName(name) as THREE.Points;
}

describe("field material", () => {
  it("carries a clock and a colour the day/night controller can write", () => {
    const material = createFieldMaterial({ size: 1.6, opacity: 0.5, attenuate: false });
    expect(material.uniforms.uTime).toBeDefined();
    expect(material.uniforms.uColor.value).toBeInstanceOf(THREE.Color);
  });
});

describe("the field is animated", () => {
  it("gives every point its own phase", () => {
    const builder = built();
    for (const name of ["background-field", "arm-dust"]) {
      const attribute = points(builder, name).geometry.getAttribute("aPhase");
      expect(attribute).toBeDefined();
      expect(attribute.count).toBe(points(builder, name).geometry.getAttribute("position").count);
    }
  });

  it("draws phases that are not all the same, or nothing twinkles", () => {
    const builder = built();
    const phase = points(builder, "arm-dust").geometry.getAttribute("aPhase");
    const seen = new Set<number>();
    for (let i = 0; i < Math.min(200, phase.count); i++) seen.add(Number(phase.getX(i).toFixed(4)));
    expect(seen.size).toBeGreaterThan(100);
  });

  it("advances the clock on update", () => {
    const builder = built();
    const material = points(builder, "arm-dust").material as THREE.ShaderMaterial;
    builder.update(12, 1);
    expect(material.uniforms.uTime.value).toBeCloseTo(12, 6);
  });

  it("still repaints for night", () => {
    const builder = built();
    const material = points(builder, "arm-dust").material as THREE.ShaderMaterial;
    const day = (material.uniforms.uColor.value as THREE.Color).getHex();
    builder.setCosmicMode("night");
    expect((material.uniforms.uColor.value as THREE.Color).getHex()).not.toBe(day);
  });

  it("NEVER reorders the dust buffer, because the clock gates it by prefix", () => {
    // armDustSortedDays is ascending so setDrawRange(0, n) is exactly "every
    // dust point whose anchor already exists". Reordering silently draws the
    // wrong points at every clock day.
    const a = buildFieldGeometry(bodies, 20260820, 1);
    const b = buildFieldGeometry(bodies, 20260820, 1);
    expect(Array.from(a.positions)).toEqual(Array.from(b.positions));
    expect(Array.from(a.armDustDays)).toEqual(Array.from(b.armDustDays));
  });

  it("leaves the clock's draw-range gating alone", () => {
    const builder = built();
    builder.setClockDay(0);
    const early = points(builder, "arm-dust").geometry.drawRange.count;
    builder.setClockDay(100000);
    const late = points(builder, "arm-dust").geometry.drawRange.count;
    expect(late).toBeGreaterThan(early);
  });
});
```

- [x] **Step 2: Run it to make sure it fails**

Run: `npx vitest run src/components/world/__tests__/field.test.ts`
Expected: FAIL — `Failed to resolve import "../FieldShader"`.

- [x] **Step 3: Write the field material**

Create `src/components/world/FieldShader.ts`:

```ts
import * as THREE from "three";

/**
 * The sky and the dust, animated.
 *
 * Sixteen and a half thousand points were the largest still thing on screen and
 * the majority of its pixels. They are also the cheapest thing here to bring to
 * life: `buildFieldGeometry` scatters both layers with a seeded RNG, so no
 * individual point encodes anything and nothing is claimed by moving one.
 *
 * The one ordering that IS load-bearing is the arm dust buffer, sorted by
 * anchor birth day so the transport can gate it with a `setDrawRange` prefix.
 * Phase therefore rides a parallel attribute and displacement happens here in
 * the shader: the position buffer is read-only to this material.
 */

export interface FieldMaterialOptions {
  /** Point size. In world units when attenuating, in pixels when not. */
  size: number;
  opacity: number;
  /** The sky does not attenuate — it must not swell on zoom. Dust does. */
  attenuate: boolean;
}

/** How far a point may wander from where it was placed, as a fraction of its size. */
const BREATH = 0.35;

export function createFieldMaterial(options: FieldMaterialOptions): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(0xffffff) },
      uSize: { value: options.size },
      uOpacity: { value: options.opacity },
    },
    vertexShader: /* glsl */ `
      attribute float aPhase;
      uniform float uTime;
      uniform float uSize;
      varying float vTwinkle;

      void main() {
        // Each point keeps its own clock, so the field shimmers rather than
        // pulsing in unison — which reads as a broken frame rather than a sky.
        float t = uTime * 0.6 + aPhase * 6.2831853;
        vTwinkle = 0.55 + 0.45 * sin(t);

        // A breath along the point's own radial. Bounded by its drawn size, so
        // no point can travel far enough to say something it did not before.
        vec3 drift = normalize(position + vec3(1e-4)) * (sin(t * 0.37) * uSize * ${BREATH.toFixed(2)});
        vec4 mvPosition = modelViewMatrix * vec4(position + drift, 1.0);

        ${
          options.attenuate
            ? "gl_PointSize = uSize * (300.0 / -mvPosition.z);"
            : "gl_PointSize = uSize;"
        }
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying float vTwinkle;

      void main() {
        // Round points. A square star is the tell that a field is a buffer.
        vec2 d = gl_PointCoord - vec2(0.5);
        float mask = 1.0 - smoothstep(0.35, 0.5, length(d));
        if (mask <= 0.0) discard;
        gl_FragColor = vec4(uColor, uOpacity * vTwinkle * mask);
      }
    `,
  });
}
```

- [x] **Step 4: Generate the phase attribute alongside the positions**

In `src/components/world/WorldSceneBuilder.ts`, in `buildFieldGeometry`, add a
phase array beside `armDustDays`. Declare it next to the other buffers:

```ts
  const phases = new Float32Array(BACKGROUND_STAR_COUNT + ARM_DUST_COUNT);
```

Fill it from the same seeded stream, immediately before the function returns,
and add it to the returned object:

```ts
  // Same `rand` stream, so the field stays deterministic and the parity golden
  // is unaffected. Drawn last so no existing draw from `rand` shifts.
  for (let n = 0; n < phases.length; n++) phases[n] = rand();
```

Return `{ positions, armDustDays, phases }` — update the return statement and
the function's return type annotation to match.

- [x] **Step 5: Use the material and carry the phase into both layers**

In `buildBackgroundField`, destructure the new field:

```ts
    const { positions, armDustDays, phases } = buildFieldGeometry(this.bodies, 20260820, SCENE_SCALE);
```

In the `layer` helper, add the phase attribute and swap the material. Replace
the `geometry.setAttribute("position", ...)` block and the `new THREE.PointsMaterial({...})`
construction with:

```ts
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(positions.subarray(from * 3, (from + count) * 3), 3),
      );
      geometry.setAttribute(
        "aPhase",
        new THREE.BufferAttribute(phases.subarray(from, from + count), 1),
      );
      const points = new THREE.Points(
        geometry,
        createFieldMaterial({ size, opacity, attenuate }),
      );
```

For the arm dust, the buffer is re-ordered by anchor day, so its phase must be
re-ordered the same way. Beside `dustPositions` and `dustDays`, add:

```ts
    const dustPhases = new Float32Array(dustBudget);
```

and inside the existing `order.forEach((srcIndex, sortedIndex) => { ... })` body,
alongside the position copies:

```ts
      dustPhases[sortedIndex] = phases[BACKGROUND_STAR_COUNT + srcIndex];
```

Then on the dust geometry, beside the existing position attribute:

```ts
    dustGeometry.setAttribute("aPhase", new THREE.BufferAttribute(dustPhases, 1));
```

and replace the dust `new THREE.PointsMaterial({...})` with:

```ts
      createFieldMaterial({ size: 1.2, opacity: 0.5, attenuate: true }),
```

Add the import at the top of the file:

```ts
import { createFieldMaterial } from "./FieldShader";
```

- [x] **Step 6: Fix the two places that spoke to `PointsMaterial`**

Change the field material list's type:

```ts
  private fieldMaterials: THREE.ShaderMaterial[] = [];
```

Both `this.fieldMaterials.push(...)` sites now push
`points.material as THREE.ShaderMaterial` and
`dustPoints.material as THREE.ShaderMaterial`.

In `setCosmicMode`, replace the colour write:

```ts
    for (const material of this.fieldMaterials) {
      (material.uniforms.uColor.value as THREE.Color).copy(mark);
    }
```

In `update`, advance the field clock — add beside the planet material's `uTime`:

```ts
    for (const material of this.fieldMaterials) material.uniforms.uTime.value = elapsed;
```

- [x] **Step 7: Run it and make sure it passes**

Run: `npx vitest run src/components/world/__tests__/field.test.ts`
Expected: PASS — 7 tests.

Run: `npm test && npm run lint`
Expected: PASS. `cullAndClock.test.ts` and `density.test.ts` both exercise the
field's draw ranges and must stay green.

- [x] **Step 8: Commit**

```bash
git add src/components/world/FieldShader.ts src/components/world/WorldSceneBuilder.ts src/components/world/__tests__/field.test.ts
git commit -m "feat(motion): give the field a pulse, without moving a single point off its mark"
```

---

## Task 7: L3 — incline the moon orbits

**Files:**
- Modify: `src/lib/atlas/moons.ts`
- Modify: `src/components/world/WorldSceneBuilder.ts` (`buildMoons`)
- Test: `src/components/world/__tests__/inclination.test.ts`
- Test: `src/lib/atlas/__tests__/moons.test.ts` (append)

**Interfaces:**
- Consumes: `MAX_INCLINATION` from Task 1.
- Produces: `MoonPlacement` gains `inclination: number` (radians). The scene
  gains one `orbit:<moonId>` group per moon, holding that moon's orbit ring and
  its pivot together.

**Acceptance gate:** `surfaceCamera.test.ts` asserts the parent stays within 15°
off-axis from a landed pose. A moon frame rides its incline, so the landed
ground tilts with it. **If that assertion fails, lower `MAX_INCLINATION` in
`motion.ts` until it passes** — the ceiling is gated by the test, not chosen.

- [x] **Step 1: Write the failing test**

Create `src/components/world/__tests__/inclination.test.ts`:

```ts
// @vitest-environment jsdom
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { WorldSceneBuilder } from "../WorldSceneBuilder";
import { loadBodies } from "@/lib/atlas/bodies";
import { deriveMoons } from "@/lib/atlas/moons";
import { moonScopeId } from "@/lib/atlas/galaxy";
import { MAX_INCLINATION } from "@/lib/atlas/motion";

const bodies = loadBodies();
const moons = deriveMoons(bodies);

function built() {
  const scene = new THREE.Scene();
  const builder = new WorldSceneBuilder(scene, bodies, "2026-08-22", 1);
  builder.build();
  return builder;
}

describe("moon orbits are inclined", () => {
  it("bounds every inclination by the ceiling that gates the landed pose", () => {
    for (const moon of moons) {
      expect(Math.abs(moon.inclination)).toBeLessThanOrEqual(MAX_INCLINATION + 1e-9);
    }
  });

  it("fans an arm's moons apart rather than tilting them together", () => {
    // Same reason `phase` is fanned across the set: only knowing the neighbours
    // can guarantee they do not stack.
    const products = moons.filter((m) => m.arm === "products");
    expect(products.length).toBeGreaterThan(1);
    expect(new Set(products.map((m) => m.inclination.toFixed(9))).size).toBe(products.length);
  });

  it("lifts a moon off its planet's plane", () => {
    const builder = built();
    // A quarter turn puts an inclined orbit at its greatest elevation.
    for (let i = 0; i < 120; i++) builder.update(i, 1);
    const lifted = moons.filter((moon) => {
      const group = builder.groupFor(moonScopeId(moon.id));
      const planet = builder.groupFor(`planet:${moon.arm}`);
      group.updateWorldMatrix(true, false);
      planet.updateWorldMatrix(true, false);
      const dy =
        new THREE.Vector3().setFromMatrixPosition(group.matrixWorld).y -
        new THREE.Vector3().setFromMatrixPosition(planet.matrixWorld).y;
      return Math.abs(dy) > 0.05;
    });
    expect(lifted.length).toBeGreaterThan(0);
  });

  it("draws each orbit ring on the plane its moon actually travels", () => {
    // The ring and the pivot share one inclined group, so the drawn path is the
    // path. A flat ring under an inclined moon is a map that lies.
    const builder = built();
    for (const moon of moons) {
      const group = builder.groupFor(moonScopeId(moon.id));
      let orbit: THREE.Object3D | null = group.parent;
      while (orbit && !orbit.name.startsWith("orbit:")) orbit = orbit.parent;
      expect(orbit).not.toBeNull();
      expect(orbit!.getObjectByName(`orbit-ring:${moon.id}`)).toBeDefined();
    }
  });
});
```

- [x] **Step 2: Run it to make sure it fails**

Run: `npx vitest run src/components/world/__tests__/inclination.test.ts`
Expected: FAIL — `moon.inclination` is `undefined`.

- [x] **Step 3: Derive the inclination**

In `src/lib/atlas/moons.ts`, add to the import line:

```ts
import { MAX_INCLINATION } from "./motion";
```

Add the field to `MoonPlacement`, below `rate`:

```ts
  /**
   * Radians the orbit plane tilts off its planet's own. Fanned across the arm's
   * moons, not authored and not hashed — the same rule `phase` follows, and for
   * the same reason: only knowing the neighbours can guarantee they do not
   * stack. Fanning also separates the labels in depth, which a shared tilt
   * would not.
   */
  inclination: number;
```

Inside the `systems.forEach` callback, add to the pushed object:

```ts
        // `t` already runs 0..1 across the arm's set. Mapped to -1..1 so the
        // fan straddles the planet's plane rather than leaning off one side.
        inclination: MAX_INCLINATION * (systems.length === 1 ? 0 : t * 2 - 1),
```

- [x] **Step 4: Hang the ring and the pivot on one inclined group**

In `src/components/world/WorldSceneBuilder.ts`, in `buildMoons`, replace:

```ts
      const group = this.groupFor(planetScopeId(moon.arm));
      // The orbit line is drawn flat and the moon rides it, so the path a
      // visitor sees is the path the moon is actually on.
      const orbitRing = this.addHairlineRing(group, orbitRadius, 0.4, DIRECTION_A.rule);

      const pivot = new THREE.Group();
      pivot.rotation.y = moon.phase;
```

with:

```ts
      const group = this.groupFor(planetScopeId(moon.arm));

      // Ring and pivot together on one inclined group, so the path a visitor
      // sees is the path the moon is actually on. The inclination goes HERE and
      // not on the planet scope group: that group is the frame the camera
      // descends into, and `moonFrames.test.ts` pins that a moon group's local
      // -X points at its planet whatever the phase — a property a frame riding
      // its own inclined orbit holds exactly (dot = 1.000000 at every phase)
      // and a counter-levelled one loses (0.978148 at ninety degrees).
      const orbit = new THREE.Group();
      orbit.name = `orbit:${moon.id}`;
      orbit.rotation.z = moon.inclination;
      group.add(orbit);

      const orbitRing = this.addHairlineRing(orbit, orbitRadius, 0.4, DIRECTION_A.rule);
      orbitRing.name = `orbit-ring:${moon.id}`;

      const pivot = new THREE.Group();
      pivot.rotation.y = moon.phase;
```

and replace the later `group.add(pivot);` with:

```ts
      orbit.add(pivot);
```

- [x] **Step 5: Run the new test, then the acceptance gate**

Run: `npx vitest run src/components/world/__tests__/inclination.test.ts`
Expected: PASS — 4 tests.

Run: `npx vitest run src/components/world/__tests__/surfaceCamera.test.ts src/components/world/__tests__/moonFrames.test.ts`
Expected: PASS, **unmodified**. If the 15°-off-axis assertion in
`surfaceCamera.test.ts` fails, lower `MAX_INCLINATION` in
`src/lib/atlas/motion.ts` (try 8°, then 6°) and re-run until it passes. Do not
edit the assertion.

- [x] **Step 6: Run the full suite**

Run: `npm test && npm run lint`
Expected: PASS, including `sceneParity.test.ts` — moons are drawn by
`bodySprites`, so an inclination that moved a moon's *build-time* position would
fail the golden. It does not: the orbit group's rotation is applied about the
planet's centre and the moon starts at phase zero on the inclined circle.

- [x] **Step 7: Commit**

```bash
git add src/lib/atlas/moons.ts src/components/world/WorldSceneBuilder.ts src/components/world/__tests__/inclination.test.ts
git commit -m "feat(motion): incline each moon's orbit, and draw the ring on it"
```

---

## Task 8: L1a — the pattern turns, the sky does not

**Files:**
- Modify: `src/components/world/WorldSceneBuilder.ts` (`buildBackgroundField`,
  new `skyShell` field, `update`)
- Test: `src/components/world/__tests__/patternRotation.test.ts`

**Interfaces:**
- Consumes: `patternAngle`, `PATTERN_PERIOD_SECONDS` from Task 1.
- Produces: `rootGroup.rotation.y` is driven by `patternAngle(elapsed)`;
  `background-field` carries the negation.

**Read Trap 2 above before starting.**

- [x] **Step 1: Write the failing test**

Create `src/components/world/__tests__/patternRotation.test.ts`:

```ts
// @vitest-environment jsdom
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { WorldSceneBuilder } from "../WorldSceneBuilder";
import { loadBodies } from "@/lib/atlas/bodies";
import { PATTERN_PERIOD_SECONDS, patternAngle } from "@/lib/atlas/motion";

const bodies = loadBodies();

function built() {
  const scene = new THREE.Scene();
  const builder = new WorldSceneBuilder(scene, bodies, "2026-08-22", 1);
  builder.build();
  return builder;
}

/** Every drawn body's world position, after `seconds` of the render loop. */
function positionsAfter(builder: WorldSceneBuilder, seconds: number) {
  builder.update(seconds, seconds);
  builder.rootGroup.updateMatrixWorld(true);
  return new Map(
    [...builder.bodySprites.entries()].map(([id, object]) => [
      id,
      object.getWorldPosition(new THREE.Vector3()),
    ]),
  );
}

describe("the pattern turns", () => {
  it("turns the galaxy at the derived rate", () => {
    const builder = built();
    builder.update(120, 120);
    expect(builder.rootGroup.rotation.y).toBeCloseTo(patternAngle(120), 9);
  });

  it("moves the bodies", () => {
    const builder = built();
    const before = positionsAfter(builder, 0);
    const after = positionsAfter(builder, 300);
    const moved = [...after].filter(([id, p]) => p.distanceTo(before.get(id)!) > 1);
    expect(moved.length).toBeGreaterThan(bodies.length / 2);
  });

  it("holds the sky still, or the rotation cancels and ships as a still image", () => {
    // The 12,000-point shell is a child of rootGroup. Rotating the root without
    // countering the shell rotates the reference with the content, and the two
    // cancel to zero perceived motion — a bug invisible to code review and to
    // every placement test.
    const builder = built();
    const shell = builder.rootGroup.getObjectByName("background-field")!;
    const sample = (): THREE.Vector3 => {
      builder.rootGroup.updateMatrixWorld(true);
      const geometry = (shell as THREE.Points).geometry;
      const local = new THREE.Vector3().fromBufferAttribute(geometry.getAttribute("position"), 0);
      return local.applyMatrix4(shell.matrixWorld);
    };
    const before = sample();
    builder.update(600, 600);
    expect(sample().distanceTo(before)).toBeLessThan(1e-6);
  });
});

describe("the pattern is rigid", () => {
  it("changes no body's distance from the core", () => {
    // Radius is time. If a radius changes, the map has started lying.
    const builder = built();
    const before = positionsAfter(builder, 0);
    const after = positionsAfter(builder, 900);
    for (const [id, position] of after) {
      const was = Math.hypot(before.get(id)!.x, before.get(id)!.z);
      const now = Math.hypot(position.x, position.z);
      expect(now).toBeCloseTo(was, 6);
    }
  });

  it("changes no angle between any two bodies", () => {
    // Angle is which arm. Differential rotation would shear these apart; this
    // assertion is what makes "rigid" a fact rather than an intention.
    const builder = built();
    const before = positionsAfter(builder, 0);
    const after = positionsAfter(builder, 900);
    const ids = [...after.keys()];
    const bearing = (p: THREE.Vector3) => Math.atan2(p.z, p.x);
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const was = bearing(before.get(ids[i])!) - bearing(before.get(ids[j])!);
        const now = bearing(after.get(ids[i])!) - bearing(after.get(ids[j])!);
        const drift = Math.atan2(Math.sin(now - was), Math.cos(now - was));
        expect(Math.abs(drift)).toBeLessThan(1e-6);
      }
    }
  });

  it("returns the galaxy to where it started after one period", () => {
    const builder = built();
    const before = positionsAfter(builder, 0);
    const after = positionsAfter(builder, PATTERN_PERIOD_SECONDS);
    for (const [id, position] of after) {
      expect(position.distanceTo(before.get(id)!)).toBeLessThan(0.01);
    }
  });

  it("does not turn with the transport clock", () => {
    // Spec §3.11. The clock decides only WHAT IS DRAWN; motion decides only
    // which way things face. Coupling them was rejected because the transport
    // parks at today, which would leave the galaxy still in exactly the state
    // this work exists to fix.
    const builder = built();
    builder.update(120, 120);
    const turned = builder.rootGroup.rotation.y;
    builder.setClockDay(0);
    expect(builder.rootGroup.rotation.y).toBe(turned);
    builder.setClockDay(100000);
    expect(builder.rootGroup.rotation.y).toBe(turned);
  });
});
```

- [x] **Step 2: Run it to make sure it fails**

Run: `npx vitest run src/components/world/__tests__/patternRotation.test.ts`
Expected: FAIL — `rootGroup.rotation.y` stays 0.

- [x] **Step 3: Keep a handle on the sky shell**

In `src/components/world/WorldSceneBuilder.ts`, add the import:

```ts
import { patternAngle } from "@/lib/atlas/motion";
```

Add the field beside `armDustGeometry`:

```ts
  /**
   * The 12,000-point sky. Held because it is a child of `rootGroup` and must be
   * counter-rotated: rotation is only perceptible against something that is not
   * rotating, and without this the pattern and its own reference cancel.
   */
  private skyShell: THREE.Points | null = null;
```

In `buildBackgroundField`, inside the `layer` helper, immediately after
`points.name = name;`:

```ts
      if (name === "background-field") this.skyShell = points;
```

- [x] **Step 4: Turn the pattern in `update`**

At the top of `update`, before the corona rings:

```ts
    // L1. One angle for the whole galaxy: rigid, so no relative angle between
    // any two bodies changes and no radius does. That is what lets the map keep
    // claiming that angle means arm and radius means time.
    const pattern = patternAngle(elapsed);
    this.rootGroup.rotation.y = pattern;
    // The sky is the fixed reference the pattern is seen against. It rides the
    // root like everything else, so it has to be given the rotation back.
    if (this.skyShell) this.skyShell.rotation.y = -pattern;
```

- [x] **Step 5: Run it and make sure it passes**

Run: `npx vitest run src/components/world/__tests__/patternRotation.test.ts`
Expected: PASS — 7 tests.

Run: `npm test`
Expected: PASS. `sceneParity.test.ts` must be green — it captures before
`update()` is called, so the pattern angle is still zero when the golden is
read.

- [x] **Step 6: Commit**

```bash
git add src/components/world/WorldSceneBuilder.ts src/components/world/__tests__/patternRotation.test.ts
git commit -m "feat(motion): wheel the galaxy against a sky that stays put"
```

---

## Task 9: L1b — positions that are read, not remembered

**Files:**
- Modify: `src/components/world/WorldSceneBuilder.ts` (`hitObjects` for moons
  and planets)
- Modify: `src/components/world/WorldCanvas.tsx` (planet pin projection)
- Test: `src/components/world/__tests__/patternRotation.test.ts` (append)

**Interfaces:**
- Consumes: Task 8's rotating root.
- Produces: `InteractiveHitObject.position` is a getter reading
  `mesh.matrixWorld`, so it stays true under motion. `WorldCanvas` reads planet
  pin anchors from `builder.groupFor(...)` rather than from `PLANET_CENTERS`.

- [x] **Step 1: Write the failing test**

Append to `src/components/world/__tests__/patternRotation.test.ts`:

```ts
import { moonScopeId } from "@/lib/atlas/galaxy";
import { deriveMoons } from "@/lib/atlas/moons";

describe("positions are read, not remembered", () => {
  it("keeps a moon's hit position on the moon after it has travelled", () => {
    const builder = built();
    builder.update(300, 300);
    builder.rootGroup.updateMatrixWorld(true);
    for (const moon of deriveMoons(bodies)) {
      const hit = builder.hitObjects.find((h) => h.id === moon.id && h.type === "body")!;
      const group = builder.groupFor(moonScopeId(moon.id));
      const world = group.getWorldPosition(new THREE.Vector3());
      expect(hit.position.distanceTo(world)).toBeLessThan(0.001);
    }
  });

  it("keeps a planet's hit position on the planet after the pattern has turned", () => {
    const builder = built();
    const before = builder.hitObjects
      .find((h) => h.type === "planet" && h.id === "products")!
      .position.clone();
    builder.update(600, 600);
    builder.rootGroup.updateMatrixWorld(true);
    const hit = builder.hitObjects.find((h) => h.type === "planet" && h.id === "products")!;
    expect(hit.position.distanceTo(before)).toBeGreaterThan(1);
    const group = builder.groupFor("planet:products");
    const world = group.getWorldPosition(new THREE.Vector3());
    expect(Math.hypot(hit.position.x - world.x, hit.position.z - world.z)).toBeLessThan(0.001);
  });
});
```

- [x] **Step 2: Run it to make sure it fails**

Run: `npx vitest run src/components/world/__tests__/patternRotation.test.ts -t "read, not remembered"`
Expected: FAIL — the frozen position no longer matches the moved world position.

- [x] **Step 3: Make `position` a getter on the moon and planet hit objects**

In `src/components/world/WorldSceneBuilder.ts`, in `buildMoons`, replace:

```ts
      moonGroup.updateWorldMatrix(true, false);
      this.hitObjects.push({
        id: moon.id,
        name: moon.label,
        type: "body",
        mesh: pickSphere,
        position: new THREE.Vector3().setFromMatrixPosition(moonGroup.matrixWorld),
      });
```

with:

```ts
      moonGroup.updateWorldMatrix(true, false);
      const moonAnchor = new THREE.Vector3();
      this.hitObjects.push({
        id: moon.id,
        name: moon.label,
        type: "body",
        mesh: pickSphere,
        // Read, not remembered. A moon orbits and the galaxy turns, so a
        // position captured at build time is stale by the first frame — and
        // `descend()` aiming at a stale position is the bug this fixes.
        get position() {
          moonGroup.updateWorldMatrix(true, false);
          return moonAnchor.setFromMatrixPosition(moonGroup.matrixWorld);
        },
      });
```

In `buildPlanetarySpheres`, replace:

```ts
      this.hitObjects.push({
        id: planet.arm,
        name: `Planet ${planet.arm[0].toUpperCase()}${planet.arm.slice(1)}`,
        type: "planet",
        mesh: pickSphere,
        position: new THREE.Vector3(center.x, PLANET_Y, center.z),
      });
```

with:

```ts
      const planetAnchor = new THREE.Vector3();
      this.hitObjects.push({
        id: planet.arm,
        name: `Planet ${planet.arm[0].toUpperCase()}${planet.arm.slice(1)}`,
        type: "planet",
        mesh: pickSphere,
        get position() {
          pickSphere.updateWorldMatrix(true, false);
          return planetAnchor.setFromMatrixPosition(pickSphere.matrixWorld);
        },
      });
```

- [x] **Step 4: Project the pins from the scene graph**

In `src/components/world/WorldCanvas.tsx`, replace the `planetPins` array and
its `forEach` with a version that reads live world positions. The per-planet Y
values are the authored heights the pins float at and stay as they are; only x
and z now come from the scene:

```ts
        // Heights are authored — how high the pin floats above its planet. The
        // horizontal position is read from the scene graph every frame, because
        // the pattern turns and a constant would leave the pins behind.
        const pinHeights: Record<string, number> = {
          galaxy: 8.8,
          self: 5.8,
          foundations: 6.2,
          products: 7.8,
          labs: 6.8,
          creative: 5.6,
        };

        const anchor = new THREE.Vector3();
        for (const [id, height] of Object.entries(pinHeights)) {
          // The core is the galaxy's own origin, which the pattern turns about,
          // so it is the one anchor that never moves.
          const group = id === "galaxy" ? sceneBuilder.rootGroup : sceneBuilder.groupFor(`planet:${id}`);
          group.getWorldPosition(anchor);
          const p = projectToScreen(new THREE.Vector3(anchor.x, height, anchor.z), cam, width, height);
          if (p.depth < 1) {
            points.push({ id, x: p.x, y: p.y, visible: true, depth: p.depth });
          }
        }
```

Remove `PLANET_CENTERS` from the import on line 11 if nothing else in the file
uses it. `PLANET_RADII` is still used by `framedRadius` and stays.

- [x] **Step 5: Run it and make sure it passes**

Run: `npx vitest run src/components/world/__tests__/patternRotation.test.ts`
Expected: PASS — 9 tests.

Run: `npm test && npm run lint`
Expected: PASS. `moonFrames.test.ts`'s "carries the moon's own position" case
must still pass — the getter returns the same value at build time that the
frozen vector did.

- [x] **Step 6: Commit**

```bash
git add src/components/world/WorldSceneBuilder.ts src/components/world/WorldCanvas.tsx src/components/world/__tests__/patternRotation.test.ts
git commit -m "feat(motion): read positions off the scene rather than remembering them"
```

---

## Task 10: L1c — descend onto a moving frame

**Files:**
- Modify: `src/components/world/WorldCameraManager.ts` (`descend`, `ascend`,
  `setPreset`, `update`)
- Test: `src/components/world/__tests__/descent.test.ts` (append)

**Interfaces:**
- Consumes: Task 8's rotating root.
- Produces: `WorldCameraManager` keeps a `descended: { frame, radius } | null`
  and re-derives the desired pose from that frame's world matrix every
  `update()`.

**Why:** `descend()` calls `target.getWorldPosition()` once and freezes the
pose. Moons already orbit today, so clicking a moon flies the camera to where
it *was* at the moment of the click. L1 makes this bad for planets too.

- [x] **Step 1: Write the failing test**

Append to `src/components/world/__tests__/descent.test.ts`:

```ts
describe("descending onto something that moves", () => {
  it("follows the frame rather than the place the frame used to be", () => {
    const scene = new THREE.Scene();
    const manager = new WorldCameraManager(1200, 800);
    const frame = new THREE.Group();
    frame.position.set(100, 0, 0);
    scene.add(frame);

    manager.descend(frame, 6);
    for (let i = 0; i < 60; i++) manager.update(1 / 60);
    const framedFirst = manager.target.clone();
    expect(framedFirst.distanceTo(new THREE.Vector3(100, 0, 0))).toBeLessThan(6);

    // The frame travels, as an orbiting moon or a turning galaxy carries it.
    frame.position.set(-100, 0, 40);
    frame.updateWorldMatrix(true, false);
    for (let i = 0; i < 180; i++) manager.update(1 / 60);

    expect(manager.target.distanceTo(new THREE.Vector3(-100, 0, 40))).toBeLessThan(6);
    expect(manager.target.distanceTo(framedFirst)).toBeGreaterThan(50);
  });

  it("lets go of the frame when the camera ascends", () => {
    const scene = new THREE.Scene();
    const manager = new WorldCameraManager(1200, 800);
    const frame = new THREE.Group();
    frame.position.set(100, 0, 0);
    scene.add(frame);

    manager.descend(frame, 6);
    for (let i = 0; i < 60; i++) manager.update(1 / 60);
    manager.ascend();
    for (let i = 0; i < 240; i++) manager.update(1 / 60);

    frame.position.set(-100, 0, 40);
    frame.updateWorldMatrix(true, false);
    for (let i = 0; i < 60; i++) manager.update(1 / 60);
    // Back at the galaxy pose, which is the origin — not chasing the frame.
    expect(manager.target.length()).toBeLessThan(1);
  });
});
```

- [x] **Step 2: Run it to make sure it fails**

Run: `npx vitest run src/components/world/__tests__/descent.test.ts -t "something that moves"`
Expected: FAIL — the target stays near the frame's original position.

- [x] **Step 3: Hold the frame instead of a snapshot of it**

In `src/components/world/WorldCameraManager.ts`, add the field beside `surface`:

```ts
  /**
   * The frame the camera is FRAMING, or null when it is not framing one.
   *
   * Held rather than snapshotted for the same reason `surface` is: `descend`
   * used to read `getWorldPosition()` once and freeze the pose, so flying to an
   * orbiting moon aimed at where the moon had been at the moment of the click.
   * A turning galaxy makes that true of planets too.
   */
  private descended: { frame: THREE.Object3D; radius: number } | null = null;
```

Replace `descend` with:

```ts
  public descend(target: THREE.Object3D, radius: number): void {
    this.surface = null;
    this.descended = { frame: target, radius };
    this.setFrameScale(radius);
    this.aimAtDescendedFrame();
  }

  /** Re-derive the desired pose from the frame's CURRENT world matrix. */
  private aimAtDescendedFrame(): void {
    if (!this.descended) return;
    const { frame, radius } = this.descended;
    frame.updateWorldMatrix(true, false);
    const center = new THREE.Vector3().setFromMatrixPosition(frame.matrixWorld);
    this.desiredPose.position.set(center.x, radius * 3.6, center.z + radius * 4.8);
    this.desiredPose.target.set(center.x, radius * 0.3, center.z);
    const offset = new THREE.Vector3().subVectors(this.desiredPose.position, this.desiredPose.target);
    this.sphericalTarget.setFromVector3(offset);
    if (this.reducedMotion) this.snap();
  }
```

Clear it wherever the camera stops framing that object. In `ascend`:

```ts
  public ascend(): void {
    this.surface = null;
    this.descended = null;
    this.setFrameScale(ASTROLABE_OUTER);
    this.setPreset("galaxy");
  }
```

and in `landOnSurface`, beside `this.surface = { frame };`:

```ts
    this.descended = null;
```

At the top of `setPreset`, so an explicit preset always wins:

```ts
    this.descended = null;
```

**Note:** `descend` sets `this.descended` and then calls `aimAtDescendedFrame`,
which does not go through `setPreset` — that is deliberate, since `setPreset`
now clears the field.

Finally, re-aim every frame. In `update`, immediately after the `if (this.surface) { ... return; }`
block:

```ts
    // The frame may have travelled since the descent began — an orbiting moon,
    // or the whole pattern turning. Re-derive rather than lerp toward a stale point.
    this.aimAtDescendedFrame();
```

- [x] **Step 4: Run it and make sure it passes**

Run: `npx vitest run src/components/world/__tests__/descent.test.ts`
Expected: PASS — all existing cases plus the 2 new ones.

Run: `npm test && npm run lint`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/components/world/WorldCameraManager.ts src/components/world/__tests__/descent.test.ts
git commit -m "fix(camera): aim at the frame, not at where the frame was"
```

---

## Task 11: Reduced motion removes travel, never orientation

**Files:**
- Modify: `src/components/world/WorldSceneBuilder.ts` (constructor,
  `update`)
- Modify: `src/components/world/WorldCanvas.tsx` (pass the flag)
- Test: `src/components/world/__tests__/patternRotation.test.ts` (append)

**Interfaces:**
- Consumes: Tasks 2, 3, 6, 8.
- Produces: `new WorldSceneBuilder(scene, bodies, today, fieldDensity, reducedMotion?)`
  — a fifth optional parameter, defaulting to `false` so every existing call
  site and test is unchanged.

- [x] **Step 1: Write the failing test**

Append to `src/components/world/__tests__/patternRotation.test.ts`:

```ts
import { obliquityFor } from "@/lib/atlas/motion";

describe("reduced motion", () => {
  function still() {
    const scene = new THREE.Scene();
    const builder = new WorldSceneBuilder(scene, bodies, "2026-08-22", 1, true);
    builder.build();
    return builder;
  }

  it("stops the pattern", () => {
    const builder = still();
    builder.update(900, 900);
    expect(builder.rootGroup.rotation.y).toBe(0);
  });

  it("stops the field", () => {
    const builder = still();
    const dust = builder.rootGroup.getObjectByName("arm-dust") as THREE.Points;
    builder.update(900, 900);
    expect((dust.material as THREE.ShaderMaterial).uniforms.uTime.value).toBe(0);
  });

  it("keeps the tilt, because orientation is content and not travel", () => {
    const builder = still();
    const mesh = builder.rootGroup.getObjectByName("planet-surfaces") as THREE.InstancedMesh;
    const m = new THREE.Matrix4();
    mesh.getMatrixAt(builder.planetInstanceIndex("products"), m);
    const q = new THREE.Quaternion();
    m.decompose(new THREE.Vector3(), q, new THREE.Vector3());
    const pole = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    expect(pole.angleTo(new THREE.Vector3(0, 1, 0))).toBeCloseTo(
      obliquityFor("products").magnitude,
      6,
    );
  });
});
```

- [x] **Step 2: Run it to make sure it fails**

Run: `npx vitest run src/components/world/__tests__/patternRotation.test.ts -t "reduced motion"`
Expected: FAIL — the pattern still turns.

- [x] **Step 3: Take the flag and gate the travelling layers**

In `src/components/world/WorldSceneBuilder.ts`, add the constructor parameter
after `fieldDensity`:

```ts
    /**
     * OS-level `prefers-reduced-motion`. Read once, at construction, exactly as
     * `WorldCameraManager` reads it.
     *
     * Removes travel, never content: L1, L4 and L5 stop, and the axial tilt
     * stays — a tilt is orientation, and turning it off would delete something
     * a visitor can see rather than something that moves.
     */
    private reducedMotion = false,
```

In `update`, guard the two travelling layers. Replace the L1 block from Task 8
with:

```ts
    const pattern = this.reducedMotion ? 0 : patternAngle(elapsed);
    this.rootGroup.rotation.y = pattern;
    if (this.skyShell) this.skyShell.rotation.y = -pattern;
```

and the field clock from Task 6 with:

```ts
    const fieldTime = this.reducedMotion ? 0 : elapsed;
    for (const material of this.fieldMaterials) material.uniforms.uTime.value = fieldTime;
```

- [x] **Step 4: Pass it in, and stop the sun too**

In `src/components/world/WorldCanvas.tsx`, find where `WorldSceneBuilder` is
constructed and where the reduced-motion preference is already read for
`WorldCameraManager`. Pass the same value as the fifth argument, and tell the
day/night controller:

```ts
      dayNight.setReducedMotion(prefersReducedMotion);
```

- [x] **Step 5: Run it and make sure it passes**

Run: `npx vitest run src/components/world/__tests__/patternRotation.test.ts`
Expected: PASS — 12 tests.

Run: `npm test && npm run lint`
Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add src/components/world/WorldSceneBuilder.ts src/components/world/WorldCanvas.tsx src/components/world/__tests__/patternRotation.test.ts
git commit -m "feat(motion): honour reduced motion by removing travel, not orientation"
```

---

## Task 12: The one number a visitor actually experiences

**Files:**
- Test: `src/components/world/__tests__/patternRotation.test.ts` (append)

**Interfaces:**
- Consumes: `PATTERN_RATE` from Task 1, `ASTROLABE_OUTER` from
  `WorldCameraManager`.
- Produces: nothing. This is a regression guard.

**Why:** every argument in the spec rests on one measurement — 2.53 px/s at the
rim at the derived galaxy pose. Too slow and the work ships invisible; too fast
and pins slide out from under the pointer, which the orrery already hit once.
Neither failure is caught by any other test.

- [x] **Step 1: Write the test**

Append to `src/components/world/__tests__/patternRotation.test.ts`:

```ts
import { PATTERN_RATE } from "@/lib/atlas/motion";
import { ASTROLABE_OUTER } from "../WorldCameraManager";

describe("the pattern is perceptible, and no faster", () => {
  /**
   * Pixels per scene unit at the derived galaxy pose: the camera sits at
   * (0, 0.9R, 1.12R) looking at the origin, with a 42-degree vertical FOV, on
   * an 800 px viewport. This is the framing every visitor lands on.
   */
  const CAMERA_DISTANCE = Math.hypot(ASTROLABE_OUTER * 0.9, ASTROLABE_OUTER * 1.12);
  const VIEWPORT_HEIGHT = 800;
  const FOV = (42 * Math.PI) / 180;
  const PX_PER_UNIT = VIEWPORT_HEIGHT / (2 * CAMERA_DISTANCE * Math.tan(FOV / 2));

  it("moves the rim fast enough to see", () => {
    // Smooth-motion detection sits near 1 px/s. Below it a visitor registers
    // that something HAS moved but never sees it moving.
    const speed = PATTERN_RATE * ASTROLABE_OUTER * PX_PER_UNIT;
    expect(speed).toBeGreaterThan(1.5);
  });

  it("moves the rim slowly enough to click", () => {
    // A planet pin is on the order of 100 px wide. ORRERY_RATE was cut from
    // 0.28 to 0.1 because a bead "slid out from under the pointer"; this is the
    // same failure mode one altitude up.
    const speed = PATTERN_RATE * ASTROLABE_OUTER * PX_PER_UNIT;
    expect(speed).toBeLessThan(4);
    expect(100 / speed).toBeGreaterThan(25);
  });
});
```

- [x] **Step 2: Run it and make sure it passes**

Run: `npx vitest run src/components/world/__tests__/patternRotation.test.ts -t "perceptible"`
Expected: PASS — 2 tests, with the measured speed at about 2.53 px/s.

- [x] **Step 3: Run the whole suite and the linter one last time**

Run: `npm test && npm run lint`
Expected: PASS.

- [x] **Step 4: Commit**

```bash
git add src/components/world/__tests__/patternRotation.test.ts
git commit -m "test(motion): guard the one number a visitor actually experiences"
```

---

## Verification after every task

`sceneParity.test.ts` is the standing gate. It captures world positions **before
`update()`**, so it proves that no task has moved a body's *placement* — only
how it is oriented and which way the whole pattern is turned. **Never regenerate
the golden during this work.** If it fails, a task has moved something it had no
business moving.
