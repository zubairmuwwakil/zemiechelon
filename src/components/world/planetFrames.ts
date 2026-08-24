import * as THREE from "three";
import type { WorldSceneBuilder } from "./WorldSceneBuilder";
import { PLANET_CENTERS } from "./WorldCameraManager";

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
 * is not a planet at all, and the callers would rather skip it than guess.
 */
export function planetFrame(builder: WorldSceneBuilder, id: string): DrawnFrame | null {
  // The core is the galaxy's own origin, which the pattern turns about, so it
  // is the one frame whose offset is exactly zero and stays there.
  if (id === "galaxy") return { frame: builder.rootGroup, offset: new THREE.Vector3() };

  const group = builder.scopeGroups.get(`planet:${id}`);
  if (group) return { frame: group, offset: new THREE.Vector3() };

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
