import type { CardProduct, Earn, EarnRule, FxRule, Predicate } from "./catalogue";
import type { CardState, OwnerState } from "./ownerState";
import type { PurchaseContext } from "./purchase";

export type RuleResolution =
  | { kind: "applied"; rule: EarnRule }
  | { kind: "cardExcluded"; reason: string };

/**
 * Categories that are a more specific case of a broader one. A predicate listing the
 * parent matches a purchase in the child (a Marriott stay is also lodging and travel).
 */
const categoryParents: Record<string, string[]> = {
  marriottDirect: ["lodging", "travel"],
};

/**
 * Decides which earn rule a purchase triggers on one card.
 *
 * Two rules govern everything here: a rule whose owner condition is unresolved is skipped
 * rather than guessed, and matching rules never stack — the best single rate wins.
 */
export function resolveRule(
  card: CardProduct,
  purchase: PurchaseContext,
  ownerState: OwnerState,
  asOf: string,
): RuleResolution {
  const state = ownerState.cardStates[card.cardId] ?? {};
  const candidates = card.earnRules.filter(
    (rule) =>
      isLive(rule, asOf) &&
      conditionsResolveTrue(rule.ownerConditions, state) &&
      matches(rule.predicate, purchase, state),
  );

  if (candidates.length === 0) {
    return {
      kind: "cardExcluded",
      reason: "no scorable earn rule (unresolved or inactive owner state)",
    };
  }

  let best = candidates[0];
  for (let i = 1; i < candidates.length; i++) {
    if (rawEarn(candidates[i].earn) > rawEarn(best.earn)) {
      best = candidates[i];
    }
  }
  return { kind: "applied", rule: best };
}

export function activeFxRule(card: CardProduct, asOf: string): FxRule | undefined {
  return card.fxRules.find((rule) => {
    const fromOk = rule.effectiveFrom != null ? rule.effectiveFrom <= asOf : true;
    const toOk = rule.effectiveTo != null ? asOf <= rule.effectiveTo : true;
    return fromOk && toOk;
  });
}

function isLive(rule: EarnRule, asOf: string): boolean {
  if (rule.scoredInV1 === false) {
    return false;
  }
  const fromOk = rule.effectiveFrom != null ? rule.effectiveFrom <= asOf : true;
  const toOk = rule.effectiveTo != null ? asOf <= rule.effectiveTo : true;
  return fromOk && toOk;
}

function conditionsResolveTrue(
  conditions: string[] | undefined | null,
  state: CardState,
): boolean {
  if (!conditions || conditions.length === 0) {
    return true;
  }
  return conditions.every((condition) => {
    switch (condition) {
      case "rogersEligibleServiceLinked":
        return state.rogersEligibleServiceLinked === true;
      case "cryptoLevelUpProActive":
        return state.cryptoLevelUpProActive === true;
      case "tangerineCategorySelected":
        return state.selectedCategories != null;
      default:
        return false;
    }
  });
}

function matches(p: Predicate, purchase: PurchaseContext, state: CardState): boolean {
  if (p.country != null && p.country !== purchase.country) return false;
  if (p.currency != null && p.currency !== purchase.currency) return false;
  if (p.channels != null && !p.channels.includes(purchase.channel)) return false;
  if (
    p.merchantExclude != null &&
    purchase.merchantBrand != null &&
    p.merchantExclude.includes(purchase.merchantBrand)
  ) {
    return false;
  }
  if (p.merchantInclude != null) {
    if (purchase.merchantBrand == null || !p.merchantInclude.includes(purchase.merchantBrand)) {
      return false;
    }
  }
  if (
    p.mccExclude != null &&
    purchase.mcc != null &&
    p.mccExclude.includes(purchase.mcc)
  ) {
    return false;
  }

  if (p.categories == null) {
    return true; // no category clause = base rule
  }

  return p.categories.some((category) => {
    switch (category) {
      case "recurring":
        return purchase.recurringIndicator;
      case "ownerSelectedTangerineCategory":
        return matchesTangerineSelection(purchase, state);
      default: {
        const selfOrParents = [
          purchase.category,
          ...(categoryParents[purchase.category] ?? []),
        ];
        if (!selfOrParents.includes(category)) return false;
        if (p.mccInclude != null && purchase.mcc != null) {
          return p.mccInclude.includes(purchase.mcc); // a known MCC must qualify; unknown falls back
        }
        return true;
      }
    }
  });
}

function matchesTangerineSelection(
  purchase: PurchaseContext,
  state: CardState,
): boolean {
  if (state.selectedCategories == null) {
    return false;
  }
  const selected = new Set(state.selectedCategories);
  const purchaseCategories = new Set([
    purchase.category,
    ...(categoryParents[purchase.category] ?? []),
  ]);

  let hasCommon = false;
  for (const cat of purchaseCategories) {
    if (selected.has(cat)) {
      hasCommon = true;
      break;
    }
  }
  if (hasCommon) return true;

  if (purchase.recurringIndicator && selected.has("recurring")) {
    return true;
  }
  if (purchase.currency.toUpperCase() !== "CAD" && selected.has("foreignCurrency")) {
    return true;
  }

  // Backward compatibility for owner-state files that used Tangerine's label-shaped id
  // before the setup screen adopted the engine's canonical `lodging` category.
  return purchaseCategories.has("lodging") && selected.has("hotelMotel");
}

/** Comparable only within one card — a card never mixes points and cashback earn rules. */
function rawEarn(earn: Earn): number {
  switch (earn.type) {
    case "points":
      return earn.pointsPerCad;
    case "cashback":
      return earn.rate * 100;
    case "centsPerLitre":
      return -1;
  }
}
