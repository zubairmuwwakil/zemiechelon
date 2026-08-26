import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { DayNightController } from "../DayNightController";
import { ASTROLABE_OUTER } from "../WorldCameraManager";

function lit() {
  const scene = new THREE.Scene();
  const controller = new DayNightController(scene, "day");
  const light = scene.children.find(
    (o): o is THREE.DirectionalLight => o instanceof THREE.DirectionalLight,
  )!;
  return { scene, controller, light };
}

/**
 * Where a caster at `point` lands in the shadow map's clip space.
 *
 * Driven through three's own `updateMatrices` rather than through arithmetic
 * repeated from `DayNightController`, so this asserts what the renderer will
 * actually do with the frustum rather than what the controller meant.
 */
function shadowNdc(
  scene: THREE.Scene,
  light: THREE.DirectionalLight,
  point: THREE.Vector3,
): THREE.Vector3 {
  scene.updateMatrixWorld(true);
  light.shadow.updateMatrices(light);
  return point.clone().project(light.shadow.camera);
}

const inside = (ndc: THREE.Vector3) =>
  Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1 && ndc.z >= -1 && ndc.z <= 1;

describe("the shadow volume follows the frame it is sizing", () => {
  it("covers a landed frame far from the galactic core", () => {
    // The regression: standing on a shard ~115 units out set a frustum three
    // units wide and left it centred on the origin, so nothing in the landed
    // frame was ever in the shadow map.
    const { scene, controller, light } = lit();
    const stood = new THREE.Vector3(-88, 4, 74);
    controller.setShadowReach(3);
    controller.setShadowCenter(stood);
    expect(inside(shadowNdc(scene, light, stood))).toBe(true);
  });

  it("covers a solar system that does not sit at the core", () => {
    const { scene, controller, light } = lit();
    const center = new THREE.Vector3(-70.9, 88.5, -504.5);
    controller.setShadowReach(152);
    controller.setShadowCenter(center);
    expect(inside(shadowNdc(scene, light, center))).toBe(true);
    // Its own rim too, not merely its centre.
    expect(inside(shadowNdc(scene, light, center.clone().add(new THREE.Vector3(120, 0, 0))))).toBe(true);
  });

  it("still covers the atlas at the core", () => {
    const { scene, controller, light } = lit();
    controller.setShadowReach(ASTROLABE_OUTER);
    expect(inside(shadowNdc(scene, light, new THREE.Vector3(171, 0, 0)))).toBe(true);
  });

  it("holds a caster standing higher than the palette's authored sun", () => {
    // `sunPosition` is authored at y = 60. A frustum whose near plane starts
    // at the light clips anything above it — which at galaxy scale is most of
    // the second system.
    const { scene, controller, light } = lit();
    controller.setShadowReach(ASTROLABE_OUTER);
    expect(inside(shadowNdc(scene, light, new THREE.Vector3(0, 88, 0)))).toBe(true);
  });

  it("does not change the direction the world is lit from", () => {
    const { controller } = lit();
    const before = controller.sunDirection().clone();
    controller.setShadowReach(3);
    controller.setShadowCenter(new THREE.Vector3(-88, 4, 74));
    expect(controller.sunDirection().angleTo(before)).toBeLessThan(1e-9);
    expect(controller.sunDirection().length()).toBeCloseTo(1, 6);
  });
});
