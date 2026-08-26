import * as THREE from "three";
import type { WorldSceneBuilder } from "./WorldSceneBuilder";
import { PLANET_CENTERS, PLANET_RADII } from "./WorldCameraManager";
import type { Body, ScopeId } from "@/lib/atlas/types";
import type { Framing } from "@/lib/atlas/journey";
import { getScope } from "@/lib/atlas/scopes";
import { systemReach } from "@/lib/atlas/galaxyPlacement";

/**
 * A live handle on where a body is DRAWN: a scene-graph frame plus a fixed
 * point in that frame's local space.
 *
 * A pair rather than a bare `Object3D`, because **a planet is drawn whether or
 * not it has a scope.** Only arms that have shipped enough get a scope group —
 * today `labs` and `products`, two of five — while all five are drawn, as rows
 * of the planet `InstancedMesh` placed inside `rootGroup`. The three without a
 * group have no object of their own to hand out, so they are named the only
 * other way there is: their layout centre, in the frame that carries it.
 *
 * Both cases resolve through a live world matrix, which is the whole point.
 * The pattern's rotation (motion design §3.2) is in that matrix either way, so
 * §3.7's "positions become live reads" holds for a planet with a scope and one
 * without, with no second code path. What is NOT allowed is reading
 * `PLANET_CENTERS` as a world position: that is what left the pins behind when
 * the galaxy started turning, and what left `setPreset` framing the place a
 * planet occupied at t=0.
 */
export interface DrawnFrame {
  /** The scene-graph object whose world matrix carries the body. */
  frame: THREE.Object3D;
  /** A point in `frame`'s LOCAL space; the origin when `frame` is the body. */
  offset: THREE.Vector3;
}

/**
 * Where a planet — or the core — is drawn, resolvable at any instant.
 *
 * Returns null for an id that is neither: an arm with no scope and no placement
 * is not a planet at all, and the callers would rather skip it than guess. An
 * arm belonging to a DIFFERENT solar system is the same answer for the same
 * reason — it is not a planet *here*.
 */
export function planetFrame(builder: WorldSceneBuilder, id: string): DrawnFrame | null {
  // The core is the solar system's own origin, which the pattern turns about,
  // so it is the one frame whose offset is exactly zero and stays there.
  if (id === "solarSystem") return { frame: builder.rootGroup, offset: new THREE.Vector3() };

  const group = builder.scopeGroups.get(`planet:${id}`);
  if (group) return { frame: group, offset: new THREE.Vector3() };

  // `PLANET_CENTERS` is the whole galaxy's table — it answers for every arm in
  // every system, and says so. What it does NOT carry is which frame a centre
  // belongs in: each is expressed in its own system's local space, and this
  // function composes it through whatever builder it was handed. With one
  // solar system that distinction could not be observed. With two it is the
  // difference between a pin and a pin over another system's planet, drawn
  // inside this one. The system's own arm table is the authority on what this
  // scene draws.
  if (!(id in builder.scope.arms)) return null;

  const center = PLANET_CENTERS[id];
  if (!center) return null;
  // Cloned: `PLANET_CENTERS` is the layout constant, and a caller that wrote
  // through this handle would corrupt the map's own placement authority.
  return { frame: builder.rootGroup, offset: center.clone() };
}

/** Resolve a `DrawnFrame` to a world position, right now. */
export function drawnWorldPosition(
  drawn: DrawnFrame,
  out: THREE.Vector3 = new THREE.Vector3(),
): THREE.Vector3 {
  drawn.frame.updateWorldMatrix(true, false);
  return out.copy(drawn.offset).applyMatrix4(drawn.frame.matrixWorld);
}

/** A drawn frame together with how large the thing in it is. */
export interface FramedBody extends DrawnFrame {
  radius: number;
}

/**
 * What `descend` needs, for a framing that names a body.
 *
 * The camera never learns what a scope is: it is handed a frame, a point in
 * that frame and a size, exactly as `descend` already asked for. What this adds
 * is that **one** function answers for a planet with a scope, a planet without
 * one, and a moon — so the canvas no longer decides between them with a
 * fall-through chain over four props, which is where two of the five arms
 * quietly took a different camera path from the other three.
 *
 * Returns null rather than throwing for anything this scene does not draw. A
 * sixth arm named before its data ships is a quiet no-op, the same answer the
 * pins already give.
 */
export function framedBody(
  builder: WorldSceneBuilder,
  bodies: Body[],
  framing: Extract<Framing, { kind: "planet" | "moon" }>,
): FramedBody | null {
  if (framing.kind === "planet") {
    const drawn = planetFrame(builder, framing.arm);
    const radius = PLANET_RADII[framing.arm];
    return drawn && radius !== undefined ? { ...drawn, radius } : null;
  }

  const group = builder.scopeGroups.get(framing.scope);
  if (!group) return null;
  const body = bodies.find((b) => b.id === framing.scope.slice("moon:".length));
  if (!body) return null;
  // Read back from the builder rather than re-derived: it is the only place
  // `MOON_SIZE` is applied, so there stays one definition of how large a moon
  // is drawn.
  return { frame: group, offset: new THREE.Vector3(), radius: builder.moonDrawnRadius(body.arm) };
}

/**
 * A whole solar system, as something to frame.
 *
 * Its radius is the system's own reach, so descending on a system frames the
 * disc rather than the sun at its centre — the same rule `framedBody` follows
 * for a planet, one level up.
 *
 * Routed through `descend` rather than given a pose of its own, unlike the
 * galaxy: a system's root rides the galaxy frame and its own pattern turns
 * inside it, so where it is drawn is a live read at every instant.
 */
export function framedSystem(
  builders: Map<ScopeId, WorldSceneBuilder>,
  scopeId: ScopeId,
): FramedBody | null {
  const builder = builders.get(scopeId);
  if (!builder) return null;
  return {
    frame: builder.rootGroup,
    offset: new THREE.Vector3(),
    radius: systemReach(getScope(scopeId)),
  };
}
