import { describe, expect, it } from "vitest";
import { FOUNDER_QUOTES } from "@/data/quotes";
import { deriveQuoteStars } from "../sky";

const RADIUS = 260;
const stars = deriveQuoteStars(FOUNDER_QUOTES, 14, RADIUS);

describe("deriveQuoteStars", () => {
  it("returns the requested count", () => {
    expect(stars).toHaveLength(14);
  });

  it("puts every star on the sky sphere", () => {
    for (const s of stars) {
      const r = Math.hypot(s.position.x, s.position.y, s.position.z);
      expect(r).toBeCloseTo(RADIUS, 4);
    }
  });

  it("gives every star a distinct quote", () => {
    expect(new Set(stars.map((s) => s.quoteId)).size).toBe(stars.length);
  });

  it("separates stars so two never overlap on screen", () => {
    // Fibonacci placement over 14 points on a sphere leaves well over 0.3 rad.
    for (let i = 0; i < stars.length; i++) {
      for (let j = i + 1; j < stars.length; j++) {
        const a = stars[i].position;
        const b = stars[j].position;
        const dot = (a.x * b.x + a.y * b.y + a.z * b.z) / (RADIUS * RADIUS);
        const angle = Math.acos(Math.min(1, Math.max(-1, dot)));
        expect(angle, `${stars[i].id} and ${stars[j].id} are too close`).toBeGreaterThan(0.3);
      }
    }
  });

  it("gives each star its own pulse phase so they do not blink in unison", () => {
    const phases = stars.map((s) => s.phase);
    expect(new Set(phases).size).toBe(phases.length);
    for (const p of phases) {
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThan(Math.PI * 2);
    }
  });

  it("is deterministic", () => {
    expect(deriveQuoteStars(FOUNDER_QUOTES, 14, RADIUS)).toEqual(stars);
  });

  it("never asks for more stars than there are quotes", () => {
    expect(deriveQuoteStars(FOUNDER_QUOTES, 10_000, RADIUS)).toHaveLength(FOUNDER_QUOTES.length);
  });
});
