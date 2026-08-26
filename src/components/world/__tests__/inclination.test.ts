// @vitest-environment jsdom
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { WorldSceneBuilder } from "../WorldSceneBuilder";
import { loadBodies } from "@/lib/atlas/bodies";
import { deriveMoons } from "@/lib/atlas/moons";
import { moonScopeId } from "@/lib/atlas/galaxy";
import { MAX_INCLINATION } from "@/lib/atlas/motion";
import { SOLAR_SYSTEM_ZEMI } from "@/lib/atlas/scopes";

const bodies = loadBodies();
const moons = deriveMoons(bodies);

function built() {
  const scene = new THREE.Scene();
  const builder = new WorldSceneBuilder(scene, SOLAR_SYSTEM_ZEMI, bodies, "2026-08-22", 1);
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
