import { describe, expect, it } from "vitest";
import { loadBodies } from "../bodies";
import { moonScopeId, planetScopeId } from "../galaxy";
import { resolveBodySelection } from "../navigation";

const bodies = loadBodies();

describe("selecting a body", () => {
  it("opens the card for whatever was tapped", () => {
    for (const body of bodies.slice(0, 8)) {
      expect(resolveBodySelection(body.id, bodies).cardId).toBe(body.id);
    }
  });

  it("flies to a shipped system and does not land on it", () => {
    // Spec §6: tapping an unlanded moon opens its card and does not enter a
    // landed state. Every moon is a flyby until it declares a surface.
    const moon = bodies.find((b) => b.kind === "system" && b.id !== "PickMe")!;
    const selection = resolveBodySelection(moon.id, bodies);
    expect(selection.flyTo).toBe(moonScopeId(moon.id));
    expect(selection.landed).toBe(false);
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

  it("never reports landed, because nothing lands yet", () => {
    // This flips for PickMe when the surface camera lands. Pinning it now
    // means that change has to be deliberate rather than incidental.
    for (const body of bodies) {
      expect(resolveBodySelection(body.id, bodies).landed).toBe(false);
    }
  });
});
