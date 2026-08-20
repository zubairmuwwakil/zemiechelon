// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ARMS } from "@/data/arms";
import { SURFACE_FAMILIES } from "../PlanetSurfaces";
import { PlanetPinsOverlay } from "../PlanetPinsOverlay";

const points = ARMS.map((arm, i) => ({ id: arm.id, x: i * 40, y: 100, visible: true, depth: 0.5 }));

describe("planet pins", () => {
  it("dots each pin in its own planet's colour, with no second palette", () => {
    const { container } = render(
      <PlanetPinsOverlay points={points} activePreset="galaxy" onSelectPlanet={vi.fn()} />,
    );

    const dots = [...container.querySelectorAll("span[style]")];
    expect(dots).toHaveLength(ARMS.length);

    // getComputedStyle normalises hex to rgb(), so compare through the same lens.
    const asRgb = (hex: string) => {
      const el = document.createElement("span");
      el.style.backgroundColor = hex;
      return el.style.backgroundColor;
    };

    ARMS.forEach((arm, i) => {
      expect(dots[i].getAttribute("style"), `${arm.id} pin is off its planet`).toContain(
        asRgb(SURFACE_FAMILIES[arm.id].baseColor),
      );
    });
  });

  it("labels each pin from ARM_META rather than a duplicate table", () => {
    const { container } = render(
      <PlanetPinsOverlay points={points} activePreset="galaxy" onSelectPlanet={vi.fn()} />,
    );
    const labels = [...container.querySelectorAll("button span:first-child")].map((n) => n.textContent);
    expect(labels).toEqual(ARMS.map((a) => a.shortName));
  });
});
