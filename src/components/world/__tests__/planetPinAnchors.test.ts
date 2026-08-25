// @vitest-environment jsdom
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { WorldSceneBuilder } from "../WorldSceneBuilder";
import { PIN_HEIGHTS, planetPinAnchors } from "../planetPins";
import { PLANET_CENTERS } from "../WorldCameraManager";
import { loadBodies } from "@/lib/atlas/bodies";
import { patternAngle } from "@/lib/atlas/motion";

const bodies = loadBodies();
const PLANETS = Object.keys(PIN_HEIGHTS).filter((id) => id !== "solarSystem");

function built() {
  const builder = new WorldSceneBuilder(new THREE.Scene(), bodies, "2026-08-22", 1);
  builder.build();
  return builder;
}

function anchorsAt(builder: WorldSceneBuilder, seconds: number) {
  builder.update(seconds, 0);
  builder.rootGroup.updateMatrixWorld(true);
  return new Map(planetPinAnchors(builder).map(({ id, anchor }) => [id, anchor]));
}

describe("planet pins are anchored to planets", () => {
  it("pins every planet, including the three arms that have no scope of their own", () => {
    // Only `labs` and `products` have scope groups; all five planets are drawn.
    // Asking `groupFor` for the other three throws, and this runs every frame.
    const scoped = [...built().scopeGroups.keys()].filter((k) => k.startsWith("planet:"));
    expect(scoped.length).toBeLessThan(PLANETS.length);
    expect(planetPinAnchors(built()).map((p) => p.id).sort()).toEqual(
      Object.keys(PIN_HEIGHTS).sort(),
    );
  });

  it("keeps every pin over its own planet once the pattern has turned", () => {
    // The failure this exists to catch is silent: a pin cut loose from its
    // planet still projects, still renders, and still looks like a pin. The
    // expected place is the layout centre carried by the pattern's rotation.
    const builder = built();
    const after = anchorsAt(builder, 600);
    const turn = new THREE.Matrix4().makeRotationY(patternAngle(600));
    for (const id of PLANETS) {
      const expected = PLANET_CENTERS[id].clone().applyMatrix4(turn);
      const anchor = after.get(id)!;
      expect(Math.hypot(anchor.x - expected.x, anchor.z - expected.z), id).toBeLessThan(1e-6);
    }
  });

  it("agrees with the scope frame wherever a planet has one", () => {
    // The two paths must not diverge: if a scope group is ever moved off its
    // layout centre, the fallback becomes a lie for every armless planet.
    const builder = built();
    anchorsAt(builder, 300);
    for (const id of PLANETS) {
      const group = builder.scopeGroups.get(`planet:${id}`);
      if (!group) continue;
      const world = group.getWorldPosition(new THREE.Vector3());
      const fallback = PLANET_CENTERS[id].clone().applyMatrix4(builder.rootGroup.matrixWorld);
      expect(Math.hypot(world.x - fallback.x, world.z - fallback.z), id).toBeLessThan(1e-6);
    }
  });

  it("moves the pins with the galaxy rather than leaving them where it started", () => {
    const builder = built();
    const before = anchorsAt(builder, 0);
    const after = anchorsAt(builder, 600);
    for (const id of PLANETS) {
      expect(after.get(id)!.distanceTo(before.get(id)!), `${id} pin did not travel`).toBeGreaterThan(1);
    }
  });

  it("holds the core pin at the axis the pattern turns about", () => {
    const builder = built();
    const core = anchorsAt(builder, 900).get("solarSystem")!;
    expect(Math.hypot(core.x, core.z)).toBeLessThan(1e-6);
  });

  it("keeps the authored height, which is the one part that is not derived", () => {
    const builder = built();
    for (const [id, anchor] of anchorsAt(builder, 450)) {
      expect(anchor.y).toBe(PIN_HEIGHTS[id]);
    }
  });
});
