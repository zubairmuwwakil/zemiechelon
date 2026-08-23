# Zemí Surface — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make landing mean standing on a surface — a camera that comes down onto a ground plane, sits low, looks across, orbits a point on it, and holds its parent in frame while that frame moves.

**Architecture:** The landed pose is stored in the *frame's own local space* and multiplied by the frame's world matrix each update, so a moon that orbits carries its camera with it and the moon→parent bearing is constant by construction. Every `kind: "system"` body gains a scope and a group, so moons are frames by rule rather than by special case. The camera's clipping and orbit limits stop being absolute constants and become functions of the framed radius. Only PickMe and Products declare a surface; the other three systems are flybys.

**Tech Stack:** Next.js 16 (App Router) · React 19 · TypeScript · three.js 0.185 · Tailwind CSS v4 · Vitest 3 · @testing-library/react

**Spec:** `docs/superpowers/specs/2026-08-21-zemi-surface-design.md` (which amends `docs/superpowers/specs/2026-08-20-zemi-world-design.md` §6, §7)

**Measurements:** Every number in this plan was measured by the throwaway spike of 2026-08-22, not chosen. See the Measured Constants section — nothing there is a guess, and nothing there should be re-derived by an implementer.

## Global Constraints

- **Position is derived, never authored.** No body, planet, moon, prop or scope carries a hardcoded coordinate. The prop *vocabulary* is authored; the *arrangement* is derived from the bodies in the scope (spec §7 risk 1).
- **`placeBodies()` is not modified.** Only its frame source changes.
- **Scene parity holds.** `sceneParity.test.ts` must pass unchanged after every task. Any task that moves an existing body on screen has failed.
- **Nothing assumes the galaxy is the root.** Every camera and scope signature takes an arbitrary parent/child pair, so a `universe` root lands later as data.
- **`prefers-reduced-motion` removes travel, never content.**
- **Direction A palette, exact values:** ground `#F7F6F2`, ink `#1B1A17`, gold `#B8860B`, verdigris `#0B6B4F`, oxide `#8C3B2E`, rule `#D3CEC0`. Import from `src/lib/theme/directionA.ts`; never retype a hex.
- **Direction C is out of scope.** Night mode ships later. Do not add C tokens.
- **The five planets stay one `InstancedMesh`.** Spec §5.4 of the world design chose that deliberately. Culling is per-instance, not per-mesh. Do not split it.
- **Only the 5 shipped systems reparent.** Products' other 7 repositories keep `parent: "galaxy:zemi"` and stay drawn on the arm. Rendering them on the surface is level of detail, not reparenting (spec §8).
- **Nothing new is exported from `src/lib/engines/pickme/index.ts`.** `publicSurface.test.ts` pins that list deliberately. This plan does not touch the engine.
- **Rover, locomotion and pathfinding are cut, not deferred** (spec §8). The visitor never walks.
- Run the full suite with `npm test`. Lint with `npm run lint` (`--max-warnings 0`).
- Test environment is `node` by default; a test needing a DOM puts `// @vitest-environment jsdom` on line 1. This works in `.ts` files, not only `.tsx`.

---

## Measured Constants

These came out of the spike. They are inputs to this plan, not decisions for an implementer to revisit. All lengths are **scene units**.

| Constant | Value | Where it comes from |
|---|---|---|
| `SCENE_SCALE` | 10.5316 | `ASTROLABE_OUTER / deriveWorldRadius(bodies)` — already exists |
| Products' drawn radius | 5.9194 | `derivePlanets` — already exists |
| PickMe's drawn radius | 2.0124 | `planet.radius × MOON_SIZE` (0.34) |
| PickMe's orbit | 33.15 | `MOON_ORBIT.outer` = 5.6 planet radii |
| Moon orbit lane gap | 4.735 | Even spacing of Products' four moons |
| **Surface altitude ratio** | **0.10 × shard radius** | Measured — pitch 8.7°, horizon 39% down frame |
| **Surface offset ratio** | **0.65 × shard radius** | Measured — camera stands inside the shard's footprint |
| **Resulting pitch** | **8.7°** below horizontal | Band 5°–12°; hard ceiling 21° (= fov/2) |
| **Shard radius** | **1.5 × the body's drawn radius** | Band 1.25×–2.24×; floor is the near plane, ceiling is the orbit lane |
| **Parent frame-fraction floor** | **0.30** of viewport height | Below this the parent stops being *the* body in frame |
| Ground distance at frame bottom | `0.202 × shard radius` | `h / sin(pitch + fov/2)` — this is what the near plane must clear |

**Two derived rules an implementer needs:**

1. `pitch = 90° − polarAngle`, and the horizon sits near the frame's midline when `pitch ≈ atan(h / (x + R))`. Picking `h/R` fixes everything else.
2. The parent's disc spans `parentRadius / (distance × tan(fov/2))` of viewport **height**. At fov 42° that is `parentRadius / (0.3839 × distance)`.

---

## Two decisions the spec leaves open — resolved here

### A. What "the parent" means from a planet's surface

Spec §3.2 makes the parent staying in view a hard requirement. From **PickMe's** surface the parent is Products: radius 5.9194 at distance 35.76, frame fraction **0.431**. Comfortable.

From **Products'** surface the parent is the galaxy, whose only body is the core: radius 7.5 (`CORE_RADIUS`) at distance 114.9 (`|PLANET_CENTERS.products|`). Frame fraction **0.170** — below the 0.30 floor. **A planet's surface cannot satisfy §3.2 by framing a sphere.**

**Resolution:** at planet level the parent frame is the galaxy *as an instrument*, not as a body. The landed pose on a planet orients the camera toward the galactic centre, so the core, the astrolabe rings and the arms sweeping away behind it are all in shot. The test asserts the **core's direction is within the frustum**, not that it occupies 30% of frame height. Task 9 encodes this.

### B. Voluntary look-away is not the failure §3.2 is about

The spike measured that a user can drag 120° and put the parent 115.1° off-axis. That frame is fine — it shows the galaxy core and an arm. The failure the previous spike hit was the camera drifting there **on its own**.

**Resolution:** no azimuth clamp. The camera test asserts the parent stays framed **while the frame moves and the user does not touch it**. Spec §6's line "the parent remains within the frustum" is implemented with that qualifier, or it fails on a legitimate drag.

---

## Ordering constraint — read before starting

**Tasks 1 and 2 must land before any surface work.** They are the blockers the spike found: without Task 1 the camera cannot get close enough to a shard to stand on it and clips the ground away beneath itself; without Task 2 culling the sky by scope deletes the parent you are required to keep.

Tasks 3–5 (moon frames, proxies, flybys) may run in any order after Task 2 and are independent of the surface.

Tasks 6–8 are strictly sequential and are the surface itself.

Tasks 9–10 depend on 6–8.

## Shippable checkpoints

| After task | What works |
|---|---|
| **2** | Descent at any depth stops clipping; culling by scope is possible. Nothing visible changes yet. |
| **5** | Every shipped system is a frame. Moons are reliably clickable. Tapping an unlanded moon opens its card. |
| **8** | **You can land on PickMe and the shot holds.** This is the spec's §4 moment minus the orrery. |
| **10** | Products' ground and the orrery. Track B complete. |

Stopping after 5 or after 8 leaves working, tested software.

## Suggested model and effort

| Task | Model | Effort | Why |
|---|---|---|---|
| 1 · Scope-relative camera depth | Opus 5 | high | Silent failure. A wrong near plane looks like missing geometry, not like a bug. |
| 2 · Per-instance planet culling | Sonnet 5 | medium | Mechanical once the instance-matrix approach is fixed. |
| 3 · Moon scopes derived | Sonnet 5 | medium | ~40 lines, mirrors `derivePlanetScopes` exactly. |
| 4 · Moon groups and hit proxies | Sonnet 5 | medium | Follows the planet pick-sphere pattern already in the file. |
| 5 · Flybys | Sonnet 5 | medium | State routing; the test is the deliverable. |
| 6 · Surface camera mode | **Opus 5** | **high** | The whole plan turns on this. Fails silently — assert on angles, never on screenshots. |
| 7 · The shard | Opus 5 | high | Derived arrangement from an authored vocabulary; watch the ratio (spec §7 risk 1). |
| 8 · Scope culling, fog, labels at depth | Opus 5 | high | Browser judgement and iteration. |
| 9 · Products' ground | Opus 5 | high | Seven props, derived placement, plus decision A above. |
| 10 · The orrery | **Opus 5** | **high** | A new interaction. Physical affordance that launches a flight. |

---

## File Structure

**Created**

| File | Responsibility |
|---|---|
| `src/lib/atlas/surfaces.ts` | Which scopes declare a surface, and the derived geometry of one: shard radius, prop ring radii, the landed pose ratios. Pure — no three.js. |
| `src/lib/atlas/__tests__/surfaces.test.ts` | One scope per shipped system; only PickMe and Products declare a surface; shard radius stays inside its measured band. |
| `src/components/world/SurfaceBuilder.ts` | Builds a shard and its props into a scope's group. Owns the authored vocabulary; takes the arrangement as data. |
| `src/components/world/__tests__/surfaceCamera.test.ts` | The §6 camera gate: a descended frame stays framed while its target moves, and the parent stays in the frustum untouched. |
| `src/components/world/__tests__/surfaceBuilder.test.ts` | Shard and prop placement is derived; prop count equals the scope's supporting bodies. |
| `src/components/world/Orrery.ts` | The tappable planet model that launches a flight to a moon. |
| `src/components/world/__tests__/orrery.test.ts` | Every moon of the planet is reachable, including ones behind it. |

**Modified**

| File | Change |
|---|---|
| `src/components/world/WorldCameraManager.ts` | Scope-relative near/far and orbit limits; `landOnSurface()`; tracked update path; `surfaceReadout()` for tests. |
| `src/components/world/WorldSceneBuilder.ts` | Moon groups registered as scopes; moon hit proxies; per-instance planet culling; `setScopeCull()`; mounts `SurfaceBuilder` and `Orrery`. |
| `src/components/world/WorldCanvas.tsx` | Routes moon clicks to flyby or landing; drives scope culling and surface fog from `landedScope`. |
| `src/components/world/DayNightController.ts` | Fog becomes a function of the framed scale rather than a day/night constant. |
| `src/lib/atlas/moons.ts` | Exports `moonScopeId`; `deriveMoons` unchanged. |
| `src/lib/atlas/scopes.ts` | Adds `deriveMoonScopes`; `SCOPES` includes them. |
| `src/app/page.tsx` | `landedScope` accepts a moon scope; flyby opens a `BodyCard` without entering a landed state. |

**Not modified**

| File | Why |
|---|---|
| `src/lib/atlas/position.ts` | `placeBodies` is untouched. Parity depends on it. |
| `src/lib/engines/pickme/*` | Track C. `publicSurface.test.ts` pins the export list. |
| `src/components/hud/LandedConsolePanel.tsx` | Survives as the narrow-viewport and reduced-motion fallback (spec §3.1). Track C rewires its contents. |

---

## Phase 0 — Depth

The two things the spike found broken. Neither changes anything visible; both are prerequisites for everything after.

### Task 1: Scope-relative camera depth

**Why:** `near = 0.5`, `minDistance = 15` and `maxDistance = 480` are galaxy-scale constants. A surface orbit radius is about 2, and the ground at the bottom of frame is `0.202 × shardRadius` away. At the recommended shard radius of 3.0 that is 0.61 — clearing `near = 0.5` by 0.11. Any smaller shard renders with a hole where the visitor's feet are. Dropping `near` globally to 0.05 is not obviously safe either, and `far` cannot simply shrink to compensate: standing on a moon, the galaxy core and the opposite arm are what you see when you turn away from the parent, and they are 90–300 units out.

**Measurement, resolved during this task:** planet framing renders clean — verified in the browser, no banding on arm dust, moons or rings. `near` uses a 0.06 coefficient because the binding constraint is the ground at `0.202 * radius`; 0.06 clears it 3.4x and does not spend depth precision it has no use for.

**Correction to the spike report:** the spike claimed that dropping `near` to 0.05 introduced z-fighting on a distant body. That was wrong. The striped sphere in that screenshot is the **Foundations planet** rendering its authored surface — `pattern: 0`, "banded sediment strata", base `ink` on accent `rule` — which aliases into black-and-white rings at small on-screen size. The camera had orbited between the two compared frames, so two different bodies were being compared. **There is no measured z-fighting anywhere in this scene**, and no case for a logarithmic depth buffer. Surface framing is still unverifiable until Task 6 builds a surface; Task 6 should confirm it looks right, but there is no known precision problem to look for.

**Original framing of the question:** the spike observed banding at a depth ratio of 40,000 (near 0.05 / far 2000) and did *not* establish where it starts. This task derives `near` from the frame, leaves `far` generous enough to keep the galaxy in the sky, and then **measures the resulting ratio in the browser**. If banding appears, the fix is `logarithmicDepthBuffer` on the renderer — which the custom `createPlanetMaterial()` and `AtmosphereShader` would then need the `logdepthbuf` shader chunks for. Do not adopt the log buffer pre-emptively; it has a real integration cost and may not be needed.

**Files:**
- Modify: `src/components/world/WorldCameraManager.ts`
- Test: `src/components/world/__tests__/descent.test.ts` (extend; existing cases must keep passing)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `WorldCameraManager.setFrameScale(radius: number): void` — sets `near`, `far`, `minDistance` and `maxDistance` from the radius of the frame being looked at. Called by `descend()` and `landOnSurface()`. `ascend()` restores galaxy scale. Also `readonly depth: { near: number; far: number; minDistance: number; maxDistance: number }` for assertions.

- [ ] **Step 1: Write the failing test**

Append to `src/components/world/__tests__/descent.test.ts`:

```typescript
describe("camera depth follows the frame it is in", () => {
  it("clears the ground at a surface frame's bottom of frame", () => {
    const manager = new WorldCameraManager(1280, 720);
    // A shard at the recommended radius. Ground at frame bottom sits
    // 0.202 * R away; the near plane has to be inside that.
    const shardRadius = 3.0;
    manager.setFrameScale(shardRadius);
    expect(manager.depth.near).toBeLessThan(0.202 * shardRadius);
  });

  it("still reaches the far side of the galaxy from a surface", () => {
    const manager = new WorldCameraManager(1280, 720);
    manager.setFrameScale(3.0);
    // Standing on a moon you can still see the core and the opposite arm.
    // A far plane derived from the frame's own size would clip them away.
    expect(manager.depth.far).toBeGreaterThan(ASTROLABE_OUTER * 3);
  });

  it("does not change the near plane at galaxy framing", () => {
    const manager = new WorldCameraManager(1280, 720);
    manager.setFrameScale(ASTROLABE_OUTER);
    // The scale that already works must be untouched by this change.
    expect(manager.depth.near).toBeCloseTo(0.5, 6);
  });

  it("lets the camera get close enough to stand on a shard", () => {
    const manager = new WorldCameraManager(1280, 720);
    manager.setFrameScale(3.0);
    // The landed orbit radius is 0.66 * R = 1.98.
    expect(manager.depth.minDistance).toBeLessThan(1.98);
  });

  it("still reaches the whole galaxy from the galaxy frame", () => {
    const manager = new WorldCameraManager(1280, 720);
    manager.setFrameScale(ASTROLABE_OUTER);
    expect(manager.depth.maxDistance).toBeGreaterThanOrEqual(480);
    expect(manager.depth.far).toBeGreaterThan(ASTROLABE_OUTER * 5);
  });

  it("restores galaxy depth on ascent", () => {
    const manager = new WorldCameraManager(1280, 720);
    manager.setFrameScale(3.0);
    manager.ascend();
    expect(manager.depth.minDistance).toBeGreaterThan(1.98);
    expect(manager.depth.far).toBeGreaterThan(ASTROLABE_OUTER * 5);
  });
});
```

Add `ASTROLABE_OUTER` to the existing import at the top of the file:

```typescript
import { WorldCameraManager, ASTROLABE_OUTER } from "../WorldCameraManager";
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/world/__tests__/descent.test.ts`
Expected: FAIL with `manager.setFrameScale is not a function`

- [ ] **Step 3: Write minimal implementation**

In `src/components/world/WorldCameraManager.ts`, replace the fixed limits and add the setter.

Replace these four field declarations:

```typescript
  // Limits
  private minDistance = 15;
  private maxDistance = 480;
```

with:

```typescript
  /**
   * Clipping and orbit limits, as functions of the frame being looked at.
   *
   * These used to be four constants sized for the galaxy. That works while the
   * galaxy is the only scale; one level down, `near = 0.5` clips the ground out
   * from under a surface camera and `minDistance = 15` makes it impossible to
   * approach anything smaller than a planet. Deriving them from the framed
   * radius is what lets one camera serve every depth — which is the same rule
   * `descend()` already follows for framing.
   */
  public depth = { near: 0.5, far: 2000, minDistance: 15, maxDistance: 480 };

  private get minDistance(): number { return this.depth.minDistance; }
  private get maxDistance(): number { return this.depth.maxDistance; }
```

Add the setter immediately after `setPreset`:

```typescript
  /**
   * Size the camera's depth range to the frame it is looking at.
   *
   * `near` is a fraction of the framed radius rather than a constant, because
   * what has to stay inside it is the nearest surface the camera can see — at a
   * standing pose that is `0.202 * radius` away. `far` is then pinned to keep
   * the depth ratio inside the precision budget while still reaching the whole
   * galaxy from galaxy framing, so the two move together instead of one being
   * tuned against a fixed other.
   */
  public setFrameScale(radius: number): void {
    // Clamped at the top so galaxy framing keeps exactly the near plane it has
    // today: this must not be a visible change at the scale that already works.
    const near = THREE.MathUtils.clamp(radius * 0.06, 0.02, 0.5);
    this.depth = {
      near,
      // `far` is NOT a multiple of `near`. A ratio rule would put the far plane
      // at 240 from a surface and clip the far side of the galaxy out of the
      // sky. What `far` has to reach is the world, not the frame.
      far: Math.max(2000, radius * 10),
      minDistance: radius * 0.12,
      maxDistance: Math.max(480, radius * 2.4),
    };
    this.camera.near = this.depth.near;
    this.camera.far = this.depth.far;
    this.camera.updateProjectionMatrix();
    // An orbit already outside the new band is pulled in rather than left
    // stranded: a preset that arrives before the scale is set would otherwise
    // keep a radius the limits now forbid.
    this.sphericalTarget.radius = THREE.MathUtils.clamp(
      this.sphericalTarget.radius, this.depth.minDistance, this.depth.maxDistance,
    );
  }
```

In `descend()`, add as the first line of the body:

```typescript
    this.setFrameScale(radius);
```

In `ascend()`, add as the first line of the body:

```typescript
    this.setFrameScale(ASTROLABE_OUTER);
```

And in the constructor, replace the camera construction line:

```typescript
    this.camera = new THREE.PerspectiveCamera(42, width / height, 0.5, 2000);
```

with:

```typescript
    this.camera = new THREE.PerspectiveCamera(42, width / height, 0.5, 2000);
    this.setFrameScale(ASTROLABE_OUTER);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/world/__tests__/descent.test.ts`
Expected: PASS, all cases including the four that already existed.

Then run the whole suite — this touches the camera every other test uses:

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/world/WorldCameraManager.ts src/components/world/__tests__/descent.test.ts
git commit -m "fix(camera): derive clipping and orbit limits from the framed radius

near=0.5 and minDistance=15 are galaxy-scale constants. At a surface pose
the nearest ground is 0.202*radius away, so the near plane clipped it out
from under the camera, and minDistance made the approach impossible at all.

Both now come from the frame being looked at, and far moves with near so
the depth ratio stays inside the precision budget rather than being tuned
against a fixed other."
```

---

### Task 2: Cull the sky by scope, per planet instance

**Why:** spec §7 risk 4 wants the field to thin as the visitor descends. The spike found that a scope-subtree visibility toggle cannot do it: the five planets are one root-level `InstancedMesh`, so hiding everything outside the landed scope hides the parent the visitor is required to keep in frame. Measured directly — culling by scope made Products vanish.

The spike also measured that this is **not a frame-budget problem**: 120.2 fps with the field, 120.1 without, with 1,543 of 16,500 points inside the frustum. The reason to cull is that arm dust reads as grey speckle smeared across the horizon. Do not spend effort optimising draw calls here.

**Files:**
- Modify: `src/components/world/WorldSceneBuilder.ts`
- Test: `src/components/world/__tests__/scopeCull.test.ts` (create)

**Interfaces:**
- Consumes: `scopeGroups` (exists), `planetScopeId` (exists).
- Produces: `WorldSceneBuilder.setScopeCull(keep: ScopeId | null): void` — `null` restores everything. When given a scope, hides the field and every arm body, keeps the kept scope's subtree, and keeps exactly the planet instance the scope belongs to.

- [ ] **Step 1: Write the failing test**

Create `src/components/world/__tests__/scopeCull.test.ts`:

```typescript
// @vitest-environment jsdom
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { WorldSceneBuilder } from "../WorldSceneBuilder";
import { loadBodies } from "@/lib/atlas/bodies";
import { planetScopeId } from "@/lib/atlas/scopes";

function built() {
  const scene = new THREE.Scene();
  const builder = new WorldSceneBuilder(scene, loadBodies(), "2026-08-22", 1);
  builder.build();
  return { scene, builder };
}

/** A planet instance is culled by zero scale, so its matrix decomposes to ~0. */
function instanceScale(scene: THREE.Scene, index: number): number {
  let found = 0;
  scene.traverse((o) => {
    const m = o as THREE.InstancedMesh;
    if (m.isInstancedMesh && m.name === "planet-surfaces") {
      const matrix = new THREE.Matrix4();
      m.getMatrixAt(index, matrix);
      found = new THREE.Vector3().setFromMatrixScale(matrix).x;
    }
  });
  return found;
}

describe("cull by scope", () => {
  it("keeps the planet a landed scope belongs to", () => {
    const { scene, builder } = built();
    const index = builder.planetInstanceIndex("products");
    builder.setScopeCull(planetScopeId("products"));
    expect(instanceScale(scene, index)).toBeGreaterThan(0);
  });

  it("drops the planets the landed scope does not belong to", () => {
    const { scene, builder } = built();
    const index = builder.planetInstanceIndex("labs");
    builder.setScopeCull(planetScopeId("products"));
    expect(instanceScale(scene, index)).toBeCloseTo(0, 5);
  });

  it("hides the field", () => {
    const { scene, builder } = built();
    builder.setScopeCull(planetScopeId("products"));
    let anyPointsVisible = false;
    scene.traverse((o) => {
      if ((o as THREE.Points).isPoints && o.visible) anyPointsVisible = true;
    });
    expect(anyPointsVisible).toBe(false);
  });

  it("restores every planet and the field when the cull is released", () => {
    const { scene, builder } = built();
    const index = builder.planetInstanceIndex("labs");
    const before = instanceScale(scene, index);
    builder.setScopeCull(planetScopeId("products"));
    builder.setScopeCull(null);
    expect(instanceScale(scene, index)).toBeCloseTo(before, 5);
    let anyPointsVisible = false;
    scene.traverse((o) => {
      if ((o as THREE.Points).isPoints && o.visible) anyPointsVisible = true;
    });
    expect(anyPointsVisible).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/world/__tests__/scopeCull.test.ts`
Expected: FAIL with `builder.planetInstanceIndex is not a function`

- [ ] **Step 3: Write minimal implementation**

In `src/components/world/WorldSceneBuilder.ts`, add these fields beside `scopeGroups`:

```typescript
  /** Arm -> its row in the planet InstancedMesh, so a single planet can be culled. */
  private planetInstanceIndices = new Map<string, number>();
  /** The instance matrices as built, so a cull can be released rather than recomputed. */
  private planetInstanceMatrices: THREE.Matrix4[] = [];
  private planetMesh: THREE.InstancedMesh | null = null;
  /** Root children hidden by the current cull, so releasing it restores exactly those. */
  private culled: THREE.Object3D[] = [];
```

In `buildPlanetarySpheres`, inside the `planets.forEach((planet, i) => {` body, immediately after `mesh.setMatrixAt(i, matrix);`, add:

```typescript
      this.planetInstanceIndices.set(planet.arm, i);
      this.planetInstanceMatrices[i] = matrix.clone();
```

And at the end of `buildPlanetarySpheres`, beside `this.planetMaterial = material;`, add:

```typescript
    this.planetMesh = mesh;
```

Then add these public methods to the class:

```typescript
  /** Which row of the planet InstancedMesh an arm occupies. */
  public planetInstanceIndex(arm: string): number {
    const index = this.planetInstanceIndices.get(arm);
    if (index === undefined) {
      // Loud, not defaulted — the same rule an unassigned arm already follows.
      throw new Error(`arm "${arm}" has no planet instance`);
    }
    return index;
  }

  /**
   * Thin the sky to one scope. `null` restores everything.
   *
   * The field is hidden because at surface altitude arm dust reads as speckle
   * smeared across the horizon, not because it costs frame time — measured at
   * 120.2 fps with it and 120.1 without. The planets need per-instance culling
   * rather than a visibility toggle: they are one mesh by design (§5.4), so the
   * parent that must stay in frame shares it with the four that must not.
   */
  public setScopeCull(keep: ScopeId | null): void {
    for (const object of this.culled) object.visible = true;
    this.culled = [];
    this.restorePlanetInstances();
    if (!keep) return;

    const kept = this.scopeGroups.get(keep);
    for (const child of this.rootGroup.children) {
      if (child === this.planetMesh) continue;
      if (kept && (child === kept || this.contains(child, kept))) continue;
      if (!child.visible) continue;
      child.visible = false;
      this.culled.push(child);
    }

    // The arm the kept scope sits in, whether that scope is the planet itself
    // or a moon inside it. `scopeChain` gives the planet either way.
    const arm = scopeChain(keep)
      .map((s) => s.id)
      .find((id) => id.startsWith("planet:"))
      ?.replace("planet:", "");
    if (arm) this.hidePlanetInstancesExcept(arm);
  }

  private contains(root: THREE.Object3D, node: THREE.Object3D): boolean {
    let cursor: THREE.Object3D | null = node;
    while (cursor) {
      if (cursor === root) return true;
      cursor = cursor.parent;
    }
    return false;
  }

  private hidePlanetInstancesExcept(arm: string): void {
    const mesh = this.planetMesh;
    if (!mesh) return;
    const keepIndex = this.planetInstanceIndices.get(arm);
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    this.planetInstanceMatrices.forEach((_, i) => {
      if (i === keepIndex) return;
      mesh.setMatrixAt(i, zero);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }

  private restorePlanetInstances(): void {
    const mesh = this.planetMesh;
    if (!mesh) return;
    this.planetInstanceMatrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
    mesh.instanceMatrix.needsUpdate = true;
  }
```

Add `scopeChain` to the existing scopes import at the top of the file:

```typescript
import { GALAXY_ZEMI, derivePlanetScopes, planetScopeId, scopeChain, type Scope } from "@/lib/atlas/scopes";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/world/__tests__/scopeCull.test.ts`
Expected: PASS

Run: `npm test`
Expected: PASS, including `sceneParity.test.ts` — nothing has moved.

- [ ] **Step 5: Commit**

```bash
git add src/components/world/WorldSceneBuilder.ts src/components/world/__tests__/scopeCull.test.ts
git commit -m "feat(world): cull the sky to one scope, per planet instance

The five planets are one InstancedMesh by design, so hiding everything
outside a landed scope hid the parent the visitor is required to keep in
frame. Culling is now per instance: the arm the scope belongs to survives
and the other four are zero-scaled, restorable from the built matrices.

The field is dropped for how it looks at surface altitude, not for frame
time — measured 120.2 fps with it and 120.1 without."
```

---

## Phase 1 — Frames (Tasks 3-5) — BUILT

Landed on main. Recorded here as built rather than as a forecast; the code and
its tests are the specification now.

| Task | Commit | Delivered |
|---|---|---|
| 3 · Moon scopes derived | `8da307e` | `deriveMoonScopes` over `kind === "system"`; `moonScopeId` in `galaxy.ts` to avoid the `scopes -> moons -> scopes` cycle; `surfaces.ts` deriving which scopes you can stand on. |
| 4 · Moon groups and hit proxies | `f6417da` | Moon body in its own group on the orbit pivot, registered as its scope; 2.6x pick proxy; hit position is the moon's own, not its planet's. |
| 5 · Flybys | this commit | `resolveBodySelection` as a pure rule; `flybyScope` on `WorldCanvas`; closing a flyby's card ascends one level to the planet. |

**The decision that mattered in Task 3.** "Only PickMe gets a surface" is derived,
not authored: a body earns one when its `consoleId` names an engine that ships.
Inunity carries a `consoleId` and stays a flyby because nothing ships behind it,
and a planet earns a ground when something in its arm has evidence — which gives
Products and not Labs, matching the reasoning §7 already made. Spec §3.3's
closing promise ("when one earns evidence, its flyby becomes a landing") is now
literally true. `surfaces.test.ts` pins the engine registry against the
directories on disk so the predicate cannot go stale silently.

**Deviation from the plan as written.** Task 5 makes *every* moon a flyby,
including PickMe. `LandedConsolePanel` resolves its arm with
`scopeId.replace("planet:", "")`, so handing it `moon:PickMe` reproduces exactly
the "landed panel renders empty at moon scale" bug §2 recorded. PickMe becomes a
landing in Task 6, through surface state that does not go through that panel.

**Found while verifying, not yet acted on.** `deepLink.ts` is consumed only by
`AtlasStage.tsx`; `page.tsx` renders `WorldCanvas` directly and never reads the
hash. Spec §7 risk 2 mitigates depth-cost with "the deep link lands directly on
the console" — that mitigation does not currently exist on the live page.

## Phase 2 — The surface (Tasks 6-8) — BUILT

| Task | Delivered |
|---|---|
| 6 · Surface camera | `landOnSurface(frame, parent, shardRadius)`. Pose stored in the frame's local space, driven from its world matrix each update. The bearing to the parent is computed in local coordinates, so a moon lands on its outward radial and a planet faces the galaxy through one code path. |
| 7 · The shard | `SurfaceBuilder` (authored vocabulary only) plus `surfacePropsFor` (derived arrangement). LOD swap is a hard substitution. Planet instance visibility gained a single owner. |
| 8 · Wiring | Landing routed from `resolveBodySelection`; scope cull and surface fog applied on arrival; the deep link wired on the main page. |

**Verified in the browser** against a clean static build: ground fills the bottom
61% with the horizon 39% down, and Products spans 44% of frame height — against
0.431 predicted. At 45 seconds the parent has not moved a pixel; only the sibling
moons and the quote sky have. That is the failure the first spike recorded,
closed.

**Two bugs found by looking, that no unit test would have caught.**

1. Props fanned from angle 0, and angle 0 is exactly where the camera stands.
   The first prop was in the visitor's face, occluding the parent almost
   entirely. Angle PI is as bad — a prop there is silhouetted against the parent.
   Props now stand on the far half only, with the sightline kept clear at both
   ends, and `surfaces.test.ts` pins both invariants.
2. Verification was blocked for a long stretch by a stale bundle: `next build`
   with `output: export` leaves old chunks in `out/`, and a cached `index.html`
   kept pointing at them, so three rounds of fixes appeared to do nothing. Clear
   `out/` before rebuilding when verifying visually.

**Also fixed, a gap the spec depends on.** `deepLink.ts` was consumed only by
`AtlasStage`; `page.tsx` never read the hash, so §7 risk 2's mitigation — "the
deep link lands directly on the console" — did not exist on the live page. The
hash now arrives through the same rule a tap does.

**Known and not addressed.** Moon label sprites still draw at constant screen
size when landed, so a sibling's pill can sit across the parent's face (spike
finding 8). The quote sky's HTML also overlays the parent. Both are label-layer
concerns rather than surface ones.

## Phase 3 — not yet written

Tasks 3–10 (moon scopes, hit proxies, flybys, the surface camera, the shard,
scope culling at depth, Products' ground, the orrery) are deliberately unwritten
until the Phase 0 checkpoint has been reviewed. Phase 0 changes the camera every
other task builds on; drafting eight tasks against an unreviewed foundation is
work that gets thrown away if the foundation moves.

Resume by writing them against the File Structure and Measured Constants above.
