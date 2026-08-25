import { describe, expect, it } from "vitest";
import { loadBodies } from "../bodies";
import { SOLAR_SYSTEM_ZEMI } from "../scopes";
import { daysSinceEpoch } from "../position";
import { derivePlanets, deriveWorldRadius, planetGrowthAt } from "../planets";

const bodies = loadBodies();
const planets = derivePlanets(bodies);
const byArm = (arm: string) => planets.find((p) => p.arm === arm)!;
const dist = (p: { x: number; z: number }) => Math.hypot(p.x, p.z);

describe("derivePlanets", () => {
  it("returns one planet per declared arm", () => {
    expect(planets.map((p) => p.arm).sort()).toEqual(Object.keys(SOLAR_SYSTEM_ZEMI.arms).sort());
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

describe("planet mass aggregates the subtree", () => {
  const bodies = loadBodies();

  it("keeps Products the largest planet after the systems reparent", () => {
    const bySize = [...derivePlanets(bodies)].sort((a, b) => b.radius - a.radius);
    expect(bySize[0].arm).toBe("products");
  });

  it("counts a planet's own children toward its mass", () => {
    const products = derivePlanets(bodies).find((p) => p.arm === "products")!;
    // Eleven bodies carry the Products arm: four shipped, seven not.
    expect(products.bodyCount).toBe(11);
  });

  it("does not shrink when a body's parent moves off the galaxy", () => {
    const asGalaxy = derivePlanets(bodies.map((b) => ({ ...b, parent: "galaxy:zemi" })));
    expect(derivePlanets(bodies).map((p) => [p.arm, p.radius])).toEqual(
      asGalaxy.map((p) => [p.arm, p.radius]),
    );
  });
});

describe("planetGrowthAt", () => {
  const fullSpan = Math.max(...bodies.map((b) => daysSinceEpoch(b.bornAt)));

  it("is absent before its arm's first repository is born", () => {
    // Every day-zero body is in Foundations (per bodies.overrides.ts), so the
    // other four arms have nothing born yet.
    const growth = planetGrowthAt(bodies, 0);
    const absent = growth.filter((p) => p.arm !== "foundations");
    expect(absent.length).toBeGreaterThan(0);
    for (const p of absent) {
      expect(p.visible).toBe(false);
      expect(p.radius).toBe(0);
      expect(p.bodyCount).toBe(0);
    }
    const foundations = growth.find((p) => p.arm === "foundations")!;
    expect(foundations.visible).toBe(true);
    expect(foundations.radius).toBeGreaterThan(0);
  });

  it("freezes every planet's centre to the full-set derivation, at every clock day", () => {
    const frozen = derivePlanets(bodies);
    for (const day of [0, 50, 150, fullSpan]) {
      const growth = planetGrowthAt(bodies, day);
      expect(growth.map((p) => [p.arm, p.center])).toEqual(frozen.map((p) => [p.arm, p.center]));
    }
  });

  it("never decreases a planet's radius as the clock advances", () => {
    const days = [0, 20, 40, 60, 80, 100, 150, 200, 250, fullSpan];
    const byArm = new Map<string, number[]>();
    for (const day of days) {
      for (const p of planetGrowthAt(bodies, day)) {
        byArm.set(p.arm, [...(byArm.get(p.arm) ?? []), p.radius]);
      }
    }
    for (const [arm, radii] of byArm) {
      for (let i = 1; i < radii.length; i++) {
        expect(radii[i], `${arm} shrank between clock steps`).toBeGreaterThanOrEqual(radii[i - 1]);
      }
    }
  });

  it("reaches the full-set radius once the clock reaches the full span", () => {
    const frozen = derivePlanets(bodies);
    const grown = planetGrowthAt(bodies, fullSpan);
    expect(grown.map((p) => [p.arm, p.radius])).toEqual(frozen.map((p) => [p.arm, p.radius]));
  });
});

