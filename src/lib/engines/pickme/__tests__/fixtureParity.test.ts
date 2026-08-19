/**
 * The executable spec. Ports `Tests/CardCopilotEngineTests/FixtureHarnessTests.swift`.
 *
 * `engine-fixtures.json` is vendored from PickMe and every one of its 27 cases was
 * hand-computed from the verified catalogue. A failure here means an engine bug or a wrong
 * expectation — never tune one to the other without re-deriving the arithmetic by hand. In
 * practice that means: **fix the port, never the fixture.**
 *
 * Three details of the harness are load-bearing, and each is a way a correct engine can be
 * made to look broken. All three are settled by `FixtureHarnessTests.swift`, not invented here:
 *
 * 1. **The default `asOf` is 2026-08-20** (`FixtureHarnessTests.defaultAsOf`, and the fixture
 *    file's own `_note`). Cases that exercise effective-dating boundaries declare their own.
 * 2. **`pinnedValuations` is applied over owner state, not inherited from it.** The fixtures
 *    pin MR to 1.8¢ while `owner-state.json` ranks at the 1.0¢ cash floor, so the cases
 *    exercise points-vs-cash ranking. See `pinnedValuations._why`.
 * 3. **`ownerStateOverrides` is a per-card deep merge, not a replacement.** A shallow spread
 *    over `OwnerState` would swap the whole `cardStates` map for a one-card stub, leaving
 *    every other card unresolved — and porting trap 6 says unresolved excludes the card, so
 *    almost the entire catalogue would vanish and the failures would look like ranking bugs.
 *    `capProgress` merges key-by-key for the same reason.
 *
 * And the reason `unsetFields` exists at all: merging a partial override can only ever *set*
 * a field, but "unresolved" (`undefined`) is a distinct, load-bearing input to
 * `RuleMatcher`'s condition resolution, and `owner-state.json` resolves most conditions to
 * `false` rather than leaving them unset. Reaching the third state needs an explicit unset.
 */

import { describe, expect, it } from "vitest";
import fixturesJson from "@/data/contracts/engine-fixtures.json";
import { loadCatalogue, loadOwnerState } from "../seed";
import { makePurchase } from "../purchase";
import { recommend } from "../recommendationEngine";
import type { Network } from "../catalogue";
import type { CardState, OwnerState } from "../ownerState";
import type { PurchaseContext } from "../purchase";

/** `FixtureHarnessTests.defaultAsOf`. Cases exercising effective-dating declare their own. */
const DEFAULT_AS_OF = "2026-08-20";

const DP = 4;
const round = (n: number) => Number(n.toFixed(DP));

// --- fixture file shape -----------------------------------------------------------------
// Mirrors the private `FixtureFile` / `FixtureCase` decodables in the Swift harness. The JSON
// import widens to a union across 27 heterogeneous cases, so it is typed once here rather
// than cast at every access.

interface FixtureExpected {
  winner: string;
  winnerValueCad: number;
  winnerRule?: string;
  runnerUp?: string;
  runnerUpValueCad?: number;
  switchFromDefault?: boolean;
  advantageOverDefaultCad?: number;
  defaultNotAccepted?: boolean;
  suppressedBetterCard?: string;
  suppressedValueCad?: number;
  warnings?: string[];
  /**
   * Warnings that must NOT be on the winner. The only way to pin behaviour whose entire
   * signal is a warning — e.g. an announced FX record being ignored before its
   * `effectiveFrom`, which is dollar-identical to the record it replaces.
   */
  warningsAbsent?: string[];
  valuationSensitive?: boolean;
  valuationDirection?: string;
  alternateWinner?: string;
  breakevenCentsPerPoint?: number;
  notes?: string;
}

/** A partial `CardState` plus the fields to force back to unresolved. */
type CardStateOverride = Partial<CardState> & { unsetFields?: string[] };

interface FixtureCase {
  caseId: string;
  description?: string;
  purchase: Partial<PurchaseContext> &
    Pick<PurchaseContext, "amountCad" | "category"> & { acceptedNetworks?: string[] };
  asOf?: string;
  ownerStateOverrides?: { cardStates?: Record<string, CardStateOverride> };
  expected: FixtureExpected;
}

interface FixtureFile {
  fixturesVersion: string;
  pinnedValuations: Record<string, number | string>;
  cases: FixtureCase[];
}

const file = fixturesJson as unknown as FixtureFile;

// --- owner-state assembly ---------------------------------------------------------------

/** Fixtures pin MR above the live cash floor so cases exercise points-vs-cash ranking. */
function applyPinnedValuations(base: OwnerState): OwnerState {
  const valuationsCad = { ...base.valuationsCad } as Record<string, unknown>;
  for (const [programId, centsPerPoint] of Object.entries(file.pinnedValuations)) {
    if (programId.startsWith("_")) continue; // "_why" is documentation
    const existing = valuationsCad[programId];
    if (existing == null || typeof existing !== "object") {
      throw new Error(`pinnedValuations names an unknown program: ${programId}`);
    }
    valuationsCad[programId] = { ...existing, centsPerPoint };
  }
  return { ...base, valuationsCad: valuationsCad as unknown as OwnerState["valuationsCad"] };
}

/** The five fields the Swift harness copies from an override onto the base card state. */
const MERGEABLE_FIELDS = [
  "cryptoLevelUpProActive",
  "croHandling",
  "rogersEligibleServiceLinked",
  "selectedCategories",
] as const;

/** The fields `unsetFields` may name. Anything else is a fixture the harness cannot honour. */
const UNSETTABLE_FIELDS = new Set<keyof CardState>([
  "capProgress",
  "cryptoLevelUpProActive",
  "croHandling",
  "rogersEligibleServiceLinked",
  "selectedCategories",
  "treatAsAllSelected",
]);

/**
 * Per-card deep merge onto the base owner state, then explicit unsets. Mirrors the Swift
 * harness exactly — see the note at the top of this file for why a spread will not do.
 */
function applyOwnerStateOverrides(
  base: OwnerState,
  overrides: Record<string, CardStateOverride> | undefined,
  caseId: string,
): OwnerState {
  if (overrides == null) return base;
  const cardStates: Record<string, CardState> = { ...base.cardStates };

  for (const [cardId, override] of Object.entries(overrides)) {
    const merged: CardState = { ...(cardStates[cardId] ?? {}) };

    // capProgress merges key-by-key: an override naming one cap must not drop the others.
    if (override.capProgress != null) {
      merged.capProgress = { ...(merged.capProgress ?? {}), ...override.capProgress };
    }
    for (const field of MERGEABLE_FIELDS) {
      const v = override[field];
      if (v !== undefined) (merged[field] as unknown) = v;
    }

    for (const field of override.unsetFields ?? []) {
      if (!UNSETTABLE_FIELDS.has(field as keyof CardState)) {
        throw new Error(`${caseId}: unknown unsetFields entry '${field}'`);
      }
      delete merged[field as keyof CardState];
    }

    // Swift's merge ignores keys it does not name, which turns a new fixture field into a
    // silent no-op. Fail loudly instead — a silently dropped override reads as an engine bug.
    const handled = new Set<string>([...MERGEABLE_FIELDS, "capProgress", "unsetFields"]);
    for (const key of Object.keys(override)) {
      if (!handled.has(key)) {
        throw new Error(`${caseId}: override for '${cardId}' names unhandled field '${key}'`);
      }
    }

    cardStates[cardId] = merged;
  }

  return { ...base, cardStates };
}

// --- the gate ---------------------------------------------------------------------------

describe("engine-fixtures.json parity", () => {
  const catalogue = loadCatalogue();
  const baseOwnerState = applyPinnedValuations(loadOwnerState());

  it("runs every case in the fixture file", () => {
    expect(file.cases).toHaveLength(27);
    expect(new Set(file.cases.map((c) => c.caseId)).size, "duplicate caseId").toBe(
      file.cases.length,
    );
  });

  for (const testCase of file.cases) {
    it(testCase.caseId, () => {
      const ownerState = applyOwnerStateOverrides(
        baseOwnerState,
        testCase.ownerStateOverrides?.cardStates,
        testCase.caseId,
      );

      const raw = testCase.purchase;
      const purchase = makePurchase({
        ...raw,
        ...(raw.acceptedNetworks != null
          ? { acceptedNetworks: new Set(raw.acceptedNetworks as Network[]) }
          : {}),
      });

      const got = recommend(catalogue, ownerState, purchase, testCase.asOf ?? DEFAULT_AS_OF);
      const want = testCase.expected;

      expect(got.winner.cardId, "winner").toBe(want.winner);
      expect(round(got.winner.netValueCad), "winnerValueCad").toBe(round(want.winnerValueCad));

      if (want.winnerRule !== undefined)
        expect(got.winner.appliedRuleId, "winnerRule").toBe(want.winnerRule);
      if (want.runnerUp !== undefined)
        expect(got.runnerUp?.cardId, "runnerUp").toBe(want.runnerUp);
      if (want.runnerUpValueCad !== undefined)
        expect(round(got.runnerUp!.netValueCad), "runnerUpValueCad")
          .toBe(round(want.runnerUpValueCad));
      if (want.switchFromDefault !== undefined)
        expect(got.switchedFromDefault, "switchFromDefault").toBe(want.switchFromDefault);
      if (want.advantageOverDefaultCad !== undefined)
        expect(round(got.advantageOverDefaultCad!), "advantageOverDefaultCad")
          .toBe(round(want.advantageOverDefaultCad));
      if (want.defaultNotAccepted !== undefined)
        expect(got.defaultNotAccepted, "defaultNotAccepted").toBe(want.defaultNotAccepted);
      if (want.suppressedBetterCard !== undefined)
        expect(got.suppressedBetterCard?.cardId, "suppressedBetterCard")
          .toBe(want.suppressedBetterCard);
      if (want.suppressedValueCad !== undefined)
        expect(round(got.suppressedBetterCard!.netValueCad), "suppressedValueCad")
          .toBe(round(want.suppressedValueCad));
      if (want.valuationSensitive !== undefined)
        expect(got.valuationSensitive, "valuationSensitive").toBe(want.valuationSensitive);
      if (want.valuationDirection !== undefined)
        expect(got.valuationDirection, "valuationDirection").toBe(want.valuationDirection);
      if (want.alternateWinner !== undefined)
        expect(got.alternateWinnerCardId, "alternateWinner").toBe(want.alternateWinner);
      if (want.breakevenCentsPerPoint !== undefined)
        expect(round(got.breakevenCentsPerPoint!), "breakevenCentsPerPoint")
          .toBe(round(want.breakevenCentsPerPoint));
      if (want.warnings !== undefined)
        for (const w of want.warnings)
          expect(got.winner.warnings, `expected warning ${w}`).toContain(w);
      if (want.warningsAbsent !== undefined)
        for (const w of want.warningsAbsent)
          expect(got.winner.warnings, `unexpected warning ${w}`).not.toContain(w);
    });
  }
});
