import type { FounderQuote } from "@/data/quotes";
import type { Vec3 } from "@/lib/atlas/types";
import type { QuoteRotation } from "./rotation";

export interface QuoteStar {
  id: string;
  quoteId: string;
  /** Scene-space, on the sky sphere. Projected to screen each frame. */
  position: Vec3;
  /** Radians. Offsets this star's pulse so the sky does not blink in unison. */
  phase: number;
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/**
 * Fibonacci sphere. Even coverage without clustering, deterministic, and no
 * rejection sampling — which matters because these are also DOM hit targets and
 * two stars landing on the same pixel would be an unclickable button.
 */
export function deriveQuoteStars(
  quotes: FounderQuote[],
  count: number,
  radius: number,
): QuoteStar[] {
  const n = Math.min(count, quotes.length);
  const stars: QuoteStar[] = [];

  for (let i = 0; i < n; i++) {
    const y = n === 1 ? 0 : 1 - (i / (n - 1)) * 2;
    const ring = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = GOLDEN_ANGLE * i;

    stars.push({
      id: `quote-star-${i}`,
      quoteId: quotes[i].id,
      position: {
        x: Math.cos(theta) * ring * radius,
        y: y * radius,
        z: Math.sin(theta) * ring * radius,
      },
      // Irrational stride, so phases never coincide for any n.
      phase: (i * GOLDEN_ANGLE) % (Math.PI * 2),
    });
  }

  return stars;
}

/**
 * Re-points each star at a quote drawn from a rotation, leaving id, position
 * and phase alone.
 *
 * Placement and selection are separate concerns and only one of them may vary.
 * The positions are what `WorldCanvas` projects — the bridge keys on the
 * positional `id` — and the guaranteed angular separation is a property of the
 * Fibonacci sphere, so both have to stay deterministic. Which quote hangs at
 * each point does not, and holding it fixed is what limited the night sky to
 * `quotes[0..count-1]` on every visit.
 *
 * Drawing from a fresh rotation gives `count` distinct quotes, because the bag
 * yields a full cycle before it reshuffles.
 */
export function assignQuotes(stars: QuoteStar[], rotation: QuoteRotation): QuoteStar[] {
  return stars.map((star) => ({ ...star, quoteId: rotation.next().id }));
}
