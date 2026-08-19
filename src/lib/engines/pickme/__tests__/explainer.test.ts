import { describe, expect, it } from "vitest";
import catalogueJson from "@/data/contracts/card-catalogue.json";
import type { Catalogue } from "../catalogue";
import { makePurchase } from "../purchase";
import type { CandidateScore } from "../scorer";
import {
  type Explanation,
  type Recommendation,
  RecommendationExplainer,
} from "../explainer";

const catalogue = catalogueJson as unknown as Catalogue;
const explainer = new RecommendationExplainer(catalogue);

function scoreStub(partial: Partial<CandidateScore> & { cardId: string }): CandidateScore {
  return {
    appliedRuleId: undefined,
    rewardUnits: 0,
    grossRewardCad: 0,
    fxCostCad: 0,
    netValueCad: 0,
    floorNetValueCad: 0,
    aspirationalNetValueCad: 0,
    warnings: [],
    excluded: false,
    exclusionReason: undefined,
    ...partial,
  };
}

describe("RecommendationExplainer", () => {
  // Port of ExplainerTests.testGroceryExplanation
  it("explains a grocery recommendation with a clear winner and runner-up", () => {
    const p = makePurchase({
      amountCad: 100,
      category: "grocery",
      mcc: 5411,
      merchantBrand: "loblaws",
    });
    const rec: Recommendation = {
      winner: scoreStub({
        cardId: "amex-cobalt",
        appliedRuleId: "amex-cobalt-grocery",
        rewardUnits: 500,
        grossRewardCad: 9.0,
        netValueCad: 9.0,
        floorNetValueCad: 5.0,
        aspirationalNetValueCad: 9.0,
      }),
      runnerUp: scoreStub({
        cardId: "mbna-rewards-we",
        appliedRuleId: "mbna-rewards-we-grocery",
        rewardUnits: 500,
        grossRewardCad: 5.0,
        netValueCad: 5.0,
        floorNetValueCad: 5.0,
        aspirationalNetValueCad: 5.0,
      }),
      switchedFromDefault: true,
      advantageOverDefaultCad: 4.0,
      defaultNotAccepted: false,
      suppressedBetterCard: undefined,
      valuationSensitive: false,
      allCandidates: [],
    };

    const e: Explanation = explainer.explain(rec, p);
    expect(e.headline).toBe(
      "Use American Express Cobalt Card — about $9.00 back on this $100.00 purchase.",
    );
    expect(e.why).toBe("Applied rule amex-cobalt-grocery: $9.00 in rewards.");
    expect(e.runnerUpLine).toBe(
      "Next best: MBNA Rewards World Elite Mastercard ($5.00) — you'd give up $4.00.",
    );
    expect(e.valuationLine).toBeUndefined();
    expect(e.warningLines).toEqual([]);
  });

  // Port of ExplainerTests.testTaxiSuppressionExplanation
  it("explains a taxi purchase where a better card is suppressed by switch threshold", () => {
    const p = makePurchase({
      amountCad: 12,
      category: "transit",
      mcc: 4121,
    });
    const rec: Recommendation = {
      winner: scoreStub({
        cardId: "wealthsimple-vip",
        appliedRuleId: "ws-vip-base",
        rewardUnits: 0.24,
        grossRewardCad: 0.24,
        netValueCad: 0.24,
        floorNetValueCad: 0.24,
        aspirationalNetValueCad: 0.24,
      }),
      runnerUp: scoreStub({
        cardId: "amex-cobalt",
        appliedRuleId: "amex-cobalt-transit",
        rewardUnits: 24,
        grossRewardCad: 0.43,
        netValueCad: 0.43,
        floorNetValueCad: 0.24,
        aspirationalNetValueCad: 0.43,
      }),
      switchedFromDefault: false,
      advantageOverDefaultCad: 0,
      defaultNotAccepted: false,
      suppressedBetterCard: scoreStub({
        cardId: "amex-cobalt",
        appliedRuleId: "amex-cobalt-transit",
        rewardUnits: 24,
        grossRewardCad: 0.43,
        netValueCad: 0.43,
        floorNetValueCad: 0.24,
        aspirationalNetValueCad: 0.43,
      }),
      valuationSensitive: false,
      allCandidates: [],
    };

    const e: Explanation = explainer.explain(rec, p);
    expect(e.headline).toBe(
      "Stay on Wealthsimple Visa Infinite Privilege Credit Card — about $0.24 back on this $12.00 purchase.",
    );
    expect(e.why).toBe("Applied rule ws-vip-base: $0.24 in rewards.");
    expect(e.runnerUpLine).toBe(
      "American Express Cobalt Card is marginally better (+$0.19) — not worth the wallet dig.",
    );
    expect(e.valuationLine).toBeUndefined();
    expect(e.warningLines).toEqual([]);
  });

  // Port of ExplainerTests.testDrawerCardWarningSurfaces
  it("surfaces a drawer card warning when winning card is in the drawer", () => {
    const p = makePurchase({
      amountCad: 150,
      category: "ctFamily",
      mcc: 5200,
      merchantBrand: "canadian-tire",
    });
    const rec: Recommendation = {
      winner: scoreStub({
        cardId: "triangle-we",
        appliedRuleId: "triangle-we-ct",
        rewardUnits: 6.0,
        grossRewardCad: 6.0,
        netValueCad: 6.0,
        floorNetValueCad: 6.0,
        aspirationalNetValueCad: 6.0,
        warnings: ["drawerCard"],
      }),
      runnerUp: scoreStub({
        cardId: "wealthsimple-vip",
        appliedRuleId: "ws-vip-base",
        rewardUnits: 3.0,
        grossRewardCad: 3.0,
        netValueCad: 3.0,
        floorNetValueCad: 3.0,
        aspirationalNetValueCad: 3.0,
      }),
      switchedFromDefault: true,
      advantageOverDefaultCad: 3.0,
      defaultNotAccepted: false,
      suppressedBetterCard: undefined,
      valuationSensitive: false,
      allCandidates: [],
    };

    const e: Explanation = explainer.explain(rec, p);
    expect(e.headline.startsWith("Use Triangle World Elite Mastercard")).toBe(true);
    expect(e.headline).toBe(
      "Use Triangle World Elite Mastercard — about $6.00 back on this $150.00 purchase.",
    );
    expect(e.warningLines).toContain(
      "This card is in your drawer — bring it or take the runner-up.",
    );
  });

  it("formats fx fee clause in why string when foreign transaction fee applies", () => {
    const p = makePurchase({
      amountCad: 100,
      category: "dining",
      currency: "USD",
    });
    const rec: Recommendation = {
      winner: scoreStub({
        cardId: "amex-cobalt",
        appliedRuleId: "amex-cobalt-dining",
        rewardUnits: 500,
        grossRewardCad: 9.0,
        fxCostCad: 2.5,
        netValueCad: 6.5,
        floorNetValueCad: 2.5,
        aspirationalNetValueCad: 6.5,
      }),
      switchedFromDefault: true,
      defaultNotAccepted: false,
      valuationSensitive: false,
      allCandidates: [],
    };

    const e = explainer.explain(rec, p);
    expect(e.why).toBe(
      "Applied rule amex-cobalt-dining: $9.00 in rewards minus $2.50 foreign-transaction fee.",
    );
  });

  it("handles no earn rule applied in why string", () => {
    const p = makePurchase({ amountCad: 50, category: "general" });
    const rec: Recommendation = {
      winner: scoreStub({
        cardId: "wealthsimple-vip",
        appliedRuleId: undefined,
        rewardUnits: 0,
        grossRewardCad: 0,
        netValueCad: 0,
      }),
      switchedFromDefault: false,
      defaultNotAccepted: false,
      valuationSensitive: false,
      allCandidates: [],
    };

    const e = explainer.explain(rec, p);
    expect(e.why).toBe("No earn rule applied.");
  });

  it("formats valuation line when valuationSensitive is true with below direction", () => {
    const p = makePurchase({ amountCad: 100, category: "grocery" });
    const rec: Recommendation = {
      winner: scoreStub({
        cardId: "amex-cobalt",
        appliedRuleId: "amex-cobalt-grocery",
        rewardUnits: 500,
        grossRewardCad: 9.0,
        netValueCad: 9.0,
      }),
      switchedFromDefault: true,
      defaultNotAccepted: false,
      valuationSensitive: true,
      valuationDirection: "below",
      alternateWinnerCardId: "mbna-rewards-we",
      breakevenCentsPerPoint: 1.25,
      declaredCentsPerPoint: 1.8,
      allCandidates: [],
    };

    const e = explainer.explain(rec, p);
    expect(e.valuationLine).toBe(
      "Assumes your points are worth 1.80¢ each. Below about 1.25¢, MBNA Rewards World Elite Mastercard wins instead.",
    );
  });

  it("formats valuation line when valuationSensitive is true with above direction", () => {
    const p = makePurchase({ amountCad: 100, category: "grocery" });
    const rec: Recommendation = {
      winner: scoreStub({
        cardId: "rogers-red-we",
        appliedRuleId: "rogers-red-we-base",
        rewardUnits: 2.0,
        grossRewardCad: 2.0,
        netValueCad: 2.0,
      }),
      switchedFromDefault: false,
      defaultNotAccepted: false,
      valuationSensitive: true,
      valuationDirection: "above",
      alternateWinnerCardId: "amex-cobalt",
      breakevenCentsPerPoint: 1.5,
      declaredCentsPerPoint: 1.0,
      allCandidates: [],
    };

    const e = explainer.explain(rec, p);
    expect(e.valuationLine).toBe(
      "Assumes your points are worth 1.00¢ each. Above about 1.50¢, American Express Cobalt Card wins instead.",
    );
  });

  it("surfaces all warning line descriptions", () => {
    const p = makePurchase({ amountCad: 100, category: "general" });
    const warnings = [
      "drawerCard",
      "capNearlyExhausted",
      "negativeNetValue",
      "networkNotAccepted",
      "unresolvedOwnerState",
      "fxAllowanceAssumed",
      "hypotheticalSelection",
    ] as const;

    const rec: Recommendation = {
      winner: scoreStub({
        cardId: "wealthsimple-vip",
        appliedRuleId: "ws-vip-base",
        rewardUnits: 1,
        grossRewardCad: 1,
        netValueCad: 1,
        warnings: [...warnings],
      }),
      switchedFromDefault: false,
      defaultNotAccepted: false,
      valuationSensitive: false,
      allCandidates: [],
    };

    const e = explainer.explain(rec, p);
    expect(e.warningLines).toEqual([
      "This card is in your drawer — bring it or take the runner-up.",
      "Category cap nearly used up — the winner may flip soon.",
      "This card would LOSE money here after fees.",
      "Card network not accepted at this merchant.",
      "Card skipped — account state not set up yet.",
      "Assumed within this card's monthly FX-free allowance.",
      "Assumes this is one of your selected 2% categories — check your selections.",
    ]);
  });

  it("falls back to cardId if card is not in catalogue", () => {
    const p = makePurchase({ amountCad: 100, category: "general" });
    const rec: Recommendation = {
      winner: scoreStub({
        cardId: "custom-mystery-card",
        appliedRuleId: "custom-rule",
        rewardUnits: 2,
        grossRewardCad: 2,
        netValueCad: 2,
      }),
      runnerUp: scoreStub({
        cardId: "another-mystery-card",
        rewardUnits: 1,
        grossRewardCad: 1,
        netValueCad: 1,
      }),
      switchedFromDefault: true,
      defaultNotAccepted: false,
      valuationSensitive: false,
      allCandidates: [],
    };

    const e = explainer.explain(rec, p);
    expect(e.headline).toBe(
      "Use custom-mystery-card — about $2.00 back on this $100.00 purchase.",
    );
    expect(e.runnerUpLine).toBe(
      "Next best: another-mystery-card ($1.00) — you'd give up $1.00.",
    );
  });

  it("uses 'Use' verb when defaultNotAccepted is true even if switchedFromDefault is false", () => {
    const p = makePurchase({ amountCad: 50, category: "general" });
    const rec: Recommendation = {
      winner: scoreStub({
        cardId: "amex-cobalt",
        appliedRuleId: "amex-cobalt-base",
        rewardUnits: 50,
        grossRewardCad: 0.9,
        netValueCad: 0.9,
      }),
      switchedFromDefault: false,
      defaultNotAccepted: true,
      valuationSensitive: false,
      allCandidates: [],
    };

    const e = explainer.explain(rec, p);
    expect(e.headline).toBe(
      "Use American Express Cobalt Card — about $0.90 back on this $50.00 purchase.",
    );
  });
});
