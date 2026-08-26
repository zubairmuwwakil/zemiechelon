// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorldHUD } from "../WorldHUD";
import { SOLAR_SYSTEMS, SOLAR_SYSTEM_CHANNEL, SOLAR_SYSTEM_ZEMI } from "@/lib/atlas/scopes";

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
    activeSystem: SOLAR_SYSTEM_ZEMI.id,
    onSelectSolarSystem: vi.fn(),
    onAscendToGalaxy: vi.fn(),
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

  describe("the system switcher", () => {
    it("names every registered solar system", () => {
      render(<WorldHUD {...defaultProps} activeSystem={SOLAR_SYSTEM_ZEMI.id} />);
      for (const s of SOLAR_SYSTEMS) {
        expect(screen.getByRole("button", { name: s.label })).toBeInTheDocument();
      }
    });

    it("shows the active system's arms and no others", () => {
      render(<WorldHUD {...defaultProps} activeSystem={SOLAR_SYSTEM_CHANNEL.id} />);
      expect(screen.getByRole("button", { name: "Tutorials" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Foundations" })).toBeNull();
    });

    it("reports which system was chosen", async () => {
      const onSelectSolarSystem = vi.fn();
      render(
        <WorldHUD
          {...defaultProps}
          activeSystem={SOLAR_SYSTEM_ZEMI.id}
          onSelectSolarSystem={onSelectSolarSystem}
        />,
      );
      await userEvent.click(screen.getByRole("button", { name: SOLAR_SYSTEM_CHANNEL.label }));
      expect(onSelectSolarSystem).toHaveBeenCalledWith(SOLAR_SYSTEM_CHANNEL.id);
    });
  });
});
