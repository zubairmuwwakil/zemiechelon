import { SOLAR_SYSTEMS } from "./galaxy";
import { bodiesFor } from "./bodies";
import { deriveWorldRadius } from "./planets";

/**
 * The drawn instrument's own size. This is the one authored length in the
 * scene: everything else is a date pushed through `radiusScale`.
 */
export const ASTROLABE_OUTER = 205;

/**
 * Layout units -> scene units, for the whole galaxy.
 *
 * One quotient, not one per system, because a day has to mean the same
 * distance everywhere: two solar systems drawn at their own scales would
 * present as equally large discs, which is a lie about their ages. The widest
 * system's outermost body lands exactly on the astrolabe's outermost ring —
 * today that is the repository atlas, and the quotient is unchanged from when
 * it was the only system.
 *
 * It lives in `lib/atlas` rather than in `WorldCameraManager` so it can be
 * stated once and still be free of three.js. `surfaces.ts` used to carry a
 * second copy of both this and `ASTROLABE_OUTER`, with a comment explaining
 * that a second way of computing it is a second thing to drift — which was
 * true, and stopped being merely theoretical the moment a second system could
 * widen one of them and not the other.
 */
export const SCENE_SCALE =
  ASTROLABE_OUTER /
  Math.max(...SOLAR_SYSTEMS.map((system) => deriveWorldRadius(bodiesFor(system), system)));
