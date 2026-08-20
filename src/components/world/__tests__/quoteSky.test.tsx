// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
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

describe("QuoteSky day comets", () => {
  afterEach(() => vi.useRealTimers());

  it("flies more than one comet at a time", async () => {
    vi.useFakeTimers();
    render(<QuoteSky cosmicMode="day" points={points} />);
    await act(async () => {
      vi.advanceTimersByTime(12_000);
    });
    expect(screen.getAllByTestId("quote-comet").length).toBeGreaterThan(1);
  });

  it("never flies more than three at once", async () => {
    vi.useFakeTimers();
    render(<QuoteSky cosmicMode="day" points={points} />);
    await act(async () => {
      vi.advanceTimersByTime(120_000);
    });
    expect(screen.getAllByTestId("quote-comet").length).toBeLessThanOrEqual(3);
  });

  it("pauses a comet and opens its quote when activated", async () => {
    vi.useFakeTimers();
    render(<QuoteSky cosmicMode="day" points={points} />);
    await act(async () => {
      vi.advanceTimersByTime(4_000);
    });
    const comet = screen.getAllByTestId("quote-comet")[0];
    fireEvent.click(comet);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveTextContent(comet.getAttribute("aria-label")!);
    expect(comet).toHaveAttribute("data-paused", "true");
  });

  it("holds a hovered comet in place and releases it on leave", async () => {
    vi.useFakeTimers();
    render(<QuoteSky cosmicMode="day" points={points} />);
    await act(async () => {
      vi.advanceTimersByTime(4_000);
    });
    const comet = screen.getAllByTestId("quote-comet")[0];
    fireEvent.mouseEnter(comet);
    expect(comet).toHaveAttribute("data-paused", "true");
    fireEvent.mouseLeave(comet);
    expect(comet).toHaveAttribute("data-paused", "false");
  });

  it("keeps a paused comet alive past the end of its flight", async () => {
    vi.useFakeTimers();
    render(<QuoteSky cosmicMode="day" points={points} />);
    await act(async () => {
      vi.advanceTimersByTime(1_000);
    });
    const comet = screen.getAllByTestId("quote-comet")[0];
    const held = comet.getAttribute("aria-label");
    fireEvent.click(comet);
    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });
    expect(
      screen.getAllByTestId("quote-comet").map((c) => c.getAttribute("aria-label")),
    ).toContain(held);
  });

  it("gives each comet a quote of its own", async () => {
    vi.useFakeTimers();
    render(<QuoteSky cosmicMode="day" points={points} />);
    await act(async () => {
      vi.advanceTimersByTime(12_000);
    });
    const labels = screen.getAllByTestId("quote-comet").map((c) => c.getAttribute("aria-label"));
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("flies no comets in night mode", async () => {
    vi.useFakeTimers();
    render(<QuoteSky cosmicMode="night" points={points} />);
    await act(async () => {
      vi.advanceTimersByTime(20_000);
    });
    expect(screen.queryAllByTestId("quote-comet")).toHaveLength(0);
  });
});
