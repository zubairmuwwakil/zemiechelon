// @vitest-environment jsdom
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { WorldSceneBuilder } from "../WorldSceneBuilder";
import { loadBodies } from "@/lib/atlas/bodies";
import { SOLAR_SYSTEM_ZEMI } from "@/lib/atlas/galaxy";
import { MAX_OBLIQUITY, obliquityFor } from "@/lib/atlas/motion";
import { dateAtDay } from "@/lib/atlas/timeline";

const bodies = loadBodies();
const ARMS = Object.keys(SOLAR_SYSTEM_ZEMI.arms);
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
    // setClockDate composes a fresh matrix from scale and position. Written
    // naively it erases the tilt, and build() calls it as its LAST step, so the
    // tilt would never reach a frame. This is the test for that trap.
    const builder = built();
    builder.setClockDate(dateAtDay(400, SOLAR_SYSTEM_ZEMI.epoch));
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
      // 1e-4 rather than 1e-6: `decompose` round-trips through a quaternion, and
      // a planet is ~3.4 scene units across, so this is still "did not move".
      expect(position.distanceTo(hit.position)).toBeLessThan(1e-4);
      // 6 decimals, not 9: instanceMatrix is Float32-backed, so ~7 significant
      // digits is all the storage has. This still says "a sphere, not an
      // ellipsoid" — the tilt rotated the instance without shearing it.
      expect(scale.x).toBeCloseTo(scale.y, 6);
      expect(scale.y).toBeCloseTo(scale.z, 6);
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
    expect(source).toMatch(
      /vNormal\s*=\s*normalize\(\s*normalMatrix\s*\*\s*mat3\(\s*instanceMatrix\s*\)\s*\*\s*normal\s*\)/,
    );
  });

  it("leaves the planet scope groups level, because the camera descends into them", () => {
    const builder = built();
    // Only arms with a shipped system get a scope group — `derivePlanetScopes`
    // keys off `kind: "moon"`, so Foundations has none.
    const framed = ARMS.filter((arm) => builder.scopeGroups.has(`planet:${arm}`));
    expect(framed.length).toBeGreaterThan(0);
    for (const arm of framed) {
      const group = builder.groupFor(`planet:${arm}`);
      group.updateWorldMatrix(true, false);
      const q = new THREE.Quaternion();
      group.matrixWorld.decompose(new THREE.Vector3(), q, new THREE.Vector3());
      expect(UP.clone().applyQuaternion(q).angleTo(UP)).toBeLessThan(1e-9);
    }
  });
});
