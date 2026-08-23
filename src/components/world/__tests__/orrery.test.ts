// @vitest-environment jsdom
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { WorldSceneBuilder } from "../WorldSceneBuilder";
import { loadBodies } from "@/lib/atlas/bodies";
import { deriveMoons } from "@/lib/atlas/moons";
import { moonScopeId, planetScopeId } from "@/lib/atlas/galaxy";

const bodies = loadBodies();
const PRODUCTS = planetScopeId("products");

function built() {
  const scene = new THREE.Scene();
  const builder = new WorldSceneBuilder(scene, bodies, "2026-08-22", 1);
  builder.build();
  return { scene, builder };
}

describe("the orrery", () => {
  it("reaches every moon of the planet, including ones behind it", () => {
    // Spec §3.4 and §6. Moons orbit, so at any moment one or two are behind
    // the planet, and tapping the sky only reaches what is visible. The
    // instrument is what makes the hidden ones reachable at all.
    const { builder } = built();
    const expected = deriveMoons(bodies)
      .filter((m) => m.arm === "products")
      .map((m) => m.id)
      .sort();
    expect(builder.orreryTargets(PRODUCTS).sort()).toEqual(expected);
  });

  it("stands on the surface it belongs to", () => {
    const { builder } = built();
    const orrery = builder.groupFor(PRODUCTS).getObjectByName(`orrery:${PRODUCTS}`);
    expect(orrery).toBeDefined();
    // At the point the camera orbits, so walking around the surface is
    // walking around the instrument — and above the ground rather than sunk
    // into it, since it stands on a plinth.
    expect(Math.hypot(orrery!.position.x, orrery!.position.z)).toBeLessThan(0.001);
    expect(orrery!.position.y).toBeGreaterThan(0);
  });

  it("is hidden until the visitor is standing on that surface", () => {
    const { builder } = built();
    const orrery = builder.groupFor(PRODUCTS).getObjectByName(`orrery:${PRODUCTS}`)!;
    const visible = () => {
      let cursor: THREE.Object3D | null = orrery;
      while (cursor) {
        if (!cursor.visible) return false;
        cursor = cursor.parent;
      }
      return true;
    };
    expect(visible()).toBe(false);
    builder.setStandingOn(PRODUCTS);
    expect(visible()).toBe(true);
  });

  it("gives each moon on it a hit target that names that moon", () => {
    const { builder } = built();
    for (const id of builder.orreryTargets(PRODUCTS)) {
      // The registered mesh is the invisible proxy, not the bead: a bead this
      // small is well under a fingertip, exactly as the moons in the sky were.
      const hit = builder.hitObjects.find(
        (h) => h.id === id && h.type === "body" && h.mesh.name === `orrery-hit:${id}`,
      );
      expect(hit).toBeDefined();
    }
  });

  it("turns its moons, so the instrument reads as running", () => {
    const { builder } = built();
    const orrery = builder.groupFor(PRODUCTS).getObjectByName(`orrery:${PRODUCTS}`)!;
    const pivot = orrery.children.find((c) => c.name.startsWith("orrery-pivot:"))!;
    const before = pivot.rotation.y;
    for (let i = 0; i < 30; i++) builder.update(i, 1);
    expect(pivot.rotation.y).not.toBeCloseTo(before, 4);
  });

  it("is not built for a scope with no moons to travel between", () => {
    const { builder } = built();
    // A moon's own surface has satellites, not moons: there is nowhere to
    // launch a flight to, so there is no instrument.
    expect(
      builder.groupFor(moonScopeId("PickMe")).getObjectByName(`orrery:${moonScopeId("PickMe")}`),
    ).toBeUndefined();
    expect(builder.orreryTargets(moonScopeId("PickMe"))).toEqual([]);
  });
});
