import type { Body } from "./types";

/**
 * Encodes a body ID into a URL hash (e.g., "#/MoneyTalks").
 */
export function bodyIdToHash(id: string): string {
  return `#/${encodeURIComponent(id)}`;
}

/**
 * Resolves a URL hash to a body ID.
 * Returns null for unknown, malformed, empty, or anonymous bodies.
 * Never throws an exception.
 */
export function hashToBodyId(hash: string, bodies: Body[]): string | null {
  if (!hash || typeof hash !== "string") return null;

  let raw = hash.trim();
  if (raw.startsWith("#/")) {
    raw = raw.slice(2);
  } else if (raw.startsWith("#")) {
    raw = raw.slice(1);
  }
  if (!raw) return null;

  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  if (!decoded) return null;

  const lower = decoded.toLowerCase();
  const match = bodies.find((b) => b.id.toLowerCase() === lower);
  if (!match || match.anonymous) return null;

  return match.id;
}
