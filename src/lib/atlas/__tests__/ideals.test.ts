import { describe, expect, it } from "vitest";
import { loadBodies } from "../bodies";
import { IDEALS, idealsFor, validateIdeals, type Ideal } from "../ideals";

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
