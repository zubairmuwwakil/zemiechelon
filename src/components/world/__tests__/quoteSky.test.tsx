// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FOUNDER_QUOTES } from "@/data/quotes";
import { deriveQuoteStars } from "@/lib/quotes/sky";
import { QuoteSky } from "../QuoteSky";

afterEach(cleanup);

const points = deriveQuoteStars(FOUNDER_QUOTES, 14, 260).map((s, i) => ({
  id: s.id,
  x: 100 + i * 40,
  y: 120,
  visible: true,
  depth: 0.5,
}));

describe("QuoteSky", () => {
  it("renders every visible star as a button in night mode", () => {
    render(<QuoteSky cosmicMode="night" points={points} />);
    expect(screen.getAllByRole("button", { name: /./ })).toHaveLength(points.length);
  });

  it("names each star with its quote, so a screen reader hears the content", () => {
    render(<QuoteSky cosmicMode="night" points={points} />);
    const first = screen.getAllByRole("button")[0];
    expect(first).toHaveAccessibleName(FOUNDER_QUOTES[0].text);
  });

  it("opens the quote card when a star is activated", async () => {
    const user = userEvent.setup();
    render(<QuoteSky cosmicMode="night" points={points} />);
    await user.click(screen.getAllByRole("button")[0]);
    expect(screen.getByRole("dialog")).toHaveTextContent(FOUNDER_QUOTES[0].text);
  });

  it("opens the card from the keyboard as well as the pointer", async () => {
    const user = userEvent.setup();
    render(<QuoteSky cosmicMode="night" points={points} />);
    await user.tab();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("closes the card on Escape", async () => {
    const user = userEvent.setup();
    render(<QuoteSky cosmicMode="night" points={points} />);
    await user.click(screen.getAllByRole("button")[0]);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("skips stars the camera has culled", () => {
    const culled = points.map((p, i) => ({ ...p, visible: i < 3 }));
    render(<QuoteSky cosmicMode="night" points={culled} />);
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });

  it("still renders reachable stars in day mode", () => {
    render(<QuoteSky cosmicMode="day" points={points} />);
    expect(screen.getAllByRole("button").length).toBeGreaterThan(0);
  });
});
