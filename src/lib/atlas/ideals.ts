import type { Body, ScopeId } from "./types";
import { loadBodies } from "./bodies";
import { planetScopeId } from "./galaxy";

export interface Ideal {
  id: string;
  /** The scope whose rings carry this claim. */
  scope: ScopeId;
  /** Ring index, inner to outer. Unique within a scope. */
  ordinal: number;
  claim: string;
  /** Body ids that demonstrate the claim. Never empty. */
  evidence: string[];
}

/**
 * The author supplies the real claims. Until then this holds the one ideal whose
 * evidence is already provable — the ported engine runs all 27 cases in
 * engine-fixtures.json under CI.
 *
 * A scope with no ideals renders no rings, which is a legitimate state. Adding a
 * claim without evidence is not.
 */
export const IDEALS: Ideal[] = [
  {
    id: "deterministic-systems",
    scope: "planet:products",
    ordinal: 1,
    claim: "Deterministic systems over speculation",
    evidence: ["PickMe", "pickleops"],
  },
];

export function validateIdeals(ideals: Ideal[], bodies: Body[] = loadBodies()): void {
  const known = new Set(bodies.map((b) => b.id));
  for (const ideal of ideals) {
    if (ideal.evidence.length === 0) {
      throw new Error(`ideal "${ideal.id}" has no evidence — a claim with nothing behind it`);
    }
    for (const id of ideal.evidence) {
      if (!known.has(id)) {
        throw new Error(`ideal "${ideal.id}" cites unknown body "${id}"`);
      }
    }
  }
}

export function idealsFor(arm: string): Ideal[] {
  return IDEALS.filter((i) => i.scope === planetScopeId(arm)).sort((a, b) => a.ordinal - b.ordinal);
}

// Fail the build, not the render. An unresolved citation must surface the way an
// unassigned arm already does.
validateIdeals(IDEALS);
