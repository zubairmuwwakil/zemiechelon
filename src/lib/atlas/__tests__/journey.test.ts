import { describe, expect, it } from "vitest";
import { loadBodies } from "../bodies";
import { moonScopeId, planetScopeId } from "../galaxy";
import { SCOPES, SOLAR_SYSTEM_ZEMI } from "../scopes";
import { declaresSurface } from "../surfaces";
import {
  AT_SOLAR_SYSTEM,
  ascendFrom,
  framingFor,
  journeyReducer,
  positionFor,
  scopeIdFor,
  activeArm,
  standingScope,
  panelScope,
  deepLinkBodyId,
  type Journey,
} from "../journey";

const bodies = loadBodies();
const WIDE = { viewportWidth: 1280, reducedMotion: false };
const NARROW = { viewportWidth: 480, reducedMotion: false };

/** Apply a sequence of events, as a session would. */
function walk(...events: Parameters<typeof journeyReducer>[1][]): Journey {
  return events.reduce(journeyReducer, AT_SOLAR_SYSTEM);
}

describe("where the visitor starts", () => {
  it("starts at the galaxy with nothing open over it", () => {
    expect(AT_SOLAR_SYSTEM.position.kind).toBe("solarSystem");
    expect(AT_SOLAR_SYSTEM.card).toBeNull();
    expect(AT_SOLAR_SYSTEM.console).toBeNull();
  });
});

describe("selecting an arm from the nav", () => {
  it("frames an arm that has shipped nothing from orbit", () => {
    // `creative` has no scope of its own, so there is nothing to land in.
    // Clicking it has always framed the planet, and still does.
    const { position } = walk({ type: "selectSector", sectorId: "creative", ...WIDE });
    expect(position).toEqual({ kind: "planet", arm: "creative", mode: "orbit" });
  });

  it("stands on an arm that declares a surface, when there is room", () => {
    const { position } = walk({ type: "selectSector", sectorId: "products", ...WIDE });
    expect(position).toEqual({ kind: "planet", arm: "products", mode: "surface" });
  });

  it("opens the panel instead on a viewport too narrow to stand up in", () => {
    const { position } = walk({ type: "selectSector", sectorId: "products", ...NARROW });
    expect(position).toEqual({ kind: "planet", arm: "products", mode: "panel" });
  });

  it("opens the panel instead when the visitor asked for less motion", () => {
    const { position } = walk({
      type: "selectSector", sectorId: "products", viewportWidth: 1280, reducedMotion: true,
    });
    expect(position).toEqual({ kind: "planet", arm: "products", mode: "panel" });
  });

  it("opens the panel for a landable arm with no ground to stand on", () => {
    const { position } = walk({ type: "selectSector", sectorId: "labs", ...WIDE });
    expect(position).toEqual({ kind: "planet", arm: "labs", mode: "panel" });
  });

  it("reads 'planet-self' and 'founder' as the same arm", () => {
    const a = walk({ type: "selectSector", sectorId: "planet-self", ...WIDE });
    const b = walk({ type: "selectSector", sectorId: "founder", ...WIDE });
    expect(a.position).toEqual(b.position);
    expect(activeArm(a)).toBe("self");
  });

  it("goes back to the galaxy when the core is selected", () => {
    expect(walk({ type: "selectSector", sectorId: "solarSystem", ...WIDE })).toEqual(AT_SOLAR_SYSTEM);
    expect(walk({ type: "selectSector", sectorId: "overview", ...WIDE })).toEqual(AT_SOLAR_SYSTEM);
  });
});

describe("selecting a body", () => {
  it("flies to a shipped system and carries its card", () => {
    const moon = bodies.find((b) => b.kind === "moon" && !declaresSurface(moonScopeId(b.id), bodies))!;
    const journey = walk({ type: "selectBody", bodyId: moon.id });
    expect(journey.position).toEqual({ kind: "moon", bodyId: moon.id, mode: "flyby" });
    expect(journey.card).toBe(moon.id);
  });

  it("lands on a system that declares a surface, and opens no card", () => {
    const journey = walk({ type: "selectBody", bodyId: "PickMe" });
    expect(journey.position).toEqual({ kind: "moon", bodyId: "PickMe", mode: "surface" });
    expect(journey.card).toBeNull();
  });

  it("opens a card for an arm body without moving the camera", () => {
    const star = bodies.find((b) => b.kind === "dwarfPlanet" && !b.anonymous)!;
    const before = walk({ type: "selectSector", sectorId: "creative", ...WIDE });
    const after = journeyReducer(before, { type: "selectBody", bodyId: star.id });
    expect(after.position).toEqual(before.position);
    expect(after.card).toBe(star.id);
  });

  it("does not throw on an id that is not a body", () => {
    expect(() => walk({ type: "selectBody", bodyId: "not-a-repo" })).not.toThrow();
  });
});

describe("ascending is one level, and the level comes from the scope tree", () => {
  it("ascends from a moon to its planet, not to the galaxy", () => {
    const journey = walk({ type: "selectBody", bodyId: "PickMe" }, { type: "ascend" });
    expect(journey.position).toEqual({ kind: "planet", arm: "products", mode: "orbit" });
  });

  it("ascends from a planet to the galaxy", () => {
    const journey = walk(
      { type: "selectSector", sectorId: "products", ...WIDE },
      { type: "ascend" },
    );
    expect(journey.position.kind).toBe("solarSystem");
  });

  it("stays at the galaxy when there is nowhere further out to go", () => {
    expect(journeyReducer(AT_SOLAR_SYSTEM, { type: "ascend" })).toEqual(AT_SOLAR_SYSTEM);
  });

  it("agrees with the scope tree for every scope that has a parent", () => {
    // The anti-drift guard. `flybyReturn` used to hold a hand-computed copy of
    // this same answer, and the copy is what went stale. If the scope tree ever
    // gains a level, this fails rather than the camera quietly ascending too far.
    for (const scope of Object.values(SCOPES)) {
      // The solar system itself is excluded: it has a parent (the galaxy), but
      // `Position` has no galaxy-level state to ascend into yet — that state is
      // deliberately deferred until a second solar system exists to navigate
      // between. See docs/superpowers/plans/... galaxy wrapper notes.
      if (!scope.parent || scope.id === SOLAR_SYSTEM_ZEMI.id) continue;
      const parent = ascendFrom(positionFor(scope.id), bodies);
      expect(scopeIdFor(parent), scope.id).toBe(scope.parent);
    }
  });

  it("puts down whatever was open on the way out", () => {
    // The bug this replaces: `leaveSurface` cleared three of the five state
    // slots and left the fourth pointing at the frame just departed.
    const journey = walk(
      { type: "selectBody", bodyId: "PickMe" },
      { type: "openConsole", consoleId: "PickMe" },
      { type: "ascend" },
    );
    expect(journey.card).toBeNull();
    expect(journey.console).toBeNull();
  });
});

describe("what is open over a position", () => {
  it("closing a flyby's card ascends to the planet it flew from", () => {
    const moon = bodies.find((b) => b.kind === "moon" && !declaresSurface(moonScopeId(b.id), bodies))!;
    const journey = walk({ type: "selectBody", bodyId: moon.id }, { type: "closeCard" });
    expect(journey.card).toBeNull();
    expect(journey.position).toEqual({ kind: "planet", arm: moon.arm, mode: "orbit" });
  });

  it("closing a card that was not a flyby leaves the position alone", () => {
    const star = bodies.find((b) => b.kind === "dwarfPlanet" && !b.anonymous)!;
    const before = walk({ type: "selectSector", sectorId: "creative", ...WIDE });
    const after = [{ type: "selectBody" as const, bodyId: star.id }, { type: "closeCard" as const }]
      .reduce(journeyReducer, before);
    expect(after.card).toBeNull();
    expect(after.position).toEqual(before.position);
  });

  it("switches a console on only where there is ground to stand on", () => {
    const standing = walk(
      { type: "selectBody", bodyId: "PickMe" },
      { type: "openConsole", consoleId: "PickMe" },
    );
    expect(standing.console).toBe("PickMe");

    const orbiting = walk(
      { type: "selectSector", sectorId: "creative", ...WIDE },
      { type: "openConsole", consoleId: "PickMe" },
    );
    expect(orbiting.console).toBeNull();
  });

  it("switches a console off without leaving the surface", () => {
    const journey = walk(
      { type: "selectBody", bodyId: "PickMe" },
      { type: "openConsole", consoleId: "PickMe" },
      { type: "closeConsole" },
    );
    expect(journey.console).toBeNull();
    expect(journey.position).toEqual({ kind: "moon", bodyId: "PickMe", mode: "surface" });
  });

  it("arriving somewhere new puts down what the last place had open", () => {
    // Two frames both claiming to be where you are is the failure this stops:
    // land on a planet, take its orrery to a moon, and the planet's console
    // must not still be open over the moon underfoot.
    const journey = walk(
      { type: "selectSector", sectorId: "products", ...NARROW },
      { type: "selectBody", bodyId: "PickMe" },
    );
    expect(journey.console).toBeNull();
    expect(journey.position).toEqual({ kind: "moon", bodyId: "PickMe", mode: "surface" });
  });

  it("resets to the galaxy with nothing open, from anywhere", () => {
    const journey = walk(
      { type: "selectBody", bodyId: "PickMe" },
      { type: "openConsole", consoleId: "PickMe" },
      { type: "reset" },
    );
    expect(journey).toEqual(AT_SOLAR_SYSTEM);
  });

  it("leaves nothing open behind when the core is selected from a surface", () => {
    // Today this is a no-op: selecting the core clears the preset and the
    // panel but leaves `standingScope` set, so the camera never leaves.
    const journey = walk(
      { type: "selectBody", bodyId: "PickMe" },
      { type: "selectSector", sectorId: "solarSystem", ...WIDE },
    );
    expect(journey).toEqual(AT_SOLAR_SYSTEM);
  });
});

describe("framing is resolved in one place", () => {
  it("frames a panelled planet exactly as an orbited one", () => {
    // The two differ in what is drawn over the scene, never in where the
    // camera is. Keeping that collapse here is what stops it being re-decided
    // by a fall-through chain inside the canvas.
    const panelled = walk({ type: "selectSector", sectorId: "labs", ...WIDE });
    const orbited = walk({ type: "selectSector", sectorId: "labs", ...NARROW });
    expect(framingFor(panelled)).toEqual(framingFor(orbited));
    expect(framingFor(panelled)).toEqual({ kind: "planet", arm: "labs" });
  });

  it("frames the galaxy at the root", () => {
    expect(framingFor(AT_SOLAR_SYSTEM)).toEqual({ kind: "solarSystem" });
  });

  it("names the surface to stand on, with the scope that has the ground", () => {
    const journey = walk({ type: "selectBody", bodyId: "PickMe" });
    expect(framingFor(journey)).toEqual({ kind: "surface", scope: moonScopeId("PickMe") });
  });

  it("names a flyby's own frame", () => {
    const moon = bodies.find((b) => b.kind === "moon" && !declaresSurface(moonScopeId(b.id), bodies))!;
    const journey = walk({ type: "selectBody", bodyId: moon.id });
    expect(framingFor(journey)).toEqual({ kind: "moon", scope: moonScopeId(moon.id) });
  });

  it("names a planet's surface by the scope that declares it", () => {
    const journey = walk({ type: "selectSector", sectorId: "products", ...WIDE });
    expect(framingFor(journey)).toEqual({ kind: "surface", scope: planetScopeId("products") });
  });
});

describe("naming a position", () => {
  it("names the galaxy's own scope at the root", () => {
    expect(scopeIdFor(AT_SOLAR_SYSTEM.position)).toBe(SOLAR_SYSTEM_ZEMI.id);
  });

  it("names nothing for an arm the map draws but does not scope", () => {
    // `creative` is drawn and can be framed; it is not a place you can be in.
    expect(scopeIdFor({ kind: "planet", arm: "creative", mode: "orbit" })).toBeNull();
  });

  it("reports the arm the HUD should highlight, at every depth", () => {
    expect(activeArm(AT_SOLAR_SYSTEM)).toBe("solarSystem");
    expect(activeArm(walk({ type: "selectBody", bodyId: "PickMe" }))).toBe("products");
    expect(activeArm(walk({ type: "selectSector", sectorId: "labs", ...WIDE }))).toBe("labs");
  });
});

describe("what the overlays need to know", () => {
  it("names the surface underfoot, and nothing when the visitor is in orbit", () => {
    expect(standingScope(walk({ type: "selectBody", bodyId: "PickMe" }))).toBe(moonScopeId("PickMe"));
    expect(standingScope(walk({ type: "selectSector", sectorId: "products", ...WIDE })))
      .toBe(planetScopeId("products"));
    expect(standingScope(walk({ type: "selectSector", sectorId: "creative", ...WIDE }))).toBeNull();
  });

  it("names the console panel's scope only where the panel is the landing", () => {
    // The panel and the surface are two different arrivals, so exactly one of
    // them names a scope at a time. Both naming one is the state that used to
    // put a console over ground the visitor was standing on.
    const panelled = walk({ type: "selectSector", sectorId: "labs", ...WIDE });
    expect(panelScope(panelled)).toBe(planetScopeId("labs"));
    expect(standingScope(panelled)).toBeNull();

    const standing = walk({ type: "selectSector", sectorId: "products", ...WIDE });
    expect(panelScope(standing)).toBeNull();
    expect(standingScope(standing)).toBe(planetScopeId("products"));
  });
});

describe("what the URL should say", () => {
  it("names the moon underfoot", () => {
    expect(deepLinkBodyId(walk({ type: "selectBody", bodyId: "PickMe" }))).toBe("PickMe");
  });

  it("names nothing while standing on a planet", () => {
    // A planet's surface names no repository, and a hash left pointing at the
    // last moon while the visitor stands on a planet is a link that lies.
    expect(deepLinkBodyId(walk({ type: "selectSector", sectorId: "products", ...WIDE }))).toBeNull();
  });

  it("names the open card when the visitor is not standing anywhere", () => {
    const star = bodies.find((b) => b.kind === "dwarfPlanet" && !b.anonymous)!;
    expect(deepLinkBodyId(walk({ type: "selectBody", bodyId: star.id }))).toBe(star.id);
  });

  it("names nothing at the galaxy with nothing open", () => {
    expect(deepLinkBodyId(AT_SOLAR_SYSTEM)).toBeNull();
  });
});
