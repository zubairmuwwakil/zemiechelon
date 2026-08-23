import { describe, expect, it } from "vitest";
import { loadBodies } from "../bodies";
import { moonScopeId, planetScopeId } from "../galaxy";
import { landingMode, resolveBodySelection } from "../navigation";
import { declaresSurface } from "../surfaces";

const bodies = loadBodies();

describe("selecting a body", () => {
  it("opens the card for whatever was tapped, unless tapping it lands", () => {
    for (const body of bodies.slice(0, 8)) {
      const selection = resolveBodySelection(body.id, bodies);
      if (!selection.landed) expect(selection.cardId).toBe(body.id);
    }
  });

  it("flies to a shipped system and does not land on it", () => {
    // Spec §6: tapping an unlanded moon opens its card and does not enter a
    // landed state. Every moon is a flyby until it declares a surface.
    const moon = bodies.find((b) => b.kind === "system" && b.id !== "PickMe")!;
    const selection = resolveBodySelection(moon.id, bodies);
    expect(selection.flyTo).toBe(moonScopeId(moon.id));
    expect(selection.landed).toBe(false);
    expect(selection.cardId).toBe(moon.id);
  });

  it("returns the planet a flyby should ascend back to, not the galaxy", () => {
    // Spec §2 found that ascending one level at a time feels right. A flyby
    // adds a level, so its way out is the planet it flew from.
    const moon = bodies.find((b) => b.kind === "system")!;
    expect(resolveBodySelection(moon.id, bodies).ascendTo).toBe(planetScopeId(moon.arm));
  });

  it("leaves the camera alone for a repository on the arm", () => {
    // An arm body is a card, not a place. Flying to every dot in the field
    // would make the map twitch at every click.
    const star = bodies.find((b) => b.kind === "star" && !b.anonymous)!;
    const selection = resolveBodySelection(star.id, bodies);
    expect(selection.flyTo).toBeNull();
    expect(selection.ascendTo).toBeNull();
  });

  it("does not throw on an id that is not a body", () => {
    const selection = resolveBodySelection("not-a-repo", bodies);
    expect(selection.cardId).toBe("not-a-repo");
    expect(selection.flyTo).toBeNull();
  });

  it("lands on a moon that declares a surface, and opens no card", () => {
    // Spec §4: a visitor lands on PickMe and walks up to the console. A card
    // is the flyby's payload — a landing is the place itself.
    const selection = resolveBodySelection("PickMe", bodies);
    expect(selection.landed).toBe(true);
    expect(selection.flyTo).toBe(moonScopeId("PickMe"));
    expect(selection.cardId).toBeNull();
  });

  it("lands on exactly the moons that declare a surface, and no others", () => {
    for (const body of bodies) {
      const expected = body.kind === "system" && declaresSurface(moonScopeId(body.id), bodies);
      expect(resolveBodySelection(body.id, bodies).landed).toBe(expected);
    }
  });
});

describe("how a planet should be landed on", () => {
  it("stands on the surface when there is room and motion is allowed", () => {
    expect(
      landingMode({ scopeId: planetScopeId("products"), viewportWidth: 1280, reducedMotion: false, bodies }),
    ).toBe("surface");
  });

  it("falls back to the panel on a narrow viewport", () => {
    // Spec §3.1: the panel survives where flying to a surface is the wrong
    // interaction. It stops being the primary path; it does not stop existing.
    expect(
      landingMode({ scopeId: planetScopeId("products"), viewportWidth: 480, reducedMotion: false, bodies }),
    ).toBe("panel");
  });

  it("falls back to the panel when motion is reduced", () => {
    expect(
      landingMode({ scopeId: planetScopeId("products"), viewportWidth: 1280, reducedMotion: true, bodies }),
    ).toBe("panel");
  });

  it("falls back to the panel for a planet with no ground to stand on", () => {
    expect(
      landingMode({ scopeId: planetScopeId("labs"), viewportWidth: 1280, reducedMotion: false, bodies }),
    ).toBe("panel");
  });
});
