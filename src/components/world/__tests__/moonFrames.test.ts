// @vitest-environment jsdom
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { WorldSceneBuilder } from "../WorldSceneBuilder";
import { loadBodies } from "@/lib/atlas/bodies";
import { deriveMoons } from "@/lib/atlas/moons";
import { moonScopeId } from "@/lib/atlas/galaxy";

const bodies = loadBodies();
const moons = deriveMoons(bodies);

function built() {
  const scene = new THREE.Scene();
  const builder = new WorldSceneBuilder(scene, bodies, "2026-08-22", 1);
  builder.build();
  return { scene, builder };
}

describe("moon frames", () => {
  it("registers a group for every moon", () => {
    const { builder } = built();
    for (const moon of moons) {
      expect(builder.scopeGroups.has(moonScopeId(moon.id))).toBe(true);
    }
  });

  it("puts each moon group where the moon is, not where its planet is", () => {
    const { builder } = built();
    for (const moon of moons) {
      const group = builder.groupFor(moonScopeId(moon.id));
      const planet = builder.groupFor(`planet:${moon.arm}`);
      group.updateWorldMatrix(true, false);
      planet.updateWorldMatrix(true, false);
      const moonPos = new THREE.Vector3().setFromMatrixPosition(group.matrixWorld);
      const planetPos = new THREE.Vector3().setFromMatrixPosition(planet.matrixWorld);
      expect(moonPos.distanceTo(planetPos)).toBeGreaterThan(1);
    }
  });

  it("points each moon group's local -X at its planet, whatever the orbit phase", () => {
    // This is what makes tracking free: a camera posed in the moon's local
    // space is looking down the moon->planet radial by construction, so an
    // orbiting moon carries its own framing with it.
    const { builder } = built();
    for (const moon of moons) {
      const group = builder.groupFor(moonScopeId(moon.id));
      const planet = builder.groupFor(`planet:${moon.arm}`);
      group.updateWorldMatrix(true, false);
      planet.updateWorldMatrix(true, false);

      const localMinusX = new THREE.Vector3(-1, 0, 0)
        .transformDirection(group.matrixWorld)
        .normalize();
      const towardPlanet = new THREE.Vector3()
        .setFromMatrixPosition(planet.matrixWorld)
        .sub(new THREE.Vector3().setFromMatrixPosition(group.matrixWorld))
        .normalize();

      expect(localMinusX.dot(towardPlanet)).toBeCloseTo(1, 4);
    }
  });

  it("keeps pointing at the planet after the orbit advances", () => {
    const { builder } = built();
    // Ninety seconds of orbit: PickMe travels about 67 degrees in that time.
    for (let i = 0; i < 90; i++) builder.update(i, 1);

    const moon = moons.find((m) => m.id === "PickMe")!;
    const group = builder.groupFor(moonScopeId(moon.id));
    const planet = builder.groupFor(`planet:${moon.arm}`);
    group.updateWorldMatrix(true, false);
    planet.updateWorldMatrix(true, false);

    const localMinusX = new THREE.Vector3(-1, 0, 0)
      .transformDirection(group.matrixWorld)
      .normalize();
    const towardPlanet = new THREE.Vector3()
      .setFromMatrixPosition(planet.matrixWorld)
      .sub(new THREE.Vector3().setFromMatrixPosition(group.matrixWorld))
      .normalize();

    expect(localMinusX.dot(towardPlanet)).toBeCloseTo(1, 4);
  });
});

describe("moon hit proxies", () => {
  it("gives every moon a pick target larger than the moon itself", () => {
    // Spec §2: moons were sub-pointer click targets at planet framing, with
    // two misses logged. The planets already carry a 1.2x pick sphere; moons
    // are a third the size and need proportionally more.
    const { builder } = built();
    for (const moon of moons) {
      const hit = builder.hitObjects.find((h) => h.id === moon.id && h.type === "body");
      expect(hit).toBeDefined();
      const proxy = hit!.mesh as THREE.Mesh;
      const geometry = proxy.geometry as THREE.SphereGeometry;
      expect(geometry.parameters.radius).toBeGreaterThan(
        builder.moonDrawnRadius(moon.arm) * 1.5,
      );
    }
  });

  it("carries the moon's own position, not its planet's", () => {
    // The old hit object reported the planet's centre, which is why clicking a
    // moon flew to the planet. A flyby needs the moon's own place.
    const { builder } = built();
    for (const moon of moons) {
      const hit = builder.hitObjects.find((h) => h.id === moon.id && h.type === "body")!;
      const group = builder.groupFor(moonScopeId(moon.id));
      group.updateWorldMatrix(true, false);
      const world = new THREE.Vector3().setFromMatrixPosition(group.matrixWorld);
      expect(hit.position.distanceTo(world)).toBeLessThan(0.001);
    }
  });

  it("keeps the proxy invisible to the eye but present to the raycaster", () => {
    const { builder } = built();
    const hit = builder.hitObjects.find((h) => h.id === "PickMe" && h.type === "body")!;
    const proxy = hit.mesh as THREE.Mesh;
    const material = proxy.material as THREE.MeshBasicMaterial;
    expect(material.opacity).toBe(0);
    expect(material.transparent).toBe(true);
    // `visible: false` would remove it from raycasting too — the planets'
    // existing pick spheres use the same zero-opacity trick for this reason.
    expect(proxy.visible).toBe(true);
  });
});
