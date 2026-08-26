// @vitest-environment jsdom
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { WorldSceneBuilder } from "../WorldSceneBuilder";
import { loadBodies } from "@/lib/atlas/bodies";
import { SOLAR_SYSTEM_ZEMI, planetScopeId } from "@/lib/atlas/scopes";

function built() {
  const scene = new THREE.Scene();
  const builder = new WorldSceneBuilder(scene, SOLAR_SYSTEM_ZEMI, loadBodies(), "2026-08-22", 1);
  builder.build();
  return { scene, builder };
}

/**
 * A culled planet is zero-scaled rather than hidden: the five planets are one
 * InstancedMesh by design, so there is no per-planet object to toggle.
 */
function instanceScale(scene: THREE.Scene, index: number): number {
  let scale = Number.NaN;
  scene.traverse((o) => {
    const mesh = o as THREE.InstancedMesh;
    if (!mesh.isInstancedMesh || mesh.name !== "planet-surfaces") return;
    const matrix = new THREE.Matrix4();
    mesh.getMatrixAt(index, matrix);
    scale = new THREE.Vector3().setFromMatrixScale(matrix).x;
  });
  return scale;
}

function anyFieldVisible(scene: THREE.Scene): boolean {
  let visible = false;
  scene.traverse((o) => {
    if ((o as THREE.Points).isPoints && o.visible) visible = true;
  });
  return visible;
}

describe("cull by scope", () => {
  it("keeps the planet the landed scope belongs to", () => {
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

  it("hides the field, which is what reads as dirt at surface altitude", () => {
    const { scene, builder } = built();
    builder.setScopeCull(planetScopeId("products"));
    expect(anyFieldVisible(scene)).toBe(false);
  });

  it("restores every planet and the field when the cull is released", () => {
    const { scene, builder } = built();
    const index = builder.planetInstanceIndex("labs");
    const before = instanceScale(scene, index);
    builder.setScopeCull(planetScopeId("products"));
    builder.setScopeCull(null);
    expect(instanceScale(scene, index)).toBeCloseTo(before, 5);
    expect(anyFieldVisible(scene)).toBe(true);
  });

  it("is idempotent — culling twice does not lose the restore state", () => {
    const { scene, builder } = built();
    const index = builder.planetInstanceIndex("labs");
    const before = instanceScale(scene, index);
    builder.setScopeCull(planetScopeId("products"));
    builder.setScopeCull(planetScopeId("products"));
    builder.setScopeCull(null);
    expect(instanceScale(scene, index)).toBeCloseTo(before, 5);
    expect(anyFieldVisible(scene)).toBe(true);
  });

  it("throws loudly for an arm with no planet, rather than defaulting", () => {
    const { builder } = built();
    expect(() => builder.planetInstanceIndex("nowhere")).toThrow(/no planet instance/);
  });
});
