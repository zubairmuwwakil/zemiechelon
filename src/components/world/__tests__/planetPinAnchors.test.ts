// @vitest-environment jsdom
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { WorldSceneBuilder } from "../WorldSceneBuilder";
import { GalaxyBuilder } from "../GalaxyBuilder";
import { PIN_HEIGHTS, planetPinAnchors } from "../planetPins";
import { PLANET_CENTERS } from "../WorldCameraManager";
import { drawnWorldPosition, planetFrame } from "../planetFrames";
import { bodiesFor, loadBodies } from "@/lib/atlas/bodies";
import { patternAngle } from "@/lib/atlas/motion";
import { placeSolarSystem } from "@/lib/atlas/galaxyPlacement";
import { SOLAR_SYSTEM_CHANNEL, SOLAR_SYSTEM_ZEMI, type Scope } from "@/lib/atlas/scopes";

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

/**
 * A system built and hung in the galaxy, the way `WorldCanvas` does it.
 *
 * The placement is the whole point here: a builder on its own sits at the
 * origin unleaned, which is the one arrangement in which this rule cannot be
 * observed.
 */
function attached(system: Scope) {
  const scene = new THREE.Scene();
  const galaxy = new GalaxyBuilder(scene);
  galaxy.build();
  const builder = new WorldSceneBuilder(scene, system, bodiesFor(system), "2026-08-22", 1);
  builder.build();
  galaxy.attach(system, builder.rootGroup);
  scene.updateMatrixWorld(true);
  return builder;
}

describe("a pin height is measured in its own system's frame", () => {
  it("leaves no pin beneath the planet it labels", () => {
    // The failure this exists to catch, in the form it actually took: written
    // as a world altitude, the channel's pins hung 64 to 90 units UNDER their
    // planets, while every assertion above stayed green — because the atlas
    // sits at the galactic origin, where its own plane IS the world plane.
    const builder = attached(SOLAR_SYSTEM_CHANNEL);
    expect(
      placeSolarSystem(SOLAR_SYSTEM_CHANNEL).tilt,
      "a level system proves nothing here",
    ).toBeGreaterThan(0);

    for (const { id, anchor } of planetPinAnchors(builder)) {
      const planet = drawnWorldPosition(planetFrame(builder, id)!);
      expect(anchor.y - planet.y, `${id} pin hangs below its planet`).toBeGreaterThan(0);
    }
  });

  it("stands each pin on its planet, along the system's own up", () => {
    // The precise statement of the rule: in the system's frame a pin shares its
    // planet's horizontal position exactly and sits at the authored height. In
    // world space that direction is the leaned one, which is what carries the
    // pin over a planet the galactic plane does not pass through.
    const builder = attached(SOLAR_SYSTEM_CHANNEL);
    const toSystem = new THREE.Matrix4().copy(builder.rootGroup.matrixWorld).invert();

    for (const { id, anchor } of planetPinAnchors(builder)) {
      const planet = drawnWorldPosition(planetFrame(builder, id)!).applyMatrix4(toSystem);
      const local = anchor.clone().applyMatrix4(toSystem);
      expect(local.y, id).toBeCloseTo(PIN_HEIGHTS[id], 6);
      expect(Math.hypot(local.x - planet.x, local.z - planet.z), id).toBeLessThan(1e-6);
    }
  });

  it("moves the atlas not at all, placed or not", () => {
    // The atlas is the system every camera preset, pin anchor and golden
    // fixture describes. Its root turns only about +Y, which carries y through
    // untouched — so the two paths must agree to the bit, not to a tolerance.
    const placed = new Map(planetPinAnchors(attached(SOLAR_SYSTEM_ZEMI)).map((p) => [p.id, p.anchor]));
    for (const { id, anchor } of planetPinAnchors(built())) {
      expect(placed.get(id)!.y, id).toBe(anchor.y);
      expect(placed.get(id)!.distanceTo(anchor), id).toBeLessThan(1e-9);
    }
  });
});
