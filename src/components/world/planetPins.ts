import * as THREE from "three";
import type { WorldSceneBuilder } from "./WorldSceneBuilder";
import { drawnWorldPosition, planetFrame } from "./planetFrames";

/**
 * How high each pin floats above its own system's plane, in scene units.
 *
 * The one authored part of a pin. Its horizontal position is derived — read
 * through the scene graph every frame — so this table says only "how far
 * above", never "where".
 *
 * Above the PLANE, not above the planet. A planet's own drawn height is its
 * business: `labs` is drawn at y = 1 and pinned at 6.8, which is 5.8 above the
 * sphere and 6.8 above the plane it orbits in. The second reading is the one
 * that survives a system that does not lie in the galactic plane.
 */
export const PIN_HEIGHTS: Record<string, number> = {
  solarSystem: 8.8,
  self: 5.8,
  foundations: 6.2,
  products: 7.8,
  labs: 6.8,
  creative: 5.6,
  vlogs: 5.6,
  shorts: 5.2,
  tutorials: 6.4,
  devlogs: 6.0,
};

/** A pin's live world anchor: the HUD label's attachment point in the scene. */
export interface PinAnchor {
  id: string;
  anchor: THREE.Vector3;
}

/**
 * Where each planet pin sits in world space, right now.
 *
 * Here rather than inline in the render loop for one reason: the loop runs
 * inside a WebGL context jsdom cannot create, so nothing written there can be
 * tested. The anchoring rule is exactly the part that must not silently drift,
 * since a pin that has come loose from its planet still projects, still
 * renders, and still looks like a pin.
 *
 * The rule itself lives in `planetFrames` rather than here, because the camera
 * needs the same answer: a nav preset frames a planet a pin is labelling, and
 * the two pointing at different places is precisely the drift this file exists
 * to prevent. What is left here is the only part that is a pin's own business —
 * how high it floats.
 */
export function planetPinAnchors(builder: WorldSceneBuilder): PinAnchor[] {
  builder.rootGroup.updateWorldMatrix(true, false);
  const anchors: PinAnchor[] = [];
  // The way back into the system's own frame. Read once rather than per pin:
  // it is the same matrix for every pin in this scene, and inverting one per
  // pin per frame is work the render loop cannot afford.
  const toSystem = new THREE.Matrix4().copy(builder.rootGroup.matrixWorld).invert();

  for (const [id, pinY] of Object.entries(PIN_HEIGHTS)) {
    const drawn = planetFrame(builder, id);
    // An arm with neither a scope nor a placement is not a planet at all.
    if (!drawn) continue;
    // Set in the system's frame and composed back out, rather than written
    // straight onto the world position. A solar system away from the galactic
    // core rises out of the plane AND leans, so its planets sit at a different
    // height each — the channel's span from 70 to 96 — and one world altitude
    // reaches none of them. Written as a world y, the channel's pins hung 64 to
    // 90 units beneath the planets they name.
    //
    // Nothing moves in the atlas: its root is at the origin and turns only
    // about +Y, and a rotation about +Y carries y through untouched, so local
    // height and world height are the same number there. That is exactly why
    // the distinction could not be seen while it was the only system.
    const anchor = drawnWorldPosition(drawn).applyMatrix4(toSystem);
    anchor.y = pinY;
    anchor.applyMatrix4(builder.rootGroup.matrixWorld);
    anchors.push({ id, anchor });
  }

  return anchors;
}
