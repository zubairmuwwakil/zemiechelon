import { describe, expect, it } from "vitest";
import { loadBodies } from "../bodies";
import { SOLAR_SYSTEM_ZEMI } from "../scopes";
import { IDEALS } from "../ideals";
import { deriveWorldRadius } from "../planets";
import {
  DAYS_PER_MONTH,
  deriveArmAnnotation,
  deriveAstrolabeRings,
  deriveDaySpan,
  deriveLegendFigures,
  derivePlanetAnnotation,
  deriveRingAnnotation,
  deriveTimelineMilestones,
  radiusToDays,
} from "../derivedFigures";
import { daysSinceEpoch } from "../position";
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
      parent: SOLAR_SYSTEM_ZEMI.id,
      label: "Quantum Frontier",
      arm: "creative",
      bornAt: "2026-12-31",
      lastTouchedAt: "2026-12-31",
      kind: "dwarfPlanet",
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
    expect(figures.shippedMoonsCount).toBe(5);
    expect(figures.learnedDwarfPlanetsCount).toBe(40);
    expect(figures.shippedMoonsCount + figures.learnedDwarfPlanetsCount).toBe(figures.totalBodies);
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
    expect(figures.products.shipped).toBe(4);
    expect(figures.products.dwarfPlanets).toBe(7);
    expect(figures.products.moons).toBe(4);
    expect(figures.products.ideals).toBe(1);
  });

  it("identifies Products as the largest planet by derived mass", () => {
    expect(figures.largestPlanet.arm).toBe("products");
    expect(figures.largestPlanet.bodyCount).toBe(11);
    expect(figures.largestPlanet.shippedCount).toBe(4);
  });

  it("derives ideals claims and cited evidence", () => {
    expect(figures.totalIdeals).toBe(IDEALS.length);
    expect(figures.totalCitedRepositories).toBe(2);
    expect(figures.citedRepositoryIds).toEqual(["PickMe", "pickleops"]);
  });

  it("maintains invariant that sum of arm bodies equals totalBodies", () => {
    const sumBodies = figures.arms.reduce((sum, a) => sum + a.bodyCount, 0);
    const sumSystems = figures.arms.reduce((sum, a) => sum + a.shippedCount, 0);
    const sumStars = figures.arms.reduce((sum, a) => sum + a.dwarfPlanetCount, 0);
    const sumMoons = figures.arms.reduce((sum, a) => sum + a.moonCount, 0);
    const sumIdeals = figures.arms.reduce((sum, a) => sum + a.idealCount, 0);

    expect(sumBodies).toBe(figures.totalBodies);
    expect(sumSystems).toBe(figures.shippedMoonsCount);
    expect(sumStars).toBe(figures.learnedDwarfPlanetsCount);
    expect(sumMoons).toBe(figures.totalMoons);
    expect(sumIdeals).toBe(figures.totalIdeals);
  });

  it("derives different figures when given synthetic test data without literals", () => {
    const mockBodies: Body[] = [
      {
        id: "core-repo",
        parent: SOLAR_SYSTEM_ZEMI.id,
        label: "Core",
        arm: "foundations",
        bornAt: "2025-11-06",
        lastTouchedAt: "2025-11-06",
        kind: "dwarfPlanet",
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
        kind: "moon",
        anonymous: false,
        links: {},
      },
    ];

    const mockFigures = deriveLegendFigures(mockBodies);
    expect(mockFigures.totalBodies).toBe(2);
    expect(mockFigures.shippedMoonsCount).toBe(1);
    expect(mockFigures.learnedDwarfPlanetsCount).toBe(1);
    expect(mockFigures.totalMoons).toBe(1);
  });
});

describe("deriveRingAnnotation", () => {
  it("derives month boundary name and days out for month 1", () => {
    const ann = deriveRingAnnotation(1, bodies);
    expect(ann.id).toBe("ring-month-1");
    expect(ann.title).toBe("Month 1");
    expect(ann.subtitle).toBe("30 days out");
  });

  it("derives month boundary name and days out for month 3 (quarter)", () => {
    const ann = deriveRingAnnotation(3, bodies);
    expect(ann.id).toBe("ring-month-3");
    expect(ann.title).toBe("Month 3");
    expect(ann.subtitle).toBe("90 days out");
  });

  it("derives galactic frontier annotation dynamically from body reach", () => {
    const ann = deriveRingAnnotation("frontier", bodies);
    expect(ann.id).toBe("ring-frontier");
    expect(ann.title).toBe("Galactic Frontier");
    expect(ann.subtitle).toBe("286 days out");
  });
});

describe("derivePlanetAnnotation", () => {
  it("derives Products composition with 4 shipped systems and 7 learning repositories", () => {
    const ann = derivePlanetAnnotation("products", bodies);
    expect(ann.id).toBe("planet-products");
    expect(ann.title).toBe("Planet Products");
    expect(ann.subtitle).toBe("4 shipped moons · 7 learning repositories");
  });

  it("derives Foundations composition with 0 shipped systems and 19 learning repositories", () => {
    const ann = derivePlanetAnnotation("foundations", bodies);
    expect(ann.id).toBe("planet-foundations");
    expect(ann.title).toBe("Planet Foundations");
    expect(ann.subtitle).toBe("0 shipped moons · 19 learning repositories");
  });

  it("derives Ancestral Anchor Core annotation", () => {
    const ann = derivePlanetAnnotation("solarSystem", bodies);
    expect(ann.id).toBe("planet-solarSystem");
    expect(ann.title).toBe("Ancestral Anchor Core");
    expect(ann.subtitle).toContain("2025-11-06");
  });
});

describe("deriveArmAnnotation", () => {
  it("derives Products arm identity and metadata", () => {
    const ann = deriveArmAnnotation("products", bodies);
    expect(ann.id).toBe("arm-products");
    expect(ann.title).toBe("Products Arm");
    expect(ann.subtitle).toContain("11 repos");
    expect(ann.subtitle).toContain("4 shipped");
    expect(ann.subtitle).toContain("7 learned");
  });

  it("derives Creative arm identity", () => {
    const ann = deriveArmAnnotation("creative", bodies);
    expect(ann.id).toBe("arm-creative");
    expect(ann.title).toBe("Creative Arm");
    expect(ann.subtitle).toContain("2 repos");
    expect(ann.subtitle).toContain("0 shipped");
    expect(ann.subtitle).toContain("2 learned");
  });
});

describe("deriveTimelineMilestones", () => {
  const milestones = deriveTimelineMilestones(bodies);

  it("only includes bodies with an authored milestone caption", () => {
    const captioned = bodies.filter((b) => b.milestone);
    expect(milestones).toHaveLength(captioned.length);
    expect(milestones.length).toBeGreaterThan(0);
  });

  it("derives day and date from the body's own bornAt, never a literal", () => {
    for (const m of milestones) {
      const body = bodies.find((b) => b.id === m.id)!;
      expect(m.day).toBe(daysSinceEpoch(body.bornAt));
      expect(m.date).toBe(body.bornAt);
      expect(m.title).toBe(body.milestone);
    }
  });

  it("derives each milestone's cumulative body count from the set itself", () => {
    for (const m of milestones) {
      const expected = bodies.filter((b) => daysSinceEpoch(b.bornAt) <= m.day).length;
      expect(m.bodyCount).toBe(expected);
    }
  });

  it("orders milestones chronologically", () => {
    const days = milestones.map((m) => m.day);
    expect(days).toEqual([...days].sort((a, b) => a - b));
  });

  it("grows the cumulative count monotonically across milestones", () => {
    for (let i = 1; i < milestones.length; i++) {
      expect(milestones[i].bodyCount).toBeGreaterThanOrEqual(milestones[i - 1].bodyCount);
    }
  });
});
