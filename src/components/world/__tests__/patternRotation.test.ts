// @vitest-environment jsdom
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { WorldSceneBuilder } from "../WorldSceneBuilder";
import { GALAXY_SKY, GalaxyBuilder } from "../GalaxyBuilder";
import { loadBodies } from "@/lib/atlas/bodies";
import {
  PATTERN_PERIOD_SECONDS,
  PATTERN_RATE,
  obliquityFor,
  patternAngle,
} from "@/lib/atlas/motion";
import { ASTROLABE_OUTER } from "../WorldCameraManager";
import { moonScopeId } from "@/lib/atlas/galaxy";
import { deriveMoons } from "@/lib/atlas/moons";
import { dateAtDay } from "@/lib/atlas/timeline";
import { SOLAR_SYSTEM_ZEMI } from "@/lib/atlas/scopes";

const bodies = loadBodies();

function built() {
  const scene = new THREE.Scene();
  const builder = new WorldSceneBuilder(scene, bodies, "2026-08-22", 1);
  builder.build();
  return builder;
}

/**
 * Every drawn body's world position, after `seconds` of the render loop.
 *
 * `delta` is zero deliberately, and that is what makes the rigidity cases below
 * statements about L1 rather than about the whole motion system. `update` runs
 * on two independent clocks: `elapsed` sets the pattern angle absolutely, while
 * `delta` accumulates into the moon pivots and the orreries. A moon orbits its
 * planet, so its distance from the CORE genuinely changes — feed the second
 * clock and "no radius changes" is false by L3's design, before L1 is asked
 * anything. Zero freezes the accumulating layers and leaves the pattern as the
 * only thing that has moved. Moon orbits are covered by `inclination.test.ts`.
 */
function positionsAfter(builder: WorldSceneBuilder, seconds: number) {
  builder.update(seconds, 0);
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
    // Rotating the root while the sky rides it rotates the reference with the
    // content, and the two cancel to zero perceived motion — a bug invisible to
    // code review and to every placement test.
    //
    // This used to be bought with `skyShell.rotation.y = -pattern`, a correction
    // applied every frame. The sky now hangs off the galaxy frame, which does
    // not rotate, so the property is structural rather than maintained. The
    // assertion is unchanged on purpose: it is the same guarantee, and it is
    // still the one worth guarding — only the mechanism that provides it moved.
    const scene = new THREE.Scene();
    const galaxy = new GalaxyBuilder(scene);
    galaxy.build();
    const builder = new WorldSceneBuilder(scene, bodies, "2026-08-22", 1);
    builder.build();
    galaxy.attach(SOLAR_SYSTEM_ZEMI, builder.rootGroup);

    const shell = galaxy.rootGroup.getObjectByName(GALAXY_SKY) as THREE.Points;
    const sample = (): THREE.Vector3 => {
      scene.updateMatrixWorld(true);
      const local = new THREE.Vector3().fromBufferAttribute(
        shell.geometry.getAttribute("position"),
        0,
      );
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
    builder.setClockDate(dateAtDay(0, SOLAR_SYSTEM_ZEMI.epoch));
    expect(builder.rootGroup.rotation.y).toBe(turned);
    builder.setClockDate(dateAtDay(100000, SOLAR_SYSTEM_ZEMI.epoch));
    expect(builder.rootGroup.rotation.y).toBe(turned);
  });
});

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
