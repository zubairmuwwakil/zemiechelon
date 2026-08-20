import { describe, expect, it } from "vitest";
import { loadBodies } from "../bodies";
import { GALAXY_ZEMI } from "../scopes";
import { derivePlanets, deriveWorldRadius } from "../planets";

const bodies = loadBodies();
const planets = derivePlanets(bodies);
const byArm = (arm: string) => planets.find((p) => p.arm === arm)!;
const dist = (p: { x: number; z: number }) => Math.hypot(p.x, p.z);

describe("derivePlanets", () => {
  it("returns one planet per declared arm", () => {
    expect(planets.map((p) => p.arm).sort()).toEqual(Object.keys(GALAXY_ZEMI.arms).sort());
  });

  it("counts every body into exactly one planet", () => {
    const total = planets.reduce((sum, p) => sum + p.bodyCount, 0);
    expect(total).toBe(bodies.length);
  });

  it("puts Foundations nearer the core than Products", () => {
    // Foundations is dense at the core and stops before the frontier;
    // Products is absent at the core and dense at the frontier.
    expect(dist(byArm("foundations").center)).toBeLessThan(dist(byArm("products").center));
  });

  it("sizes Products largest, because mass is not equal", () => {
    const products = byArm("products").radius;
    for (const p of planets) {
      if (p.arm !== "products") expect(products).toBeGreaterThan(p.radius);
    }
  });

  it("sizes Foundations smaller than Products despite holding more bodies", () => {
    expect(byArm("foundations").bodyCount).toBeGreaterThan(byArm("products").bodyCount);
    expect(byArm("foundations").radius).toBeLessThan(byArm("products").radius);
  });

  it("is deterministic", () => {
    expect(derivePlanets(bodies)).toEqual(planets);
  });

  it("places no planet at the origin", () => {
    for (const p of planets) expect(dist(p.center)).toBeGreaterThan(1);
  });

  // Centres and radii are both in layout units, so they are directly comparable.
  // Before these existed, SIZE was authored against a scene ten times wider and
  // gave Products a radius larger than its own distance from the core.
  it("keeps every planet clear of the core", () => {
    for (const p of planets) {
      expect(p.radius, `${p.arm} reaches the core`).toBeLessThan(dist(p.center) * 0.5);
    }
  });

  it("never overlaps two planets", () => {
    for (const a of planets) {
      for (const b of planets) {
        if (a.arm >= b.arm) continue;
        const gap = Math.hypot(a.center.x - b.center.x, a.center.z - b.center.z);
        expect(gap, `${a.arm} overlaps ${b.arm}`).toBeGreaterThan(a.radius + b.radius);
      }
    }
  });

  it("contains every planet within the derived world radius", () => {
    const world = deriveWorldRadius(bodies);
    expect(world).toBeGreaterThan(0);
    for (const p of planets) expect(dist(p.center) + p.radius).toBeLessThan(world);
  });
});
