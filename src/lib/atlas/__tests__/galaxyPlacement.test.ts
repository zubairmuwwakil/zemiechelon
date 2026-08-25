import { describe, expect, it } from "vitest";
import { GALAXY_REACH, MAX_SYSTEM_TILT, placeSolarSystem, systemReach } from "../galaxyPlacement";
import { SOLAR_SYSTEMS, SOLAR_SYSTEM_CHANNEL, SOLAR_SYSTEM_ZEMI } from "../galaxy";

const length = (v: { x: number; y: number; z: number }) => Math.hypot(v.x, v.y, v.z);

describe("placeSolarSystem", () => {
  it("puts the repository atlas exactly at the galactic core", () => {
    // Its epoch IS the galaxy epoch, so radiusScale(0) is 0. This is what lets
    // the entire existing scene stay where it is.
    expect(length(placeSolarSystem(SOLAR_SYSTEM_ZEMI).center)).toBe(0);
  });

  it("leaves the atlas exactly unleaned", () => {
    // Tilt scales with radius, so the core is in the galactic plane by
    // construction — which is what keeps surfaceCamera.test.ts's 15 degree
    // off-axis budget entirely unspent.
    expect(placeSolarSystem(SOLAR_SYSTEM_ZEMI).tilt).toBe(0);
  });

  it("puts a later system further out", () => {
    expect(length(placeSolarSystem(SOLAR_SYSTEM_CHANNEL).center)).toBeGreaterThan(0);
  });

  it("leans a system no further than the ceiling", () => {
    for (const s of SOLAR_SYSTEMS) {
      expect(placeSolarSystem(s).tilt, s.id).toBeLessThanOrEqual(MAX_SYSTEM_TILT);
      expect(placeSolarSystem(s).tilt, s.id).toBeGreaterThanOrEqual(0);
    }
  });

  it("lifts a leaning system out of the galactic plane and nothing else", () => {
    const atlas = placeSolarSystem(SOLAR_SYSTEM_ZEMI);
    expect(atlas.center.y).toBe(0);
    const channel = placeSolarSystem(SOLAR_SYSTEM_CHANNEL);
    expect(channel.center.y).toBeGreaterThan(0);
  });

  it("never lets two systems' discs overlap", () => {
    for (const a of SOLAR_SYSTEMS) {
      for (const b of SOLAR_SYSTEMS) {
        if (a === b) continue;
        const ca = placeSolarSystem(a).center;
        const cb = placeSolarSystem(b).center;
        const gap = Math.hypot(ca.x - cb.x, ca.y - cb.y, ca.z - cb.z);
        const needed = systemReach(a) + systemReach(b) + Math.min(systemReach(a), systemReach(b));
        expect(gap, `${a.id} vs ${b.id}`).toBeGreaterThanOrEqual(needed - 1e-6);
      }
    }
  });
});

describe("scale", () => {
  it("solves the quotient from the requirement rather than carrying a typed one", () => {
    // GALAXY_SPREAD is the SMALLEST quotient that clears every pair, so the
    // pair that set it must come out exactly touching. That is what pins the
    // value: too small and the overlap test above fails, too large and this
    // one does. A body-scale quotient, or the spec's worked 51.5, is caught
    // here — `expect(GALAXY_SPREAD).toBeGreaterThan(0)` catches neither.
    //
    // Measured planar, not in 3D, because the rise of a leaning system is
    // exactly the slack that makes the 3D distance strictly larger.
    expect(SOLAR_SYSTEMS.length, "a lone system has no pair to solve against").toBeGreaterThan(1);

    const slack = SOLAR_SYSTEMS.flatMap((a) =>
      SOLAR_SYSTEMS.filter((b) => b !== a).map((b) => {
        const ca = placeSolarSystem(a).center;
        const cb = placeSolarSystem(b).center;
        const planar = Math.hypot(ca.x - cb.x, ca.z - cb.z);
        return planar - (systemReach(a) + systemReach(b) + Math.min(systemReach(a), systemReach(b)));
      }),
    );
    expect(Math.min(...slack)).toBeCloseTo(0, 6);
  });

  it("reaches past the outermost system's rim", () => {
    for (const s of SOLAR_SYSTEMS) {
      const d = length(placeSolarSystem(s).center);
      expect(GALAXY_REACH).toBeGreaterThanOrEqual(d + systemReach(s) - 1e-6);
    }
  });
});
