export interface SwitchThreshold {
  minAdvantagePercentagePoints: number;
  minAdvantageCad: number;
  semantics: string; // "both" | "either"
}

export interface Carry {
  drawerCards: string[];
}

export type TangerineMoneyBackCategory =
  | "grocery"
  | "dining"
  | "gasStation"
  | "entertainment"
  | "furniture"
  | "lodging"
  | "drugStore"
  | "recurring"
  | "homeImprovement"
  | "transit"
  | "eGames"
  | "fitness"
  | "foreignCurrency";

/**
 * Layer 2 of the three-layer model: per-card owner/account state.
 * A `undefined`/`nil` field means unresolved — the engine skips rules that depend on it rather than guessing.
 */
export interface CardState {
  capProgress?: Record<string, number>;
  scotiaAccountYearAnchorMonth?: number;
  selectedCategories?: string[];
  treatAsAllSelected?: boolean;
  thirdCategoryUnlocked?: boolean;
  nextChangeEffectiveDate?: string;
  rogersEligibleServiceLinked?: boolean;
  rogersAccountAnniversaryMonth?: number;
  feeWaiverActive?: boolean;
  cryptoLevelUpProActive?: boolean;
  croHandling?: string; // "autoSell" | "hold" | undefined (unresolved)
}

export interface PointValuation {
  centsPerPoint: number;
  floorCentsPerPoint?: number;
  aspirationalCentsPerPoint?: number;
  low?: number;
  high?: number;
  basis?: string;
}

export interface CtMoneyValuation {
  cadPerUnit: number;
  optionalUsabilityFactor: number;
  usabilityFactorApplied: boolean;
}

export interface CroValuation {
  model: string;
  faceValueFactorIfAutoSold: number;
  defaultHeldRiskFactor: number;
}

export interface CashBackValuation {
  cadPerDollar: number;
}

export interface Valuations {
  amexMembershipRewards: PointValuation;
  marriottBonvoy: PointValuation;
  mbnaRewards: PointValuation;
  ctMoney: CtMoneyValuation;
  cro: CroValuation;
  cashBack: CashBackValuation;
}

export interface OwnerState {
  ownerStateVersion: string;
  ownedCardIds: string[];
  defaultCardId: string;
  switchThreshold: SwitchThreshold;
  carry: Carry;
  cardStates: Record<string, CardState>;
  valuationsCad: Valuations;
}
