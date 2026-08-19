import { describe, expect, it } from "vitest";
import * as pickme from "../index";

describe("public surface", () => {
  it("exports everything the console needs and nothing internal", () => {
    expect(Object.keys(pickme).sort()).toEqual([
      "UnsupportedCatalogueVersionError",
      "loadCatalogue",
      "loadOwnerState",
      "makePurchase",
      "recommend",
    ]);
  });

  it("produces a recommendation from the vendored seed data", () => {
    const result = pickme.recommend(
      pickme.loadCatalogue(),
      pickme.loadOwnerState(),
      pickme.makePurchase({ amountCad: 100, category: "grocery", mcc: 5411 }),
      "2026-08-16",
    );
    expect(result.winner.cardId).toBeTruthy();
    expect(result.allCandidates.length).toBeGreaterThan(1);
  });
});
