import * as THREE from "three";
import type { WorldSceneBuilder } from "./WorldSceneBuilder";
import { drawnWorldPosition, planetFrame } from "./planetFrames";

/**
 * How high each pin floats above the body it names, in scene units.
 *
 * The one authored part of a pin. Its horizontal position is derived — read
 * through the scene graph every frame — so this table says only "how far
 * above", never "where".
 */
export const PIN_HEIGHTS: Record<string, number> = {
  galaxy: 8.8,
  self: 5.8,
  foundations: 6.2,
  products: 7.8,
  labs: 6.8,
  creative: 5.6,
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

  for (const [id, pinY] of Object.entries(PIN_HEIGHTS)) {
    const drawn = planetFrame(builder, id);
    // An arm with neither a scope nor a placement is not a planet at all.
    if (!drawn) continue;
    const anchor = drawnWorldPosition(drawn);
    anchor.y = pinY;
    anchors.push({ id, anchor });
  }

  return anchors;
}
