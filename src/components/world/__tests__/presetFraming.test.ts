// @vitest-environment jsdom
import * as THREE from "three";
import { beforeEach, describe, expect, it } from "vitest";
import { WorldSceneBuilder } from "../WorldSceneBuilder";
import {
  CAMERA_PRESETS,
  PLANET_RADII,
  WorldCameraManager,
  presetArm,
} from "../WorldCameraManager";
import { planetFrame, drawnWorldPosition } from "../planetFrames";
import { planetPinAnchors, PIN_HEIGHTS } from "../planetPins";
import { loadBodies } from "@/lib/atlas/bodies";
import { patternAngle } from "@/lib/atlas/motion";

const bodies = loadBodies();
/** Every arm the top nav can name. */
const ARMS = Object.keys(PIN_HEIGHTS).filter((id) => id !== "galaxy");

let builder: WorldSceneBuilder;
let camera: WorldCameraManager;

beforeEach(() => {
  builder = new WorldSceneBuilder(new THREE.Scene(), bodies, "2026-08-22", 1);
  builder.build();
  camera = new WorldCameraManager(1200, 897);
});

/** Advance the pattern to `seconds`, then let the camera converge on it. */
function advance(seconds: number): void {
  builder.update(seconds, 1 / 60);
  builder.rootGroup.updateMatrixWorld(true);
  // Long frames, as the other camera suites use: the pose lerps toward its
  // target at `dt * 3.8`, so a real-time frame closes only 6% of the gap and
  // twenty of them would leave the measurement reading lag rather than aim.
  for (let i = 0; i < 20; i++) camera.update(1);
}

/** Frame `arm` exactly as `WorldCanvas` does for a nav preset. */
function frameByPreset(preset: string): void {
  const arm = presetArm(preset);
  expect(arm, `${preset} names no arm`).not.toBeNull();
  const drawn = planetFrame(builder, arm!);
  expect(drawn, `${arm} resolves to no frame`).not.toBeNull();
  camera.descend(drawn!.frame, PLANET_RADII[arm!], drawn!.offset);
}

/** Where the planet the preset named actually is, right now. */
function drawnPlanet(arm: string): THREE.Vector3 {
  return drawnWorldPosition(planetFrame(builder, arm)!);
}

describe("which presets name a body", () => {
  it("names an arm for every planet the nav can select, alias included", () => {
    for (const arm of ARMS) expect(presetArm(arm), arm).toBe(arm);
    // Retained alias: the HUD and page.tsx both still dispatch "founder".
    expect(presetArm("founder")).toBe("self");
  });

  it("names no arm for the presets that name a place", () => {
    // The origin the pattern turns about does not move, so there is nothing to
    // follow and the two frozen vectors go on being right forever.
    expect(presetArm("galaxy")).toBeNull();
    expect(presetArm("overview")).toBeNull();
    expect(presetArm("sun")).toBeNull();
    expect(presetArm("not-a-planet")).toBeNull();
  });
});

describe("a nav preset resolves to a drawn frame", () => {
  it("resolves all five arms, though only two have a scope of their own", () => {
    const scoped = ARMS.filter((arm) => builder.scopeGroups.has(`planet:${arm}`));
    expect(scoped.length).toBeLessThan(ARMS.length);
    for (const arm of ARMS) expect(planetFrame(builder, arm), arm).not.toBeNull();
  });

  it("resolves to the same place the planet's own pin hangs from", () => {
    // One rule, so a preset cannot frame one point while the label naming it
    // sits over another.
    advance(420);
    const pins = new Map(planetPinAnchors(builder).map((p) => [p.id, p.anchor]));
    for (const arm of ARMS) {
      const framed = drawnPlanet(arm);
      const pin = pins.get(arm)!;
      expect(Math.hypot(framed.x - pin.x, framed.z - pin.z), arm).toBeLessThan(1e-6);
    }
  });
});

describe("a nav preset frames the planet, not the place it started", () => {
  it("frames each arm exactly as the preset table did, before anything turns", () => {
    // The point of routing presets through the descent is that it changes what
    // the camera FOLLOWS, never how it frames. `orbitPose` and the descent's
    // own framing are one function now; this is the assertion that keeps them
    // one, since a drift between them would be invisible on any single frame.
    for (const arm of ARMS) {
      frameByPreset(arm);
      advance(0);
      const preset = CAMERA_PRESETS[arm];
      expect(camera.target.distanceTo(preset.target), arm).toBeLessThan(0.01);
      expect(camera.camera.position.distanceTo(preset.position), arm).toBeLessThan(0.01);
    }
  });

  it("keeps every arm centred after the pattern has turned a third of a lap", () => {
    for (const arm of ARMS) {
      camera = new WorldCameraManager(1200, 897);
      frameByPreset(arm);
      advance(0);
      advance(600);

      const planet = drawnPlanet(arm);
      const radius = PLANET_RADII[arm];
      // Framed means centred on it, to well inside the planet's own rim.
      expect(Math.hypot(camera.target.x - planet.x, camera.target.z - planet.z), arm)
        .toBeLessThan(radius * 0.5);
    }
  });

  it("measures the drift the preset table would have had, so the guard is real", () => {
    // Without this the test above could pass against a planet that never moved.
    // 600 s is a third of the 30-minute period; every arm is far enough out
    // that a third of a lap is many times its own radius.
    builder.update(600, 1 / 60);
    builder.rootGroup.updateMatrixWorld(true);
    const turn = patternAngle(600);
    expect(turn).toBeGreaterThan(2);

    for (const arm of ARMS) {
      const stale = CAMERA_PRESETS[arm].target;
      const now = drawnPlanet(arm);
      expect(Math.hypot(now.x - stale.x, now.z - stale.z), arm)
        .toBeGreaterThan(PLANET_RADII[arm] * 4);
    }
  });

  it("still lets the visitor orbit a planet reached from the nav", () => {
    // `descend` seeds the orbit offset once and re-aims only the pose, so
    // following must not cost the controls — the same split `descent.test.ts`
    // pins for a clicked frame, now on the path most of the nav takes.
    frameByPreset("creative");
    advance(0);
    const framed = camera.camera.position.clone().sub(camera.target);

    camera.onPointerDrag(220, 0);
    camera.onWheelZoom(-400);
    advance(120);
    const dragged = camera.camera.position.clone().sub(camera.target);

    const bearing = (v: THREE.Vector3) => Math.atan2(v.z, v.x);
    const turn = Math.abs(Math.atan2(
      Math.sin(bearing(dragged) - bearing(framed)),
      Math.cos(bearing(dragged) - bearing(framed)),
    ));
    expect(turn).toBeGreaterThan(0.5);
    expect(dragged.length()).toBeLessThan(framed.length());
    // And it is still framing the planet while the visitor holds it.
    const planet = drawnPlanet("creative");
    expect(Math.hypot(camera.target.x - planet.x, camera.target.z - planet.z))
      .toBeLessThan(PLANET_RADII.creative * 0.5);
  });
});
