// @vitest-environment jsdom
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { DayNightController, SUN_ARC_PERIOD_SECONDS } from "../DayNightController";

function controller() {
  return new DayNightController(new THREE.Scene(), "day");
}

/** Advance in one-second steps, the way the render loop does. */
function run(c: DayNightController, seconds: number) {
  for (let i = 0; i < seconds; i++) c.update(1);
}

describe("the sun moves", () => {
  it("reports a unit direction", () => {
    expect(controller().sunDirection().length()).toBeCloseTo(1, 6);
  });

  it("has moved measurably after a minute", () => {
    const c = controller();
    const start = c.sunDirection().clone();
    run(c, 60);
    expect(c.sunDirection().angleTo(start)).toBeGreaterThan(0.02);
  });

  it("comes back to where it started after one circuit", () => {
    const c = controller();
    const start = c.sunDirection().clone();
    run(c, SUN_ARC_PERIOD_SECONDS);
    expect(c.sunDirection().angleTo(start)).toBeLessThan(0.01);
  });

  it("keeps the sun above the plane, so the map is never lit from below", () => {
    const c = controller();
    for (let i = 0; i < SUN_ARC_PERIOD_SECONDS; i += 7) {
      run(c, 7);
      expect(c.sunDirection().y).toBeGreaterThan(0.05);
    }
  });

  it("holds still when the visitor has asked for less motion", () => {
    const c = controller();
    c.setReducedMotion(true);
    const start = c.sunDirection().clone();
    run(c, 300);
    expect(c.sunDirection().angleTo(start)).toBeLessThan(1e-9);
  });
});
