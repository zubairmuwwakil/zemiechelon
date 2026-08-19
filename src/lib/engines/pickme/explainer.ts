import type { Catalogue } from "./catalogue";
import type { PurchaseContext } from "./purchase";
import type { CandidateScore, Warning } from "./scorer";

export type ValuationDirection = "below" | "above";

export interface Recommendation {
  winner: CandidateScore;
  runnerUp?: CandidateScore;
  switchedFromDefault: boolean;
  advantageOverDefaultCad?: number;
  defaultNotAccepted: boolean;
  /** A card that beat the default but not by enough to be worth digging out the wallet. */
  suppressedBetterCard?: CandidateScore;
  /**
   * True when the winner depends on the owner's declared point valuation — valuing points
   * lower (or higher) would pick a different card.
   */
  valuationSensitive: boolean;
  /** Which way the declared valuation would have to move to change the advice. */
  valuationDirection?: ValuationDirection;
  /** The card that wins on the other side of the breakeven. */
  alternateWinnerCardId?: string;
  /** The cents-per-point at which the recommendation flips to `alternateWinnerCardId`. */
  breakevenCentsPerPoint?: number;
  /** The declared cents-per-point the winning score assumed, when valuation-sensitive. */
  declaredCentsPerPoint?: number;
  allCandidates: CandidateScore[];
}

export interface Explanation {
  headline: string;
  why: string;
  runnerUpLine?: string;
  /**
   * Present only when the winner depends on the owner's declared point valuation.
   * Discloses the assumption and the value at which the advice would change.
   */
  valuationLine?: string;
  warningLines: string[];
}

/**
 * Turns scoring evidence into the sentences the recommendation screen shows.
 * Every recommendation must be explainable — it is a product principle and, under
 * pending federal privacy reform, likely a legal one for automated decisions.
 */
export class RecommendationExplainer {
  private readonly namesById: Record<string, string>;

  constructor(catalogue: Catalogue) {
    this.namesById = Object.fromEntries(
      catalogue.cards.map((c) => [c.cardId, c.officialName]),
    );
  }

  public explain(
    recommendation: Recommendation,
    purchase: PurchaseContext,
  ): Explanation {
    const name = this.displayName(recommendation.winner.cardId);
    const verb =
      recommendation.switchedFromDefault || recommendation.defaultNotAccepted
        ? "Use"
        : "Stay on";
    const headline = `${verb} ${name} — about ${money(recommendation.winner.netValueCad)} back on this ${money(purchase.amountCad)} purchase.`;

    let why: string;
    if (recommendation.winner.appliedRuleId != null) {
      const fxClause =
        recommendation.winner.fxCostCad > 0
          ? ` minus ${money(recommendation.winner.fxCostCad)} foreign-transaction fee.`
          : ".";
      why = `Applied rule ${recommendation.winner.appliedRuleId}: ${money(recommendation.winner.grossRewardCad)} in rewards${fxClause}`;
    } else {
      why = "No earn rule applied.";
    }

    let runnerUpLine: string | undefined = undefined;
    if (recommendation.suppressedBetterCard != null) {
      const delta =
        recommendation.suppressedBetterCard.netValueCad -
        recommendation.winner.netValueCad;
      runnerUpLine = `${this.displayName(recommendation.suppressedBetterCard.cardId)} is marginally better (+${money(delta)}) — not worth the wallet dig.`;
    } else if (recommendation.runnerUp != null) {
      const delta =
        recommendation.winner.netValueCad - recommendation.runnerUp.netValueCad;
      runnerUpLine = `Next best: ${this.displayName(recommendation.runnerUp.cardId)} (${money(recommendation.runnerUp.netValueCad)}) — you'd give up ${money(delta)}.`;
    }

    let valuationLine: string | undefined = undefined;
    if (
      recommendation.valuationSensitive &&
      recommendation.declaredCentsPerPoint != null &&
      recommendation.breakevenCentsPerPoint != null &&
      recommendation.alternateWinnerCardId != null &&
      recommendation.valuationDirection != null
    ) {
      const side =
        recommendation.valuationDirection === "below" ? "Below" : "Above";
      valuationLine =
        `Assumes your points are worth ${cents(recommendation.declaredCentsPerPoint)} each. ` +
        `${side} about ${cents(recommendation.breakevenCentsPerPoint)}, ${this.displayName(recommendation.alternateWinnerCardId)} wins instead.`;
    }

    return {
      headline,
      why,
      runnerUpLine,
      valuationLine,
      warningLines: recommendation.winner.warnings.map(lineForWarning),
    };
  }

  private displayName(cardId: string): string {
    return this.namesById[cardId] ?? cardId;
  }
}

function lineForWarning(warning: Warning): string {
  switch (warning) {
    case "drawerCard":
      return "This card is in your drawer — bring it or take the runner-up.";
    case "capNearlyExhausted":
      return "Category cap nearly used up — the winner may flip soon.";
    case "negativeNetValue":
      return "This card would LOSE money here after fees.";
    case "networkNotAccepted":
      return "Card network not accepted at this merchant.";
    case "unresolvedOwnerState":
      return "Card skipped — account state not set up yet.";
    case "fxAllowanceAssumed":
      return "Assumed within this card's monthly FX-free allowance.";
    case "hypotheticalSelection":
      return "Assumes this is one of your selected 2% categories — check your selections.";
  }
}

function money(value: number): string {
  return `$${value.toFixed(2)}`;
}

function cents(value: number): string {
  return `${value.toFixed(2)}¢`;
}
