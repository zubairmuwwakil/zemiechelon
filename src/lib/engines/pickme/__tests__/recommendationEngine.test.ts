import { describe, expect, it } from "vitest";
import catalogueJson from "@/data/contracts/card-catalogue.json";
import ownerStateJson from "@/data/contracts/owner-state.json";
import type { Catalogue, CardProduct, Network } from "../catalogue";
import { RecommendationExplainer } from "../explainer";
import type { OwnerState } from "../ownerState";
import { makePurchase, type PurchaseContext } from "../purchase";
import {
  recommend,
  RecommendationEngine,
  type Recommendation,
} from "../recommendationEngine";

const asOf = "2026-08-20";
const catalogue = catalogueJson as unknown as Catalogue;

/** `SeedLoader.loadOwnerState()` — the live state, which ranks MR at the 1.0¢ cash floor. */
function liveOwner(): OwnerState {
  return JSON.parse(JSON.stringify(ownerStateJson)) as OwnerState;
}

/**
 * `SeedLoader.loadPinnedOwnerState()` from `PinnedOwnerState.swift`. Behaviour tests pin MR
 * above the floor so they keep exercising points-vs-cash ranking rather than re-baselining
 * every time the owner's personal valuation changes.
 */
function pinnedOwner(mrCentsPerPoint = 1.8): OwnerState {
  const o = liveOwner();
  o.valuationsCad.amexMembershipRewards.centsPerPoint = mrCentsPerPoint;
  return o;
}

function advise(owner: OwnerState, purchase: PurchaseContext): Recommendation {
  return new RecommendationEngine(catalogue, owner).recommend(purchase, asOf);
}

// ── Ported from EngineGateTests.swift (4 cases) ──────────────────────────────

describe("EngineGateTests", () => {
  // testPharmacyHoldsDefault
  it("holds the default on pharmacy $30 — a tie is not 'strictly better'", () => {
    const r = advise(
      pinnedOwner(),
      makePurchase({ amountCad: 30, category: "drugStore", mcc: 5912 }),
    );
    expect(r.winner.cardId).toBe("wealthsimple-vip");
    expect(r.switchedFromDefault).toBe(false);
    // Tangerine only ties 2%, so nothing is strictly better.
    expect(r.suppressedBetterCard).toBeUndefined();
  });

  // testTaxiSuppressionUnderBothSemantics
  it("suppresses a marginally better card on taxi $12 under 'both' semantics", () => {
    const r = advise(
      pinnedOwner(),
      makePurchase({ amountCad: 12, category: "transit", mcc: 4121 }),
    );
    expect(r.winner.cardId).toBe("wealthsimple-vip");
    expect(r.switchedFromDefault).toBe(false);
    expect(r.suppressedBetterCard?.cardId).toBe("amex-cobalt");
    expect(r.suppressedBetterCard?.netValueCad ?? NaN).toBeCloseTo(0.432, 3);
  });

  // testCostcoDefaultNotAccepted
  it("reports defaultNotAccepted when the default card's network is refused", () => {
    const r = advise(
      pinnedOwner(),
      makePurchase({
        amountCad: 200,
        category: "wholesaleClub",
        mcc: 5300,
        merchantBrand: "costco",
        acceptedNetworks: new Set<Network>(["mastercard"]),
      }),
    );
    expect(r.defaultNotAccepted).toBe(true);
    expect(r.winner.cardId).toBe("rogers-red-we");
    expect(r.winner.netValueCad).toBeCloseTo(3.0, 3);
    // Swift's `rank` returns `advantage: nil` on this branch — there is no default to
    // measure against, so the field is genuinely absent rather than zero.
    expect(r.advantageOverDefaultCad).toBeUndefined();
    expect(r.switchedFromDefault).toBe(true);
  });

  // testGroceryWinnerAndRunnerUp
  it("switches from the default on grocery $100 and reports the advantage", () => {
    const r = advise(
      pinnedOwner(),
      makePurchase({
        amountCad: 100,
        category: "grocery",
        mcc: 5411,
        merchantBrand: "loblaws",
      }),
    );
    expect(r.winner.cardId).toBe("amex-cobalt");
    expect(r.switchedFromDefault).toBe(true);
    expect(r.runnerUp?.cardId).toBe("mbna-rewards-we");
    expect(r.advantageOverDefaultCad ?? NaN).toBeCloseTo(7.0, 3);
  });
});

// ── Ported from UpsideValuationTests.swift (6 cases) ─────────────────────────

describe("UpsideValuationTests", () => {
  // The live owner state already ranks MR at 1.0¢ with a 2.2¢ published benchmark; the Swift
  // setUp restates both explicitly, so assert that here rather than assuming the JSON.
  const owner = liveOwner();
  expect(owner.valuationsCad.amexMembershipRewards.centsPerPoint).toBe(1.0);
  expect(owner.valuationsCad.amexMembershipRewards.aspirationalCentsPerPoint).toBe(2.2);

  const explainer = new RecommendationExplainer(catalogue);

  // testGasDisclosesWhatTransferringWouldBeWorth
  it("discloses the gas $70 upside: Cobalt takes over at 1.25¢", () => {
    const r = advise(
      liveOwner(),
      makePurchase({ amountCad: 70, category: "gasStation", mcc: 5541 }),
    );
    expect(r.winner.cardId).toBe("wealthsimple-vip");
    expect(r.valuationSensitive).toBe(true);
    expect(r.valuationDirection).toBe("above");
    expect(r.alternateWinnerCardId).toBe("amex-cobalt");
    // needed = $1.40 + max($0.25, 0.5pp × $70 = $0.35) = $1.75 → ×100/140 pts = 1.25¢
    expect(r.breakevenCentsPerPoint ?? NaN).toBeCloseTo(1.25, 3);
  });

  // testTaxiBreakevenUsesCashLegOfThreshold
  it("uses the cash leg of the threshold on taxi $25 — breakeven 1.50¢", () => {
    const r = advise(
      liveOwner(),
      makePurchase({ amountCad: 25, category: "transit", mcc: 4121 }),
    );
    expect(r.winner.cardId).toBe("wealthsimple-vip");
    expect(r.valuationDirection).toBe("above");
    // On $25 the $0.25 leg exceeds the 0.5pp leg ($0.125): ($0.50 + $0.25) × 100 / 50 = 1.50¢
    expect(r.breakevenCentsPerPoint ?? NaN).toBeCloseTo(1.5, 3);
  });

  // testNetflixComparesAgainstTheNonDefaultIncumbent
  it("compares against the non-default incumbent on Netflix — no threshold between them", () => {
    const r = advise(
      liveOwner(),
      makePurchase({
        amountCad: 15.49,
        category: "streaming",
        mcc: 5968,
        merchantBrand: "netflix",
        channel: "online",
        recurringIndicator: true,
      }),
    );
    expect(r.winner.cardId).toBe("mbna-rewards-we");
    expect(r.valuationDirection).toBe("above");
    expect(r.alternateWinnerCardId).toBe("amex-cobalt");
    // MBNA $0.7745 is the bar; the switch threshold applies only against the default, and
    // WS + threshold ($0.3098 + $0.25) is lower, so it does not bind: ×100/46.47 = 1.6667¢
    expect(r.breakevenCentsPerPoint ?? NaN).toBeCloseTo(1.6667, 3);
  });

  // testGroceryStaysValuationProofEvenAtTheFloor
  it("stays valuation-proof on grocery $140 — nothing to disclose either way", () => {
    const r = advise(
      liveOwner(),
      makePurchase({
        amountCad: 140,
        category: "grocery",
        mcc: 5411,
        merchantBrand: "loblaws",
      }),
    );
    expect(r.winner.cardId).toBe("amex-cobalt");
    expect(r.valuationSensitive).toBe(false);
    expect(r.valuationDirection).toBeUndefined();
  });

  // testImplausibleBreakevenIsNotDisclosed
  it("withholds an implausible breakeven on pharmacy $30 (2.83¢ > the 2.2¢ benchmark)", () => {
    const r = advise(
      liveOwner(),
      makePurchase({ amountCad: 30, category: "drugStore", mcc: 5912 }),
    );
    expect(r.winner.cardId).toBe("wealthsimple-vip");
    expect(r.valuationSensitive).toBe(false);
    expect(r.breakevenCentsPerPoint).toBeUndefined();
    // Plan scenario: a valuation-insensitive result leaves all four breakeven fields undefined.
    expect(r.valuationDirection).toBeUndefined();
    expect(r.alternateWinnerCardId).toBeUndefined();
    expect(r.declaredCentsPerPoint).toBeUndefined();
  });

  // testExplainerStatesTheUpsideSymmetrically — checks the Task 6 wiring end to end.
  it("feeds the Explainer a symmetric upside sentence", () => {
    const p = makePurchase({ amountCad: 70, category: "gasStation", mcc: 5541 });
    const e = explainer.explain(advise(liveOwner(), p), p);
    expect(e.valuationLine).toBe(
      "Assumes your points are worth 1.00¢ each. Above about 1.25¢, American Express Cobalt Card wins instead.",
    );
  });
});

// ── Ported from BreakevenValuationTests.swift ────────────────────────────────
//
// The Swift file is a `print()`-only diagnostic with no XCTAssert: it bisects the real engine
// to find where the advice changes, then dumps a table for a human to read. Ported as an
// assertion, that bisection becomes the cross-validation `breakevenCents` already claims in
// its doc comment ("Cross-validated against bisection over the full engine") — the analytic
// formula and the engine's own behaviour must name the same number.

describe("BreakevenValuationTests (bisection cross-validation)", () => {
  const mrCardIds = new Set(
    catalogue.cards
      .filter((c) => c.program.programId === "amexMembershipRewards")
      .map((c) => c.cardId),
  );

  function winnerAt(purchase: PurchaseContext, mr: number): string {
    return advise(pinnedOwner(mr), purchase).winner.cardId;
  }

  /** Lowest MR valuation in (low, high] at which an MR card takes the recommendation. */
  function bisectFlip(purchase: PurchaseContext): number {
    let low = 1.0;
    let high = 4.0;
    for (let i = 0; i < 40; i++) {
      const mid = (low + high) / 2;
      if (mrCardIds.has(winnerAt(purchase, mid))) high = mid;
      else low = mid;
    }
    return high;
  }

  // Labels avoid `$` — Vitest interpolates `$name` in `it.each` titles.
  const checkouts: Array<[string, PurchaseContext]> = [
    ["Gas 70 CAD", makePurchase({ amountCad: 70, category: "gasStation", mcc: 5541 })],
    ["Taxi 25 CAD", makePurchase({ amountCad: 25, category: "transit", mcc: 4121 })],
    [
      "Netflix 15.49 CAD",
      makePurchase({
        amountCad: 15.49,
        category: "streaming",
        mcc: 5968,
        merchantBrand: "netflix",
        channel: "online",
        recurringIndicator: true,
      }),
    ],
  ];

  it.each(checkouts)(
    "%s: the analytic breakeven equals the engine's own flip point",
    (_label, purchase) => {
      const r = advise(liveOwner(), purchase);
      expect(r.valuationSensitive).toBe(true);
      expect(r.valuationDirection).toBe("above");
      const analytic = r.breakevenCentsPerPoint ?? NaN;
      expect(analytic).toBeCloseTo(bisectFlip(purchase), 3);

      // And the flip is real in both directions, not merely a number in a field.
      expect(mrCardIds.has(winnerAt(purchase, analytic - 0.01))).toBe(false);
      expect(mrCardIds.has(winnerAt(purchase, analytic + 0.01))).toBe(true);
    },
  );

  it("reports no flip for a checkout that is valuation-proof across the whole range", () => {
    const grocery = makePurchase({
      amountCad: 140,
      category: "grocery",
      mcc: 5411,
      merchantBrand: "loblaws",
    });
    // Cobalt 5x wins at the 1.0¢ floor already, so there is no crossing to find.
    expect(winnerAt(grocery, 1.0)).toBe("amex-cobalt");
    expect(winnerAt(grocery, 4.0)).toBe("amex-cobalt");
    expect(advise(liveOwner(), grocery).valuationSensitive).toBe(false);
  });
});

// ── Ported from ValuationSensitivityTests.swift ──────────────────────────────
//
// Also a print-only diagnostic in Swift: it counts how many of nine checkouts change their
// advice between 1.8¢ and the 1.0¢ floor. Ported as an assertion, the interesting content is
// not the count but the invariant behind it — a winner that flips between the two valuations
// must have been disclosed as sensitive at the lower one, and one that does not flip must not
// claim a breakeven inside the interval. That ties the disclosure to real behaviour without
// hard-coding an answer the engine itself is supposed to produce.

describe("ValuationSensitivityTests", () => {
  const checkouts: Array<[string, PurchaseContext]> = [
    ["Coffee 6 CAD", makePurchase({ amountCad: 6, category: "dining", mcc: 5814 })],
    ["Restaurant 50 CAD", makePurchase({ amountCad: 50, category: "dining", mcc: 5812 })],
    [
      "Groceries 140 CAD",
      makePurchase({
        amountCad: 140,
        category: "grocery",
        mcc: 5411,
        merchantBrand: "loblaws",
      }),
    ],
    [
      "Netflix 15.49 CAD",
      makePurchase({
        amountCad: 15.49,
        category: "streaming",
        mcc: 5968,
        merchantBrand: "netflix",
        channel: "online",
        recurringIndicator: true,
      }),
    ],
    ["Gas 70 CAD", makePurchase({ amountCad: 70, category: "gasStation", mcc: 5541 })],
    ["Taxi 25 CAD", makePurchase({ amountCad: 25, category: "transit", mcc: 4121 })],
    [
      "Marriott stay 300 CAD",
      makePurchase({
        amountCad: 300,
        category: "marriottDirect",
        mcc: 3509,
        merchantBrand: "marriott",
      }),
    ],
    ["Flight 600 CAD", makePurchase({ amountCad: 600, category: "travel", mcc: 3000 })],
    ["Pharmacy 30 CAD", makePurchase({ amountCad: 30, category: "drugStore", mcc: 5912 })],
  ];

  it.each(checkouts)(
    "%s: a flip between 1.0¢ and 1.8¢ is disclosed at 1.0¢, and only then",
    (_label, purchase) => {
      const atFloor = advise(pinnedOwner(1.0), purchase);
      const atDeclared = advise(pinnedOwner(1.8), purchase);
      const flipped = atFloor.winner.cardId !== atDeclared.winner.cardId;

      if (flipped) {
        expect(atFloor.valuationSensitive).toBe(true);
        expect(atFloor.valuationDirection).toBe("above");
        expect(atFloor.breakevenCentsPerPoint ?? NaN).toBeGreaterThan(1.0);
        expect(atFloor.breakevenCentsPerPoint ?? NaN).toBeLessThanOrEqual(1.8);
      } else if (atFloor.valuationDirection === "above") {
        // No flip by 1.8¢, so any disclosed upside must sit beyond it.
        expect(atFloor.breakevenCentsPerPoint ?? NaN).toBeGreaterThan(1.8);
      }
    },
  );

  it("flips the gas $70 advice and holds the grocery $140 advice", () => {
    const gas = makePurchase({ amountCad: 70, category: "gasStation", mcc: 5541 });
    expect(advise(pinnedOwner(1.0), gas).winner.cardId).toBe("wealthsimple-vip");
    expect(advise(pinnedOwner(1.8), gas).winner.cardId).toBe("amex-cobalt");

    const grocery = makePurchase({
      amountCad: 140,
      category: "grocery",
      mcc: 5411,
      merchantBrand: "loblaws",
    });
    expect(advise(pinnedOwner(1.0), grocery).winner.cardId).toBe("amex-cobalt");
    expect(advise(pinnedOwner(1.8), grocery).winner.cardId).toBe("amex-cobalt");
  });
});

// ── Downside sensitivity: the `.below` branch ────────────────────────────────

describe("downside valuation sensitivity", () => {
  it("warns that Netflix at 1.8¢ reverts to MBNA below 1.6667¢", () => {
    const r = advise(
      pinnedOwner(1.8),
      makePurchase({
        amountCad: 15.49,
        category: "streaming",
        mcc: 5968,
        merchantBrand: "netflix",
        channel: "online",
        recurringIndicator: true,
      }),
    );
    // Cobalt 3x: 46.47 MR × 1.8¢ = $0.8365 wins; at the 1.0¢ floor it is $0.4647 and MBNA's
    // $0.7745 takes over. Same crossing as the upside case, read from the other side.
    expect(r.winner.cardId).toBe("amex-cobalt");
    expect(r.valuationSensitive).toBe(true);
    expect(r.valuationDirection).toBe("below");
    expect(r.alternateWinnerCardId).toBe("mbna-rewards-we");
    expect(r.breakevenCentsPerPoint ?? NaN).toBeCloseTo(1.6667, 3);
    // The disclosed cents is the winner's own currency valuation.
    expect(r.declaredCentsPerPoint ?? NaN).toBeCloseTo(1.8, 4);
  });
});

// ── Switch threshold: `both` vs `either` ─────────────────────────────────────

describe("switch threshold semantics", () => {
  const taxi = makePurchase({ amountCad: 12, category: "transit", mcc: 4121 });

  it("holds the default under 'both' when only the pp leg clears", () => {
    // Advantage $0.192 = 1.6pp ≥ 0.5pp, but $0.192 < $0.25.
    const r = advise(pinnedOwner(), taxi);
    expect(r.winner.cardId).toBe("wealthsimple-vip");
    expect(r.switchedFromDefault).toBe(false);
    expect(r.suppressedBetterCard?.cardId).toBe("amex-cobalt");
  });

  it("switches under 'either' on the same purchase", () => {
    const o = pinnedOwner();
    o.switchThreshold.semantics = "either";
    const r = advise(o, taxi);
    expect(r.winner.cardId).toBe("amex-cobalt");
    expect(r.switchedFromDefault).toBe(true);
    expect(r.advantageOverDefaultCad ?? NaN).toBeCloseTo(0.192, 4);
    expect(r.suppressedBetterCard).toBeUndefined();
  });

  it("holds the default under 'both' when only the CAD leg clears", () => {
    // Fixture `threshold-both-cad-cleared-pp-missed-1000` — the mirror of the taxi case.
    const o = pinnedOwner();
    o.cardStates["amex-cobalt"] = { capProgress: { "cobalt-eats-monthly": 2420 } };
    const p = makePurchase({ amountCad: 1000, category: "grocery", mcc: 5451 });
    const r = advise(o, p);

    expect(r.winner.cardId).toBe("wealthsimple-vip");
    expect(r.winner.netValueCad).toBeCloseTo(20.0, 3);
    expect(r.switchedFromDefault).toBe(false);
    // $80 in cap × 5 + $920 × 1 = 1,320 MR × 1.8¢ = $23.76. Advantage $3.76 clears the $0.25
    // floor but is only 0.376pp, under the 0.5pp floor.
    expect(r.suppressedBetterCard?.cardId).toBe("amex-cobalt");
    expect(r.suppressedBetterCard?.netValueCad ?? NaN).toBeCloseTo(23.76, 3);
    // When the threshold holds the default, runnerUp is "the card you passed up" and can be
    // worth MORE than the winner.
    expect(r.runnerUp?.cardId).toBe("amex-cobalt");
    expect(r.runnerUp?.netValueCad ?? NaN).toBeGreaterThan(r.winner.netValueCad);
    // Here the breakeven is where Cobalt clears the THRESHOLD, not where it overtakes on
    // raw value — it already has: ($20.00 + max($0.25, $5.00)) × 100 / 1,320 = 1.8939¢.
    expect(r.valuationSensitive).toBe(true);
    expect(r.valuationDirection).toBe("above");
    expect(r.alternateWinnerCardId).toBe("amex-cobalt");
    expect(r.breakevenCentsPerPoint ?? NaN).toBeCloseTo(1.8939, 3);
  });

  it("reports advantageOverDefaultCad as 0 — not undefined — when the default holds", () => {
    // `RecommendationEngine.swift:173` passes `advantage: 0` on the held-default branch;
    // only the defaultNotAccepted branch passes nil. Asserting the difference keeps a
    // "helpful" nil from creeping in.
    const r = advise(pinnedOwner(), taxi);
    expect(r.advantageOverDefaultCad).toBe(0);
  });
});

// ── The tie-break (porting trap 2) ───────────────────────────────────────────

function syntheticCard(cardId: string, rate: number): CardProduct {
  return {
    cardId,
    officialName: cardId,
    issuer: "test",
    network: "visa",
    kind: "credit",
    fee: {},
    program: { programId: "cashback", unit: "cad" },
    fxRules: [],
    earnRules: [
      {
        ruleId: `${cardId}-flat`,
        status: "current",
        sourceType: "issuerConfirmed",
        earn: { type: "cashback", rate },
        predicate: {},
      },
    ],
    caps: [],
    perTransactionRewardVisibility: "none",
    lastVerifiedAt: "2026-08-19",
  };
}

function syntheticOwner(defaultCardId: string): OwnerState {
  const base = liveOwner();
  return {
    ownerStateVersion: base.ownerStateVersion,
    ownedCardIds: [],
    defaultCardId,
    switchThreshold: {
      minAdvantagePercentagePoints: 0.5,
      minAdvantageCad: 0.25,
      semantics: "both",
    },
    carry: { drawerCards: [] },
    cardStates: {},
    valuationsCad: base.valuationsCad,
  };
}

describe("rank tie-break", () => {
  // Deliberately NOT in the expected output order: a comparator that returned 0 for ties
  // would pass these through unchanged, because Array.prototype.sort is stable.
  const tiedIds = ["z-card", "a-card", "m-default", "b-card"];
  const tied: Catalogue = {
    catalogueVersion: "1.0.0",
    currency: "CAD",
    cards: tiedIds.map((id) => syntheticCard(id, 0.02)),
  };
  const p = makePurchase({ amountCad: 100, category: "other" });

  it("ranks the default card first among equals, then ascending cardId", () => {
    const r = recommend(tied, syntheticOwner("m-default"), p, asOf);
    expect(r.allCandidates.map((c) => c.cardId)).toEqual([
      "m-default",
      "a-card",
      "b-card",
      "z-card",
    ]);
    expect(r.winner.cardId).toBe("m-default");
    expect(r.switchedFromDefault).toBe(false);
    expect(r.suppressedBetterCard).toBeUndefined();
  });

  it("falls back to ascending cardId when the default is not in the field", () => {
    const r = recommend(tied, syntheticOwner("not-in-catalogue"), p, asOf);
    expect(r.allCandidates.map((c) => c.cardId)).toEqual([
      "a-card",
      "b-card",
      "m-default",
      "z-card",
    ]);
    expect(r.defaultNotAccepted).toBe(true);
    expect(r.advantageOverDefaultCad).toBeUndefined();
  });

  it("orders by value first and only then by the tie-break", () => {
    const mixed: Catalogue = {
      catalogueVersion: "1.0.0",
      currency: "CAD",
      cards: [
        syntheticCard("a-card", 0.01),
        syntheticCard("m-default", 0.02),
        syntheticCard("z-card", 0.03),
      ],
    };
    const r = recommend(mixed, syntheticOwner("m-default"), p, asOf);
    expect(r.allCandidates.map((c) => c.cardId)).toEqual([
      "z-card",
      "m-default",
      "a-card",
    ]);
  });

  it("produces the same ranking regardless of catalogue order", () => {
    // The real catalogue on a purchase that ties Wealthsimple with Tangerine at 2%.
    const owner = pinnedOwner();
    const pharmacy = makePurchase({ amountCad: 30, category: "drugStore", mcc: 5912 });
    const forward = advise(owner, pharmacy);
    const reversed = new RecommendationEngine(
      { ...catalogue, cards: [...catalogue.cards].reverse() },
      owner,
    ).recommend(pharmacy, asOf);

    expect(reversed.allCandidates.map((c) => c.cardId)).toEqual(
      forward.allCandidates.map((c) => c.cardId),
    );
    // And the tie itself resolves to the default, with Tangerine as the runner-up.
    expect(forward.winner.cardId).toBe("wealthsimple-vip");
    expect(forward.runnerUp?.cardId).toBe("tangerine-moneyback-world");
    expect(forward.runnerUp?.netValueCad ?? NaN).toBeCloseTo(
      forward.winner.netValueCad,
      6,
    );
  });
});

// ── The precondition ─────────────────────────────────────────────────────────

describe("no scorable card", () => {
  const message = "no scorable card — catalogue misconfigured";

  it("throws when the catalogue is empty", () => {
    const empty: Catalogue = { catalogueVersion: "1.0.0", currency: "CAD", cards: [] };
    expect(() =>
      recommend(empty, syntheticOwner("m-default"), makePurchase({ amountCad: 10, category: "other" }), asOf),
    ).toThrowError(message);
  });

  it("throws when every card is excluded rather than returning a null recommendation", () => {
    const visaOnly: Catalogue = {
      catalogueVersion: "1.0.0",
      currency: "CAD",
      cards: [syntheticCard("a-card", 0.02)],
    };
    const amexOnly = makePurchase({
      amountCad: 10,
      category: "other",
      acceptedNetworks: new Set<Network>(["amex"]),
    });
    expect(() => recommend(visaOnly, syntheticOwner("a-card"), amexOnly, asOf)).toThrowError(
      message,
    );
  });
});
