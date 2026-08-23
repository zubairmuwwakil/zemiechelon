import type { Body, ScopeId } from "./types";
import { moonScopeId, planetScopeId } from "./galaxy";
import { loadBodies } from "./bodies";
import { declaresSurface } from "./surfaces";

/**
 * What tapping a body should do to the camera and the HUD.
 *
 * A rule rather than a branch in the click handler, for the reason the atlas
 * derives everything else: the answer depends only on what kind of body was
 * tapped, so it can be decided without a scene, a camera or a React tree, and
 * tested without any of them.
 */
export interface BodySelection {
  /**
   * The card to open, or null when the tap lands instead. A card is the
   * flyby's payload; a landing is the place itself, and §4 has the visitor
   * arriving on the ground rather than reading a panel about it.
   */
  cardId: string | null;
  /** A frame to fly to, or null to leave the camera where it is. */
  flyTo: ScopeId | null;
  /**
   * Where leaving that frame goes. Spec §2 found ascending one level at a time
   * feels right, and a flyby adds a level — so the way out of a moon is its
   * planet, not the galaxy.
   */
  ascendTo: ScopeId | null;
  /**
   * Whether this puts the visitor on a surface. True only where the scope
   * declares one — which is derived from where the evidence is, so a venture
   * that earns an engine starts landing without an edit here (§3.3).
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

  const scopeId = moonScopeId(body.id);
  const landed = declaresSurface(scopeId, bodies);
  return {
    cardId: landed ? null : bodyId,
    flyTo: scopeId,
    ascendTo: planetScopeId(body.arm),
    landed,
  };
}
