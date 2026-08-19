import { beforeEach, describe, expect, it } from "vitest";
import catalogueJson from "@/data/contracts/card-catalogue.json";
import ownerStateJson from "@/data/contracts/owner-state.json";
import type { CardProduct, Catalogue } from "../catalogue";
import type { OwnerState, TangerineMoneyBackCategory } from "../ownerState";
import { makePurchase, type PurchaseContext } from "../purchase";
import { activeFxRule, resolveRule } from "../ruleMatcher";

describe("RuleMatcher", () => {
  let catalogue: Catalogue;
  let owner: OwnerState;
  const asOf = "2026-08-20";

  beforeEach(() => {
    catalogue = catalogueJson as unknown as Catalogue;
    owner = JSON.parse(JSON.stringify(ownerStateJson)) as OwnerState;
  });

  function card(id: string): CardProduct {
    const found = catalogue.cards.find((c) => c.cardId === id);
    if (!found) throw new Error(`Card ${id} not found in catalogue`);
    return found;
  }

  function appliedRuleId(cardId: string, p: PurchaseContext): string | undefined {
    const res = resolveRule(card(cardId), p, owner, asOf);
    if (res.kind === "applied") {
      return res.rule.ruleId;
    }
    return undefined;
  }

  it("grocery matches Cobalt 5x", () => {
    const p = makePurchase({
      amountCad: 100,
      category: "grocery",
      mcc: 5411,
      merchantBrand: "loblaws",
    });
    expect(appliedRuleId("amex-cobalt", p)).toBe("cobalt-eats-5x");
  });

  it("Costco MCC blocks MBNA grocery", () => {
    const p = makePurchase({
      amountCad: 200,
      category: "wholesaleClub",
      mcc: 5300,
      merchantBrand: "costco",
      acceptedNetworks: new Set(["mastercard"] as const),
    });
    expect(appliedRuleId("mbna-rewards-we", p)).toBe("mbna-base");
  });

  it("Costco brand blocks Triangle grocery even as MCC 5411", () => {
    const p = makePurchase({
      amountCad: 200,
      category: "grocery",
      mcc: 5411,
      merchantBrand: "costco",
    });
    expect(appliedRuleId("triangle-we", p)).toBe("triangle-base");
  });

  it("recurring indicator fires Momentum 4%", () => {
    const p = makePurchase({
      amountCad: 15.49,
      category: "streaming",
      mcc: 5968,
      merchantBrand: "netflix",
      channel: "online",
      recurringIndicator: true,
    });
    expect(appliedRuleId("scotia-momentum-vi-plus", p)).toBe("momentum-grocery-recurring-4pct");
  });

  it("USD rule fires on currency", () => {
    const p = makePurchase({
      amountCad: 165,
      currency: "USD",
      category: "other",
      channel: "online",
    });
    expect(appliedRuleId("rogers-red-we", p)).toBe("rogers-usd-3pct");
  });

  it("Rogers service rule skipped when unresolved", () => {
    const p = makePurchase({ amountCad: 100, category: "other" });
    const s = owner.cardStates["rogers-red-we"] ?? {};
    s.rogersEligibleServiceLinked = undefined;
    owner.cardStates["rogers-red-we"] = s;
    const res = resolveRule(card("rogers-red-we"), p, owner, asOf);
    expect(res.kind).toBe("applied");
    if (res.kind === "applied") {
      expect(res.rule.ruleId).toBe("rogers-base-1_5");
    }
  });

  it("Crypto excluded when plan inactive", () => {
    const p = makePurchase({ amountCad: 100, category: "other" });
    const res = resolveRule(card("cryptocom-royal-indigo"), p, owner, asOf);
    expect(res.kind).toBe("cardExcluded");
  });

  it("Tangerine treatAsAllSelected matches sentinel", () => {
    const p = makePurchase({ amountCad: 30, category: "drugStore", mcc: 5912 });
    expect(appliedRuleId("tangerine-moneyback-world", p)).toBe("tangerine-selected-2pct");
  });

  it("Tangerine unresolved selections fall to base", () => {
    const p = makePurchase({ amountCad: 30, category: "drugStore", mcc: 5912 });
    const s = owner.cardStates["tangerine-moneyback-world"] ?? {};
    s.selectedCategories = undefined;
    owner.cardStates["tangerine-moneyback-world"] = s;
    const res = resolveRule(card("tangerine-moneyback-world"), p, owner, asOf);
    expect(res.kind).toBe("applied");
    if (res.kind === "applied") {
      expect(res.rule.ruleId).toBe("tangerine-base");
    }
  });

  it("every Tangerine selection matches its purchase facts", () => {
    const cases: [TangerineMoneyBackCategory, PurchaseContext][] = [
      ["grocery", makePurchase({ amountCad: 30, category: "grocery", mcc: 5411 })],
      ["dining", makePurchase({ amountCad: 30, category: "dining", mcc: 5812 })],
      ["gasStation", makePurchase({ amountCad: 30, category: "gasStation", mcc: 5541 })],
      ["entertainment", makePurchase({ amountCad: 30, category: "entertainment" })],
      ["furniture", makePurchase({ amountCad: 30, category: "furniture" })],
      ["lodging", makePurchase({ amountCad: 30, category: "lodging", mcc: 3501 })],
      ["drugStore", makePurchase({ amountCad: 30, category: "drugStore", mcc: 5912 })],
      ["recurring", makePurchase({ amountCad: 30, category: "insurance", recurringIndicator: true })],
      ["homeImprovement", makePurchase({ amountCad: 30, category: "homeImprovement" })],
      ["transit", makePurchase({ amountCad: 30, category: "transit", mcc: 4121 })],
      ["eGames", makePurchase({ amountCad: 30, category: "eGames" })],
      ["fitness", makePurchase({ amountCad: 30, category: "fitness" })],
      ["foreignCurrency", makePurchase({ amountCad: 30, currency: "USD", category: "other" })],
    ];

    expect(cases).toHaveLength(13);
    for (const [selection, purchase] of cases) {
      const state = owner.cardStates["tangerine-moneyback-world"] ?? {};
      state.selectedCategories = [selection];
      state.treatAsAllSelected = false;
      owner.cardStates["tangerine-moneyback-world"] = state;

      expect(
        appliedRuleId("tangerine-moneyback-world", purchase),
        `Failed matching Tangerine selection: ${selection}`,
      ).toBe("tangerine-selected-2pct");
    }
  });

  it("Tangerine special selections do not match unrelated purchases", () => {
    const state = owner.cardStates["tangerine-moneyback-world"] ?? {};
    state.selectedCategories = ["recurring", "foreignCurrency"];
    state.treatAsAllSelected = false;
    owner.cardStates["tangerine-moneyback-world"] = state;

    const ordinaryCadPurchase = makePurchase({ amountCad: 30, category: "other" });
    expect(appliedRuleId("tangerine-moneyback-world", ordinaryCadPurchase)).toBe("tangerine-base");
  });

  it("Marriott direct inherits lodging", () => {
    const p = makePurchase({
      amountCad: 300,
      category: "marriottDirect",
      mcc: 3509,
      merchantBrand: "marriott",
    });
    expect(appliedRuleId("amex-platinum", p)).toBe("platinum-travel-2x");
    expect(appliedRuleId("amex-bonvoy", p)).toBe("bonvoy-marriott-5x");
  });

  it("announced future FX record ignored before effectiveFrom", () => {
    const crypto = card("cryptocom-royal-indigo");
    const active = activeFxRule(crypto, "2026-08-20");
    expect(active?.freeAllowanceCadPerCalendarMonth).toBeUndefined();
    const september = activeFxRule(crypto, "2026-09-02");
    expect(september?.freeAllowanceCadPerCalendarMonth).toBe(1400);
  });
});
