import { beforeEach, describe, expect, it } from "vitest";
import catalogueJson from "@/data/contracts/card-catalogue.json";
import ownerStateJson from "@/data/contracts/owner-state.json";
import type { CardProduct, Catalogue } from "../catalogue";
import type { OwnerState } from "../ownerState";
import { makePurchase, type PurchaseContext } from "../purchase";
import { FALLBACK_CAD_TO_USD, score } from "../scorer";

describe("Scorer", () => {
  let catalogue: Catalogue;
  let owner: OwnerState;
  const asOf = "2026-08-20";

  beforeEach(() => {
    catalogue = catalogueJson as unknown as Catalogue;
    owner = JSON.parse(JSON.stringify(ownerStateJson)) as OwnerState;
    // Pin amexMembershipRewards to 1.8c as in SeedLoader.loadPinnedOwnerState()
    owner.valuationsCad.amexMembershipRewards.centsPerPoint = 1.8;
  });

  function card(id: string): CardProduct {
    const found = catalogue.cards.find((c) => c.cardId === id);
    if (!found) throw new Error(`Card ${id} not found in catalogue`);
    return found;
  }

  function scoreCard(id: string, p: PurchaseContext, o?: OwnerState) {
    return score(card(id), p, o ?? owner, asOf);
  }

  // Case 1: testCobaltGrocery100
  it("scores Cobalt on $100 grocery at 5x points", () => {
    const p = makePurchase({
      amountCad: 100,
      category: "grocery",
      mcc: 5411,
      merchantBrand: "loblaws",
    });
    const s = scoreCard("amex-cobalt", p);
    expect(s.rewardUnits).toBeCloseTo(500, 2);
    expect(s.netValueCad).toBeCloseTo(9.0, 2);
    expect(s.grossRewardCad).toBeCloseTo(9.0, 2);
    expect(s.appliedRuleId).toBe("cobalt-eats-5x");
    expect(s.excluded).toBe(false);
  });

  // Case 2: testCobaltCapProration
  it("scores Cobalt cap proration across monthly boundary and adds capNearlyExhausted warning", () => {
    const o = JSON.parse(JSON.stringify(owner)) as OwnerState;
    const cobaltState = o.cardStates["amex-cobalt"] ?? {};
    cobaltState.capProgress = { "cobalt-eats-monthly": 2450 };
    o.cardStates["amex-cobalt"] = cobaltState;

    const p = makePurchase({
      amountCad: 100,
      category: "grocery",
      mcc: 5411,
      merchantBrand: "loblaws",
    });
    const s = scoreCard("amex-cobalt", p, o);
    // $50 in cap at 5x (250 pts) + $50 over cap at 1x (50 pts) = 300 pts
    expect(s.rewardUnits).toBeCloseTo(300, 2);
    expect(s.netValueCad).toBeCloseTo(5.4, 2);
    expect(s.warnings).toContain("capNearlyExhausted");
  });

  // Case 3: testWealthsimpleUsdNoFx
  it("scores Wealthsimple USD purchase with 0% FX fee", () => {
    const p = makePurchase({
      amountCad: 165,
      currency: "USD",
      category: "other",
      channel: "online",
    });
    const s = scoreCard("wealthsimple-vip", p);
    expect(s.netValueCad).toBeCloseTo(3.3, 2);
    expect(s.fxCostCad).toBeCloseTo(0, 2);
  });

  // Case 4: testCobaltUsdGoesNegative
  it("scores Cobalt USD purchase going negative from 2.5% FX cost", () => {
    const p = makePurchase({
      amountCad: 165,
      currency: "USD",
      category: "other",
      channel: "online",
    });
    const s = scoreCard("amex-cobalt", p);
    // 165 pts * 1.8c = $2.97 gross; FX = 165 * 0.025 = $4.125; net = 2.97 - 4.125 = -1.155
    expect(s.netValueCad).toBeCloseTo(-1.155, 3);
    expect(s.warnings).toContain("negativeNetValue");
  });

  // Case 5: testCryptoProAutoSell
  it("scores Crypto.com Pro with autoSell", () => {
    const o = JSON.parse(JSON.stringify(owner)) as OwnerState;
    const cryptoState = o.cardStates["cryptocom-royal-indigo"] ?? {};
    cryptoState.cryptoLevelUpProActive = true;
    cryptoState.croHandling = "autoSell";
    o.cardStates["cryptocom-royal-indigo"] = cryptoState;

    const p = makePurchase({
      amountCad: 165,
      currency: "USD",
      category: "other",
      channel: "online",
    });
    const s = scoreCard("cryptocom-royal-indigo", p, o);
    expect(s.netValueCad).toBeCloseTo(4.95, 2);
  });

  // Case 6: testTriangleCtFamilyUsabilityHaircutAndDrawerWarning
  it("scores Triangle with CT family usability haircut and drawer warning", () => {
    const p = makePurchase({
      amountCad: 150,
      category: "ctFamily",
      mcc: 5200,
      merchantBrand: "canadian-tire",
    });
    const s = scoreCard("triangle-we", p);
    // 4% of 150 = 6.00 CT units * 0.95 usability factor = 5.70
    expect(s.netValueCad).toBeCloseTo(5.7, 2);
    expect(s.warnings).toContain("drawerCard");
  });

  // Case 7: testBonvoyMarriott300
  it("scores Amex Bonvoy and Amex Platinum on $300 Marriott stay", () => {
    const p = makePurchase({
      amountCad: 300,
      category: "marriottDirect",
      mcc: 3509,
      merchantBrand: "marriott",
    });
    expect(scoreCard("amex-bonvoy", p).netValueCad).toBeCloseTo(12.0, 2);
    // marriottDirect inherits lodging/travel, so Platinum earns 2x = 600 pts @ 1.8c = $10.80
    expect(scoreCard("amex-platinum", p).netValueCad).toBeCloseTo(10.8, 2);
  });

  // Case 8: testNetworkNotAcceptedExcludes
  it("excludes card when network is not accepted", () => {
    const p = makePurchase({
      amountCad: 200,
      category: "wholesaleClub",
      mcc: 5300,
      merchantBrand: "costco",
      acceptedNetworks: new Set(["mastercard"] as const),
    });
    const s = scoreCard("wealthsimple-vip", p);
    expect(s.excluded).toBe(true);
    expect(s.warnings).toContain("networkNotAccepted");
    expect(s.exclusionReason).toBe("visa not accepted");
  });

  // Additional checklist coverage: floor and aspirational valuation
  it("calculates floor and aspirational valuations for points and cashback", () => {
    const p = makePurchase({
      amountCad: 100,
      category: "grocery",
      mcc: 5411,
      merchantBrand: "loblaws",
    });
    const cobaltScore = scoreCard("amex-cobalt", p);
    // 500 points: declared 1.8c = $9.00, floor 1.0c = $5.00, aspirational 2.2c = $11.00
    expect(cobaltScore.netValueCad).toBeCloseTo(9.0, 2);
    expect(cobaltScore.floorNetValueCad).toBeCloseTo(5.0, 2);
    expect(cobaltScore.aspirationalNetValueCad).toBeCloseTo(11.0, 2);

    const wsScore = scoreCard("wealthsimple-vip", p);
    // Cash-back has floor and aspirational equal to netValueCad
    expect(wsScore.floorNetValueCad).toBeCloseTo(wsScore.netValueCad, 4);
    expect(wsScore.aspirationalNetValueCad).toBeCloseTo(wsScore.netValueCad, 4);
  });

  // USD cap calculation with and without usdEquivalent
  it("handles USD-measured caps with supplied usdEquivalent and fallback rate", () => {
    expect(FALLBACK_CAD_TO_USD).toBe(0.73);

    const o = JSON.parse(JSON.stringify(owner)) as OwnerState;
    const cryptoState = o.cardStates["cryptocom-royal-indigo"] ?? {};
    cryptoState.cryptoLevelUpProActive = true;
    cryptoState.croHandling = "autoSell";
    // Cap limit is 2500 USD monthly. Set usage to 2490 USD so room is 10 USD
    cryptoState.capProgress = { "crypto-monthly-usd": 2490 };
    o.cardStates["cryptocom-royal-indigo"] = cryptoState;

    // Case A: usdEquivalent supplied (e.g. amountCad 20, usdEquivalent 15)
    // room is 10 USD. Split: inCap = 10 USD, overCap = 5 USD. inFraction = 10 / 15 = 2/3.
    // inCapCad = 20 * (2/3) = 13.333... CAD; overCapCad = 6.666... CAD
    // postCapEarn is cashback rate 0.0 (0%), inCap is 3%
    // units = 13.333... * 0.03 + 6.666... * 0.0 = 0.40
    const pWithUsd = makePurchase({
      amountCad: 20,
      usdEquivalent: 15,
      category: "other",
    });
    const sWithUsd = scoreCard("cryptocom-royal-indigo", pWithUsd, o);
    expect(sWithUsd.rewardUnits).toBeCloseTo(20 * (10 / 15) * 0.03, 4);

    // Case B: usdEquivalent absent, falls back to amountCad * 0.73
    // amountCad = 20 -> measureAmount = 20 * 0.73 = 14.6 USD
    // usage is 2490 USD, limit is 2500 USD -> room is 10 USD.
    // split: inCap = 10 USD, overCap = 4.6 USD. inFraction = 10 / 14.6
    const pFallback = makePurchase({
      amountCad: 20,
      category: "other",
    });
    const sFallback = scoreCard("cryptocom-royal-indigo", pFallback, o);
    const expectedInFraction = 10 / (20 * 0.73);
    const expectedUnits = 20 * expectedInFraction * 0.03;
    expect(sFallback.rewardUnits).toBeCloseTo(expectedUnits, 4);
  });

  // Cap nearly exhausted exact threshold (>= 90%)
  it("adds capNearlyExhausted warning at exactly 90% usage, but not below", () => {
    const o90 = JSON.parse(JSON.stringify(owner)) as OwnerState;
    // Cobalt eats cap is 2500. 90% of 2500 = 2250
    o90.cardStates["amex-cobalt"] = {
      capProgress: { "cobalt-eats-monthly": 2250 },
    };
    const p = makePurchase({
      amountCad: 10,
      category: "grocery",
      mcc: 5411,
      merchantBrand: "loblaws",
    });
    const s90 = scoreCard("amex-cobalt", p, o90);
    expect(s90.warnings).toContain("capNearlyExhausted");

    const o89 = JSON.parse(JSON.stringify(owner)) as OwnerState;
    o89.cardStates["amex-cobalt"] = {
      capProgress: { "cobalt-eats-monthly": 2249.99 },
    };
    const s89 = scoreCard("amex-cobalt", p, o89);
    expect(s89.warnings).not.toContain("capNearlyExhausted");
  });

  // Hypothetical selection warning for Tangerine
  it("adds hypotheticalSelection warning when Tangerine treatAsAllSelected is true", () => {
    const p = makePurchase({ amountCad: 30, category: "drugStore", mcc: 5912 });
    const s = scoreCard("tangerine-moneyback-world", p);
    expect(s.warnings).toContain("hypotheticalSelection");
  });
});
