// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { loadCatalogue, loadOwnerState, makePurchase, recommend } from "@/lib/engines/pickme";
import fixturesJson from "@/data/contracts/engine-fixtures.json";
import { PickMeConsole, fixtureToFormState, formStateToPurchaseContext } from "../PickMeConsole";
import { valuationSubject, withDeclaredCentsPerPoint } from "../valuationControl";

afterEach(() => {
  cleanup();
});

const fixtures = fixturesJson.cases;
const ASOF = "2026-08-16"; // matches publicSurface.test.ts — before any effective-dating fixture boundary

describe("PickMeConsole guard: no hardcoded card evidence", () => {
  it("contains no card officialName or cardId as a string literal in its own source", () => {
    const sourcePath = path.join(process.cwd(), "src/components/hud/PickMeConsole.tsx");
    const source = readFileSync(sourcePath, "utf8");
    const catalogue = loadCatalogue();
    for (const card of catalogue.cards) {
      expect(source.includes(card.officialName)).toBe(false);
      expect(source.includes(`"${card.cardId}"`)).toBe(false);
      expect(source.includes(`'${card.cardId}'`)).toBe(false);
    }
  });

  it("renders the winner's officialName only via recommend() output, not a literal", () => {
    render(<PickMeConsole isDay={true} asOf={ASOF} />);
    const catalogue = loadCatalogue();
    const purchase = formStateToPurchaseContext(fixtureToFormState(fixtures[0].purchase));
    const expected = recommend(catalogue, loadOwnerState(), purchase, ASOF);
    const winnerCard = catalogue.cards.find((c) => c.cardId === expected.winner.cardId)!;
    expect(screen.getAllByText(winnerCard.officialName).length).toBeGreaterThan(0);
  });
});

describe("PickMeConsole", () => {
  it("arrives populated from the first fixture case rather than blank", () => {
    render(<PickMeConsole isDay={true} asOf={ASOF} />);
    const first = fixtures[0];
    expect(screen.getByDisplayValue(String(first.purchase.amountCad))).toBeTruthy();
    expect(screen.getByDisplayValue(first.purchase.category)).toBeTruthy();
  });

  it("offers exactly the scenarios in engine-fixtures.json", () => {
    render(<PickMeConsole isDay={true} asOf={ASOF} />);
    const select = screen.getByLabelText(/scenario/i) as HTMLSelectElement;
    const optionValues = Array.from(select.options).map((o) => o.value);
    expect(optionValues).toEqual(fixtures.map((c) => c.caseId));
  });

  it("switching scenarios re-seeds the amount field from the new case", async () => {
    render(<PickMeConsole isDay={true} asOf={ASOF} />);
    const select = screen.getByLabelText(/scenario/i) as HTMLSelectElement;
    const restaurantCase = fixtures.find((c) => c.caseId === "restaurant-50")!;
    await userEvent.selectOptions(select, "restaurant-50");
    expect(screen.getByDisplayValue(String(restaurantCase.purchase.amountCad))).toBeTruthy();
  });

  it("recomputes the verdict when a network is deselected", async () => {
    render(<PickMeConsole isDay={true} asOf={ASOF} />);
    const catalogue = loadCatalogue();
    const groceryCase = fixtures.find((c) => c.caseId === "grocery-standalone-100")!;
    const withoutAmex = makePurchase({
      amountCad: groceryCase.purchase.amountCad,
      category: groceryCase.purchase.category,
      mcc: groceryCase.purchase.mcc ?? undefined,
      merchantBrand: groceryCase.purchase.merchantBrand ?? undefined,
      recurringIndicator: groceryCase.purchase.recurringIndicator,
      acceptedNetworks: new Set(
        groceryCase.purchase.acceptedNetworks.filter((n) => n !== "amex") as ("visa" | "mastercard")[],
      ),
    });
    const expected = recommend(catalogue, loadOwnerState(), withoutAmex, ASOF);
    const expectedWinnerCard = catalogue.cards.find((c) => c.cardId === expected.winner.cardId)!;

    const amexCheckbox = screen.getByLabelText("amex", { exact: true }) as HTMLInputElement;
    expect(amexCheckbox.checked).toBe(true);
    await userEvent.click(amexCheckbox);

    expect(
      await screen.findAllByText(expectedWinnerCard.officialName),
    ).not.toHaveLength(0);
  });
});

describe("formStateToPurchaseContext", () => {
  it("converts the fixture's acceptedNetworks array into a real Set, not a cast", () => {
    const purchase = formStateToPurchaseContext(fixtureToFormState(fixtures[0].purchase));
    expect(purchase.acceptedNetworks).toBeInstanceOf(Set);
    expect(Array.from(purchase.acceptedNetworks).sort()).toEqual(
      [...fixtures[0].purchase.acceptedNetworks].sort(),
    );
  });
});

describe("the valuation control", () => {
  /** A case the engine reports a breakeven for, chosen from the fixtures rather than named. */
  const sensitiveCase = fixtures.find((fx) => {
    const purchase = formStateToPurchaseContext(fixtureToFormState(fx.purchase));
    return recommend(loadCatalogue(), loadOwnerState(), purchase, ASOF).valuationSensitive;
  })!;

  async function openSensitiveScenario() {
    render(<PickMeConsole isDay={true} asOf={ASOF} />);
    await userEvent.selectOptions(screen.getByLabelText(/scenario/i), sensitiveCase.caseId);
  }

  it("names the currency being valued and starts at the owner's declared value", async () => {
    await openSensitiveScenario();
    const catalogue = loadCatalogue();
    const ownerState = loadOwnerState();
    const purchase = formStateToPurchaseContext(fixtureToFormState(sensitiveCase.purchase));
    const baseline = recommend(catalogue, ownerState, purchase, ASOF);
    const subject = valuationSubject(catalogue, ownerState, baseline)!;

    const slider = screen.getByLabelText(
      new RegExp(`${subject.label} cents per`, "i"),
    ) as HTMLInputElement;
    expect(Number(slider.value)).toBeCloseTo(subject.declaredCentsPerPoint, 5);
    // The engine's breakeven appears at its own precision, not rounded to a friendlier one.
    const shown = String(Number(subject.breakevenCentsPerPoint!.toFixed(4)));
    expect(
      screen.getByText((_, node) => node?.textContent?.includes(shown) === true, {
        selector: "span",
      }),
    ).toBeTruthy();
  });

  it("crossing the breakeven changes the recommendation, and crossing back changes it back", async () => {
    await openSensitiveScenario();
    const catalogue = loadCatalogue();
    const ownerState = loadOwnerState();
    const purchase = formStateToPurchaseContext(fixtureToFormState(sensitiveCase.purchase));
    const baseline = recommend(catalogue, ownerState, purchase, ASOF);
    const subject = valuationSubject(catalogue, ownerState, baseline)!;
    const breakeven = subject.breakevenCentsPerPoint!;

    const nameAt = (cents: number) => {
      const r = recommend(
        catalogue,
        withDeclaredCentsPerPoint(ownerState, subject.programId, cents),
        purchase,
        ASOF,
      );
      return catalogue.cards.find((card) => card.cardId === r.winner.cardId)!.officialName;
    };
    const belowName = nameAt(breakeven - 0.005);
    const aboveName = nameAt(breakeven + 0.005);
    expect(belowName).not.toBe(aboveName);

    await userEvent.click(screen.getByRole("button", { name: /just above/i }));
    expect(await screen.findAllByText(aboveName)).not.toHaveLength(0);

    await userEvent.click(screen.getByRole("button", { name: /just below/i }));
    expect(await screen.findAllByText(belowName)).not.toHaveLength(0);
  });

  it("says so plainly when the recommendation has no flip point", async () => {
    const catalogue = loadCatalogue();
    const ownerState = loadOwnerState();
    const insensitive = fixtures.find((fx) => {
      const purchase = formStateToPurchaseContext(fixtureToFormState(fx.purchase));
      const r = recommend(catalogue, ownerState, purchase, ASOF);
      return !r.valuationSensitive && valuationSubject(catalogue, ownerState, r) != null;
    })!;
    render(<PickMeConsole isDay={true} asOf={ASOF} />);
    await userEvent.selectOptions(screen.getByLabelText(/scenario/i), insensitive.caseId);

    expect(screen.getByText(/no flip point here/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /just above/i })).toBeNull();
  });
});
