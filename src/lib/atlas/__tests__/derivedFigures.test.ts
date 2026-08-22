import { describe, expect, it } from "vitest";
import { loadBodies } from "../bodies";
import { GALAXY_ZEMI } from "../scopes";
import { IDEALS } from "../ideals";
import { deriveWorldRadius } from "../planets";
import {
  DAYS_PER_MONTH,
  deriveAstrolabeRings,
  deriveDaySpan,
  deriveLegendFigures,
  radiusToDays,
} from "../derivedFigures";
import type { Body } from "../types";

const bodies = loadBodies();

describe("radiusToDays", () => {
  it("converts zero radius to zero days", () => {
    expect(radiusToDays(0)).toBe(0);
    expect(radiusToDays(-5)).toBe(0);
  });

  it("inverts radiusScale(1)", () => {
    expect(radiusToDays(1.15)).toBe(1);
  });

  it("inverts radiusScale(286)", () => {
    const r286 = Math.sqrt(286) * 1.15;
    expect(radiusToDays(r286)).toBe(286);
  });
});

describe("deriveDaySpan", () => {
  it("derives exactly 286 days for the current galaxy", () => {
    const span = deriveDaySpan(bodies);
    expect(span).toBe(286);
  });

  it("is computed from deriveWorldRadius rather than a constant", () => {
    const worldRadius = deriveWorldRadius(bodies);
    const expected = Math.round(Math.pow(worldRadius / 1.15, 2));
    expect(deriveDaySpan(bodies)).toBe(expected);
  });

  it("dynamically increases when a further body is introduced", () => {
    const futureBody: Body = {
      id: "quantum-frontier",
      parent: GALAXY_ZEMI.id,
      label: "Quantum Frontier",
      arm: "creative",
      bornAt: "2026-12-31",
      lastTouchedAt: "2026-12-31",
      kind: "star",
      anonymous: false,
      links: {},
    };
    const expanded = [...bodies, futureBody];
    expect(deriveDaySpan(expanded)).toBeGreaterThan(286);
  });
});

describe("deriveAstrolabeRings", () => {
  it("derives month and quarter rings consistent with scene builder", () => {
    const rings = deriveAstrolabeRings(bodies);
    expect(rings.daysPerMonth).toBe(DAYS_PER_MONTH);
    expect(rings.monthRingCount).toBe(9);
    expect(rings.quarterRingCount).toBe(3);
    expect(rings.radii).toHaveLength(9);
  });

  it("strictly includes only rings within the world radius", () => {
    const worldRadius = deriveWorldRadius(bodies);
    const rings = deriveAstrolabeRings(bodies);
    for (const r of rings.radii) {
      expect(r).toBeLessThanOrEqual(worldRadius);
    }
  });
});

describe("deriveLegendFigures", () => {
  const figures = deriveLegendFigures(bodies);

  it("derives 45 total charted bodies", () => {
    expect(figures.totalBodies).toBe(45);
    expect(figures.totalBodies).toBe(bodies.length);
  });

  it("derives exactly 5 shipped systems and 40 learned stars", () => {
    expect(figures.shippedSystemsCount).toBe(5);
    expect(figures.learnedStarsCount).toBe(40);
    expect(figures.shippedSystemsCount + figures.learnedStarsCount).toBe(figures.totalBodies);
  });

  it("derives 5 declared arms", () => {
    expect(figures.armCount).toBe(5);
    expect(figures.arms).toHaveLength(5);
  });

  it("derives 5 moons in orbit across planets", () => {
    expect(figures.totalMoons).toBe(5);
  });

  it("derives Products holdings of 11 repositories (4 systems, 7 stars, 4 moons, 1 ideal)", () => {
    expect(figures.products.total).toBe(11);
    expect(figures.products.systems).toBe(4);
    expect(figures.products.stars).toBe(7);
    expect(figures.products.moons).toBe(4);
    expect(figures.products.ideals).toBe(1);
  });

  it("identifies Products as the largest planet by derived mass", () => {
    expect(figures.largestPlanet.arm).toBe("products");
    expect(figures.largestPlanet.bodyCount).toBe(11);
    expect(figures.largestPlanet.systemCount).toBe(4);
  });

  it("derives ideals claims and cited evidence", () => {
    expect(figures.totalIdeals).toBe(IDEALS.length);
    expect(figures.totalCitedRepositories).toBe(2);
    expect(figures.citedRepositoryIds).toEqual(["PickMe", "pickleops"]);
  });

  it("maintains invariant that sum of arm bodies equals totalBodies", () => {
    const sumBodies = figures.arms.reduce((sum, a) => sum + a.bodyCount, 0);
    const sumSystems = figures.arms.reduce((sum, a) => sum + a.systemCount, 0);
    const sumStars = figures.arms.reduce((sum, a) => sum + a.starCount, 0);
    const sumMoons = figures.arms.reduce((sum, a) => sum + a.moonCount, 0);
    const sumIdeals = figures.arms.reduce((sum, a) => sum + a.idealCount, 0);

    expect(sumBodies).toBe(figures.totalBodies);
    expect(sumSystems).toBe(figures.shippedSystemsCount);
    expect(sumStars).toBe(figures.learnedStarsCount);
    expect(sumMoons).toBe(figures.totalMoons);
    expect(sumIdeals).toBe(figures.totalIdeals);
  });

  it("derives different figures when given synthetic test data without literals", () => {
    const mockBodies: Body[] = [
      {
        id: "core-repo",
        parent: GALAXY_ZEMI.id,
        label: "Core",
        arm: "foundations",
        bornAt: "2025-11-06",
        lastTouchedAt: "2025-11-06",
        kind: "star",
        anonymous: false,
        links: {},
      },
      {
        id: "flagship-app",
        parent: "planet:products",
        label: "Flagship",
        arm: "products",
        bornAt: "2026-02-01",
        lastTouchedAt: "2026-02-01",
        kind: "system",
        anonymous: false,
        links: {},
      },
    ];

    const mockFigures = deriveLegendFigures(mockBodies);
    expect(mockFigures.totalBodies).toBe(2);
    expect(mockFigures.shippedSystemsCount).toBe(1);
    expect(mockFigures.learnedStarsCount).toBe(1);
    expect(mockFigures.totalMoons).toBe(1);
  });
});
