import { describe, expect, it } from "vitest";
import { SOLAR_SYSTEM_ZEMI } from "@/lib/atlas/scopes";
import { ARMS } from "@/data/arms";
import { SURFACE_FAMILIES } from "../PlanetSurfaces";

const families = Object.values(SURFACE_FAMILIES);

describe("surface families", () => {
  it("covers every arm the galaxy declares", () => {
    expect(Object.keys(SURFACE_FAMILIES).sort()).toEqual(Object.keys(SOLAR_SYSTEM_ZEMI.arms).sort());
  });

  it("gives every planet a distinct pattern, so none are twins", () => {
    expect(new Set(families.map((f) => f.pattern)).size).toBe(families.length);
  });

  it("gives every planet its own rotation rate", () => {
    expect(new Set(families.map((f) => f.rotationRate)).size).toBe(families.length);
  });

  it("rotates every planet slowly — fast reads as a screensaver", () => {
    for (const f of families) {
      expect(f.rotationRate).toBeGreaterThan(0);
      expect(f.rotationRate, `${f.arm} spins too fast`).toBeLessThan(0.05);
    }
  });

  it("turns Foundations slowest, because it is the oldest and most settled", () => {
    const slowest = families.reduce((a, b) => (a.rotationRate < b.rotationRate ? a : b));
    expect(slowest.arm).toBe("foundations");
  });

  it("uses only Direction A colours", () => {
    const allowed = new Set(["#F7F6F2", "#1B1A17", "#B8860B", "#0B6B4F", "#8C3B2E", "#D3CEC0"]);
    for (const f of families) {
      expect(allowed.has(f.baseColor), `${f.arm} base ${f.baseColor} is off-palette`).toBe(true);
      expect(allowed.has(f.accentColor), `${f.arm} accent ${f.accentColor} is off-palette`).toBe(true);
    }
  });
});

describe("arm theme colours", () => {
  it("matches each arm's HUD dot to the planet it points at", () => {
    for (const arm of ARMS) {
      expect(SURFACE_FAMILIES[arm.id], `no family for ${arm.id}`).toBeDefined();
      expect(arm.themeColor, `${arm.id} HUD dot is off its planet`).toBe(
        SURFACE_FAMILIES[arm.id].baseColor,
      );
    }
  });
});
