// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { loadBodies } from "@/lib/atlas/bodies";
import { IDEALS } from "@/lib/atlas/ideals";
import { deriveLegendFigures } from "@/lib/atlas/derivedFigures";
import { LegendModal } from "../LegendModal";
import type { Body } from "@/lib/atlas/types";
import { GALAXY_ZEMI } from "@/lib/atlas/scopes";

afterEach(() => {
  cleanup();
});

const bodies = loadBodies();
const figures = deriveLegendFigures(bodies);

describe("LegendModal", () => {
  it("renders nothing when isOpen is false", () => {
    const { container } = render(<LegendModal isOpen={false} onClose={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the dialog with accessible attributes when isOpen is true", () => {
    render(<LegendModal isOpen={true} onClose={() => {}} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-labelledby")).toBe("legend-modal-title");
    expect(screen.getByText("How The Map Explains Itself")).toBeTruthy();
  });

  it("displays every derived figure matching the atlas geometry", () => {
    render(<LegendModal isOpen={true} onClose={() => {}} />);

    // 1. Day span
    expect(screen.getByText(new RegExp(`${figures.daySpan} days`))).toBeTruthy();

    // 2. Astrolabe graticule rings
    expect(
      screen.getByText(new RegExp(`${figures.astrolabe.monthRingCount} month rings`)),
    ).toBeTruthy();
    expect(
      screen.getByText(new RegExp(`${figures.astrolabe.quarterRingCount} quarterly rings`)),
    ).toBeTruthy();

    // 3. Celestial taxonomy: total bodies, shipped systems (gold), learned stars (verdigris)
    expect(screen.getByText(new RegExp(`${figures.totalBodies} total repositories`))).toBeTruthy();
    expect(screen.getByText(new RegExp(`${figures.shippedSystemsCount} Gold Dots`))).toBeTruthy();
    expect(screen.getByText(new RegExp(`${figures.learnedStarsCount} Verdigris Dots`))).toBeTruthy();

    // 4. Products holdings & largest planet
    expect(
      screen.getByText(
        new RegExp(
          `${figures.products.total} repositories \\(${figures.products.systems} shipped systems, ${figures.products.stars} supporting stars\\)`,
        ),
      ),
    ).toBeTruthy();

    // 5. Moons
    expect(screen.getByText(new RegExp(`${figures.totalMoons} Moons`))).toBeTruthy();

    // 6. Ideals and verified citations
    expect(screen.getByText(new RegExp(`${figures.totalIdeals} active claim`))).toBeTruthy();
    for (const cited of figures.citedRepositoryIds) {
      expect(screen.getByText(new RegExp(cited))).toBeTruthy();
    }
  });

  it("derives figures dynamically when passed a synthetic body set without literals", () => {
    const mockBodies: Body[] = [
      {
        id: "core-tool",
        parent: GALAXY_ZEMI.id,
        label: "Core Tool",
        arm: "foundations",
        bornAt: "2025-11-06",
        lastTouchedAt: "2025-11-06",
        kind: "star",
        anonymous: false,
        links: {},
      },
      {
        id: "venture-alpha",
        parent: "planet:products",
        label: "Venture Alpha",
        arm: "products",
        bornAt: "2026-01-15",
        lastTouchedAt: "2026-01-15",
        kind: "system",
        anonymous: false,
        links: {},
      },
      {
        id: "venture-beta",
        parent: "planet:products",
        label: "Venture Beta",
        arm: "products",
        bornAt: "2026-03-01",
        lastTouchedAt: "2026-03-01",
        kind: "system",
        anonymous: false,
        links: {},
      },
    ];

    const mockFigures = deriveLegendFigures(mockBodies, undefined, IDEALS);

    render(<LegendModal isOpen={true} onClose={() => {}} bodies={mockBodies} />);

    expect(screen.getByText(new RegExp(`${mockFigures.daySpan} days`))).toBeTruthy();
    expect(
      screen.getByText(new RegExp(`${mockFigures.totalBodies} total repositories`)),
    ).toBeTruthy();
    expect(
      screen.getByText(new RegExp(`${mockFigures.shippedSystemsCount} Gold Dots`)),
    ).toBeTruthy();
    expect(
      screen.getByText(new RegExp(`${mockFigures.learnedStarsCount} Verdigris Dots`)),
    ).toBeTruthy();
    expect(screen.getByText(new RegExp(`${mockFigures.totalMoons} Moons`))).toBeTruthy();
  });

  it("closes on Escape key press", async () => {
    const onClose = vi.fn();
    render(<LegendModal isOpen={true} onClose={onClose} />);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on backdrop click", async () => {
    const onClose = vi.fn();
    render(<LegendModal isOpen={true} onClose={onClose} />);
    const backdrop = screen.getByTestId("legend-modal-backdrop");
    await userEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not close when clicking inside the modal content", async () => {
    const onClose = vi.fn();
    render(<LegendModal isOpen={true} onClose={onClose} />);
    const title = screen.getByText("How The Map Explains Itself");
    await userEvent.click(title);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes when the close button is clicked", async () => {
    const onClose = vi.fn();
    render(<LegendModal isOpen={true} onClose={onClose} />);
    const closeBtn = screen.getByRole("button", { name: /close celestial atlas legend/i });
    await userEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("manages focus on open and restores focus on unmount", () => {
    const invokingButton = document.createElement("button");
    document.body.appendChild(invokingButton);
    invokingButton.focus();
    expect(document.activeElement).toBe(invokingButton);

    const { unmount } = render(<LegendModal isOpen={true} onClose={() => {}} />);
    const dialog = screen.getByRole("dialog");
    expect(document.activeElement).toBe(dialog);

    unmount();
    expect(document.activeElement).toBe(invokingButton);
    document.body.removeChild(invokingButton);
  });
});
