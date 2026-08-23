import { describe, expect, it } from "vitest";
import { GALAXY_ZEMI } from "../galaxy";
import {
  MAX_INCLINATION,
  MAX_OBLIQUITY,
  PATTERN_PERIOD_SECONDS,
  PATTERN_RATE,
  obliquityFor,
  patternAngle,
} from "../motion";

const ARMS = Object.keys(GALAXY_ZEMI.arms);

describe("pattern rotation", () => {
  it("turns the galaxy exactly once per period", () => {
    expect(patternAngle(PATTERN_PERIOD_SECONDS)).toBeCloseTo(2 * Math.PI, 10);
  });

  it("is one rate for every radius, which is what makes it rigid", () => {
    // Rigidity is the whole argument: differential rotation winds an arm
    // through a full arm-spacing in 11 seconds (spec §2).
    expect(patternAngle(10)).toBeCloseTo(PATTERN_RATE * 10, 12);
    expect(patternAngle(0)).toBe(0);
  });

  it("turns slowly enough that a pin does not slide out from under a pointer", () => {
    // Precedent: ORRERY_RATE was cut 0.28 -> 0.1 for exactly this failure.
    expect(PATTERN_RATE).toBeLessThan(0.01);
  });
});

describe("obliquity", () => {
  it("leans every arm, and none of them past the ceiling", () => {
    for (const arm of ARMS) {
      const tilt = obliquityFor(arm);
      expect(tilt.magnitude).toBeGreaterThan(0);
      expect(tilt.magnitude).toBeLessThanOrEqual(MAX_OBLIQUITY);
    }
  });

  it("gives no two arms the same lean", () => {
    const leans = ARMS.map((a) => obliquityFor(a).magnitude.toFixed(9));
    expect(new Set(leans).size).toBe(ARMS.length);
  });

  it("gives no two arms the same direction of lean", () => {
    const azimuths = ARMS.map((a) => obliquityFor(a).azimuth.toFixed(9));
    expect(new Set(azimuths).size).toBe(ARMS.length);
  });

  it("gives a sixth arm one without anybody choosing a number", () => {
    const sixth = {
      ...GALAXY_ZEMI,
      arms: { ...GALAXY_ZEMI.arms, ventures: (10 * Math.PI) / 6 },
    };
    const tilt = obliquityFor("ventures", sixth);
    expect(tilt.magnitude).toBeGreaterThan(0);
    expect(tilt.magnitude).toBeLessThanOrEqual(MAX_OBLIQUITY);
  });

  it("is loud about an arm it does not know", () => {
    expect(() => obliquityFor("nope")).toThrow(/unknown arm/);
  });

  it("keeps the moon ceiling well under the planet ceiling", () => {
    // Obliquity never reaches a moon frame (spec §3.5). Inclination does, and
    // it is the ground a visitor stands on.
    expect(MAX_INCLINATION).toBeLessThan(MAX_OBLIQUITY);
  });
});
