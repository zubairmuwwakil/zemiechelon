import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { WorldCameraManager, ASTROLABE_OUTER } from "../WorldCameraManager";

function settled(manager: WorldCameraManager): THREE.Vector3 {
  // Pose lerps toward its target; twenty long frames is well past convergence.
  for (let i = 0; i < 20; i++) manager.update(1);
  return manager.target.clone();
}

describe("descent", () => {
  it("frames an arbitrary group, with no knowledge of the galaxy", () => {
    const manager = new WorldCameraManager(1280, 720);
    const group = new THREE.Group();
    group.position.set(-99.6, 1, 57.3);
    group.updateMatrixWorld(true);

    manager.descend(group, 5.92);
    const target = settled(manager);

    expect(target.x).toBeCloseTo(-99.6, 1);
    expect(target.z).toBeCloseTo(57.3, 1);
  });

  it("composes a nested frame's world matrix rather than its local position", () => {
    const manager = new WorldCameraManager(1280, 720);
    const parent = new THREE.Group();
    parent.position.set(100, 0, 0);
    const child = new THREE.Group();
    child.position.set(10, 0, 0);
    parent.add(child);
    parent.updateMatrixWorld(true);

    manager.descend(child, 4);
    expect(settled(manager).x).toBeCloseTo(110, 1);
  });

  it("returns to the galaxy pose on ascent", () => {
    const manager = new WorldCameraManager(1280, 720);
    const group = new THREE.Group();
    group.position.set(-99.6, 1, 57.3);
    group.updateMatrixWorld(true);

    manager.descend(group, 5.92);
    settled(manager);
    manager.ascend();
    const target = settled(manager);

    expect(target.x).toBeCloseTo(0, 1);
    expect(target.z).toBeCloseTo(0, 1);
  });

  it("arrives without travelling when motion is reduced", () => {
    const manager = new WorldCameraManager(1280, 720, true);
    const group = new THREE.Group();
    group.position.set(-99.6, 1, 57.3);
    group.updateMatrixWorld(true);

    manager.descend(group, 5.92);
    // No update() call at all: reduced motion means arrived, not animating.
    expect(manager.target.x).toBeCloseTo(-99.6, 1);
  });
});

describe("camera depth follows the frame it is in", () => {
  it("clears the ground at a surface frame's bottom of frame", () => {
    const manager = new WorldCameraManager(1280, 720);
    // A shard at the recommended radius. The nearest ground a standing camera
    // can see sits 0.202 * R away; the near plane has to be inside that.
    const shardRadius = 3.0;
    manager.setFrameScale(shardRadius);
    expect(manager.depth.near).toBeLessThan(0.202 * shardRadius);
  });

  it("still reaches the far side of the galaxy from a surface", () => {
    const manager = new WorldCameraManager(1280, 720);
    manager.setFrameScale(3.0);
    // Standing on a moon you can still see the core and the opposite arm. A
    // far plane derived from the frame's own size would clip them away.
    expect(manager.depth.far).toBeGreaterThan(ASTROLABE_OUTER * 3);
  });

  it("lets the camera get close enough to stand on a shard", () => {
    const manager = new WorldCameraManager(1280, 720);
    manager.setFrameScale(3.0);
    // The landed orbit radius is 0.66 * R = 1.98.
    expect(manager.depth.minDistance).toBeLessThan(1.98);
  });

  it("does not change the near plane at galaxy framing", () => {
    const manager = new WorldCameraManager(1280, 720);
    manager.setFrameScale(ASTROLABE_OUTER);
    // The scale that already works must be untouched by this change.
    expect(manager.depth.near).toBeCloseTo(0.5, 6);
  });

  it("still reaches the whole galaxy from the galaxy frame", () => {
    const manager = new WorldCameraManager(1280, 720);
    manager.setFrameScale(ASTROLABE_OUTER);
    expect(manager.depth.maxDistance).toBeGreaterThanOrEqual(480);
    expect(manager.depth.far).toBeGreaterThan(ASTROLABE_OUTER * 5);
  });

  it("restores galaxy depth on ascent", () => {
    const manager = new WorldCameraManager(1280, 720);
    manager.setFrameScale(3.0);
    manager.ascend();
    expect(manager.depth.minDistance).toBeGreaterThan(1.98);
    expect(manager.depth.far).toBeGreaterThan(ASTROLABE_OUTER * 5);
  });

  it("sizes depth to the frame descent was given", () => {
    const manager = new WorldCameraManager(1280, 720);
    const group = new THREE.Group();
    group.position.set(-99.6, 1, 57.3);
    group.updateMatrixWorld(true);
    manager.descend(group, 5.92);
    expect(manager.depth.near).toBeLessThan(0.5);
    expect(manager.depth.minDistance).toBeLessThan(5.92);
  });
});
