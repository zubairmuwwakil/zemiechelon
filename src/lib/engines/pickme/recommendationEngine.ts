/**
 * Port of `Engine/RecommendationEngine.swift`.
 *
 * ## THE TIE-BREAK (read this before touching `rank`)
 *
 * `RecommendationEngine.rank(_:purchase:value:)` sorts with this comparator:
 *
 * ```swift
 * let ranked = scores.sorted { a, b in
 *     if value(a) != value(b) { return value(a) > value(b) }  // 1. higher value first
 *     if a.cardId == defaultId { return true }                // 2. default card first
 *     if b.cardId == defaultId { return false }
 *     return a.cardId < b.cardId                              // 3. ascending cardId
 * }
 * ```
 *
 * So the total order is, in strict priority:
 *   1. **descending `value(score)`** — the band-specific value (declared / floor / aspirational);
 *   2. **the owner's default card wins any tie** — this is why `pharmacy-30-hold-default` keeps
 *      Wealthsimple ahead of Tangerine when both earn exactly 2%;
 *   3. **ascending `cardId`, lexicographic** — a deterministic last resort, never a coin flip.
 *
 * Reproducing steps 2 and 3 explicitly is mandatory, not decorative (porting trap 2). Swift's
 * `sorted(by:)` is an unstable introsort; `Array.prototype.sort` has been stable since ES2019.
 * A comparator that returned `0` for equal values would still *pass* in JS — it would silently
 * fall back to catalogue order — and would disagree with Swift the moment two cards tie. The
 * failure surfaces as a wrong winner, which reads like a valuation bug rather than a sort bug.
 * `__tests__/recommendationEngine.test.ts` guards this by re-ranking a reversed catalogue and
 * asserting the output order is byte-identical.
 *
 * Note on step 3: Swift compares `String` by Unicode scalar; JS `<` compares UTF-16 code units.
 * Every `cardId` in the catalogue is ASCII (`[a-z0-9-]`), where the two orders coincide.
 */

import type { Catalogue } from "./catalogue";
import type { OwnerState } from "./ownerState";
import type { PurchaseContext } from "./purchase";
import { score, type CandidateScore } from "./scorer";

/** Which direction the point valuation would have to move for the advice to change. */
export type ValuationDirection = "below" | "above";

export interface Recommendation {
  winner: CandidateScore;
  runnerUp?: CandidateScore;
  switchedFromDefault: boolean;
  /**
   * The winner's edge over the default card. `0` when the threshold held the default —
   * Swift's `rank` passes `advantage: 0` there — and `undefined` only when there is no
   * default score to measure against, i.e. `defaultNotAccepted`.
   */
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

/** The private `Verdict` intermediate: one ranking pass at one valuation band. */
interface Verdict {
  winner: CandidateScore;
  runnerUp?: CandidateScore;
  switched: boolean;
  advantage?: number;
  defaultNotAccepted: boolean;
  suppressed?: CandidateScore;
  ranked: CandidateScore[];
}

export class RecommendationEngine {
  private readonly catalogue: Catalogue;
  private readonly ownerState: OwnerState;

  constructor(catalogue: Catalogue, ownerState: OwnerState) {
    this.catalogue = catalogue;
    this.ownerState = ownerState;
  }

  public recommend(purchase: PurchaseContext, asOf: string): Recommendation {
    const scores = this.catalogue.cards
      .map((card) => score(card, purchase, this.ownerState, asOf))
      .filter((s) => !s.excluded);
    if (scores.length === 0) {
      throw new Error("no scorable card — catalogue misconfigured");
    }

    // Three full rankings, one per valuation band. The declared band is the advice; the other
    // two exist only to tell the owner how load-bearing their own valuation is.
    const declared = this.rank(scores, purchase, (s) => s.netValueCad);
    const floor = this.rank(scores, purchase, (s) => s.floorNetValueCad);
    const aspirational = this.rank(scores, purchase, (s) => s.aspirationalNetValueCad);

    let sensitive = false;
    let direction: ValuationDirection | undefined = undefined;
    let alternateId: string | undefined = undefined;
    let breakeven: number | undefined = undefined;
    let declaredCents: number | undefined = undefined;

    // Downside: the winner is a points card that only wins because points are declared
    // above their guaranteed floor.
    if (
      declared.winner.cardId !== floor.winner.cardId &&
      Math.abs(declared.winner.floorNetValueCad - declared.winner.netValueCad) > 0.0001 &&
      declared.winner.rewardUnits > 0
    ) {
      sensitive = true;
      direction = "below";
      alternateId = floor.winner.cardId;
      breakeven = this.breakevenCents(
        declared.winner,
        floor.winner,
        declared.ranked,
        purchase,
      );
      declaredCents = centsPerUnit(declared.winner);
    }
    // Upside: a points card would overtake the winner if points were worth more. Only
    // disclosed when the flip happens within the published benchmark — past that it is
    // noise, not information.
    else if (
      aspirational.winner.cardId !== declared.winner.cardId &&
      aspirational.winner.rewardUnits > 0 &&
      Math.abs(
        aspirational.winner.aspirationalNetValueCad - aspirational.winner.netValueCad,
      ) > 0.0001
    ) {
      // Swift binds this in the condition list, so a missing challenger fails the whole
      // branch rather than falling through to anything else.
      const challenger = declared.ranked.find(
        (s) => s.cardId === aspirational.winner.cardId,
      );
      if (challenger != null) {
        const flip = this.breakevenCents(
          challenger,
          declared.winner,
          declared.ranked,
          purchase,
        );
        const benchmarkCents =
          ((challenger.aspirationalNetValueCad + challenger.fxCostCad) * 100) /
          challenger.rewardUnits;
        if (flip <= benchmarkCents + 0.0001) {
          sensitive = true;
          direction = "above";
          alternateId = challenger.cardId;
          breakeven = flip;
          // The disclosed value is the challenger's currency — that is the number the
          // owner would be revising, not the cash-back winner's notional "unit" value.
          declaredCents = centsPerUnit(challenger);
        }
      }
    }

    return {
      winner: declared.winner,
      runnerUp: declared.runnerUp,
      switchedFromDefault: declared.switched,
      advantageOverDefaultCad: declared.advantage,
      defaultNotAccepted: declared.defaultNotAccepted,
      suppressedBetterCard: declared.suppressed,
      valuationSensitive: sensitive,
      valuationDirection: direction,
      alternateWinnerCardId: alternateId,
      breakevenCentsPerPoint: breakeven,
      declaredCentsPerPoint: declaredCents,
      allCandidates: declared.ranked,
    };
  }

  /**
   * The cents-per-point at which `pointsCard` and `incumbent` swap places, accounting for
   * the switch threshold that applies against the default card.
   */
  private breakevenCents(
    pointsCard: CandidateScore,
    incumbent: CandidateScore,
    ranked: CandidateScore[],
    purchase: PurchaseContext,
  ): number {
    const t = this.ownerState.switchThreshold;
    const ppFloorCad = (t.minAdvantagePercentagePoints * purchase.amountCad) / 100;
    const requiredAdvantage =
      t.semantics === "either"
        ? Math.min(t.minAdvantageCad, ppFloorCad)
        : Math.max(t.minAdvantageCad, ppFloorCad);
    const defaultId = this.ownerState.defaultCardId;

    // The points card must clear the incumbent, plus the switch threshold over the default.
    let needed =
      incumbent.netValueCad + (incumbent.cardId === defaultId ? requiredAdvantage : 0);
    if (incumbent.cardId !== defaultId && pointsCard.cardId !== defaultId) {
      const defaultScore = ranked.find((s) => s.cardId === defaultId);
      if (defaultScore != null) {
        needed = Math.max(needed, defaultScore.netValueCad + requiredAdvantage);
      }
    }
    return ((needed + pointsCard.fxCostCad) * 100) / pointsCard.rewardUnits;
  }

  /** See the tie-break note at the top of this file before changing the comparator. */
  private rank(
    scores: CandidateScore[],
    purchase: PurchaseContext,
    value: (score: CandidateScore) => number,
  ): Verdict {
    const defaultId = this.ownerState.defaultCardId;
    const ranked = [...scores].sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      if (va !== vb) return vb - va; // 1. higher value first
      if (a.cardId === defaultId) return -1; // 2. the default wins any tie
      if (b.cardId === defaultId) return 1;
      // 3. ascending cardId — never 0, or ties would fall back to catalogue order.
      return a.cardId < b.cardId ? -1 : a.cardId > b.cardId ? 1 : 0;
    });

    const best = ranked[0];
    const runnerUp = ranked.length > 1 ? ranked[1] : undefined;

    const defaultScore = ranked.find((s) => s.cardId === defaultId);
    if (defaultScore == null) {
      return {
        winner: best,
        runnerUp,
        switched: true,
        advantage: undefined,
        defaultNotAccepted: true,
        suppressed: undefined,
        ranked,
      };
    }

    const advantage = value(best) - value(defaultScore);
    const advantagePP =
      purchase.amountCad > 0 ? (advantage / purchase.amountCad) * 100 : 0;
    const t = this.ownerState.switchThreshold;
    const cadOk = advantage >= t.minAdvantageCad;
    const ppOk = advantagePP >= t.minAdvantagePercentagePoints;
    const clearsThreshold = t.semantics === "either" ? cadOk || ppOk : cadOk && ppOk;

    if (best.cardId !== defaultId && clearsThreshold) {
      return {
        winner: best,
        runnerUp,
        switched: true,
        advantage,
        defaultNotAccepted: false,
        suppressed: undefined,
        ranked,
      };
    }

    const suppressed = best.cardId !== defaultId && advantage > 0 ? best : undefined;
    return {
      winner: defaultScore,
      // When the threshold holds the default, the runner-up is "the card you passed up",
      // which may be worth more than the winner.
      runnerUp: ranked.find((s) => s.cardId !== defaultId),
      switched: false,
      advantage: 0,
      defaultNotAccepted: false,
      suppressed,
      ranked,
    };
  }
}

function centsPerUnit(score: CandidateScore): number {
  return score.rewardUnits > 0 ? (score.grossRewardCad / score.rewardUnits) * 100 : 0;
}

/** Free-function form of {@link RecommendationEngine.recommend}. */
export function recommend(
  catalogue: Catalogue,
  ownerState: OwnerState,
  purchase: PurchaseContext,
  asOf: string,
): Recommendation {
  return new RecommendationEngine(catalogue, ownerState).recommend(purchase, asOf);
}
