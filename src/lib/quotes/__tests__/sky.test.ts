import { describe, expect, it } from "vitest";
import { FOUNDER_QUOTES } from "@/data/quotes";
import { createQuoteRotation } from "../rotation";
import { assignQuotes, deriveQuoteStars } from "../sky";

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

describe("assignQuotes", () => {
  const session = (seed: number) => assignQuotes(stars, createQuoteRotation(FOUNDER_QUOTES, seed));
  const ids = new Set(FOUNDER_QUOTES.map((q) => q.id));

  it("names every star with a real quote", () => {
    for (const star of session(1)) expect(ids.has(star.quoteId)).toBe(true);
  });

  it("never gives two stars the same quote", () => {
    const assigned = session(7);
    expect(new Set(assigned.map((s) => s.quoteId)).size).toBe(assigned.length);
  });

  it("leaves id, position and phase exactly as derived", () => {
    // The projection bridge keys on the positional id, and the separation
    // guarantee is a property of the positions. Only the quote may move.
    for (const [i, star] of session(3).entries()) {
      expect(star.id).toBe(stars[i].id);
      expect(star.position).toEqual(stars[i].position);
      expect(star.phase).toBe(stars[i].phase);
    }
  });

  it("reaches past the first fourteen quotes", () => {
    // The whole point: index assignment could only ever show FOUNDER_QUOTES[0..13].
    const union = new Set<string>();
    for (let seed = 1; seed <= 12; seed++) for (const s of session(seed)) union.add(s.quoteId);
    expect(union.size).toBeGreaterThan(stars.length * 2);
  });

  it("gives two sessions two different skies", () => {
    expect(session(1).map((s) => s.quoteId)).not.toEqual(session(2).map((s) => s.quoteId));
  });

  it("does not mutate the derived stars", () => {
    session(5);
    expect(stars.map((s) => s.quoteId)).toEqual(
      FOUNDER_QUOTES.slice(0, stars.length).map((q) => q.id),
    );
  });
});
