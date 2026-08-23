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

describe("descending onto something that moves", () => {
  it("follows the frame rather than the place the frame used to be", () => {
    const scene = new THREE.Scene();
    const manager = new WorldCameraManager(1200, 800);
    const frame = new THREE.Group();
    frame.position.set(100, 0, 0);
    scene.add(frame);

    manager.descend(frame, 6);
    for (let i = 0; i < 60; i++) manager.update(1 / 60);
    const framedFirst = manager.target.clone();
    expect(framedFirst.distanceTo(new THREE.Vector3(100, 0, 0))).toBeLessThan(6);

    // The frame travels, as an orbiting moon or a turning galaxy carries it.
    frame.position.set(-100, 0, 40);
    frame.updateWorldMatrix(true, false);
    for (let i = 0; i < 180; i++) manager.update(1 / 60);

    expect(manager.target.distanceTo(new THREE.Vector3(-100, 0, 40))).toBeLessThan(6);
    expect(manager.target.distanceTo(framedFirst)).toBeGreaterThan(50);
  });

  it("lets go of the frame when the camera ascends", () => {
    const scene = new THREE.Scene();
    const manager = new WorldCameraManager(1200, 800);
    const frame = new THREE.Group();
    frame.position.set(100, 0, 0);
    scene.add(frame);

    manager.descend(frame, 6);
    for (let i = 0; i < 60; i++) manager.update(1 / 60);
    manager.ascend();
    for (let i = 0; i < 240; i++) manager.update(1 / 60);

    frame.position.set(-100, 0, 40);
    frame.updateWorldMatrix(true, false);
    for (let i = 0; i < 60; i++) manager.update(1 / 60);
    // Back at the galaxy pose, which is the origin — not chasing the frame.
    expect(manager.target.length()).toBeLessThan(1);
  });

  it("still lets the visitor orbit and zoom the thing it is following", () => {
    // Re-aiming a frame means re-deriving where the camera LOOKS, never where
    // the visitor has dragged it to. `onPointerDrag` and `onWheelZoom` write to
    // the same spherical the framing pose is derived into, so re-deriving that
    // spherical every frame silently takes the controls away from a visitor for
    // as long as they are looking at anything — which is most of the session.
    const scene = new THREE.Scene();
    const manager = new WorldCameraManager(1200, 800);
    const frame = new THREE.Group();
    frame.position.set(100, 0, 0);
    scene.add(frame);

    manager.descend(frame, 6);
    for (let i = 0; i < 60; i++) manager.update(1 / 60);
    const framed = manager.camera.position.clone().sub(manager.target);

    manager.onPointerDrag(220, 0);
    manager.onWheelZoom(-400);
    for (let i = 0; i < 120; i++) manager.update(1 / 60);
    const dragged = manager.camera.position.clone().sub(manager.target);

    // Turned around the frame, and pulled in toward it.
    const bearing = (v: THREE.Vector3) => Math.atan2(v.z, v.x);
    const turn = Math.abs(Math.atan2(
      Math.sin(bearing(dragged) - bearing(framed)),
      Math.cos(bearing(dragged) - bearing(framed)),
    ));
    expect(turn).toBeGreaterThan(0.5);
    expect(dragged.length()).toBeLessThan(framed.length() - 1);

    // And the drag survives the frame travelling, rather than being reset by it.
    frame.position.set(-100, 0, 40);
    frame.updateWorldMatrix(true, false);
    for (let i = 0; i < 120; i++) manager.update(1 / 60);
    const travelled = manager.camera.position.clone().sub(manager.target);
    expect(manager.target.distanceTo(new THREE.Vector3(-100, 0, 40))).toBeLessThan(6);
    expect(travelled.distanceTo(dragged)).toBeLessThan(0.5);
  });
});
