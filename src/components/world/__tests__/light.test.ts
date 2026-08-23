// @vitest-environment jsdom
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { DayNightController, SUN_ARC_PERIOD_SECONDS } from "../DayNightController";
import { WorldSceneBuilder } from "../WorldSceneBuilder";
import { loadBodies } from "@/lib/atlas/bodies";

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
    expect((material.uniforms.uLightDir.value as THREE.Vector3).length()).toBeCloseTo(1, 6);
    expect((material.uniforms.uLightDir.value as THREE.Vector3).y).toBeCloseTo(0.6, 6);
  });

  it("lights against a world normal, so the terminator does not follow the camera", () => {
    const { material } = builtScene();
    expect(material.vertexShader).toContain("vWorldNormal");
    expect(material.fragmentShader).toContain("uLightDir");
    // The hardcoded raking direction is gone.
    expect(material.fragmentShader).not.toContain("vec3(0.6, 0.7, 0.4)");
  });
});
