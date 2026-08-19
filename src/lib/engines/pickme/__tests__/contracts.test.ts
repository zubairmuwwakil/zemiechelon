import { describe, expect, it } from "vitest";
import catalogue from "@/data/contracts/card-catalogue.json";
import ownerState from "@/data/contracts/owner-state.json";
import fixtures from "@/data/contracts/engine-fixtures.json";

describe("vendored contracts", () => {
  it("ships a v1 catalogue of 27 cards", () => {
    expect(catalogue.catalogueVersion.split(".")[0]).toBe("1");
    expect(catalogue.cards).toHaveLength(27);
  });

  it("ships owner state with a declared default card", () => {
    expect(ownerState.defaultCardId).toBeTruthy();
    expect(ownerState.ownedCardIds.length).toBeGreaterThan(0);
  });

  it("ships 27 fixture cases, each with a caseId and expected winner", () => {
    expect(fixtures.cases).toHaveLength(27);
    for (const c of fixtures.cases) {
      expect(c.caseId, "every case needs a caseId").toBeTruthy();
      expect(c.expected.winner, `${c.caseId} needs an expected winner`).toBeTruthy();
    }
  });

  it("pins a valuation that differs from live owner state", () => {
    expect(fixtures.pinnedValuations.amexMembershipRewards).toBe(1.8);
  });
});
