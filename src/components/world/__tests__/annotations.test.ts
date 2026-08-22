// @vitest-environment jsdom
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { loadBodies } from "@/lib/atlas/bodies";
import { ARMS } from "@/data/arms";
import { WorldSceneBuilder } from "../WorldSceneBuilder";

const bodies = loadBodies();

describe("element annotations and hit testing", () => {
  it("registers generous pick meshes for astrolabe month rings and the frontier ring", () => {
    const scene = new THREE.Scene();
    const builder = new WorldSceneBuilder(scene, bodies, "2026-08-21");
    builder.build();

    const ringHits = builder.hitObjects.filter((h) => h.type === "ring");
    // 9 month rings + 1 frontier ring = 10 ring hit objects
    expect(ringHits.length).toBe(10);
    expect(ringHits.map((h) => h.id)).toContain("ring-month-1");
    expect(ringHits.map((h) => h.id)).toContain("ring-month-3");
    expect(ringHits.map((h) => h.id)).toContain("ring-frontier");

    for (const ring of ringHits) {
      expect(ring.mesh).toBeInstanceOf(THREE.Mesh);
      const mesh = ring.mesh as THREE.Mesh;
      const mat = mesh.material as THREE.MeshBasicMaterial;
      expect(mat.transparent).toBe(true);
      expect(mat.opacity).toBe(0);
    }
  });

  it("registers pick meshes for all 5 galactic arms", () => {
    const scene = new THREE.Scene();
    const builder = new WorldSceneBuilder(scene, bodies, "2026-08-21");
    builder.build();

    const armHits = builder.hitObjects.filter((h) => h.type === "arm");
    expect(armHits).toHaveLength(5);
    for (const arm of ARMS) {
      expect(armHits.map((h) => h.id)).toContain(`arm-${arm.id}`);
    }

    for (const arm of armHits) {
      expect(arm.mesh).toBeInstanceOf(THREE.Mesh);
      const mesh = arm.mesh as THREE.Mesh;
      const mat = mesh.material as THREE.MeshBasicMaterial;
      expect(mat.transparent).toBe(true);
      expect(mat.opacity).toBe(0);
    }
  });

  it("registers planet hit objects for all planets and central core", () => {
    const scene = new THREE.Scene();
    const builder = new WorldSceneBuilder(scene, bodies, "2026-08-21");
    builder.build();

    const planetHits = builder.hitObjects.filter((h) => h.type === "planet");
    // 5 planets + 1 central anchor core
    expect(planetHits.length).toBeGreaterThanOrEqual(6);
    expect(planetHits.map((h) => h.id)).toContain("galaxy");
    expect(planetHits.map((h) => h.id)).toContain("products");
  });

  it("handles hover transitions for astrolabe rings", () => {
    const scene = new THREE.Scene();
    const builder = new WorldSceneBuilder(scene, bodies, "2026-08-21");
    builder.build();

    // Hover month 3 ring
    builder.setHoveredTarget({ type: "ring", id: "ring-month-3" });
    // Clear hover
    builder.setHoveredTarget(null);
  });

  it("handles hover transitions for planets and arms", () => {
    const scene = new THREE.Scene();
    const builder = new WorldSceneBuilder(scene, bodies, "2026-08-21");
    builder.build();

    // Hover Products planet
    builder.setHoveredTarget({ type: "planet", id: "products" });

    // Hover Products arm
    builder.setHoveredTarget({ type: "arm", id: "arm-products" });

    // Clear hover
    builder.setHoveredTarget(null);
  });

  it("swaps cosmic mode between day and night without error", () => {
    const scene = new THREE.Scene();
    const builder = new WorldSceneBuilder(scene, bodies, "2026-08-21");
    builder.build();

    expect(() => builder.setCosmicMode("night")).not.toThrow();
    expect(() => builder.setCosmicMode("day")).not.toThrow();
  });
});
