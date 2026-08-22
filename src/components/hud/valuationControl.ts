/**
 * The valuation control's logic, kept out of the component so the claim it makes can be
 * tested against the engine directly.
 *
 * ## Why this is not one global "cents per point" slider
 *
 * `Recommendation.breakevenCentsPerPoint` is `(needed + fxCost) * 100 / rewardUnits` — a
 * number denominated in **one card's point currency**, not a universal exchange rate. The
 * owner declares a separate value for each program (`amexMembershipRewards`,
 * `marriottBonvoy`, `mbnaRewards`), and `needed` is derived from the *incumbent's*
 * `netValueCad`. A slider that moved every program together would still flip the
 * recommendation, and would look entirely correct on screen — but the flip would land
 * wherever the incumbent's own currency had drifted to, not on the engine's number. That
 * is the failure this file exists to prevent: approximately right, and therefore lying.
 *
 * So the control governs exactly one program — {@link valuationSubject} names which — and
 * every other valuation is left where the owner put it. With the incumbent's currency held
 * still, `netValue(c) = units * c / 100 - fxCost` crosses `needed` at precisely
 * `(needed + fxCost) * 100 / units`, which is the engine's formula rearranged.
 *
 * Only `centsPerPoint` moves. `floorCentsPerPoint` is a guaranteed redemption rate and
 * `aspirationalCentsPerPoint` a published benchmark — neither is the owner's opinion, and
 * dragging them along would collapse the very gap that makes a breakeven exist.
 */

import type {
  Catalogue,
  OwnerState,
  PointValuation,
  Recommendation,
  ValuationDirection,
  Valuations,
} from "@/lib/engines/pickme";

/**
 * A program the owner values in cents per point, identified by shape rather than by a
 * hand-maintained list: the contract's other currencies (CT Money, CRO, cash back) carry
 * no `centsPerPoint`, and one gaining it later should light this control up on its own.
 */
export function pointValuationOf(
  valuations: Valuations,
  programId: string,
): PointValuation | undefined {
  const entry = (valuations as unknown as Record<string, unknown>)[programId];
  if (entry == null || typeof entry !== "object") return undefined;
  const candidate = entry as Partial<PointValuation>;
  return typeof candidate.centsPerPoint === "number" ? (candidate as PointValuation) : undefined;
}

/**
 * A copy of the owner state with one program's *declared* value replaced.
 *
 * `loadOwnerState()` hands back the imported JSON module object itself, so every write here
 * is a spread: mutating in place would rewrite the seed for every later call in the
 * process, and the console re-runs this on every drag frame.
 */
export function withDeclaredCentsPerPoint(
  ownerState: OwnerState,
  programId: string,
  centsPerPoint: number,
): OwnerState {
  const existing = pointValuationOf(ownerState.valuationsCad, programId);
  if (existing == null) return ownerState;
  return {
    ...ownerState,
    valuationsCad: {
      ...ownerState.valuationsCad,
      // The key is a runtime programId; `Valuations` is a closed interface, so this one
      // cast is the boundary between the two. The shape written is a real PointValuation.
      [programId]: { ...existing, centsPerPoint },
    } as Valuations,
  };
}

/** The currency the control edits, and what the engine says about it from where we stand. */
export interface ValuationSubject {
  programId: string;
  /** Derived from the programId, so no program name is typed into the UI. */
  label: string;
  /** The program's unit noun from the catalogue ("point"). */
  unit: string;
  /** The card in contention whose value this program carries. */
  cardId: string;
  /** The owner's stored declared value — where the slider starts. */
  declaredCentsPerPoint: number;
  /** The engine's flip point, absent when the recommendation is not valuation-sensitive. */
  breakevenCentsPerPoint?: number;
  direction?: ValuationDirection;
  /** The card that wins on the other side of the breakeven. */
  alternateWinnerCardId?: string;
}

/**
 * Picks the program the control governs, from a recommendation computed at the owner's
 * *stored* valuations. Deriving it from the baseline rather than from the live slider value
 * matters: the subject has to hold still while you drag, or you would be editing one
 * currency at the start of a gesture and a different one by the end.
 *
 * When the recommendation is valuation-sensitive the choice is forced — the breakeven is
 * denominated in the points card's currency, which is the winner when the advice would flip
 * *below* the declared value and the challenger when it would flip *above*. When it is not
 * sensitive there is no breakeven to point at, so the control falls back to the best-ranked
 * points card still in contention: dragging it is how you find out that it has no flip point
 * here, or that it acquires one.
 */
export function valuationSubject(
  catalogue: Catalogue,
  ownerState: OwnerState,
  baseline: Recommendation,
): ValuationSubject | undefined {
  const programOf = (cardId: string) =>
    catalogue.cards.find((card) => card.cardId === cardId)?.program;

  const build = (cardId: string, extras: Partial<ValuationSubject>) => {
    const program = programOf(cardId);
    if (program == null) return undefined;
    const valuation = pointValuationOf(ownerState.valuationsCad, program.programId);
    if (valuation == null) return undefined;
    return {
      programId: program.programId,
      label: programLabel(program.programId),
      unit: program.unit,
      cardId,
      declaredCentsPerPoint: valuation.centsPerPoint,
      ...extras,
    } satisfies ValuationSubject;
  };

  if (baseline.valuationSensitive) {
    const pointsCardId =
      baseline.valuationDirection === "below"
        ? baseline.winner.cardId
        : baseline.alternateWinnerCardId;
    const subject =
      pointsCardId == null
        ? undefined
        : build(pointsCardId, {
            breakevenCentsPerPoint: baseline.breakevenCentsPerPoint,
            direction: baseline.valuationDirection,
            // The engine's `alternateWinnerCardId` is already the card on the far side of
            // the flip in both directions — it is the floor winner going down and the
            // challenger going up. Only which card the breakeven is *denominated* in
            // changes with direction, and that is `pointsCardId` above.
            alternateWinnerCardId: baseline.alternateWinnerCardId,
          });
    if (subject != null) return subject;
  }

  for (const candidate of baseline.allCandidates) {
    if (candidate.excluded || candidate.rewardUnits <= 0) continue;
    const subject = build(candidate.cardId, {});
    if (subject != null) return subject;
  }
  return undefined;
}

/** "amexMembershipRewards" -> "Amex Membership Rewards", so the UI types no program name. */
export function programLabel(programId: string): string {
  const spaced = programId.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** The slider's published range, per surface design §3.7. */
export const DEFAULT_VALUATION_RANGE = { min: 0.5, max: 2.5 } as const;
export const VALUATION_STEP = 0.01;

/**
 * The slider's domain, widened when it has to be.
 *
 * A control whose whole purpose is to reach the flip point must be able to reach it, and
 * the published 0.5–2.5 range does not always contain it — `taxi-12-threshold-suppression`
 * breaks even at 2.0417¢ only after clearing the switch threshold, and a fixed 2.5 ceiling
 * would happen to cover that while a tighter one would not. Rather than let the range
 * silently decide what the visitor is allowed to discover, it grows to hold the breakeven
 * with a margin on both sides.
 */
export function sliderDomain(breakevenCentsPerPoint?: number): { min: number; max: number } {
  const { min, max } = DEFAULT_VALUATION_RANGE;
  if (breakevenCentsPerPoint == null || !Number.isFinite(breakevenCentsPerPoint)) {
    return { min, max };
  }
  const margin = 0.25;
  return {
    min: Math.min(min, Math.floor((breakevenCentsPerPoint - margin) * 10) / 10),
    max: Math.max(max, Math.ceil((breakevenCentsPerPoint + margin) * 10) / 10),
  };
}
