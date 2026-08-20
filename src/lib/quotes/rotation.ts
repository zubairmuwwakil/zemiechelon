import type { FounderQuote } from "@/data/quotes";

export interface QuoteRotation {
  /** The next quote. Never repeats until the set is exhausted, and never twice in a row across the seam. */
  next(): FounderQuote;
  /** How many have been drawn in total, across cycles. */
  drawn(): number;
}

/** Deterministic PRNG, so a seeded rotation is reproducible in tests. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * A shuffled bag rather than random sampling. Sampling repeats immediately and
 * leaves quotes unreached; a bag guarantees every quote appears once per cycle.
 * On reshuffle, if the new first would repeat the previous last, it is swapped
 * with the next one along, so the seam never stutters.
 */
export function createQuoteRotation(quotes: FounderQuote[], seed = 1): QuoteRotation {
  if (quotes.length === 0) throw new Error("no quotes to rotate");

  const rand = mulberry32(seed);
  let bag = shuffle(quotes, rand);
  let index = 0;
  let total = 0;
  let last: FounderQuote | null = null;

  return {
    next() {
      if (index >= bag.length) {
        bag = shuffle(quotes, rand);
        if (bag.length > 1 && last && bag[0].id === last.id) {
          [bag[0], bag[1]] = [bag[1], bag[0]];
        }
        index = 0;
      }
      last = bag[index++];
      total++;
      return last;
    },
    drawn() {
      return total;
    },
  };
}
