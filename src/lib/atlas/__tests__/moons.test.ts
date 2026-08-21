import { describe, expect, it } from "vitest";
import { loadBodies } from "../bodies";
import { deriveMoons, MOON_ORBIT } from "../moons";

const bodies = loadBodies();
const moons = deriveMoons(bodies);

describe("moons", () => {
  it("makes every shipped system a moon of its own arm, and nothing else", () => {
    const systems = bodies.filter((b) => b.kind === "system");
    expect(moons.map((m) => m.id).sort()).toEqual(systems.map((b) => b.id).sort());
    for (const moon of moons) {
      expect(moon.arm).toBe(bodies.find((b) => b.id === moon.id)!.arm);
    }
  });

  it("gives Products the four ventures the spec names", () => {
    expect(moons.filter((m) => m.arm === "products").map((m) => m.id).sort()).toEqual(
      ["MoneyTalks", "PickMe", "marketdata", "pickleops"].sort(),
    );
  });

  it("orders orbits by birth date, so radius is time at planet scale too", () => {
    const products = moons.filter((m) => m.arm === "products");
    const byOrbit = [...products].sort((a, b) => a.orbit - b.orbit).map((m) => m.id);
    const byBirth = [...products]
      .sort((a, b) => {
        const at = bodies.find((x) => x.id === a.id)!.bornAt;
        const bt = bodies.find((x) => x.id === b.id)!.bornAt;
        return at.localeCompare(bt);
      })
      .map((m) => m.id);
    expect(byOrbit).toEqual(byBirth);
  });

  it("keeps every orbit clear of the ideals rings and inside the arm", () => {
    for (const moon of moons) {
      expect(moon.orbit).toBeGreaterThanOrEqual(MOON_ORBIT.inner);
      expect(moon.orbit).toBeLessThanOrEqual(MOON_ORBIT.outer);
    }
  });

  it("fans an arm's moons apart rather than stacking their phases", () => {
    const products = moons.filter((m) => m.arm === "products");
    const phases = products.map((m) => m.phase).sort((a, b) => a - b);
    for (let i = 1; i < phases.length; i++) {
      expect(phases[i] - phases[i - 1]).toBeGreaterThan(0.5);
    }
  });

  it("turns outer moons slower than inner ones, and all of them slowly", () => {
    const products = [...moons.filter((m) => m.arm === "products")].sort((a, b) => a.orbit - b.orbit);
    for (let i = 1; i < products.length; i++) {
      expect(products[i].rate).toBeLessThan(products[i - 1].rate);
    }
    for (const moon of moons) {
      expect(moon.rate).toBeGreaterThan(0);
      expect(moon.rate, `${moon.id} orbits too fast`).toBeLessThan(0.05);
    }
  });

  it("is a pure function of the set, so the map does not reshuffle on reload", () => {
    expect(deriveMoons(bodies)).toEqual(deriveMoons(bodies));
  });

  it("gives a lone system a stable orbit rather than dividing by zero", () => {
    const labs = moons.filter((m) => m.arm === "labs");
    expect(labs).toHaveLength(1);
    expect(Number.isFinite(labs[0].orbit)).toBe(true);
    expect(Number.isFinite(labs[0].phase)).toBe(true);
  });
});
