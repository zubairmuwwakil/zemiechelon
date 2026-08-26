import { describe, expect, it } from "vitest";
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
