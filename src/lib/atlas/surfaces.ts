import type { Body, ScopeId } from "./types";
import { moonScopeId, planetScopeId } from "./galaxy";
import { loadBodies } from "./bodies";
import { derivePlanets, deriveWorldRadius } from "./planets";
import { ENGINE_IDS } from "@/lib/engines/registry";

/**
 * The pose a visitor stands in, as ratios of the shard's own radius.
 *
 * Measured, not chosen. At altitude 0.10 R and horizontal offset 0.65 R the
 * camera pitches 8.7 degrees below horizontal, the shard's far edge lands 39%
 * down the frame, and the ground fills the bottom 61%. Below about 0.04 the
 * frame sees past the shard's near rim; above about 0.20 it starts reading as a
 * table seen from above, and at 0.35 the parent leaves through the top of the
 * frame entirely — half the field of view is 21 degrees, and that is a ceiling
 * rather than a preference.
 *
 * These are ratios because the landed frame is scale-invariant in R: the camera
 * scales with the shard, so the composition is identical whether the shard is
 * two units across or seven. Shard radius is decided by the constraints below,
 * not by how the landed shot looks.
 */
export const SURFACE_ALTITUDE_RATIO = 0.1;
export const SURFACE_OFFSET_RATIO = 0.65;

/**
 * A shard is 1.5x the drawn radius of the body it replaces.
 *
 * Bounded at both ends by things outside the landed frame. Below about 1.25x
 * the camera's near plane clips the ground out from under the visitor, since
 * the nearest ground a standing pose can see is only `0.202 * R` away. Above
 * about 2.24x the shard reaches into the neighbouring moon's orbit lane — the
 * four moons of Products are evenly spaced 4.735 scene units apart, and the
 * shard's top face lies in that same plane. 1.5x sits mid-band and puts the
 * shard's full width at just under the parent's radius, so the ground a visitor
 * stands on cannot compete with the body it belongs to.
 */
export const SHARD_RADIUS_MULTIPLE = 1.5;

/** Moon drawn radius as a fraction of its planet's. Mirrors MOON_SIZE in the builder. */
const MOON_SIZE = 0.34;

/**
 * Layout units -> scene units.
 *
 * The same quotient `SCENE_SCALE` is, taken from the same function rather than
 * re-derived: a second way of computing it is a second thing to drift. It lives
 * here rather than being imported from `WorldCameraManager` only so this module
 * stays free of three.js and testable without a GL context.
 */
const ASTROLABE_OUTER = 205;

function sceneScale(bodies: Body[]): number {
  return ASTROLABE_OUTER / deriveWorldRadius(bodies);
}

/**
 * Evidence, as a predicate rather than as a list.
 *
 * Spec §3.3 gives a surface only where there is something to stand on, and §1
 * says what that means precisely: a console backed by an engine that ships,
 * not a console made of hardcoded strings. Inunity carries a `consoleId` and
 * stays a flyby because no engine ships behind it.
 *
 * Writing it this way makes §3.3's closing promise literally true — "when one
 * earns evidence, its flyby becomes a landing" happens by adding the engine,
 * with no edit here.
 */
function hasEvidence(body: Body): boolean {
  return body.consoleId !== undefined && ENGINE_IDS.has(body.consoleId);
}

/** The scopes a visitor can stand on, derived from where the evidence is. */
export function surfaceScopeIds(bodies: Body[] = loadBodies()): ScopeId[] {
  const ids: ScopeId[] = [];
  const arms = new Set<string>();

  for (const body of bodies) {
    if (!hasEvidence(body)) continue;
    if (body.kind === "system") ids.push(moonScopeId(body.id));
    // A planet earns a ground when something in it has evidence — which is the
    // reasoning §7 already gave for why Products gets a diorama and the others
    // do not, stated as a rule rather than restated as a decision.
    arms.add(body.arm);
  }

  for (const arm of arms) ids.push(planetScopeId(arm));
  return ids;
}

export function declaresSurface(scopeId: ScopeId, bodies: Body[] = loadBodies()): boolean {
  return surfaceScopeIds(bodies).includes(scopeId);
}

/**
 * The drawn radius of the shard for a scope, in scene units.
 *
 * A moon's shard is sized against the moon's own drawn radius; a planet's
 * against the planet's. Both go through the same multiple, so the ratio the
 * spike measured holds at either depth.
 */
export function shardRadiusFor(scopeId: ScopeId, bodies: Body[] = loadBodies()): number {
  if (!declaresSurface(scopeId, bodies)) {
    // Loud, not defaulted. A plausible number here would put a visitor on a
    // surface the spec says does not exist, and nothing downstream would know.
    throw new Error(`scope "${scopeId}" declares no surface`);
  }

  const scale = sceneScale(bodies);
  const planets = new Map(derivePlanets(bodies).map((p) => [p.arm, p.radius * scale]));

  if (scopeId.startsWith("planet:")) {
    const arm = scopeId.slice("planet:".length);
    const radius = planets.get(arm);
    if (radius === undefined) throw new Error(`arm "${arm}" has no planet`);
    return radius * SHARD_RADIUS_MULTIPLE;
  }

  const bodyId = scopeId.slice("moon:".length);
  const body = bodies.find((b) => b.id === bodyId);
  if (!body) throw new Error(`no body for scope "${scopeId}"`);
  const planetRadius = planets.get(body.arm);
  if (planetRadius === undefined) throw new Error(`arm "${body.arm}" has no planet`);
  return planetRadius * MOON_SIZE * SHARD_RADIUS_MULTIPLE;
}

/**
 * A thing standing on a surface.
 *
 * Spec §7 risk 1 names the trap: a surface is a lot of authored geometry, and
 * authored is what this project has avoided. The split that keeps it honest is
 * that the *vocabulary* is authored — what a prop looks like — while the
 * *arrangement* is derived from the bodies actually in the scope. Nothing here
 * is a coordinate somebody chose.
 */
export interface SurfaceProp {
  id: string;
  label: string;
  /**
   * A private repository. It still stands — the work supported the ventures
   * either way, and leaving it out would understate the ground — but it is
   * drawn without a name, exactly as the arm already draws it.
   */
  anonymous: boolean;
  /** Radians around the shard's centre. Fanned across the set, not hashed. */
  angle: number;
  /** Distance from the shard's centre, in scene units. */
  distance: number;
  /** Drawn height, in scene units. */
  height: number;
}

/** Props occupy this band of the shard, as fractions of its radius. */
const PROP_BAND = { inner: 0.34, outer: 0.68 } as const;
const PROP_HEIGHT = 0.16;

/**
 * What stands on a scope's ground.
 *
 * A planet's ground is its supporting work: the repositories in its arm that
 * did not ship as systems (§3.5). What shipped orbits overhead; what supported
 * it is the ground it stands on. Those keep their galaxy parent and stay drawn
 * on the arm — rendering them here is level of detail, not reparenting.
 *
 * Private repositories are included. Two of the seven §3.5 names are anonymous,
 * and dropping them would understate the ground the argument rests on; the atlas
 * already draws them on the arm and only withholds them from lists. They stand
 * here unnamed, which is the same treatment.
 *
 * A moon's ground carries the moon's own satellites, which is what §4 describes
 * a visitor finding when they land on PickMe.
 *
 * Ordered by birth and fanned across the set, for the reason `placeBodies` is a
 * function of the set rather than of each body: only knowing the neighbours can
 * guarantee they do not stack.
 */
export function surfacePropsFor(
  scopeId: ScopeId,
  bodies: Body[] = loadBodies(),
): SurfaceProp[] {
  if (!declaresSurface(scopeId, bodies)) return [];

  const radius = shardRadiusFor(scopeId, bodies);
  const entries: { id: string; label: string; anonymous: boolean }[] = [];

  if (scopeId.startsWith("planet:")) {
    const arm = scopeId.slice("planet:".length);
    entries.push(
      ...bodies
        .filter((b) => b.arm === arm && b.kind !== "system")
        .sort((a, b) => a.bornAt.localeCompare(b.bornAt) || a.id.localeCompare(b.id))
        .map((b) => ({ id: b.id, label: b.label, anonymous: b.anonymous })),
    );
  } else {
    const body = bodies.find((b) => b.id === scopeId.slice("moon:".length));
    entries.push(
      ...(body?.satellites ?? []).map((s) => ({
        id: s.id,
        label: s.label,
        anonymous: false,
      })),
    );
  }

  const count = entries.length;
  return entries.map((entry, i) => {
    // A lone prop sits mid-band rather than dividing by zero at the rim.
    const t = count === 1 ? 0.5 : i / (count - 1);
    return {
      ...entry,
      angle: (i / count) * Math.PI * 2,
      distance: radius * (PROP_BAND.inner + t * (PROP_BAND.outer - PROP_BAND.inner)),
      height: radius * PROP_HEIGHT,
    };
  });
}
