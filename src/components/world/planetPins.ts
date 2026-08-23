import * as THREE from "three";
import type { WorldSceneBuilder } from "./WorldSceneBuilder";
import { PLANET_CENTERS } from "./WorldCameraManager";

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
 * **A planet is drawn whether or not it has a scope.** Only arms that have
 * shipped enough get a scope group — today that is `labs` and `products`, two
 * of five — while all five are drawn, as rows of the planet InstancedMesh
 * placed inside `rootGroup`. So the frame is preferred where one exists, and
 * where none does the layout constant is pushed through `rootGroup`'s own
 * matrix instead. Both are live reads: the pattern's rotation is in that
 * matrix either way (motion design §3.2), which is what §3.7 asks for. What is
 * NOT allowed is reading `PLANET_CENTERS` as a world position, which is what
 * left the pins behind when the galaxy started turning.
 */
export function planetPinAnchors(builder: WorldSceneBuilder): PinAnchor[] {
  builder.rootGroup.updateWorldMatrix(true, false);
  const anchors: PinAnchor[] = [];

  for (const [id, pinY] of Object.entries(PIN_HEIGHTS)) {
    const anchor = new THREE.Vector3();
    if (id === "galaxy") {
      // The core is the galaxy's own origin, which the pattern turns about, so
      // it is the one anchor that never moves.
      builder.rootGroup.getWorldPosition(anchor);
    } else {
      const group = builder.scopeGroups.get(`planet:${id}`);
      if (group) {
        group.getWorldPosition(anchor);
      } else {
        const center = PLANET_CENTERS[id];
        // An arm with neither a scope nor a placement is not a planet at all.
        if (!center) continue;
        anchor.copy(center).applyMatrix4(builder.rootGroup.matrixWorld);
      }
    }
    anchor.y = pinY;
    anchors.push({ id, anchor });
  }

  return anchors;
}
