import { describe, expect, it } from "vitest";
import { loadBodies } from "../bodies";
import { magnitude, temperature, MOON_MAGNITUDE } from "../magnitude";

const bodies = loadBodies();
const byId = (id: string) => bodies.find((b) => b.id === id)!;

describe("magnitude", () => {
  it("pins every system to the same bright value", () => {
    for (const b of bodies.filter((x) => x.kind === "moon")) {
      expect(magnitude(b), `${b.id}`).toBe(MOON_MAGNITUDE);
    }
  });

  it("makes a four-day-old flagship outshine a long-lived star", () => {
    // The whole reason systems are pinned rather than derived.
    expect(magnitude(byId("PickMe"))).toBeGreaterThan(magnitude(byId("mindmap")));
  });

  it("ranks a long-lived repo above a same-day one", () => {
    expect(magnitude(byId("return-saas"))).toBeGreaterThan(magnitude(byId("Coin_Flipper")));
  });

  it("never derives brightness from repository size", async () => {
    // Obsidian is a 25MB vault and must not be the brightest object in the sky.
    const brightest = [...bodies].sort((a, b) => magnitude(b) - magnitude(a))[0];
    expect(brightest.id).not.toBe("Obsidian");
  });

  it("is positive for every body", () => {
    for (const b of bodies) expect(magnitude(b), `${b.id}`).toBeGreaterThan(0);
  });
});

describe("temperature", () => {
  it("is hottest for something pushed today", () => {
    expect(temperature(byId("MoneyTalks"), "2026-08-19")).toBeCloseTo(1, 1);
  });

  it("is cold for something abandoned months ago", () => {
    expect(temperature(byId("zweb"), "2026-08-19")).toBeLessThan(0.2);
  });

  it("separates two bodies of similar radius but different liveness", () => {
    // marketdata and zweb were created two days apart in January 2026.
    const hot = temperature(byId("marketdata"), "2026-08-19");
    const cold = temperature(byId("zweb"), "2026-08-19");
    expect(hot - cold).toBeGreaterThan(0.5);
  });

  it("stays within 0..1", () => {
    for (const b of bodies) {
      const t = temperature(b, "2026-08-19");
      expect(t, `${b.id}`).toBeGreaterThanOrEqual(0);
      expect(t, `${b.id}`).toBeLessThanOrEqual(1);
    }
  });
});
