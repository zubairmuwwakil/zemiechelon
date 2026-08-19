import type { ArmId, Body, Vec3 } from "./types";
import { EPOCH } from "./bodies";

/** Radians. Arms are evenly spaced; the order is fixed so the layout is stable. */
export const ARM_ANGLES: Record<ArmId, number> = {
  foundations: 0,
  products: (2 * Math.PI) / 5,
  labs: (4 * Math.PI) / 5,
  self: (6 * Math.PI) / 5,
  creative: (8 * Math.PI) / 5,
};

/** How far an arm sweeps per e-fold of radius. Higher = tighter spiral. */
export const WIND_RATE = 0.55;

const MS_PER_DAY = 86_400_000;

export function daysSinceEpoch(iso: string): number {
  return Math.round((Date.parse(iso) - Date.parse(EPOCH)) / MS_PER_DAY);
}

/**
 * Days -> radius. Square root, not linear: repository creation is far denser at
 * the frontier than at the core, and a linear map would pile the recent work into
 * a thin outer band while leaving the middle empty.
 */
export function radiusScale(days: number): number {
  return Math.sqrt(Math.max(0, days)) * 1.15;
}

export function polar(arm: ArmId, radius: number): Vec3 {
  const theta = ARM_ANGLES[arm] + WIND_RATE * Math.log(1 + radius);
  return { x: Math.cos(theta) * radius, y: 0, z: Math.sin(theta) * radius };
}

export function derivePosition(body: Body): Vec3 {
  return polar(body.arm, radiusScale(daysSinceEpoch(body.bornAt)));
}

/** Where a body's trail ends: its own arm, at its last-touched radius. */
export function trailEnd(body: Body): Vec3 {
  return polar(body.arm, radiusScale(daysSinceEpoch(body.lastTouchedAt)));
}
