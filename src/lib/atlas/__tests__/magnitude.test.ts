import { describe, expect, it } from "vitest";
import { loadBodies } from "../bodies";
import { magnitude, temperature, MOON_MAGNITUDE, RUNTIME_PIVOT_MINUTES } from "../magnitude";
import { loadChannelBodies } from "../channel";

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

describe("runtime brightness", () => {
  const channel = loadChannelBodies();
  const withRuntime = channel.filter((b) => b.runtimeSeconds !== undefined);

  it("makes a video at the pivot exactly as bright as a shipped repository", () => {
    const pivot = { ...withRuntime[0], runtimeSeconds: RUNTIME_PIVOT_MINUTES * 60 };
    expect(magnitude(pivot)).toBeCloseTo(MOON_MAGNITUDE, 10);
  });

  it("ranks a long tutorial above a short", () => {
    const short = { ...withRuntime[0], runtimeSeconds: 58 };
    const tutorial = { ...withRuntime[0], runtimeSeconds: 2_705 };
    expect(magnitude(tutorial)).toBeGreaterThan(magnitude(short));
  });

  it("beats the moon pin, because a video that is a moon still has a runtime", () => {
    // The branch order is the whole point: `kind === "moon"` would flatten
    // every published video to MOON_MAGNITUDE and delete the arm's texture.
    const short = { ...withRuntime[0], kind: "moon" as const, runtimeSeconds: 58 };
    expect(magnitude(short)).toBeLessThan(MOON_MAGNITUDE);
  });

  it("leaves an idea, which has no runtime, on the lifespan rule", () => {
    const idea = channel.find((b) => b.runtimeSeconds === undefined)!;
    expect(magnitude(idea)).toBeGreaterThan(0);
    expect(magnitude(idea)).toBeLessThan(MOON_MAGNITUDE);
  });

  it("is positive for every channel body", () => {
    for (const b of channel) expect(magnitude(b), b.id).toBeGreaterThan(0);
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
