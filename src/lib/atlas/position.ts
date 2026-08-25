import type { Body, Vec3 } from "./types";
import { getScope, SOLAR_SYSTEM_ZEMI, type Scope } from "./scopes";

/** @deprecated Read `scope.arms` instead. Retained so the galaxy's own table stays importable. */
export const ARM_ANGLES = SOLAR_SYSTEM_ZEMI.arms;

/** @deprecated Read `scope.windRate` instead. */
export const WIND_RATE = SOLAR_SYSTEM_ZEMI.windRate;

const MS_PER_DAY = 86_400_000;

export function daysSinceEpoch(iso: string, epoch: string = SOLAR_SYSTEM_ZEMI.epoch): number {
  return Math.round((Date.parse(iso) - Date.parse(epoch)) / MS_PER_DAY);
}

/**
 * Days -> radius. Square root, not linear: repository creation is far denser at
 * the frontier than at the core, and a linear map would pile the recent work into
 * a thin outer band while leaving the middle empty.
 */
export function radiusScale(days: number): number {
  return Math.sqrt(Math.max(0, days)) * 1.15;
}

export function polar(arm: string, radius: number, scope: Scope = SOLAR_SYSTEM_ZEMI): Vec3 {
  const theta = scope.arms[arm] + scope.windRate * Math.log(1 + radius);
  return { x: Math.cos(theta) * radius, y: 0, z: Math.sin(theta) * radius };
}

/**
 * A body's position ON THE ARM SPINE. Real bodies are scattered about the spine
 * rather than sitting on it — see `placeBodies`, which is what the Field and
 * Chart layers consume. This is the spine itself: the curve the arm is drawn
 * along, and the base that `placeBodies` offsets from.
 */
export function derivePosition(body: Body, scope: Scope = getScope(body.parent)): Vec3 {
  return polar(body.arm, radiusScale(daysSinceEpoch(body.bornAt, scope.epoch)), scope);
}

/** Where a body's trail ends on the spine: its own arm, at last-touched radius. */
export function trailEnd(body: Body, scope: Scope = getScope(body.parent)): Vec3 {
  return polar(body.arm, radiusScale(daysSinceEpoch(body.lastTouchedAt, scope.epoch)), scope);
}

// --- Scatter -----------------------------------------------------------------
//
// Radius alone cannot separate bodies. Theta is a pure function of (arm, radius),
// so two repositories in one arm born the same day occupy the identical point —
// 23 of the 45 land within a hair of another — and radiusScale's sqrt yields
// under 0.04 world units per day at the frontier, where most of them live.
//
// A hashed per-body offset was measured and rejected. Across 48,000 (seed, arm
// width) combinations the best minimum separation over the real set was 0.324
// world units, short of the 0.35 two glyphs need, and reaching even that
// required an arm half-width of 41 degrees against a 72 degree arm spacing: the
// arms would merge into each other. This is not a tuning failure. No pure
// per-body function of a scalar can guarantee a minimum separation for arbitrary
// inputs — a guarantee needs to know the neighbours.
//
// So placement is a pure function of the body SET. Nothing is authored: the fan
// below is derived from the same metadata, and adding a repository re-flows only
// the run of bodies it actually crowds.

/** Bodies whose radii differ by less than this are treated as one crowded run. */
const CROWD = 1.1;
/** World units of arc a run tries to leave around each member. */
const ROOM = { dwarfPlanet: 0.5, moon: 1.5 } as const;
/** Radians. A fan never opens wider than this, so an arm never reaches its neighbour. */
const MAX_LANE = 0.55;
/** World units. Bodies born at the epoch would otherwise all share the origin. */
export const BULGE = 1.9;

export interface Placement {
  id: string;
  /** Where the body is drawn. */
  position: Vec3;
  /** The far end of its trail, on the same lane so the trail runs parallel to the arm. */
  trailEnd: Vec3;
  /** Radians of offset from the arm spine. Zero for a body that crowds nobody. */
  lane: number;
}

function at(arm: string, radius: number, lane: number, scope: Scope): Vec3 {
  const theta = scope.arms[arm] + scope.windRate * Math.log(1 + radius) + lane;
  return { x: Math.cos(theta) * radius, y: 0, z: Math.sin(theta) * radius };
}

/**
 * Lay out a whole set of bodies. Each arm is swept outward and broken into runs
 * of mutually crowded bodies; each run is fanned across the arm in birth order,
 * so that where the map is dense you can read time across the arm as well as
 * along it. A run may also be nudged radially, by at most half a day of local
 * radius — enough to unstack the epoch, negligible at the frontier.
 */
export function placeBodies(bodies: Body[], scope: Scope = SOLAR_SYSTEM_ZEMI): Placement[] {
  const out: Placement[] = [];

  for (const arm of Object.keys(scope.arms)) {
    const inArm = bodies
      .filter((b) => b.arm === arm)
      .map((b) => ({
        b,
        day: daysSinceEpoch(b.bornAt, scope.epoch),
        r: Math.max(radiusScale(daysSinceEpoch(b.bornAt, scope.epoch)), BULGE),
      }))
      .sort((p, q) => p.r - q.r || p.b.bornAt.localeCompare(q.b.bornAt) || p.b.id.localeCompare(q.b.id));

    for (let i = 0; i < inArm.length; ) {
      let j = i + 1;
      while (j < inArm.length && inArm[j].r - inArm[j - 1].r < CROWD) j++;
      const run = inArm.slice(i, j);
      i = j;

      // Walk the run laying out arc positions, giving each member the room its
      // drawn figure needs, then centre the result and convert arc to angle.
      const room = run.map((m) => ROOM[m.b.kind]);
      const arc = [0];
      for (let k = 1; k < run.length; k++) arc.push(arc[k - 1] + Math.max(room[k - 1], room[k]));
      const total = arc[arc.length - 1];
      const mid = run.reduce((a, m) => a + m.r, 0) / run.length;
      const scaleToLane = total === 0 ? 0 : Math.min(MAX_LANE, total / mid) / total;

      run.forEach((m, k) => {
        const lane = (arc[k] - total / 2) * scaleToLane;
        // A day of radius here, so the nudge means "within one day" everywhere.
        const dayWidth = radiusScale(m.day + 1) - radiusScale(m.day);
        const t = run.length === 1 ? 0 : (k / (run.length - 1)) * 2 - 1;
        const nudge = t * dayWidth * 0.5;
        out.push({
          id: m.b.id,
          lane,
          position: at(arm, m.r + nudge, lane, scope),
          trailEnd: at(arm, Math.max(radiusScale(daysSinceEpoch(m.b.lastTouchedAt, scope.epoch)), BULGE) + nudge, lane, scope),
        });
      });
    }
  }
  return out;
}
