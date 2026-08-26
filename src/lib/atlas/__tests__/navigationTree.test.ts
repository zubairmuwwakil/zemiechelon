import { describe, expect, it } from "vitest";
import { allBodies } from "../bodies";
import { moonScopeId, planetScopeId } from "../galaxy";
import { SCOPES, SOLAR_SYSTEM_ZEMI, scopeChain } from "../scopes";
import {
  AT_GALAXY,
  AT_SOLAR_SYSTEM,
  ascendFrom,
  breadcrumbFor,
  journeyReducer,
  siblingsOf,
  scopeIdFor,
  type Position,
} from "../journey";

const bodies = allBodies();

/** A moon that actually exists in the atlas, so the tests name a real place. */
const A_MOON = bodies.find((b) => b.kind === "moon")!;
const MOON_AT: Position = { kind: "moon", bodyId: A_MOON.id, mode: "flyby" };

describe("going down the tree by name", () => {
  it("descends to whatever scope it is handed, at that scope's outermost mode", () => {
    // The verb the wheel, the breadcrumb and the keyboard all share. Three call
    // sites choosing between selectSector, selectBody and selectSolarSystem is
    // how the four camera props drifted apart; one verb cannot.
    const next = journeyReducer(AT_GALAXY, {
      type: "descendTo",
      scopeId: SOLAR_SYSTEM_ZEMI.id,
    });
    expect(next.position).toEqual({ kind: "solarSystem", id: SOLAR_SYSTEM_ZEMI.id });
  });

  it("puts down whatever was open on the way down", () => {
    const busy = { ...AT_SOLAR_SYSTEM, card: "PickMe", console: "PickMe" };
    const next = journeyReducer(busy, {
      type: "descendTo",
      scopeId: planetScopeId("products"),
    });
    expect(next.card).toBeNull();
    expect(next.console).toBeNull();
  });

  it("is the inverse of ascending, for every scope that has a parent", () => {
    // The same contract `ascendFrom` already holds against the scope tree, read
    // in the other direction: descending into a scope and climbing back out
    // must land where you started.
    for (const scope of Object.values(SCOPES)) {
      if (!scope.parent) continue;
      const down = journeyReducer(AT_GALAXY, { type: "descendTo", scopeId: scope.id });
      const backUp = ascendFrom(down.position, bodies);
      expect(scopeIdFor(backUp)).toBe(scope.parent);
    }
  });
});

describe("stepping sideways", () => {
  it("lists the planets of a solar system as each other's siblings", () => {
    const here: Position = { kind: "planet", arm: "products", mode: "orbit" };
    const siblings = siblingsOf(here, bodies);
    const arms = siblings.map((p) => (p.kind === "planet" ? p.arm : null));
    expect(arms).toContain("products");
    expect(arms.length).toBeGreaterThan(1);
  });

  it("keeps every sibling under one parent", () => {
    const here: Position = { kind: "planet", arm: "products", mode: "orbit" };
    const parents = siblingsOf(here, bodies).map((p) =>
      scopeIdFor(ascendFrom(p, bodies)),
    );
    expect(new Set(parents).size).toBe(1);
  });

  it("includes the position it was asked about, so cycling has a place to start", () => {
    const siblings = siblingsOf(MOON_AT, bodies);
    expect(siblings.map((p) => scopeIdFor(p))).toContain(moonScopeId(A_MOON.id));
  });

  it("gives the galaxy only itself, so stepping sideways there is inert", () => {
    // No parent, so no siblings. Answered here rather than special-cased at
    // every call site that binds a key to it.
    expect(siblingsOf({ kind: "galaxy" }, bodies)).toEqual([{ kind: "galaxy" }]);
  });
});

describe("saying where you are", () => {
  it("names the galaxy alone at the top", () => {
    expect(breadcrumbFor({ kind: "galaxy" }).map((c) => c.scopeId)).toEqual([
      scopeIdFor({ kind: "galaxy" }),
    ]);
  });

  it("reads root-first, so it can be rendered left to right", () => {
    const crumbs = breadcrumbFor({ kind: "solarSystem", id: SOLAR_SYSTEM_ZEMI.id });
    expect(crumbs[0].scopeId).toBe(scopeIdFor({ kind: "galaxy" }));
    expect(crumbs[crumbs.length - 1].scopeId).toBe(SOLAR_SYSTEM_ZEMI.id);
  });

  it("agrees with the scope tree at every depth", () => {
    // `scopeChain` is already the ancestor walk; the breadcrumb must be that
    // list and not a second one that could drift from it.
    const crumbs = breadcrumbFor(MOON_AT);
    expect(crumbs.map((c) => c.scopeId)).toEqual(
      scopeChain(moonScopeId(A_MOON.id)).map((s) => s.id),
    );
  });

  it("carries a label for every crumb", () => {
    for (const crumb of breadcrumbFor(MOON_AT)) {
      expect(crumb.label.length).toBeGreaterThan(0);
    }
  });

  it("says nothing extra for an arm the map draws but does not scope", () => {
    // Three of the five arms are drawn and framable without being scoped. A
    // breadcrumb for one of those still has to say something rather than throw.
    const unscoped: Position = { kind: "planet", arm: "labs", mode: "orbit" };
    expect(() => breadcrumbFor(unscoped)).not.toThrow();
    expect(breadcrumbFor(unscoped).length).toBeGreaterThan(0);
  });
});

describe("reset carries where it is going", () => {
  it("returns to the solar system by default", () => {
    const next = journeyReducer(AT_GALAXY, { type: "reset" });
    expect(next).toEqual(AT_SOLAR_SYSTEM);
  });

  it("goes all the way out when asked for the galaxy", () => {
    const next = journeyReducer(AT_SOLAR_SYSTEM, { type: "reset", to: "galaxy" });
    expect(next).toEqual(AT_GALAXY);
  });

  it("hands back a fresh journey either way, so neither stage is swallowed", () => {
    // Same reason the default stage spreads: `useReducer` bails on identity,
    // and the second press is pressed precisely when nothing else has changed.
    expect(journeyReducer(AT_GALAXY, { type: "reset", to: "galaxy" })).not.toBe(AT_GALAXY);
    expect(journeyReducer(AT_SOLAR_SYSTEM, { type: "reset" })).not.toBe(AT_SOLAR_SYSTEM);
  });
});
