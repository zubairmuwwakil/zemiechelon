import type { Body, ScopeId } from "./types";
import { allBodies } from "./bodies";
import { moonScopeId, planetScopeId } from "./galaxy";
import { GALAXY_ZEMI, SOLAR_SYSTEM_ZEMI, SCOPES } from "./scopes";
import { landingMode, resolveBodySelection } from "./navigation";

/**
 * Where the visitor is, and what is open over it. One value.
 *
 * This replaces five independent `useState` slots — a camera preset, a landed
 * scope, a flyby scope, a standing scope and a return pointer — that between
 * them encoded exactly this one fact. Independent slots made every arrival
 * responsible for clearing the four it was not setting, twenty-four
 * assignments in all, and a missed one is invisible: `leaveSurface` cleared
 * three and left the fourth pointing at the frame just departed, which pinned
 * the camera to ground the visitor had asked to leave.
 *
 * The union is the fix, not the tidying. A `Position` cannot say "standing on
 * the galaxy" or "flying past a planet", so those states stop needing to be
 * ruled out by hand at each of the six call sites that set them.
 */
export type PlanetMode = "orbit" | "panel" | "surface";
export type MoonMode = "flyby" | "surface";

/**
 * A planet or moon position carries no system field. `planetScopeId(arm)` and
 * `moonScopeId(bodyId)` are globally unique — `validateGalaxy` in `galaxy.ts`
 * is what makes that true — so which solar system a planet or moon belongs to
 * is read off `Scope.parent`, not stored here. A stored copy of that answer is
 * the shape every drift in this scene has taken; see `ascendFrom`.
 */
export type Position =
  | { kind: "galaxy" }
  | { kind: "solarSystem"; id: ScopeId }
  /**
   * An arm, whether or not it has a scope. All five planets are drawn; only the
   * arms that have shipped enough get a scope, so `arm` rather than a `ScopeId`
   * is the only name that fits every planet the nav can select.
   */
  | { kind: "planet"; arm: string; mode: PlanetMode }
  | { kind: "moon"; bodyId: string; mode: MoonMode };

export interface Journey {
  readonly position: Position;
  /** The body card open over this position, or null. */
  readonly card: string | null;
  /** The surface console switched on at this position, or null. */
  readonly console: string | null;
}

/**
 * What the camera should do about a position.
 *
 * Deliberately coarser than `Position`: `orbit` and `panel` frame a planet
 * identically and differ only in what is drawn over the scene, so the collapse
 * happens here, once. It used to happen inside the canvas as a fall-through
 * chain over four props — which is how two of the five arms came to take a
 * different camera path from the other three for two commits.
 */
export type Framing =
  | { kind: "galaxy" }
  | { kind: "solarSystem"; scope: ScopeId }
  | { kind: "planet"; arm: string }
  | { kind: "moon"; scope: ScopeId }
  | { kind: "surface"; scope: ScopeId };

export type JourneyEvent =
  | { type: "selectSector"; sectorId: string; viewportWidth: number; reducedMotion: boolean }
  | { type: "selectBody"; bodyId: string }
  | { type: "selectSolarSystem"; id: ScopeId }
  | { type: "openConsole"; consoleId: string }
  | { type: "closeConsole" }
  | { type: "closeCard" }
  | { type: "ascend" }
  | { type: "reset" };

export const AT_GALAXY: Journey = { position: { kind: "galaxy" }, card: null, console: null };

export const AT_SOLAR_SYSTEM: Journey = {
  position: { kind: "solarSystem", id: SOLAR_SYSTEM_ZEMI.id },
  card: null,
  console: null,
};

/** The arm a nav control names. `founder` is a retained alias for `self`. */
function armOf(sectorId: string): string {
  const arm = sectorId.replace(/^planet-/, "");
  return arm === "founder" ? "self" : arm;
}

function bodyArm(bodyId: string, bodies: Body[]): string | null {
  return bodies.find((b) => b.id === bodyId)?.arm ?? null;
}

/** The position a scope id names, at its own outermost mode. */
export function positionFor(scopeId: ScopeId): Position {
  if (scopeId.startsWith("moon:")) {
    return { kind: "moon", bodyId: scopeId.slice("moon:".length), mode: "flyby" };
  }
  if (scopeId.startsWith("planet:")) {
    return { kind: "planet", arm: scopeId.slice("planet:".length), mode: "orbit" };
  }
  if (scopeId.startsWith("solarSystem:")) return { kind: "solarSystem", id: scopeId };
  return { kind: "galaxy" };
}

/**
 * The scope a position names, or null where the map draws the place but does
 * not scope it. Three of the five arms are exactly that: drawn, framable, and
 * not somewhere you can be inside.
 */
export function scopeIdFor(position: Position): ScopeId | null {
  switch (position.kind) {
    case "galaxy":
      return GALAXY_ZEMI.id;
    case "solarSystem":
      return position.id;
    case "planet": {
      const id = planetScopeId(position.arm);
      return SCOPES[id] ? id : null;
    }
    case "moon":
      return moonScopeId(position.bodyId);
  }
}

/**
 * One level out.
 *
 * The level comes from the map's own nesting rather than from a pointer stored
 * alongside it. `flybyReturn` used to hold a hand-computed copy of this answer
 * — the same value `deriveMoonScopes` already puts in `Scope.parent` — and a
 * stored copy of a derived fact is the shape every drift in this scene has
 * taken. `journey.test.ts` asserts this agrees with the scope tree for every
 * scope that has a parent, so the two cannot separate quietly.
 */
export function ascendFrom(position: Position, bodies: Body[] = allBodies()): Position {
  switch (position.kind) {
    case "galaxy":
      return { kind: "galaxy" };
    case "solarSystem":
      return { kind: "galaxy" };
    case "planet": {
      // The system the tree says this planet is in. An arm with no scope is
      // drawn but not somewhere you can be inside, so it falls back to the
      // atlas — the same answer it gave before there were two systems.
      const scope = SCOPES[planetScopeId(position.arm)];
      return { kind: "solarSystem", id: scope?.parent ?? SOLAR_SYSTEM_ZEMI.id };
    }
    case "moon": {
      const arm = bodyArm(position.bodyId, bodies);
      return arm
        ? { kind: "planet", arm, mode: "orbit" }
        : { kind: "solarSystem", id: SOLAR_SYSTEM_ZEMI.id };
    }
  }
}

/** The arm the HUD should show as active, at any depth. */
export function activeArm(journey: Journey, bodies: Body[] = allBodies()): string {
  const { position } = journey;
  if (position.kind === "planet") return position.arm;
  if (position.kind === "moon") return bodyArm(position.bodyId, bodies) ?? "solarSystem";
  return "solarSystem";
}

/** Whether the visitor is on the ground, at either depth. */
export function isStanding(position: Position): boolean {
  return position.kind !== "galaxy" && position.kind !== "solarSystem" && position.mode === "surface";
}

/** The scope whose surface the visitor is standing on, or null in orbit. */
export function standingScope(journey: Journey): ScopeId | null {
  return isStanding(journey.position) ? scopeIdFor(journey.position) : null;
}

/**
 * The scope whose landed console panel is open, or null.
 *
 * Exactly one of this and `standingScope` names a scope at a time, because
 * `PlanetMode` cannot be both — which is what stops a console being drawn over
 * ground the visitor is standing on.
 */
export function panelScope(journey: Journey): ScopeId | null {
  const { position } = journey;
  return position.kind === "planet" && position.mode === "panel"
    ? scopeIdFor(position)
    : null;
}

/**
 * The body the URL hash should name, or null for a URL that should say nothing.
 *
 * Standing somewhere outranks whatever card is open, because the hash is a link
 * to *where the visitor is* — and a planet's surface names no repository, so it
 * deliberately names nothing rather than leaving the last moon in the bar,
 * which would be a link that lies about where they are.
 */
export function deepLinkBodyId(journey: Journey): string | null {
  const { position } = journey;
  if (isStanding(position)) {
    return position.kind === "moon" ? position.bodyId : null;
  }
  return journey.card;
}

export function framingFor(journey: Journey): Framing {
  const { position } = journey;
  switch (position.kind) {
    case "galaxy":
      return { kind: "galaxy" };
    case "solarSystem":
      return { kind: "solarSystem", scope: position.id };
    case "planet": {
      const scope = scopeIdFor(position);
      // Only a scoped arm can declare ground, so a surface always has a scope.
      if (position.mode === "surface" && scope) return { kind: "surface", scope };
      return { kind: "planet", arm: position.arm };
    }
    case "moon": {
      const scope = moonScopeId(position.bodyId);
      return position.mode === "surface"
        ? { kind: "surface", scope }
        : { kind: "moon", scope };
    }
  }
}

/**
 * How arriving, leaving and opening things move the visitor.
 *
 * Every branch returns a whole `Journey`. That is the point: there is no way to
 * set where you are and forget to put down what the last place had open,
 * because they are not separate things to set.
 */
export function journeyReducer(journey: Journey, event: JourneyEvent): Journey {
  const bodies = allBodies();

  switch (event.type) {
    case "selectSector": {
      const arm = armOf(event.sectorId);
      if (arm === "solarSystem" || arm === "overview") return AT_SOLAR_SYSTEM;

      const scopeId = planetScopeId(arm);
      // An arm that has shipped nothing has no scope to land in. Clicking it
      // frames the planet, which is what clicking it has always done.
      if (!SCOPES[scopeId]) {
        return { position: { kind: "planet", arm, mode: "orbit" }, card: null, console: null };
      }
      const mode = landingMode({
        scopeId,
        viewportWidth: event.viewportWidth,
        reducedMotion: event.reducedMotion,
        bodies,
      });
      return { position: { kind: "planet", arm, mode }, card: null, console: null };
    }

    case "selectBody": {
      const selection = resolveBodySelection(event.bodyId, bodies);
      // An arm body is a card, not a place: flying to every dot in the field
      // would make the map twitch at every click.
      if (!selection.flyTo) return { ...journey, card: selection.cardId };
      return {
        position: {
          kind: "moon",
          bodyId: event.bodyId,
          mode: selection.landed ? "surface" : "flyby",
        },
        card: selection.cardId,
        console: null,
      };
    }

    case "selectSolarSystem":
      return { position: { kind: "solarSystem", id: event.id }, card: null, console: null };

    case "openConsole":
      // A console is a thing you walk up to and switch on, so there has to be
      // ground under it. Guarded here rather than trusted to the caller.
      return isStanding(journey.position)
        ? { ...journey, console: event.consoleId }
        : journey;

    case "closeConsole":
      return { ...journey, console: null };

    case "closeCard":
      // A flyby's card IS the flyby's payload, so closing it leaves the frame.
      // A card opened over somewhere you are staying just closes.
      return journey.position.kind === "moon" && journey.position.mode === "flyby"
        ? { position: ascendFrom(journey.position, bodies), card: null, console: null }
        : { ...journey, card: null };

    case "ascend":
      return { position: ascendFrom(journey.position, bodies), card: null, console: null };

    case "reset":
      return AT_SOLAR_SYSTEM;
  }
}
