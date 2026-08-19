import { describe, expect, it } from "vitest";
import { decodeEarn } from "../catalogue";
import { makePurchase } from "../purchase";

describe("decodeEarn", () => {
  it("decodes a points earn", () => {
    expect(decodeEarn({ type: "points", pointsPerCad: 5 }))
      .toEqual({ type: "points", pointsPerCad: 5 });
  });

  it("decodes a cashback earn with a reward currency", () => {
    expect(decodeEarn({ type: "cashback", rate: 0.04, rewardCurrency: "ctMoney" }))
      .toEqual({ type: "cashback", rate: 0.04, rewardCurrency: "ctMoney" });
  });

  it("decodes a cashback earn without a reward currency", () => {
    expect(decodeEarn({ type: "cashback", rate: 0.02 }))
      .toEqual({ type: "cashback", rate: 0.02, rewardCurrency: undefined });
  });

  it("decodes centsPerLitre", () => {
    expect(decodeEarn({ type: "centsPerLitre" })).toEqual({ type: "centsPerLitre" });
  });

  it("throws on an unknown earn type rather than defaulting", () => {
    expect(() => decodeEarn({ type: "miles" })).toThrow(/unknown earn type: miles/);
  });
});

describe("makePurchase", () => {
  it("applies Swift's declared defaults", () => {
    const p = makePurchase({ amountCad: 100, category: "grocery" });
    expect(p.currency).toBe("CAD");
    expect(p.country).toBe("CA");
    expect(p.channel).toBe("cardPresent");
    expect(p.recurringIndicator).toBe(false);
    expect([...p.acceptedNetworks].sort()).toEqual(["amex", "mastercard", "visa"]);
  });

  it("does not override explicitly supplied values", () => {
    const p = makePurchase({
      amountCad: 50, category: "dining", currency: "USD",
      acceptedNetworks: new Set(["mastercard"] as const),
    });
    expect(p.currency).toBe("USD");
    expect([...p.acceptedNetworks]).toEqual(["mastercard"]);
  });
});
