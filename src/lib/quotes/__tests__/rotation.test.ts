import { describe, expect, it } from "vitest";
import { FOUNDER_QUOTES } from "@/data/quotes";
import { createQuoteRotation } from "../rotation";

describe("createQuoteRotation", () => {
  it("reaches every quote before repeating any", () => {
    const rotation = createQuoteRotation(FOUNDER_QUOTES, 1);
    const seen = FOUNDER_QUOTES.map(() => rotation.next().id);
    expect(new Set(seen).size).toBe(FOUNDER_QUOTES.length);
  });

  it("reaches all 80+ quotes, not a hardcoded subset", () => {
    expect(FOUNDER_QUOTES.length).toBeGreaterThanOrEqual(80);
    const rotation = createQuoteRotation(FOUNDER_QUOTES, 2);
    const seen = new Set(FOUNDER_QUOTES.map(() => rotation.next().id));
    expect(seen.size).toBe(FOUNDER_QUOTES.length);
  });

  it("restarts after exhaustion instead of running dry", () => {
    const rotation = createQuoteRotation(FOUNDER_QUOTES, 3);
    for (let i = 0; i < FOUNDER_QUOTES.length; i++) rotation.next();
    expect(rotation.next()).toBeDefined();
    expect(rotation.drawn()).toBe(FOUNDER_QUOTES.length + 1);
  });

  it("does not repeat across the seam between cycles", () => {
    const rotation = createQuoteRotation(FOUNDER_QUOTES, 4);
    let last = rotation.next();
    for (let i = 0; i < FOUNDER_QUOTES.length * 3; i++) {
      const current = rotation.next();
      expect(current.id, `repeated ${current.id} back to back`).not.toBe(last.id);
      last = current;
    }
  });

  it("is deterministic for a given seed", () => {
    const a = createQuoteRotation(FOUNDER_QUOTES, 7);
    const b = createQuoteRotation(FOUNDER_QUOTES, 7);
    expect(FOUNDER_QUOTES.map(() => a.next().id)).toEqual(FOUNDER_QUOTES.map(() => b.next().id));
  });

  it("differs between seeds, so a second visit is not the same order", () => {
    const a = createQuoteRotation(FOUNDER_QUOTES, 11);
    const b = createQuoteRotation(FOUNDER_QUOTES, 12);
    expect(FOUNDER_QUOTES.map(() => a.next().id)).not.toEqual(
      FOUNDER_QUOTES.map(() => b.next().id),
    );
  });

  it("throws on an empty set rather than returning undefined", () => {
    expect(() => createQuoteRotation([], 1)).toThrow(/no quotes/);
  });
});
