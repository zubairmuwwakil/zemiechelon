import { FOUNDER_QUOTES } from "@/data/quotes";
import { createQuoteRotation, type QuoteRotation } from "./rotation";
import { assignQuotes, deriveQuoteStars, type QuoteStar } from "./sky";

export const QUOTE_STAR_COUNT = 14;

/**
 * Scene units, just outside `ASTROLABE_OUTER` (205). The sky sits beyond the
 * drawn instrument so the stars read as behind the galaxy, not inside it.
 */
export const QUOTE_SKY_RADIUS = 260;

/**
 * Derived star positions. Deterministic, and the only part of a star the
 * renderer projects: `WorldCanvas` takes these as anchors and keys the
 * projection on the positional `id`.
 */
export const QUOTE_STARS = deriveQuoteStars(FOUNDER_QUOTES, QUOTE_STAR_COUNT, QUOTE_SKY_RADIUS);

interface QuoteSession {
  rotation: QuoteRotation;
  stars: QuoteStar[];
}

let session: QuoteSession | null = null;

/**
 * One rotation per page load, shared by the night stars and the day comets, so
 * "session-level no-repeat" means the whole sky rather than each layer
 * separately. The stars draw first and take `QUOTE_STAR_COUNT` of the bag;
 * comets continue through what is left.
 */
function open(): QuoteSession {
  if (!session) {
    const rotation = createQuoteRotation(FOUNDER_QUOTES, Date.now() % 100_000);
    session = { rotation, stars: assignQuotes(QUOTE_STARS, rotation) };
  }
  return session;
}

/** Memoised, so it is referentially stable — `useSyncExternalStore` requires that. */
export function getSessionStars(): QuoteStar[] {
  return open().stars;
}

/**
 * The server renders the deterministic index assignment, so both sides of a
 * hydration agree. The shuffled sky arrives on the client afterwards.
 *
 * Today no star reaches the server anyway — they render from projected points,
 * which start empty until the render loop fills them. Stating the server
 * snapshot explicitly means that stays a fact about this module rather than a
 * coincidence of the render path that some later change quietly breaks.
 */
export function getServerStars(): QuoteStar[] {
  return QUOTE_STARS;
}

/** The sky is fixed for the life of the page; nothing ever has to re-read it. */
export function subscribeToQuoteSession(): () => void {
  return () => {};
}

export function getSessionRotation(): QuoteRotation {
  return open().rotation;
}

/** Test seam: drops the memoised session so each case opens its own sky. */
export function resetQuoteSession(): void {
  session = null;
}
