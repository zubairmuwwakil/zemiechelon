import { describe, expect, it } from "vitest";
import {
  loadCatalogue,
  loadOwnerState,
  makePurchase,
  recommend,
  type PurchaseContext,
  type Recommendation,
} from "@/lib/engines/pickme";
import fixturesJson from "@/data/contracts/engine-fixtures.json";
import {
  pointValuationOf,
  sliderDomain,
  valuationSubject,
  withDeclaredCentsPerPoint,
  DEFAULT_VALUATION_RANGE,
} from "../valuationControl";

const ASOF = "2026-08-16"; // matches pickMeConsole.test.tsx and publicSurface.test.ts
const catalogue = loadCatalogue();
const ownerState = loadOwnerState();

interface FixturePurchase {
  amountCad: number;
  category: string;
  mcc?: number | null;
  merchantBrand?: string | null;
  country?: string;
  channel?: string;
  recurringIndicator?: boolean;
  acceptedNetworks: string[];
}
const fixtures = fixturesJson.cases as unknown as {
  caseId: string;
  description: string;
  purchase: FixturePurchase;
}[];

function purchaseFor(p: FixturePurchase): PurchaseContext {
  return makePurchase({
    amountCad: p.amountCad,
    category: p.category,
    mcc: p.mcc ?? undefined,
    merchantBrand: p.merchantBrand ?? undefined,
    country: p.country ?? "CA",
    channel: p.channel ?? "cardPresent",
    recurringIndicator: p.recurringIndicator ?? false,
    acceptedNetworks: new Set(p.acceptedNetworks as ("amex" | "visa" | "mastercard")[]),
  });
}

const baselines = fixtures.map((fx) => ({
  caseId: fx.caseId,
  purchase: purchaseFor(fx.purchase),
  baseline: recommend(catalogue, ownerState, purchaseFor(fx.purchase), ASOF),
}));

const sensitive = baselines.filter((b) => b.baseline.valuationSensitive);

describe("the fixture set", () => {
  it("contains valuation-sensitive cases for the flip test to use", () => {
    expect(sensitive.length).toBeGreaterThan(0);
  });
});

describe("valuationSubject", () => {
  it("names the program the engine's own disclosed value belongs to", () => {
    // The engine reports declaredCentsPerPoint as the *challenger's* currency. If this
    // control picked any other program, the two numbers would disagree — which is exactly
    // how a slider ends up flipping near the breakeven instead of on it.
    for (const { caseId, baseline } of sensitive) {
      const subject = valuationSubject(catalogue, ownerState, baseline);
      expect(subject, caseId).toBeDefined();
      expect(subject!.declaredCentsPerPoint, caseId).toBeCloseTo(
        baseline.declaredCentsPerPoint!,
        10,
      );
      expect(subject!.breakevenCentsPerPoint, caseId).toBe(baseline.breakevenCentsPerPoint);
      expect(subject!.direction, caseId).toBe(baseline.valuationDirection);
      // The card named on the far side is the engine's, in both directions. Naming the
      // current winner here reads as a sentence and is a lie: "above X the advice becomes
      // <the card it already is>".
      expect(subject!.alternateWinnerCardId, caseId).toBe(baseline.alternateWinnerCardId);
      expect(subject!.alternateWinnerCardId, caseId).not.toBe(baseline.winner.cardId);
    }
  });

  it("still offers a points card to value when there is no breakeven", () => {
    const insensitive = baselines.filter((b) => !b.baseline.valuationSensitive);
    expect(insensitive.length).toBeGreaterThan(0);
    for (const { caseId, baseline } of insensitive) {
      const subject = valuationSubject(catalogue, ownerState, baseline);
      if (subject == null) continue; // no points card in contention — control says so
      expect(subject.breakevenCentsPerPoint, caseId).toBeUndefined();
      expect(subject.direction, caseId).toBeUndefined();
      expect(
        pointValuationOf(ownerState.valuationsCad, subject.programId),
        caseId,
      ).toBeDefined();
    }
  });
});

describe("the breakeven is exact, not approximate", () => {
  // One ten-thousandth of a cent per point either side of the engine's number. A control
  // that flipped "about there" survives a loose epsilon and dies here.
  const EPS = 1e-4;

  function winnerAt(
    purchase: PurchaseContext,
    programId: string,
    centsPerPoint: number,
  ): Recommendation {
    return recommend(
      catalogue,
      withDeclaredCentsPerPoint(ownerState, programId, centsPerPoint),
      purchase,
      ASOF,
    );
  }

  it.each(sensitive.map((s) => [s.caseId, s] as const))(
    "%s: crossing breakevenCentsPerPoint changes the winner, and crossing back changes it back",
    (caseId, { purchase, baseline }) => {
      const subject = valuationSubject(catalogue, ownerState, baseline)!;
      const breakeven = subject.breakevenCentsPerPoint!;
      expect(breakeven, caseId).toBeGreaterThan(0);

      const below = winnerAt(purchase, subject.programId, breakeven - EPS);
      const above = winnerAt(purchase, subject.programId, breakeven + EPS);

      expect(below.winner.cardId, `${caseId} below`).not.toBe(above.winner.cardId);

      // "above"/"below" is the direction the declared value must move for the advice to
      // change, so the alternate winner is on that side and the baseline winner the other.
      const [incumbentSide, alternateSide] =
        baseline.valuationDirection === "above" ? [below, above] : [above, below];
      expect(incumbentSide.winner.cardId, `${caseId} incumbent side`).toBe(
        baseline.winner.cardId,
      );
      expect(alternateSide.winner.cardId, `${caseId} alternate side`).toBe(
        baseline.alternateWinnerCardId,
      );
      // What the control tells the visitor must be the card the engine actually lands on.
      expect(alternateSide.winner.cardId, `${caseId} subject alternate`).toBe(
        subject.alternateWinnerCardId,
      );
    },
  );

  it.each(sensitive.map((s) => [s.caseId, s] as const))(
    "%s: the winner holds right up to the breakeven on the incumbent's side",
    (caseId, { purchase, baseline }) => {
      const subject = valuationSubject(catalogue, ownerState, baseline)!;
      const breakeven = subject.breakevenCentsPerPoint!;
      const toward = baseline.valuationDirection === "above" ? -1 : 1;
      // Sweep from the declared value to the very edge of the flip; nothing may change.
      for (const offset of [1, 0.1, 0.01, 0.001, EPS]) {
        const r = winnerAt(purchase, subject.programId, breakeven + toward * offset);
        expect(r.winner.cardId, `${caseId} at ${breakeven + toward * offset}`).toBe(
          baseline.winner.cardId,
        );
      }
    },
  );
});

describe("withDeclaredCentsPerPoint", () => {
  it("does not mutate the loaded owner state, which is a shared module object", () => {
    const before = loadOwnerState();
    const originalCents = before.valuationsCad.amexMembershipRewards.centsPerPoint;
    withDeclaredCentsPerPoint(before, "amexMembershipRewards", 9.99);
    expect(loadOwnerState().valuationsCad.amexMembershipRewards.centsPerPoint).toBe(
      originalCents,
    );
  });

  it("moves only the declared value, leaving the floor and the benchmark alone", () => {
    const next = withDeclaredCentsPerPoint(ownerState, "amexMembershipRewards", 1.75);
    const before = ownerState.valuationsCad.amexMembershipRewards;
    const after = next.valuationsCad.amexMembershipRewards;
    expect(after.centsPerPoint).toBe(1.75);
    expect(after.floorCentsPerPoint).toBe(before.floorCentsPerPoint);
    expect(after.aspirationalCentsPerPoint).toBe(before.aspirationalCentsPerPoint);
    // Every other currency is left exactly where the owner put it — the property the
    // exactness of the breakeven depends on.
    expect(next.valuationsCad.marriottBonvoy).toBe(ownerState.valuationsCad.marriottBonvoy);
    expect(next.valuationsCad.mbnaRewards).toBe(ownerState.valuationsCad.mbnaRewards);
    expect(next.valuationsCad.cashBack).toBe(ownerState.valuationsCad.cashBack);
  });

  it("leaves a program that has no declared cents-per-point untouched", () => {
    const next = withDeclaredCentsPerPoint(ownerState, "cashback", 1.75);
    expect(next).toBe(ownerState);
  });
});

describe("sliderDomain", () => {
  it("is the published range when there is no breakeven to reach", () => {
    expect(sliderDomain(undefined)).toEqual({
      min: DEFAULT_VALUATION_RANGE.min,
      max: DEFAULT_VALUATION_RANGE.max,
    });
  });

  it("always contains every breakeven the fixture set produces", () => {
    for (const { caseId, baseline } of sensitive) {
      const breakeven = baseline.breakevenCentsPerPoint!;
      const domain = sliderDomain(breakeven);
      expect(breakeven, caseId).toBeGreaterThan(domain.min);
      expect(breakeven, caseId).toBeLessThan(domain.max);
    }
  });

  it("widens past the published ceiling rather than hiding an out-of-range flip", () => {
    const domain = sliderDomain(3.4);
    expect(domain.max).toBeGreaterThan(3.4);
    expect(domain.min).toBe(DEFAULT_VALUATION_RANGE.min);
  });
});
