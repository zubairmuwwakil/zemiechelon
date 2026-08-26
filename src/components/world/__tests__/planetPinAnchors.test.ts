// @vitest-environment jsdom
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { WorldSceneBuilder } from "../WorldSceneBuilder";
import { PIN_HEIGHTS, planetPinAnchors } from "../planetPins";
import { PLANET_CENTERS } from "../WorldCameraManager";
import { loadBodies } from "@/lib/atlas/bodies";
import { patternAngle } from "@/lib/atlas/motion";
import { SOLAR_SYSTEM_ZEMI } from "@/lib/atlas/scopes";

const bodies = loadBodies();
/**
 * The arms THIS system draws, taken from its own declaration.
 *
 * Not `PIN_HEIGHTS` minus the core, which is what it was while the atlas was
 * the only solar system there was. That table is keyed by arm across the whole
 * galaxy, so once the channel was registered it began to describe planets this
 * builder does not draw — and every assertion below would have gone on passing,
 * because the layout fallback answered for them.
 */
const PLANETS = Object.keys(SOLAR_SYSTEM_ZEMI.arms);

function built() {
  const builder = new WorldSceneBuilder(new THREE.Scene(), SOLAR_SYSTEM_ZEMI, bodies, "2026-08-22", 1);
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
      ["solarSystem", ...PLANETS].sort(),
    );
  });

  it("pins no planet belonging to another solar system", () => {
    // The pins of two systems are projected into one overlay, keyed by arm. A
    // builder that answers for an arm it does not draw does not merely add a
    // stray label: it anchors another system's planet inside this one, at a
    // layout centre expressed in a frame that is not the one it is composed
    // through. Every id here would also collide with the same id from the
    // system that really owns it.
    const drawn = new Set(planetPinAnchors(built()).map((p) => p.id));
    const elsewhere = Object.keys(PIN_HEIGHTS).filter(
      (arm) => arm !== "solarSystem" && !(arm in SOLAR_SYSTEM_ZEMI.arms),
    );
    expect(elsewhere.length, "no other system declares arms, so this proves nothing").toBeGreaterThan(0);
    expect(elsewhere.filter((arm) => drawn.has(arm))).toEqual([]);
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
