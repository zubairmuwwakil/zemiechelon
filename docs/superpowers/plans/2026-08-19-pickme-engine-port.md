# PickMe Engine Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port PickMe's Swift checkout-recommendation engine to TypeScript so it runs in the browser, proven identical by the 27 fixture cases the Swift package already treats as its executable specification.

**Architecture:** A dependency-free TypeScript library under `src/lib/engines/pickme/`, mirroring the Swift module structure one file per Swift file. Contract JSON is vendored from the PickMe repo by a sync script and committed, so the build is hermetic. `SeedLoader`'s `Bundle.module` resource loading is replaced by direct JSON imports; everything else is a faithful translation. The library has no React, no DOM, and no knowledge of the Atlas shell — it is consumed later by the console in Track C.

**Tech Stack:** TypeScript 5, Vitest, Node >= 20.9.0. No runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-08-19-zemi-atlas-design.md` (§7 Track B, §8)

## Global Constraints

- Node `>=20.9.0` — matches the `engines` field already in `package.json`.
- **The engine adds zero runtime dependencies.** It is pure TypeScript. Vitest is a devDependency only.
- `next.config.ts` keeps `output: "export"`. Nothing in this plan may introduce an API route, a server component that fetches at request time, or any runtime backend.
- The engine must run in a browser bundle: no `node:fs`, no `node:path`, no `process.env` at module scope.
- `catalogueVersion` MAJOR must equal `1`. A catalogue with a different MAJOR is refused, not coerced — this reproduces `SeedLoader.validate(catalogueVersion:)`.
- Fixture expectations are compared to **4 decimal places**. `engine-fixtures.json` states its expected values are "exact engine outputs (unrounded beyond 4dp)".
- Fixture runs apply `pinnedValuations` **over** `owner-state.json`. The fixtures deliberately pin `amexMembershipRewards` to 1.8¢ while live owner state uses the 1.0¢ cash floor. A run that ignores the pin will fail cases it should pass.
- Swift reference tree: `../PickMe/Engine/Sources/CardCopilotEngine/`. Swift tests, which are a second source of test cases, are at `../PickMe/Engine/Tests/CardCopilotEngineTests/`.

## Porting Traps

Read this before Task 3. Every one of these has bitten a Swift-to-TS port:

1. **Integer division.** Swift `Int / Int` truncates. TS `/` produces a float. Every ported `/` between two integers needs `Math.floor(...)` (or `Math.trunc` where negatives are possible).
2. **Sort stability.** Swift's `sorted(by:)` is **not** stable; `Array.prototype.sort` **is** (ES2019+). Where `RecommendationEngine.rank()` produces ties, the two languages can order differently. Read `rank()` and reproduce its explicit tie-break rather than relying on sort order.
3. **`nil` vs `undefined` vs `null`.** Swift `nil` maps to TS `undefined`, but JSON supplies `null`. Every optional decode must accept both: `x ?? undefined` after reading, not `x!`.
4. **`Set<Network>`.** `purchase.acceptedNetworks` is a Swift `Set`. Use a real JS `Set<Network>` so `.has()` is O(1) and duplicate entries in JSON collapse identically.
5. **Dictionary subscript defaults.** `state.capProgress?[capId] ?? 0` becomes `state.capProgress?.[capId] ?? 0`. Note the extra `.` — `?[` is not TS syntax.
6. **Unresolved owner state excludes the card.** `RuleMatcher` returns `.cardExcluded` rather than skipping a rule. Do not "helpfully" fall through to a lower-tier rule.
7. **Floating-point accumulation.** Do not round intermediates. Round only at comparison, to 4dp.

---

## File Structure

**Created:**

| File | Responsibility |
|---|---|
| `scripts/sync-contracts.sh` | Copies contract JSON from the PickMe repo into `src/data/contracts/`. Run by a human, not by the build. |
| `src/data/contracts/card-catalogue.json` | Vendored, committed. 27 cards. |
| `src/data/contracts/owner-state.json` | Vendored, committed. |
| `src/data/contracts/engine-fixtures.json` | Vendored, committed. 27 cases. |
| `src/lib/engines/pickme/catalogue.ts` | Ports `Models/CatalogueModels.swift` — card/rule/cap/fx types + `Earn` union decode. |
| `src/lib/engines/pickme/ownerState.ts` | Ports `Models/OwnerState.swift` — owner/valuation types. |
| `src/lib/engines/pickme/purchase.ts` | Ports `Models/PurchaseContext.swift` — purchase facts + defaults. |
| `src/lib/engines/pickme/capMath.ts` | Ports `Engine/CapMath.swift` — in-cap/over-cap split. |
| `src/lib/engines/pickme/ruleMatcher.ts` | Ports `Engine/RuleMatcher.swift` — rule resolution + active FX rule. |
| `src/lib/engines/pickme/scorer.ts` | Ports `Engine/Scorer.swift` — one card to one `CandidateScore`. |
| `src/lib/engines/pickme/explainer.ts` | Ports `Engine/Explainer.swift` — human-readable reasoning. |
| `src/lib/engines/pickme/recommendationEngine.ts` | Ports `Engine/RecommendationEngine.swift` — ranking, threshold, breakeven. |
| `src/lib/engines/pickme/seed.ts` | Replaces `Loading/SeedLoader.swift` — JSON imports + version guard. |
| `src/lib/engines/pickme/index.ts` | The package's only public surface. |
| `vitest.config.ts` | Test runner config with `@/` path resolution. |
| `src/lib/engines/pickme/__tests__/*.test.ts` | Per-module unit tests + the fixture parity harness. |

**Modified:**

- `package.json` — add `test` / `test:watch` scripts and Vitest devDependencies.
- `.github/workflows/deploy.yml` — run tests before building.

---

### Task 1: Test infrastructure and vendored contracts

Nothing in this repo runs tests today — `package.json` has only `lint`. This task ends with a green trivial test and three committed JSON files.

**Files:**
- Create: `vitest.config.ts`
- Create: `scripts/sync-contracts.sh`
- Create: `src/data/contracts/{card-catalogue,owner-state,engine-fixtures}.json` (generated)
- Create: `src/lib/engines/pickme/__tests__/contracts.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: nothing.
- Produces: `npm test` runs Vitest; `src/data/contracts/*.json` exist and are importable with `resolveJsonModule`.

- [x] **Step 1: Install the test runner**

```bash
npm install -D vitest@^3 vite-tsconfig-paths@^5
```

- [x] **Step 2: Write the Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
```

- [x] **Step 3: Add test scripts to `package.json`**

In the `"scripts"` block, alongside the existing `"lint": "eslint"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [x] **Step 4: Write the contract sync script**

Create `scripts/sync-contracts.sh`:

```bash
#!/usr/bin/env bash
# Vendors PickMe's contract JSON into this repo so the build is hermetic.
# Run by hand after a PickMe catalogue change, then commit the result.
# CI does NOT run this — drift shows up as a fixture-parity failure instead.
set -euo pipefail

PICKME_ROOT="${PICKME_ROOT:-../PickMe}"
DEST="src/data/contracts"

if [[ ! -d "$PICKME_ROOT" ]]; then
  echo "error: PickMe repo not found at '$PICKME_ROOT'" >&2
  echo "       set PICKME_ROOT=/path/to/PickMe and re-run" >&2
  exit 1
fi

mkdir -p "$DEST"

copy() {
  local src="$PICKME_ROOT/$1" dst="$DEST/$2"
  [[ -f "$src" ]] || { echo "error: missing $src" >&2; exit 1; }
  cp "$src" "$dst"
  echo "  $2  <-  $1"
}

echo "syncing contracts from $PICKME_ROOT"
copy "contracts/card-catalogue.json"  "card-catalogue.json"
copy "contracts/engine-fixtures.json" "engine-fixtures.json"
copy "Engine/Sources/CardCopilotEngine/Resources/owner-state.json" "owner-state.json"
echo "done — review the diff and commit"
```

Then make it executable:

```bash
chmod +x scripts/sync-contracts.sh
```

- [x] **Step 5: Run the sync**

Run: `./scripts/sync-contracts.sh`
Expected: three lines of output, and `src/data/contracts/` contains three JSON files.

- [x] **Step 6: Write the failing test**

Create `src/lib/engines/pickme/__tests__/contracts.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import catalogue from "@/data/contracts/card-catalogue.json";
import ownerState from "@/data/contracts/owner-state.json";
import fixtures from "@/data/contracts/engine-fixtures.json";

describe("vendored contracts", () => {
  it("ships a v1 catalogue of 27 cards", () => {
    expect(catalogue.catalogueVersion.split(".")[0]).toBe("1");
    expect(catalogue.cards).toHaveLength(27);
  });

  it("ships owner state with a declared default card", () => {
    expect(ownerState.defaultCardId).toBeTruthy();
    expect(ownerState.ownedCardIds.length).toBeGreaterThan(0);
  });

  it("ships 27 fixture cases, each with a caseId and expected winner", () => {
    expect(fixtures.cases).toHaveLength(27);
    for (const c of fixtures.cases) {
      expect(c.caseId, "every case needs a caseId").toBeTruthy();
      expect(c.expected.winner, `${c.caseId} needs an expected winner`).toBeTruthy();
    }
  });

  it("pins a valuation that differs from live owner state", () => {
    expect(fixtures.pinnedValuations.amexMembershipRewards).toBe(1.8);
  });
});
```

- [x] **Step 7: Run it and confirm it fails for the right reason**

Run: `npm test`
Expected: FAIL — TypeScript cannot import JSON until `resolveJsonModule` is enabled.

- [x] **Step 8: Enable JSON imports**

In `tsconfig.json`, add to `compilerOptions`:

```json
"resolveJsonModule": true
```

- [x] **Step 9: Run it and confirm it passes**

Run: `npm test`
Expected: PASS — 4 tests.

- [x] **Step 10: Commit**

```bash
git add vitest.config.ts package.json package-lock.json tsconfig.json scripts/sync-contracts.sh src/data/contracts src/lib/engines/pickme/__tests__/contracts.test.ts
git commit -m "test(pickme): add vitest and vendor PickMe contract JSON"
```

---

### Task 2: Catalogue, owner-state and purchase types

Pure type definitions plus the one piece of real decoding logic: `Earn` is a tagged union in JSON and a Swift enum with associated values.

**Files:**
- Create: `src/lib/engines/pickme/catalogue.ts`
- Create: `src/lib/engines/pickme/ownerState.ts`
- Create: `src/lib/engines/pickme/purchase.ts`
- Create: `src/lib/engines/pickme/__tests__/types.test.ts`
- Reference: `../PickMe/Engine/Sources/CardCopilotEngine/Models/`

**Interfaces:**
- Consumes: vendored JSON from Task 1.
- Produces:
  - `catalogue.ts`: `Network`, `CardKind`, `RuleStatus`, `SourceType`, `Earn`, `Predicate`, `EarnRule`, `CapMeasure`, `CapPeriod`, `Cap`, `FxRule`, `Fee`, `Program`, `CardProduct`, `Catalogue`, `decodeEarn(raw: unknown): Earn`
  - `ownerState.ts`: `SwitchThreshold`, `Carry`, `CardState`, `PointValuation`, `CtMoneyValuation`, `CroValuation`, `CashBackValuation`, `Valuations`, `OwnerState`
  - `purchase.ts`: `PurchaseContext`, `makePurchase(partial): PurchaseContext`

- [ ] **Step 1: Write the failing test**

Create `src/lib/engines/pickme/__tests__/types.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm test -- types`
Expected: FAIL — cannot resolve `../catalogue` or `../purchase`.

- [ ] **Step 3: Write `catalogue.ts`**

Translate `Models/CatalogueModels.swift` one declaration at a time. Swift `enum X: String` becomes a TS string-literal union. Swift's `Earn` enum with associated values becomes a discriminated union whose discriminant is the JSON `type` field:

```ts
export type Network = "amex" | "visa" | "mastercard";
export type CardKind = "credit" | "charge" | "prepaid";
export type RuleStatus = "current" | "announced";
export type SourceType = "issuerConfirmed" | "ownerObserved" | "inferred";

export type Earn =
  | { type: "points"; pointsPerCad: number }
  | { type: "cashback"; rate: number; rewardCurrency?: string }
  | { type: "centsPerLitre" };

export function decodeEarn(raw: unknown): Earn {
  const r = raw as Record<string, unknown>;
  switch (r?.type) {
    case "points":
      return { type: "points", pointsPerCad: r.pointsPerCad as number };
    case "cashback":
      return {
        type: "cashback",
        rate: r.rate as number,
        rewardCurrency: (r.rewardCurrency as string | null) ?? undefined,
      };
    case "centsPerLitre":
      return { type: "centsPerLitre" };
    default:
      throw new Error(`unknown earn type: ${String(r?.type)}`);
  }
}
```

Then define the remaining interfaces — `Predicate`, `EarnRule`, `CapMeasure`, `CapPeriod`, `Cap`, `FxRule`, `Fee`, `Program`, `CardProduct`, `Catalogue` — with field names and optionality matching the Swift exactly. Swift `var x: T?` becomes `x?: T`.

- [ ] **Step 4: Write `ownerState.ts`**

Translate `Models/OwnerState.swift`. Note `CardState` has eleven optional fields and `capProgress` is `[String: Double]?`, which becomes `capProgress?: Record<string, number>`. Every field stays optional — the Swift comment is explicit that `nil` means unresolved and the engine refuses rather than guessing.

- [ ] **Step 5: Write `purchase.ts`**

Translate `Models/PurchaseContext.swift`. Its Swift `init` defaults are the contract:

```ts
export interface PurchaseContext {
  amountCad: number;
  currency: string;
  usdEquivalent?: number;
  category: string;
  mcc?: number;
  merchantBrand?: string;
  country: string;
  channel: string;
  recurringIndicator: boolean;
  acceptedNetworks: Set<Network>;
}

export function makePurchase(
  p: Partial<PurchaseContext> & Pick<PurchaseContext, "amountCad" | "category">,
): PurchaseContext {
  return {
    currency: "CAD",
    country: "CA",
    channel: "cardPresent",
    recurringIndicator: false,
    acceptedNetworks: new Set<Network>(["amex", "visa", "mastercard"]),
    ...p,
  };
}
```

- [ ] **Step 6: Run tests and confirm they pass**

Run: `npm test -- types`
Expected: PASS — 7 tests.

- [ ] **Step 7: Commit**

```bash
git add src/lib/engines/pickme
git commit -m "feat(pickme): port catalogue, owner-state and purchase types"
```

---

### Task 3: CapMath

Nine lines of Swift, and the only place cap arithmetic lives. Port it exactly.

**Files:**
- Create: `src/lib/engines/pickme/capMath.ts`
- Create: `src/lib/engines/pickme/__tests__/capMath.test.ts`
- Reference: `../PickMe/Engine/Sources/CardCopilotEngine/Engine/CapMath.swift`

**Interfaces:**
- Consumes: nothing.
- Produces: `splitAtCap(amount: number, capLimit: number, usage: number): { inCap: number; overCap: number }`

- [ ] **Step 1: Write the failing test**

Create `src/lib/engines/pickme/__tests__/capMath.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { splitAtCap } from "../capMath";

describe("splitAtCap", () => {
  it("puts the whole amount in-cap when there is room", () => {
    expect(splitAtCap(100, 1000, 0)).toEqual({ inCap: 100, overCap: 0 });
  });

  it("splits across the cap boundary", () => {
    expect(splitAtCap(100, 1000, 950)).toEqual({ inCap: 50, overCap: 50 });
  });

  it("puts the whole amount over-cap when the cap is exactly met", () => {
    expect(splitAtCap(100, 1000, 1000)).toEqual({ inCap: 0, overCap: 100 });
  });

  it("clamps negative room to zero when usage exceeds the limit", () => {
    expect(splitAtCap(100, 1000, 1200)).toEqual({ inCap: 0, overCap: 100 });
  });

  it("handles a zero amount without producing negative parts", () => {
    expect(splitAtCap(0, 1000, 500)).toEqual({ inCap: 0, overCap: 0 });
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm test -- capMath`
Expected: FAIL — cannot resolve `../capMath`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/engines/pickme/capMath.ts`:

```ts
/** Splits a purchase into the portion still earning the accelerated rate and the post-cap portion. */
export function splitAtCap(
  amount: number,
  capLimit: number,
  usage: number,
): { inCap: number; overCap: number } {
  const room = Math.max(0, capLimit - usage);
  const inCap = Math.min(amount, room);
  return { inCap, overCap: amount - inCap };
}
```

- [ ] **Step 4: Run tests and confirm they pass**

Run: `npm test -- capMath`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/engines/pickme/capMath.ts src/lib/engines/pickme/__tests__/capMath.test.ts
git commit -m "feat(pickme): port CapMath cap-boundary split"
```

---

### Task 4: RuleMatcher

**Files:**
- Create: `src/lib/engines/pickme/ruleMatcher.ts`
- Create: `src/lib/engines/pickme/__tests__/ruleMatcher.test.ts`
- Reference: `../PickMe/Engine/Sources/CardCopilotEngine/Engine/RuleMatcher.swift` (121 lines)
- Reference for cases: `../PickMe/Engine/Tests/CardCopilotEngineTests/RuleMatcherTests.swift`

**Interfaces:**
- Consumes: `catalogue.ts` (`CardProduct`, `EarnRule`, `FxRule`), `ownerState.ts` (`OwnerState`), `purchase.ts` (`PurchaseContext`)
- Produces:
  - `type RuleResolution = { kind: "applied"; rule: EarnRule } | { kind: "cardExcluded"; reason: string }`
  - `resolveRule(card, purchase, ownerState, asOf): RuleResolution`
  - `activeFxRule(card: CardProduct, asOf: string): FxRule | undefined`

- [ ] **Step 1: Read the Swift and port its test cases**

Read `RuleMatcher.swift` end to end, then read `RuleMatcherTests.swift`.

**`RuleMatcherTests.swift` contains 13 test cases. Your `ruleMatcher.test.ts` must contain at least 13.** Port them from the Swift rather than paraphrasing from this plan — the Swift tests are ground truth, and a paraphrase introduces drift. The list below is a coverage checklist to verify against after porting, not a substitute for reading the file:

- a rule matching on `categories`
- a rule matching on `mccInclude`, and one rejected by `mccExclude`
- `merchantInclude` / `merchantExclude`
- `country` and `currency` predicates
- `recurringViaNetworkIndicator`
- an `announced` rule outside its `effectiveFrom` window being ignored at `asOf`
- an `ownerConditions` entry that owner state cannot resolve returning `{ kind: "cardExcluded" }` — **not** falling through to a lower rule
- Tangerine `treatAsAllSelected` vs `selectedCategories`
- `activeFxRule` picking the `current` rule when an `announced` one exists but is not yet effective

Write them all before writing any implementation.

- [ ] **Step 2: Run and confirm they fail**

Run: `npm test -- ruleMatcher`
Expected: FAIL — cannot resolve `../ruleMatcher`.

- [ ] **Step 3: Write the implementation**

Port `RuleMatcher.swift`. The public shape:

```ts
import type { CardProduct, EarnRule, FxRule } from "./catalogue";
import type { OwnerState } from "./ownerState";
import type { PurchaseContext } from "./purchase";

export type RuleResolution =
  | { kind: "applied"; rule: EarnRule }
  | { kind: "cardExcluded"; reason: string };

export function resolveRule(
  card: CardProduct,
  purchase: PurchaseContext,
  ownerState: OwnerState,
  asOf: string,
): RuleResolution {
  // Port RuleMatcher.resolve(card:purchase:ownerState:asOf:) here.
  // Trap 6: an unresolvable ownerCondition returns cardExcluded, never a fallthrough.
  // Trap 3: treat JSON null and absent identically when reading optional predicate fields.
}

export function activeFxRule(card: CardProduct, asOf: string): FxRule | undefined {
  // Port RuleMatcher.activeFxRule(for:asOf:) here.
}
```

Fill both bodies by translating the Swift line by line. Do not restructure the control flow — a faithful translation is reviewable against the original; a "cleaner" one is not.

- [ ] **Step 4: Run tests and confirm they pass**

Run: `npm test -- ruleMatcher`
Expected: PASS — all ported cases green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/engines/pickme/ruleMatcher.ts src/lib/engines/pickme/__tests__/ruleMatcher.test.ts
git commit -m "feat(pickme): port RuleMatcher rule resolution and FX rule selection"
```

---

### Task 5: Scorer

**Files:**
- Create: `src/lib/engines/pickme/scorer.ts`
- Create: `src/lib/engines/pickme/__tests__/scorer.test.ts`
- Reference: `../PickMe/Engine/Sources/CardCopilotEngine/Engine/Scorer.swift` (141 lines)
- Reference for cases: `../PickMe/Engine/Tests/CardCopilotEngineTests/ScorerTests.swift`, `CapProjectorTests.swift` (cap-split cases only), `ValuationSensitivityTests.swift`

**Interfaces:**
- Consumes: `catalogue.ts`, `ownerState.ts`, `purchase.ts`, `capMath.ts`, `ruleMatcher.ts`
- Produces:
  - `type Warning = "drawerCard" | "unresolvedOwnerState" | "networkNotAccepted" | "capNearlyExhausted" | "negativeNetValue" | "fxAllowanceAssumed" | "hypotheticalSelection"`
  - `interface CandidateScore { cardId: string; appliedRuleId?: string; rewardUnits: number; grossRewardCad: number; fxCostCad: number; netValueCad: number; floorNetValueCad: number; aspirationalNetValueCad: number; warnings: Warning[]; excluded: boolean; exclusionReason?: string }`
  - `const FALLBACK_CAD_TO_USD = 0.73`
  - `score(card, purchase, ownerState, asOf): CandidateScore`

- [ ] **Step 1: Port the Swift test cases**

Read `Scorer.swift` and `ScorerTests.swift`.

**`ScorerTests.swift` contains 8 test cases. Your `scorer.test.ts` must contain at least 8.** Port them from the Swift. The list below is a coverage checklist to verify against afterwards:

- a network the merchant does not accept returns `excluded: true` with the `networkNotAccepted` warning and a reason of the form `"amex not accepted"`
- a points rule producing `rewardUnits` and `grossRewardCad` at the declared valuation
- `floorNetValueCad` equalling `netValueCad` for cash-back and floorless programs
- `aspirationalNetValueCad` using the published benchmark when `aspirationalCentsPerPoint` is set
- a purchase straddling a cap producing blended units across `rule.earn` and `cap.postCapEarn`
- a USD-measured cap using `purchase.usdEquivalent` when supplied
- a USD-measured cap falling back to `amountCad * 0.73` when it is not
- `capNearlyExhausted` firing at exactly 90% usage
- an FX cost reducing `netValueCad` below `grossRewardCad`

- [ ] **Step 2: Run and confirm they fail**

Run: `npm test -- scorer`
Expected: FAIL — cannot resolve `../scorer`.

- [ ] **Step 3: Write the implementation**

Port `Scorer.swift`, preserving its structure: the local `excludedScore` helper, the network gate, the `RuleMatcher` call, the cap split, then valuation. Signature:

```ts
export function score(
  card: CardProduct,
  purchase: PurchaseContext,
  ownerState: OwnerState,
  asOf: string,
): CandidateScore
```

Traps that apply here specifically: trap 4 (`acceptedNetworks` is a `Set` — use `.has()`), trap 5 (`capProgress?.[capId] ?? 0`), trap 7 (do not round `inCapCad` / `overCapCad`).

- [ ] **Step 4: Run tests and confirm they pass**

Run: `npm test -- scorer`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/engines/pickme/scorer.ts src/lib/engines/pickme/__tests__/scorer.test.ts
git commit -m "feat(pickme): port Scorer card valuation"
```

---

### Task 6: Explainer

**Files:**
- Create: `src/lib/engines/pickme/explainer.ts`
- Create: `src/lib/engines/pickme/__tests__/explainer.test.ts`
- Reference: `../PickMe/Engine/Sources/CardCopilotEngine/Engine/Explainer.swift` (81 lines)
- Reference for cases: `../PickMe/Engine/Tests/CardCopilotEngineTests/ExplainerTests.swift`

The console in Track C renders this text directly, so its exact wording is part of the contract.

**Interfaces:**
- Consumes: `scorer.ts` (`CandidateScore`), `catalogue.ts` (`CardProduct`), `purchase.ts`
- Produces: the functions declared in `Explainer.swift`, with Swift's names preserved.

- [ ] **Step 1: Port the Swift test cases**

Read `Explainer.swift` and `ExplainerTests.swift`.

**`ExplainerTests.swift` contains 3 test cases. Port all 3.** Assert on **exact strings** — a reworded explanation is a behaviour change, and the fixture `notes` fields reference this phrasing.

- [ ] **Step 2: Run and confirm they fail**

Run: `npm test -- explainer`
Expected: FAIL — cannot resolve `../explainer`.

- [ ] **Step 3: Write the implementation**

Port `Explainer.swift`. Swift string interpolation `"\(x)"` becomes a template literal. Where Swift formats a currency value, reproduce the same rounding and separator behaviour rather than reaching for `Intl.NumberFormat`, whose output is locale-dependent and will differ under CI.

- [ ] **Step 4: Run tests and confirm they pass**

Run: `npm test -- explainer`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/engines/pickme/explainer.ts src/lib/engines/pickme/__tests__/explainer.test.ts
git commit -m "feat(pickme): port Explainer reasoning strings"
```

---

### Task 7: RecommendationEngine

The ranking, the switch threshold, the suppression rule, and the breakeven calculation. This is the module the console's valuation slider drives.

**Files:**
- Create: `src/lib/engines/pickme/recommendationEngine.ts`
- Create: `src/lib/engines/pickme/__tests__/recommendationEngine.test.ts`
- Reference: `../PickMe/Engine/Sources/CardCopilotEngine/Engine/RecommendationEngine.swift` (176 lines)
- Reference for cases: `../PickMe/Engine/Tests/CardCopilotEngineTests/BreakevenValuationTests.swift`, `ValuationSensitivityTests.swift`, `ScorerTests.swift`

**Interfaces:**
- Consumes: `scorer.ts`, `catalogue.ts`, `ownerState.ts`, `purchase.ts`
- Produces:
  - `type ValuationDirection = "below" | "above"`
  - `interface Recommendation { winner: CandidateScore; runnerUp?: CandidateScore; switchedFromDefault: boolean; advantageOverDefaultCad?: number; defaultNotAccepted: boolean; suppressedBetterCard?: CandidateScore; valuationSensitive: boolean; valuationDirection?: ValuationDirection; alternateWinnerCardId?: string; breakevenCentsPerPoint?: number; declaredCentsPerPoint?: number; allCandidates: CandidateScore[] }`
  - `recommend(catalogue: Catalogue, ownerState: OwnerState, purchase: PurchaseContext, asOf: string): Recommendation`

- [ ] **Step 1: Read `rank()` and write down its tie-break**

Before writing any code, read `RecommendationEngine.rank(_:purchase:value:)` and record its tie-breaking rule in a comment at the top of the new file. This is trap 2: Swift's sort is unstable and JS's is stable, so ties must be broken explicitly or the two engines will disagree on cases the fixtures cover.

- [ ] **Step 2: Port the Swift test cases**

`BreakevenValuationTests.swift` and `ValuationSensitivityTests.swift` contain 1 case each — port both. They do not cover ranking, thresholds or suppression, so the 8 scenarios below are additional and must also be written. **Expect at least 10 cases in `recommendationEngine.test.ts`.**

- the default card winning, so `switchedFromDefault` is `false` and `advantageOverDefaultCad` is `undefined`
- a non-default card winning by more than the threshold, so `switchedFromDefault` is `true`
- a non-default card winning by **less** than `switchThreshold`, populating `suppressedBetterCard` and leaving `switchedFromDefault` false
- `switchThreshold.semantics === "both"` requiring both `minAdvantagePercentagePoints` and `minAdvantageCad`, versus `"either"`
- the default card excluded by `networkNotAccepted`, setting `defaultNotAccepted: true`
- a valuation-sensitive result reporting `breakevenCentsPerPoint`, `alternateWinnerCardId` and a `valuationDirection`
- a valuation-insensitive result leaving all four breakeven fields `undefined`
- a tie at the declared valuation resolving via the recorded tie-break, not sort order

- [ ] **Step 3: Run and confirm they fail**

Run: `npm test -- recommendationEngine`
Expected: FAIL — cannot resolve `../recommendationEngine`.

- [ ] **Step 4: Write the implementation**

Port `RecommendationEngine.swift`. Preserve its three-ranking structure — `declared`, `floor`, `aspirational` — and its private `Verdict` intermediate. The Swift `precondition(!scores.isEmpty, ...)` becomes a thrown `Error` with the same message; do not silently return a null recommendation.

- [ ] **Step 5: Run tests and confirm they pass**

Run: `npm test -- recommendationEngine`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/engines/pickme/recommendationEngine.ts src/lib/engines/pickme/__tests__/recommendationEngine.test.ts
git commit -m "feat(pickme): port RecommendationEngine ranking and breakeven"
```

---

### Task 8: Seed loading and the fixture parity gate

The task the whole plan exists for. All 27 fixture cases must match exactly.

**Files:**
- Create: `src/lib/engines/pickme/seed.ts`
- Create: `src/lib/engines/pickme/__tests__/seed.test.ts`
- Create: `src/lib/engines/pickme/__tests__/fixtureParity.test.ts`
- Reference: `../PickMe/Engine/Sources/CardCopilotEngine/Loading/SeedLoader.swift`
- Reference: `../PickMe/Engine/Tests/CardCopilotEngineTests/FixtureHarnessTests.swift`

**Interfaces:**
- Consumes: every module from Tasks 2–7, plus the vendored JSON from Task 1.
- Produces:
  - `class UnsupportedCatalogueVersionError extends Error`
  - `assertSupportedCatalogueVersion(version: string): void` — internal; deliberately **not** re-exported from `index.ts`
  - `loadCatalogue(): Catalogue`
  - `loadOwnerState(): OwnerState`

- [ ] **Step 1: Write the failing seed test**

Create `src/lib/engines/pickme/__tests__/seed.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { loadCatalogue, loadOwnerState, assertSupportedCatalogueVersion,
         UnsupportedCatalogueVersionError } from "../seed";

describe("seed loading", () => {
  it("loads the vendored 27-card catalogue", () => {
    expect(loadCatalogue().cards).toHaveLength(27);
  });

  it("loads owner state with a default card", () => {
    expect(loadOwnerState().defaultCardId).toBeTruthy();
  });

  it("accepts a supported MAJOR", () => {
    expect(() => assertSupportedCatalogueVersion("1.1")).not.toThrow();
    expect(() => assertSupportedCatalogueVersion("1.9")).not.toThrow();
  });

  it("refuses an unsupported MAJOR rather than coercing it", () => {
    expect(() => assertSupportedCatalogueVersion("2.0"))
      .toThrow(UnsupportedCatalogueVersionError);
    expect(() => assertSupportedCatalogueVersion("banana"))
      .toThrow(UnsupportedCatalogueVersionError);
  });
});
```

- [ ] **Step 2: Run and confirm it fails**

Run: `npm test -- seed`
Expected: FAIL — cannot resolve `../seed`.

- [ ] **Step 3: Write `seed.ts`**

```ts
import catalogueJson from "@/data/contracts/card-catalogue.json";
import ownerStateJson from "@/data/contracts/owner-state.json";
import type { Catalogue } from "./catalogue";
import type { OwnerState } from "./ownerState";

/** The only catalogueVersion MAJOR this build understands. See ../PickMe/contracts/CHANGELOG.md. */
const SUPPORTED_CATALOGUE_MAJOR = 1;

export class UnsupportedCatalogueVersionError extends Error {
  constructor(version: string) {
    super(`unsupported catalogueVersion: ${version}`);
    this.name = "UnsupportedCatalogueVersionError";
  }
}

export function assertSupportedCatalogueVersion(version: string): void {
  const major = Number.parseInt(version.split(".")[0] ?? "", 10);
  if (!Number.isInteger(major) || major !== SUPPORTED_CATALOGUE_MAJOR) {
    throw new UnsupportedCatalogueVersionError(version);
  }
}

export function loadCatalogue(): Catalogue {
  const c = catalogueJson as unknown as Catalogue;
  assertSupportedCatalogueVersion(c.catalogueVersion);
  return c;
}

export function loadOwnerState(): OwnerState {
  return ownerStateJson as unknown as OwnerState;
}
```

- [ ] **Step 4: Run and confirm it passes**

Run: `npm test -- seed`
Expected: PASS — 4 tests.

- [ ] **Step 5: Write the fixture parity harness**

Create `src/lib/engines/pickme/__tests__/fixtureParity.test.ts`. It must apply `pinnedValuations` over owner state and merge each case's `ownerStateOverrides`, or cases will fail for the wrong reason:

```ts
import { describe, expect, it } from "vitest";
import fixtures from "@/data/contracts/engine-fixtures.json";
import { loadCatalogue, loadOwnerState } from "../seed";
import { makePurchase } from "../purchase";
import { recommend } from "../recommendationEngine";
import type { Network } from "../catalogue";
import type { OwnerState } from "../ownerState";

const DP = 4;
const round = (n: number) => Number(n.toFixed(DP));

/** Fixtures pin MR above the live cash floor so cases exercise points-vs-cash ranking. */
function applyPinnedValuations(base: OwnerState): OwnerState {
  const pinned = fixtures.pinnedValuations as Record<string, number>;
  const valuationsCad = { ...base.valuationsCad };
  for (const [programId, centsPerPoint] of Object.entries(pinned)) {
    if (programId.startsWith("_")) continue; // "_why" is documentation
    const existing = (valuationsCad as Record<string, unknown>)[programId];
    if (existing && typeof existing === "object") {
      (valuationsCad as Record<string, unknown>)[programId] = { ...existing, centsPerPoint };
    }
  }
  return { ...base, valuationsCad };
}

describe("engine-fixtures.json parity", () => {
  const catalogue = loadCatalogue();
  const baseOwnerState = applyPinnedValuations(loadOwnerState());

  it("runs every case in the fixture file", () => {
    expect(fixtures.cases).toHaveLength(27);
  });

  for (const testCase of fixtures.cases) {
    it(testCase.caseId, () => {
      const ownerState: OwnerState = testCase.ownerStateOverrides
        ? { ...baseOwnerState, ...(testCase.ownerStateOverrides as Partial<OwnerState>) }
        : baseOwnerState;

      const raw = testCase.purchase;
      const purchase = makePurchase({
        ...raw,
        acceptedNetworks: new Set(raw.acceptedNetworks as Network[]),
      });

      const got = recommend(catalogue, ownerState, purchase, testCase.asOf ?? "2026-08-16");
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
        for (const w of want.warnings as string[])
          expect(got.winner.warnings, `expected warning ${w}`).toContain(w);
      if (want.warningsAbsent !== undefined)
        for (const w of want.warningsAbsent as string[])
          expect(got.winner.warnings, `unexpected warning ${w}`).not.toContain(w);
    });
  }
});
```

- [ ] **Step 6: Run the gate**

Run: `npm test -- fixtureParity`
Expected: 28 tests, all PASS (27 cases plus the count assertion).

If any case fails, fix the **port**, never the fixture. `engine-fixtures.json` is vendored from PickMe and is the specification; editing it to make a test pass destroys the only guarantee this plan provides. If a case appears genuinely wrong, stop and raise it rather than editing.

- [ ] **Step 7: Commit**

```bash
git add src/lib/engines/pickme
git commit -m "feat(pickme): add seed loading and 27/27 fixture parity gate"
```

---

### Task 9: Public surface and CI

**Files:**
- Create: `src/lib/engines/pickme/index.ts`
- Create: `src/lib/engines/pickme/__tests__/publicSurface.test.ts`
- Modify: `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: every module from Tasks 2–8.
- Produces: the import surface Track C consumes — `recommend`, `makePurchase`, `loadCatalogue`, `loadOwnerState`, and the public types.

- [ ] **Step 1: Write the failing test**

Create `src/lib/engines/pickme/__tests__/publicSurface.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import * as pickme from "../index";

describe("public surface", () => {
  it("exports everything the console needs and nothing internal", () => {
    expect(Object.keys(pickme).sort()).toEqual([
      "UnsupportedCatalogueVersionError",
      "loadCatalogue",
      "loadOwnerState",
      "makePurchase",
      "recommend",
    ]);
  });

  it("produces a recommendation from the vendored seed data", () => {
    const result = pickme.recommend(
      pickme.loadCatalogue(),
      pickme.loadOwnerState(),
      pickme.makePurchase({ amountCad: 100, category: "grocery", mcc: 5411 }),
      "2026-08-16",
    );
    expect(result.winner.cardId).toBeTruthy();
    expect(result.allCandidates.length).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 2: Run and confirm it fails**

Run: `npm test -- publicSurface`
Expected: FAIL — cannot resolve `../index`.

- [ ] **Step 3: Write `index.ts`**

```ts
export { recommend } from "./recommendationEngine";
export { makePurchase } from "./purchase";
export { loadCatalogue, loadOwnerState, UnsupportedCatalogueVersionError } from "./seed";

export type { Recommendation, ValuationDirection } from "./recommendationEngine";
export type { CandidateScore, Warning } from "./scorer";
export type { PurchaseContext } from "./purchase";
export type { Catalogue, CardProduct, Earn, Network } from "./catalogue";
export type { OwnerState, Valuations, PointValuation } from "./ownerState";
```

Type-only exports do not appear as runtime keys, so the first test's list stays five entries.

- [ ] **Step 4: Run and confirm it passes**

Run: `npm test -- publicSurface`
Expected: PASS — 2 tests.

- [ ] **Step 5: Gate the deploy on tests**

In `.github/workflows/deploy.yml`, insert a step between "Install dependencies" and "Build Next.js static export":

```yaml
      - name: Run tests
        run: npm test
```

- [ ] **Step 6: Run the whole suite**

Run: `npm test`
Expected: PASS — every test from Tasks 1–9, including 27/27 fixture parity.

- [ ] **Step 7: Commit**

```bash
git add src/lib/engines/pickme/index.ts src/lib/engines/pickme/__tests__/publicSurface.test.ts .github/workflows/deploy.yml
git commit -m "feat(pickme): add public surface and gate deploys on the test suite"
```

---

## Done when

- `npm test` passes, including all 27 fixture cases.
- `npm run build` still produces a static export.
- The engine imports nothing from `src/components/` and nothing from React.
- `./scripts/sync-contracts.sh` re-vendors cleanly and produces no diff against a fresh PickMe checkout.
