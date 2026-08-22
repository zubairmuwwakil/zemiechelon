// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { loadCatalogue, loadOwnerState, makePurchase, recommend } from "@/lib/engines/pickme";
import fixturesJson from "@/data/contracts/engine-fixtures.json";
import { PickMeConsole, fixtureToFormState, formStateToPurchaseContext } from "../PickMeConsole";

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

    const amexCheckbox = screen.getByLabelText(/amex/i) as HTMLInputElement;
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
