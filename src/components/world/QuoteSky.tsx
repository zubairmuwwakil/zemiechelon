"use client";

import { useMemo, useState } from "react";
import { FOUNDER_QUOTES, type FounderQuote } from "@/data/quotes";
import { deriveQuoteStars } from "@/lib/quotes/sky";
import type { ScreenPoint } from "@/lib/atlas/types";
import type { CosmicMode } from "./DayNightController";
import { QuoteCard } from "./QuoteCard";
import { sound } from "@/lib/audio";

export const QUOTE_STAR_COUNT = 14;

/**
 * Scene units, matching `ASTROLABE_OUTER` (205). The sky sits just outside the
 * drawn instrument so the stars read as behind the galaxy, not inside it.
 */
export const QUOTE_SKY_RADIUS = 260;

/** Scene-space star positions. Exported so WorldCanvas can project them. */
export const QUOTE_STARS = deriveQuoteStars(FOUNDER_QUOTES, QUOTE_STAR_COUNT, QUOTE_SKY_RADIUS);

interface QuoteSkyProps {
  cosmicMode: CosmicMode;
  /** Projected screen positions for QUOTE_STARS, produced by WorldCanvas each frame. */
  points: ScreenPoint[];
}

export function QuoteSky({ cosmicMode, points }: QuoteSkyProps) {
  const [open, setOpen] = useState<{ quote: FounderQuote; x: number; y: number } | null>(null);

  const quoteById = useMemo(() => new Map(FOUNDER_QUOTES.map((q) => [q.id, q])), []);
  const starById = useMemo(() => new Map(QUOTE_STARS.map((s) => [s.id, s])), []);

  return (
    <div className="pointer-events-none fixed inset-0 z-20 select-none">
      {points
        .filter((p) => p.visible && starById.has(p.id))
        .map((p) => {
          const star = starById.get(p.id)!;
          const quote = quoteById.get(star.quoteId)!;
          return (
            <button
              key={p.id}
              onClick={() => {
                sound.playChime(750, 0.15);
                setOpen({ quote, x: p.x, y: p.y });
              }}
              aria-label={quote.text}
              style={{
                left: `${p.x}px`,
                top: `${p.y}px`,
                // Negative, so every star starts mid-pulse rather than dark for
                // its first few seconds. Own phase, so the sky never blinks in
                // unison — synchronised pulsing reads as a loading state.
                animationDelay: `-${star.phase.toFixed(3)}s`,
                color: "var(--accent)",
                opacity: cosmicMode === "day" ? 0.45 : 1,
              }}
              className="quote-star pointer-events-auto absolute size-6 -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform hover:scale-150 focus-visible:scale-150 focus-visible:outline focus-visible:outline-2"
            >
              <span aria-hidden className="mx-auto block size-1.5 rounded-full bg-current" />
            </button>
          );
        })}

      {open && (
        <QuoteCard quote={open.quote} x={open.x} y={open.y} onClose={() => setOpen(null)} />
      )}
    </div>
  );
}
