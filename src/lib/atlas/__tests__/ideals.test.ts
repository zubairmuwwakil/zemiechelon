import { describe, expect, it } from "vitest";
import { loadBodies } from "../bodies";
import { daysSinceEpoch } from "../position";
import { IDEALS, idealsFor, idealVisibleAt, validateIdeals, type Ideal } from "../ideals";

const bodies = loadBodies();

describe("ideals", () => {
  it("accepts the shipped set", () => {
    expect(() => validateIdeals(IDEALS, bodies)).not.toThrow();
  });

  it("rejects an ideal whose evidence does not resolve", () => {
    const bogus: Ideal = {
      id: "bogus",
      scope: "galaxy:zemi",
      ordinal: 1,
      claim: "Untrue things",
      evidence: ["glicko2-ts"], // real-looking, and genuinely absent from bodies.generated.json
    };
    expect(() => validateIdeals([bogus], bodies)).toThrow(/glicko2-ts/);
  });

  it("rejects an ideal with no evidence at all — a claim with nothing behind it", () => {
    const empty: Ideal = {
      id: "empty",
      scope: "galaxy:zemi",
      ordinal: 1,
      claim: "Trust me",
      evidence: [],
    };
    expect(() => validateIdeals([empty], bodies)).toThrow(/no evidence/);
  });

  it("accepts an empty set, so a planet may declare no ideals and render no rings", () => {
    expect(() => validateIdeals([], bodies)).not.toThrow();
    expect(idealsFor("creative")).toEqual([]);
  });

  it("orders rings inner to outer without gaps or ties", () => {
    for (const arm of ["foundations", "products", "labs", "self", "creative"]) {
      const ordinals = idealsFor(arm).map((i) => i.ordinal);
      expect(ordinals).toEqual([...ordinals].sort((a, b) => a - b));
      expect(new Set(ordinals).size).toBe(ordinals.length);
    }
  });
});

describe("idealVisibleAt", () => {
  const ideal = IDEALS[0]; // deterministic-systems, evidence: PickMe, pickleops
  const evidenceDays = ideal.evidence.map(
    (id) => daysSinceEpoch(bodies.find((b) => b.id === id)!.bornAt),
  );
  const lastDay = Math.max(...evidenceDays);

  it("is hidden until every cited repository exists", () => {
    expect(idealVisibleAt(ideal, bodies, lastDay - 1)).toBe(false);
  });

  it("appears the moment the last citation is born", () => {
    expect(idealVisibleAt(ideal, bodies, lastDay)).toBe(true);
  });

  it("stays visible afterward", () => {
    expect(idealVisibleAt(ideal, bodies, lastDay + 10)).toBe(true);
  });

  it("is hidden at the very start", () => {
    expect(idealVisibleAt(ideal, bodies, 0)).toBe(false);
  });
});
