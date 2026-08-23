// @vitest-environment jsdom
import * as THREE from "three";
import { beforeEach, describe, expect, it } from "vitest";
import { WorldSceneBuilder } from "../WorldSceneBuilder";
import { WorldCameraManager } from "../WorldCameraManager";
import { loadBodies } from "@/lib/atlas/bodies";
import { moonScopeId, planetScopeId } from "@/lib/atlas/galaxy";
import {
  shardRadiusFor,
  SURFACE_ALTITUDE_RATIO,
  SURFACE_OFFSET_RATIO,
} from "@/lib/atlas/surfaces";

const bodies = loadBodies();
const PICKME = moonScopeId("PickMe");
const PRODUCTS = planetScopeId("products");

let scene: THREE.Scene;
let builder: WorldSceneBuilder;
let camera: WorldCameraManager;

beforeEach(() => {
  scene = new THREE.Scene();
  builder = new WorldSceneBuilder(scene, bodies, "2026-08-22", 1);
  builder.build();
  camera = new WorldCameraManager(1280, 800);
});

/** The pose lerps toward its target; twenty long frames is past convergence. */
function settle(): void {
  for (let i = 0; i < 20; i++) camera.update(1);
}

/** Advance the orbits by `seconds` of scene time. */
function orbit(seconds: number): void {
  for (let i = 0; i < seconds; i++) builder.update(i, 1);
}

function worldPos(object: THREE.Object3D): THREE.Vector3 {
  object.updateWorldMatrix(true, false);
  return new THREE.Vector3().setFromMatrixPosition(object.matrixWorld);
}

/** Height above the orbit target, and the pitch that height implies. */
function pose() {
  const offset = camera.camera.position.clone().sub(camera.target);
  const horizontal = Math.hypot(offset.x, offset.z);
  return {
    altitude: offset.y,
    pitchDeg: THREE.MathUtils.radToDeg(Math.atan2(offset.y, horizontal)),
    distance: offset.length(),
  };
}

/** Degrees between the camera axis and a point. Beyond fov/2 it has left frame. */
function offAxisDeg(point: THREE.Vector3): number {
  const forward = camera.target.clone().sub(camera.camera.position).normalize();
  const toPoint = point.clone().sub(camera.camera.position).normalize();
  return THREE.MathUtils.radToDeg(
    Math.acos(THREE.MathUtils.clamp(forward.dot(toPoint), -1, 1)),
  );
}

function inFrustum(point: THREE.Vector3): boolean {
  camera.camera.updateMatrixWorld(true);
  camera.camera.updateProjectionMatrix();
  const frustum = new THREE.Frustum().setFromProjectionMatrix(
    new THREE.Matrix4().multiplyMatrices(
      camera.camera.projectionMatrix,
      camera.camera.matrixWorldInverse,
    ),
  );
  return frustum.containsPoint(point);
}

describe("standing on a surface", () => {
  it("puts the camera at the measured altitude and pitch", () => {
    const radius = shardRadiusFor(PICKME, bodies);
    camera.landOnSurface(builder.groupFor(PICKME), builder.groupFor(PRODUCTS), radius);
    settle();

    const { altitude, pitchDeg } = pose();
    expect(altitude).toBeCloseTo(radius * SURFACE_ALTITUDE_RATIO, 4);
    // atan(0.10 / 0.65) = 8.75 degrees. Inside the 5-12 band the spike measured.
    expect(pitchDeg).toBeGreaterThan(5);
    expect(pitchDeg).toBeLessThan(12);
  });

  it("orbits a point on the surface, not the body", () => {
    const radius = shardRadiusFor(PICKME, bodies);
    camera.landOnSurface(builder.groupFor(PICKME), builder.groupFor(PRODUCTS), radius);
    settle();
    // The target is the moon's own origin — the point the shard sits on.
    expect(camera.target.distanceTo(worldPos(builder.groupFor(PICKME)))).toBeLessThan(0.001);
    expect(pose().distance).toBeCloseTo(
      radius * Math.hypot(SURFACE_ALTITUDE_RATIO, SURFACE_OFFSET_RATIO),
      4,
    );
  });

  it("looks across at the parent rather than down at the ground", () => {
    const radius = shardRadiusFor(PICKME, bodies);
    camera.landOnSurface(builder.groupFor(PICKME), builder.groupFor(PRODUCTS), radius);
    settle();
    // Half the vertical field of view is 21 degrees. The parent sits well
    // inside that, high in frame rather than at its edge.
    expect(offAxisDeg(worldPos(builder.groupFor(PRODUCTS)))).toBeLessThan(15);
    expect(inFrustum(worldPos(builder.groupFor(PRODUCTS)))).toBe(true);
  });
});

describe("a landed frame that moves under the camera", () => {
  it("holds the parent in frame for a minute of orbit", () => {
    // This is the failure the previous spike paid for: twenty seconds in, the
    // moon had orbited away and the parent had left the shot. PickMe travels
    // 0.745 degrees a second, so a minute is about 45 degrees of orbit.
    const radius = shardRadiusFor(PICKME, bodies);
    camera.landOnSurface(builder.groupFor(PICKME), builder.groupFor(PRODUCTS), radius);
    settle();
    const first = offAxisDeg(worldPos(builder.groupFor(PRODUCTS)));

    for (const seconds of [15, 30, 60]) {
      orbit(seconds);
      settle();
      expect(offAxisDeg(worldPos(builder.groupFor(PRODUCTS)))).toBeCloseTo(first, 3);
      expect(inFrustum(worldPos(builder.groupFor(PRODUCTS)))).toBe(true);
    }
  });

  it("keeps the camera on the surface it landed on", () => {
    const radius = shardRadiusFor(PICKME, bodies);
    camera.landOnSurface(builder.groupFor(PICKME), builder.groupFor(PRODUCTS), radius);
    settle();
    const before = pose();

    orbit(60);
    settle();

    expect(pose().altitude).toBeCloseTo(before.altitude, 4);
    expect(pose().pitchDeg).toBeCloseTo(before.pitchDeg, 3);
    expect(camera.target.distanceTo(worldPos(builder.groupFor(PICKME)))).toBeLessThan(0.001);
  });

  it("travels with the moon rather than staying where it landed", () => {
    const radius = shardRadiusFor(PICKME, bodies);
    camera.landOnSurface(builder.groupFor(PICKME), builder.groupFor(PRODUCTS), radius);
    settle();
    const landedAt = camera.camera.position.clone();

    orbit(60);
    settle();

    // A static pose would still be here. The moon has moved several units.
    expect(camera.camera.position.distanceTo(landedAt)).toBeGreaterThan(1);
  });
});

describe("looking around while landed", () => {
  it("preserves altitude and pitch through a drag", () => {
    const radius = shardRadiusFor(PICKME, bodies);
    camera.landOnSurface(builder.groupFor(PICKME), builder.groupFor(PRODUCTS), radius);
    settle();
    const before = pose();

    // 120 degrees of azimuth at the manager's own rotate speed.
    camera.onPointerDrag(-(120 * Math.PI) / 180 / 0.005, 0);
    settle();

    expect(pose().altitude).toBeCloseTo(before.altitude, 3);
    expect(pose().pitchDeg).toBeCloseTo(before.pitchDeg, 2);
  });

  it("lets a visitor turn away from the parent", () => {
    // Deliberately allowed. The spike found that turning away shows the galaxy
    // core and an arm, which reads fine — the failure §3.2 guards against is
    // the camera drifting there on its own, not the visitor choosing to look.
    const radius = shardRadiusFor(PICKME, bodies);
    camera.landOnSurface(builder.groupFor(PICKME), builder.groupFor(PRODUCTS), radius);
    settle();
    camera.onPointerDrag(-(120 * Math.PI) / 180 / 0.005, 0);
    settle();
    expect(offAxisDeg(worldPos(builder.groupFor(PRODUCTS)))).toBeGreaterThan(60);
  });
});

describe("landing on a planet", () => {
  it("faces the galaxy it belongs to, whichever way that is", () => {
    // Products' parent has no body worth framing — the core is 7.5 across at
    // 114.9 away, a frame fraction of 0.17, under the 0.30 floor. So the test
    // is that the galaxy is in shot, not that it fills a share of the frame.
    const radius = shardRadiusFor(PRODUCTS, bodies);
    const galaxy = builder.groupFor("galaxy:zemi");
    camera.landOnSurface(builder.groupFor(PRODUCTS), galaxy, radius);
    settle();

    expect(offAxisDeg(worldPos(galaxy))).toBeLessThan(15);
    expect(inFrustum(worldPos(galaxy))).toBe(true);
  });

  it("stands at the same ratios a moon's surface uses", () => {
    const radius = shardRadiusFor(PRODUCTS, bodies);
    camera.landOnSurface(builder.groupFor(PRODUCTS), builder.groupFor("galaxy:zemi"), radius);
    settle();
    expect(pose().altitude).toBeCloseTo(radius * SURFACE_ALTITUDE_RATIO, 4);
  });
});

describe("leaving a surface", () => {
  it("releases the surface on ascent", () => {
    const radius = shardRadiusFor(PICKME, bodies);
    camera.landOnSurface(builder.groupFor(PICKME), builder.groupFor(PRODUCTS), radius);
    settle();
    camera.ascend();
    settle();
    expect(camera.target.length()).toBeLessThan(1);
  });

  it("releases the surface when descending somewhere else", () => {
    const radius = shardRadiusFor(PICKME, bodies);
    camera.landOnSurface(builder.groupFor(PICKME), builder.groupFor(PRODUCTS), radius);
    settle();

    const products = builder.groupFor(PRODUCTS);
    camera.descend(products, 5.92);
    settle();
    // Framing a planet from outside puts the camera well above its own rim;
    // a surface pose would still be hugging the ground.
    expect(pose().altitude).toBeGreaterThan(5.92);
  });

  it("arrives without travelling when motion is reduced", () => {
    const reduced = new WorldCameraManager(1280, 800, true);
    const radius = shardRadiusFor(PICKME, bodies);
    reduced.landOnSurface(builder.groupFor(PICKME), builder.groupFor(PRODUCTS), radius);
    reduced.update(0.016);
    const offset = reduced.camera.position.clone().sub(reduced.target);
    expect(offset.y).toBeCloseTo(radius * SURFACE_ALTITUDE_RATIO, 4);
  });
});
