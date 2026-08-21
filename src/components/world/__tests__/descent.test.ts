import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { WorldCameraManager } from "../WorldCameraManager";

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
