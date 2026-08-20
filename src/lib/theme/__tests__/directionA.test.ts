import { describe, expect, it } from "vitest";
import { DIRECTION_A } from "../directionA";

describe("Direction A palette", () => {
  it("uses the exact values the spec fixes", () => {
    expect(DIRECTION_A.ground).toBe("#F7F6F2");
    expect(DIRECTION_A.ink).toBe("#1B1A17");
    expect(DIRECTION_A.gold).toBe("#B8860B");
    expect(DIRECTION_A.verdigris).toBe("#0B6B4F");
    expect(DIRECTION_A.oxide).toBe("#8C3B2E");
  });

  it("exposes every colour as a parseable hex", () => {
    for (const [name, value] of Object.entries(DIRECTION_A)) {
      expect(value, `${name} is not a hex colour`).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it("is frozen, so no consumer can mutate the shared palette", () => {
    expect(Object.isFrozen(DIRECTION_A)).toBe(true);
  });
});
