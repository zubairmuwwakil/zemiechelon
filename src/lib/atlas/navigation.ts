import type { Body, ScopeId } from "./types";
import { moonScopeId, planetScopeId } from "./galaxy";
import { loadBodies } from "./bodies";

/**
 * What tapping a body should do to the camera and the HUD.
 *
 * A rule rather than a branch in the click handler, for the reason the atlas
 * derives everything else: the answer depends only on what kind of body was
 * tapped, so it can be decided without a scene, a camera or a React tree, and
 * tested without any of them.
 */
export interface BodySelection {
  /** The card to open. Always the body that was tapped. */
  cardId: string;
  /** A frame to fly to, or null to leave the camera where it is. */
  flyTo: ScopeId | null;
  /**
   * Where leaving that frame goes. Spec §2 found ascending one level at a time
   * feels right, and a flyby adds a level — so the way out of a moon is its
   * planet, not the galaxy.
   */
  ascendTo: ScopeId | null;
  /**
   * Whether this puts the visitor on a surface. Always false today: a flyby is
   * honest about there being nothing to stand on (spec §3.3), and PickMe's
   * landing arrives with the surface camera.
   */
  landed: boolean;
}

export function resolveBodySelection(
  bodyId: string,
  bodies: Body[] = loadBodies(),
): BodySelection {
  const body = bodies.find((b) => b.id === bodyId);

  // A shipped system is a place you can visit. Everything else on the arm is a
  // card — flying to every dot in the field would make the map twitch at every
  // click, and there is nothing there to see up close.
  if (!body || body.kind !== "system") {
    return { cardId: bodyId, flyTo: null, ascendTo: null, landed: false };
  }

  return {
    cardId: bodyId,
    flyTo: moonScopeId(body.id),
    ascendTo: planetScopeId(body.arm),
    landed: false,
  };
}
