import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { CAMERA_PRESETS, WorldCameraManager } from "../WorldCameraManager";
import { GALAXY_REACH } from "@/lib/atlas/galaxyPlacement";

describe("the galaxy pose", () => {
  it("is registered as a preset", () => {
    expect(CAMERA_PRESETS.galaxy).toBeDefined();
  });

  it("stands far enough back to hold the whole galaxy", () => {
    const pose = CAMERA_PRESETS.galaxy;
    expect(pose.position.length()).toBeGreaterThan(GALAXY_REACH);
  });

  it("aims at the galactic core", () => {
    expect(CAMERA_PRESETS.galaxy.target.length()).toBe(0);
  });

  it("keeps the far plane past the far rim", () => {
    const m = new WorldCameraManager(1200, 800);
    m.setFrameScale(GALAXY_REACH);
    expect(m.depth.far).toBeGreaterThan(GALAXY_REACH * 2);
  });
});

describe("framing a system that rises out of the galactic plane", () => {
  /**
   * `placeSolarSystem` lifts a system by the same angle it leans, so the
   * channel's centre sits 88 units off the galactic plane. The framing ratios
   * were written when everything framable sat at y = 0 and so read as ABSOLUTE
   * heights — which aims the camera at the plane under the disc rather than at
   * the disc, and pushes it to the top of the frame.
   *
   * Asserted as an invariance rather than against a number: framing is the same
   * composition wherever the body sits, so lifting the body by `rise` lifts the
   * whole pose by `rise` and changes nothing else. That is the property, and it
   * cannot be satisfied by a tolerance that happens to be wide enough.
   */
  function poseFor(center: THREE.Vector3, radius: number) {
    const frame = new THREE.Object3D();
    frame.position.copy(center);
    frame.updateMatrixWorld(true);
    const camera = new WorldCameraManager(1200, 800);
    camera.descend(frame, radius);
    // lerpRate is `deltaSeconds * 3.8` clamped to 1, so one second arrives.
    camera.update(1);
    return { target: camera.target.clone(), position: camera.camera.position.clone() };
  }

  const RISE = 88.5;
  const RADIUS = 152;
  const onPlane = new THREE.Vector3(-70.9, 0, -504.5);

  it("lifts the whole pose with the body, and only by the rise", () => {
    const low = poseFor(onPlane, RADIUS);
    const high = poseFor(onPlane.clone().setY(RISE), RADIUS);
    expect(high.target.y - low.target.y).toBeCloseTo(RISE, 4);
    expect(high.position.y - low.position.y).toBeCloseTo(RISE, 4);
  });

  it("leaves the bearing on the body untouched", () => {
    const low = poseFor(onPlane, RADIUS);
    const high = poseFor(onPlane.clone().setY(RISE), RADIUS);
    expect(high.target.x).toBeCloseTo(low.target.x, 4);
    expect(high.target.z).toBeCloseTo(low.target.z, 4);
    expect(high.position.x).toBeCloseTo(low.position.x, 4);
    expect(high.position.z).toBeCloseTo(low.position.z, 4);
  });
});
