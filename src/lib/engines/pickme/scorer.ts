import type { CardProduct, Earn, EarnRule } from "./catalogue";
import type { CardState, OwnerState, PointValuation, Valuations } from "./ownerState";
import type { PurchaseContext } from "./purchase";
import { splitAtCap } from "./capMath";
import { activeFxRule, resolveRule } from "./ruleMatcher";

export type Warning =
  | "drawerCard"
  | "unresolvedOwnerState"
  | "networkNotAccepted"
  | "capNearlyExhausted"
  | "negativeNetValue"
  | "fxAllowanceAssumed"
  | "hypotheticalSelection";

export interface CandidateScore {
  cardId: string;
  appliedRuleId?: string;
  rewardUnits: number;
  grossRewardCad: number;
  fxCostCad: number;
  netValueCad: number;
  /**
   * Net value if points are redeemed at their guaranteed cash floor rather than the
   * owner's declared value. Equal to `netValueCad` for cash-back and floorless programs.
   */
  floorNetValueCad: number;
  /** Net value at the program's published benchmark valuation, when one is set. */
  aspirationalNetValueCad: number;
  warnings: Warning[];
  excluded: boolean;
  exclusionReason?: string;
}

/**
 * Fallback CAD-to-USD rate, used only when a USD-measured cap must be checked and the
 * caller supplied no converted amount. Only Crypto.com's monthly cap uses this measure.
 */
export const FALLBACK_CAD_TO_USD = 0.73;

/** Turns one card's matched earn rule into a net CAD value for this purchase. */
export function score(
  card: CardProduct,
  purchase: PurchaseContext,
  ownerState: OwnerState,
  asOf: string,
): CandidateScore {
  function excludedScore(warning: Warning, reason: string): CandidateScore {
    return {
      cardId: card.cardId,
      appliedRuleId: undefined,
      rewardUnits: 0,
      grossRewardCad: 0,
      fxCostCad: 0,
      netValueCad: 0,
      floorNetValueCad: 0,
      aspirationalNetValueCad: 0,
      warnings: [warning],
      excluded: true,
      exclusionReason: reason,
    };
  }

  if (!purchase.acceptedNetworks.has(card.network)) {
    return excludedScore("networkNotAccepted", `${card.network} not accepted`);
  }

  let rule: EarnRule;
  const resolution = resolveRule(card, purchase, ownerState, asOf);
  switch (resolution.kind) {
    case "cardExcluded":
      return excludedScore("unresolvedOwnerState", resolution.reason);
    case "applied":
      rule = resolution.rule;
      break;
  }

  const warnings: Warning[] = [];
  const state = ownerState.cardStates[card.cardId] ?? {};

  let inCapCad = purchase.amountCad;
  let overCapCad = 0.0;
  if (rule.capId != null) {
    const cap = card.caps.find((c) => c.capId === rule.capId);
    if (cap != null) {
      const usage = state.capProgress?.[cap.capId] ?? 0;
      const measureAmount =
        cap.measure === "spendUsdEquivalent"
          ? (purchase.usdEquivalent ?? purchase.amountCad * FALLBACK_CAD_TO_USD)
          : purchase.amountCad;
      const split = splitAtCap(measureAmount, cap.limit, usage);
      const inFraction = measureAmount > 0 ? split.inCap / measureAmount : 1;
      inCapCad = purchase.amountCad * inFraction;
      overCapCad = purchase.amountCad - inCapCad;
      if (usage >= cap.limit * 0.9) {
        warnings.push("capNearlyExhausted");
      }
    }
  }

  const postCapEarn =
    rule.capId != null
      ? card.caps.find((c) => c.capId === rule.capId)?.postCapEarn
      : undefined;
  const units =
    earnUnits(rule.earn, inCapCad) +
    earnUnits(postCapEarn ?? rule.earn, overCapCad);
  const gross = valueCad(
    units,
    card.program.programId,
    ownerState.valuationsCad,
    state,
    "declared",
  );
  const grossFloor = valueCad(
    units,
    card.program.programId,
    ownerState.valuationsCad,
    state,
    "floor",
  );
  const grossAspirational = valueCad(
    units,
    card.program.programId,
    ownerState.valuationsCad,
    state,
    "aspirational",
  );

  let fxCost = 0.0;
  if (purchase.currency !== "CAD") {
    const fx = activeFxRule(card, asOf);
    if (fx != null) {
      if (fx.freeAllowanceCadPerCalendarMonth != null) {
        warnings.push("fxAllowanceAssumed");
      } else {
        fxCost = purchase.amountCad * fx.rate;
      }
    }
  }

  const net = gross - fxCost;
  if (net < 0) {
    warnings.push("negativeNetValue");
  }
  if (ownerState.carry.drawerCards.includes(card.cardId)) {
    warnings.push("drawerCard");
  }
  if (rule.ruleId === "tangerine-selected-2pct" && state.treatAsAllSelected === true) {
    warnings.push("hypotheticalSelection");
  }

  return {
    cardId: card.cardId,
    appliedRuleId: rule.ruleId,
    rewardUnits: units,
    grossRewardCad: gross,
    fxCostCad: fxCost,
    netValueCad: net,
    floorNetValueCad: grossFloor - fxCost,
    aspirationalNetValueCad: grossAspirational - fxCost,
    warnings,
    excluded: false,
    exclusionReason: undefined,
  };
}

function earnUnits(earn: Earn, amountCad: number): number {
  switch (earn.type) {
    case "points":
      return amountCad * earn.pointsPerCad;
    case "cashback":
      return amountCad * earn.rate;
    case "centsPerLitre":
      return 0;
  }
}

type ValuationBand = "declared" | "floor" | "aspirational";

function valueCad(
  units: number,
  program: string,
  valuations: Valuations,
  state: CardState,
  band: ValuationBand = "declared",
): number {
  function cents(v: PointValuation): number {
    switch (band) {
      case "declared":
        return v.centsPerPoint;
      case "floor":
        return v.floorCentsPerPoint ?? v.centsPerPoint;
      case "aspirational":
        return Math.max(v.aspirationalCentsPerPoint ?? v.centsPerPoint, v.centsPerPoint);
    }
  }

  switch (program) {
    case "amexMembershipRewards":
      return (units * cents(valuations.amexMembershipRewards)) / 100;
    case "marriottBonvoy":
      return (units * cents(valuations.marriottBonvoy)) / 100;
    case "mbnaRewards":
      return (units * cents(valuations.mbnaRewards)) / 100;
    case "ctMoney": {
      const v = valuations.ctMoney;
      return (
        units *
        v.cadPerUnit *
        (v.usabilityFactorApplied ? v.optionalUsabilityFactor : 1)
      );
    }
    case "cro": {
      const factor =
        state.croHandling === "autoSell"
          ? valuations.cro.faceValueFactorIfAutoSold
          : valuations.cro.defaultHeldRiskFactor;
      return units * factor;
    }
    case "cashback":
      return units * valuations.cashBack.cadPerDollar;
    default:
      return 0.0;
  }
}
