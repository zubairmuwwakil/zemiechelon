import { describe, expect, it } from "vitest";
import { loadBodies } from "../bodies";
import { planetScopeId } from "../galaxy";
import { SCOPES, derivePlanetScopes, getScope, scopeChain } from "../scopes";

const bodies = loadBodies();
const planets = derivePlanetScopes(bodies);

describe("derived planet scopes", () => {
  it("registers one scope per arm that ships something, and no others", () => {
    const armsWithSystems = new Set(bodies.filter((b) => b.kind === "system").map((b) => b.arm));
    expect(planets.map((s) => s.id).sort()).toEqual(
      [...armsWithSystems].map(planetScopeId).sort(),
    );
  });

  it("gives Products and Labs a scope, and the other three none", () => {
    expect(planets.map((s) => s.id).sort()).toEqual(["planet:labs", "planet:products"]);
  });

  it("hangs every planet scope off the galaxy", () => {
    for (const scope of planets) {
      expect(scope.parent).toBe("galaxy:zemi");
      expect(scopeChain(scope.id).map((s) => s.id)).toEqual(["galaxy:zemi", scope.id]);
    }
  });

  it("takes each planet's epoch from its oldest child, so radius is time inside too", () => {
    for (const scope of planets) {
      const arm = scope.id.replace("planet:", "");
      const oldest = bodies
        .filter((b) => b.arm === arm && b.kind === "system")
        .map((b) => b.bornAt)
        .sort()[0];
      expect(scope.epoch).toBe(oldest);
    }
  });

  it("declares the arm its children use, so placeBodies can run in the frame", () => {
    for (const scope of planets) {
      const arm = scope.id.replace("planet:", "");
      expect(scope.arms[arm]).toBe(0);
    }
  });

  it("puts the derived scopes in the registry getScope reads", () => {
    for (const scope of planets) {
      // toEqual, not toBe: SCOPES is built from its own derivePlanetScopes()
      // call, so these are equal records and not the same object.
      expect(getScope(scope.id)).toEqual(scope);
      expect(SCOPES[scope.id]).toEqual(scope);
    }
  });
});
