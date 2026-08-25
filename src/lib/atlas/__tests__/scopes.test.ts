import { describe, expect, it } from "vitest";
import { GALAXY_ZEMI, SOLAR_SYSTEM_ZEMI, SCOPES, getScope, scopeChain } from "../scopes";
import { loadBodies } from "../bodies";

describe("scope tree", () => {
  it("has exactly one root", () => {
    const roots = Object.values(SCOPES).filter((s) => s.parent === undefined);
    expect(roots).toHaveLength(1);
    expect(roots[0].id).toBe(GALAXY_ZEMI.id);
  });

  it("resolves every declared parent", () => {
    for (const scope of Object.values(SCOPES)) {
      if (scope.parent !== undefined) {
        expect(SCOPES[scope.parent], `dangling parent on ${scope.id}`).toBeDefined();
      }
    }
  });

  it("has no cycles", () => {
    for (const scope of Object.values(SCOPES)) {
      const seen = new Set<string>();
      let cursor: string | undefined = scope.id;
      while (cursor !== undefined) {
        expect(seen.has(cursor), `cycle through ${cursor}`).toBe(false);
        seen.add(cursor);
        cursor = SCOPES[cursor].parent;
      }
    }
  });

  it("returns the chain root-first", () => {
    expect(scopeChain(SOLAR_SYSTEM_ZEMI.id).map((s) => s.id)).toEqual([
      GALAXY_ZEMI.id,
      SOLAR_SYSTEM_ZEMI.id,
    ]);
  });

  it("throws on an unknown scope rather than defaulting", () => {
    expect(() => getScope("galaxy:nope")).toThrow(/unknown scope/);
  });

  it("parents every body to a scope that exists", () => {
    for (const body of loadBodies()) {
      expect(SCOPES[body.parent], `body ${body.id} has no scope`).toBeDefined();
    }
  });

  it("declares an angle for every arm a body uses", () => {
    for (const body of loadBodies()) {
      const scope = getScope(body.parent);
      expect(scope.arms[body.arm], `${body.id} uses undeclared arm ${body.arm}`).toBeDefined();
    }
  });
});
