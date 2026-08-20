import { describe, expect, it } from "vitest";
import {
  ARM_DUST_COUNT,
  BACKGROUND_STAR_COUNT,
  MOBILE_FIELD_SCALE,
  NARROW_VIEWPORT,
  buildFieldGeometry,
  fieldDensityFor,
} from "../WorldSceneBuilder";
import { loadBodies } from "@/lib/atlas/bodies";

describe("field density", () => {
  it("budgets a real background field, not a token one", () => {
    expect(BACKGROUND_STAR_COUNT).toBeGreaterThanOrEqual(8_000);
    expect(ARM_DUST_COUNT).toBeGreaterThanOrEqual(3_000);
  });

  it("emits three floats per point", () => {
    const { positions } = buildFieldGeometry(loadBodies(), 1);
    expect(positions.length).toBe((BACKGROUND_STAR_COUNT + ARM_DUST_COUNT) * 3);
  });

  it("is deterministic for a seed, so the sky does not reshuffle on every reload", () => {
    expect(buildFieldGeometry(loadBodies(), 7).positions).toEqual(
      buildFieldGeometry(loadBodies(), 7).positions,
    );
  });

  it("emits no NaN, which would silently blank the whole point cloud", () => {
    const { positions } = buildFieldGeometry(loadBodies(), 1);
    expect(positions.some((v) => Number.isNaN(v))).toBe(false);
  });

  it("concentrates dust along the arms rather than filling a disc uniformly", () => {
    const { positions } = buildFieldGeometry(loadBodies(), 3);
    // Dust points occupy the tail of the buffer.
    const start = BACKGROUND_STAR_COUNT * 3;
    let onArm = 0;
    for (let i = start; i < positions.length; i += 3) {
      const r = Math.hypot(positions[i], positions[i + 2]);
      if (r > 2 && r < 30) onArm++;
    }
    expect(onArm).toBeGreaterThan(ARM_DUST_COUNT * 0.5);
  });
});

describe("mobile budget", () => {
  it("thins the field on a narrow viewport and not on a wide one", () => {
    expect(fieldDensityFor(375)).toBe(MOBILE_FIELD_SCALE);
    expect(fieldDensityFor(NARROW_VIEWPORT)).toBe(1);
    expect(fieldDensityFor(1440)).toBe(1);
  });
});
