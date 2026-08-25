// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorldHUD } from "../WorldHUD";

afterEach(() => {
  cleanup();
});

describe("WorldHUD", () => {
  const defaultProps = {
    cosmicMode: "day" as const,
    onToggleCosmicMode: vi.fn(),
    activePreset: "solarSystem" as const,
    onSelectPreset: vi.fn(),
    onResetView: vi.fn(),
    isDossierOpen: false,
    onToggleDossier: vi.fn(),
    isLegendOpen: false,
    onToggleLegend: vi.fn(),
    onOpenTerminal: vi.fn(),
  };

  it("renders the brand badge and sector navigation", () => {
    render(<WorldHUD {...defaultProps} />);
    expect(screen.getByText("ZEMI ECHELON")).toBeTruthy();
    expect(screen.getByText("CELESTIAL ATLAS")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Foundations" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Products" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Labs" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Self" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Creative" })).toBeTruthy();
  });

  it("renders the legend button and triggers onToggleLegend on click", async () => {
    const onToggleLegend = vi.fn();
    render(<WorldHUD {...defaultProps} onToggleLegend={onToggleLegend} />);
    const legendBtn = screen.getByRole("button", { name: /open celestial atlas legend/i });
    expect(legendBtn).toBeTruthy();
    await userEvent.click(legendBtn);
    expect(onToggleLegend).toHaveBeenCalledTimes(1);
  });

  it("renders the dossier button and triggers onToggleDossier on click", async () => {
    const onToggleDossier = vi.fn();
    render(<WorldHUD {...defaultProps} onToggleDossier={onToggleDossier} />);
    const dossierBtn = screen.getByRole("button", { name: /open architecture dossier/i });
    expect(dossierBtn).toBeTruthy();
    await userEvent.click(dossierBtn);
    expect(onToggleDossier).toHaveBeenCalledTimes(1);
  });
});
