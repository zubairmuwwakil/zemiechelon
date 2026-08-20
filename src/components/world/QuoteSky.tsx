"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { FOUNDER_QUOTES, type FounderQuote } from "@/data/quotes";
import {
  getServerStars,
  getSessionRotation,
  getSessionStars,
  subscribeToQuoteSession,
} from "@/lib/quotes/session";
import type { ScreenPoint } from "@/lib/atlas/types";
import type { CosmicMode } from "./DayNightController";
import { QuoteCard } from "./QuoteCard";
import { sound } from "@/lib/audio";

export { QUOTE_STAR_COUNT, QUOTE_SKY_RADIUS, QUOTE_STARS } from "@/lib/quotes/session";

/** Three in flight reads as weather; one every sixteen seconds reads as a thing you missed. */
const MAX_COMETS = 3;
const SPAWN_MS = 5_200;
const FLIGHT_MS = 11_000;
/**
 * The lifecycle runs on one coarse tick rather than a timeout per comet, because
 * a paused comet has to stop ageing as well as stop moving — a per-comet timeout
 * would fire mid-hover and delete the quote out from under the reader.
 */
const TICK_MS = 400;

interface Comet {
  key: number;
  quote: FounderQuote;
  /**
   * Percent of viewport height. Lanes are 15% apart and rotate, so the gap
   * always exceeds the 4vh drift plus a two-line comet's height.
   */
  top: number;
  paused: boolean;
  /** Milliseconds of flight left. Frozen while paused. */
  remaining: number;
}

interface OpenCard {
  quote: FounderQuote;
  x: number;
  y: number;
  /** Set when the card was opened from a comet, so the comet stays held. */
  cometKey: number | null;
}

interface QuoteSkyProps {
  cosmicMode: CosmicMode;
  /** Projected screen positions for QUOTE_STARS, produced by WorldCanvas each frame. */
  points: ScreenPoint[];
}

export function QuoteSky({ cosmicMode, points }: QuoteSkyProps) {
  const [open, setOpen] = useState<OpenCard | null>(null);
  const [comets, setComets] = useState<Comet[]>([]);

  const quoteById = useMemo(() => new Map(FOUNDER_QUOTES.map((q) => [q.id, q])), []);

  // Which quote hangs at which point is drawn per page load, so a second visit
  // is not the same fourteen quotes. Positions are unaffected — they are what
  // WorldCanvas projects. Read through a store rather than an effect so the
  // server snapshot is a stated contract instead of a happy accident.
  const stars = useSyncExternalStore(subscribeToQuoteSession, getSessionStars, getServerStars);
  const starById = useMemo(() => new Map(stars.map((s) => [s.id, s])), [stars]);

  const setPaused = useCallback((key: number, paused: boolean) => {
    setComets((current) => current.map((c) => (c.key === key ? { ...c, paused } : c)));
  }, []);

  const closeCard = useCallback(() => {
    if (open?.cometKey != null) setPaused(open.cometKey, false);
    setOpen(null);
  }, [open, setPaused]);

  const isDay = cosmicMode === "day";

  useEffect(() => {
    if (!isDay) return;

    // The same bag the stars drew from, so a comet never repeats a quote that
    // is already hanging in the sky behind it.
    const rotation = getSessionRotation();
    let key = 0;
    let lane = 0;
    const make = (): Comet => ({
      key: key++,
      quote: rotation.next(),
      top: 14 + (lane++ % MAX_COMETS) * 15 + Math.random() * 3,
      paused: false,
      remaining: FLIGHT_MS,
    });

    // Primed, so the first comet arrives on the first tick. Seeding state
    // straight from the effect body would cascade a render before paint.
    let sinceSpawn = SPAWN_MS;

    const id = window.setInterval(() => {
      sinceSpawn += TICK_MS;
      const spawning = sinceSpawn >= SPAWN_MS;
      if (spawning) sinceSpawn = 0;
      // Drawn outside the updater: React may invoke an updater twice, and the
      // rotation is stateful.
      const arrival = spawning ? make() : null;

      setComets((current) => {
        const aged = current.flatMap((c) => {
          if (c.paused) return [c];
          const remaining = c.remaining - TICK_MS;
          return remaining > 0 ? [{ ...c, remaining }] : [];
        });
        return arrival && aged.length < MAX_COMETS ? [...aged, arrival] : aged;
      });
    }, TICK_MS);

    return () => {
      window.clearInterval(id);
      setComets([]);
    };
  }, [isDay]);

  return (
    <div className="pointer-events-none fixed inset-0 z-20 select-none overflow-hidden">
      {comets.map((comet) => (
        <button
          key={comet.key}
          data-testid="quote-comet"
          data-paused={comet.paused ? "true" : "false"}
          aria-label={comet.quote.text}
          onMouseEnter={() => setPaused(comet.key, true)}
          onMouseLeave={() => {
            if (open?.cometKey !== comet.key) setPaused(comet.key, false);
          }}
          onFocus={() => setPaused(comet.key, true)}
          onBlur={() => {
            if (open?.cometKey !== comet.key) setPaused(comet.key, false);
          }}
          onClick={() => {
            sound.playChime(750, 0.15);
            setPaused(comet.key, true);
            setOpen({
              quote: comet.quote,
              x: window.innerWidth / 2,
              y: (window.innerHeight * comet.top) / 100,
              cometKey: comet.key,
            });
          }}
          style={{ top: `${comet.top}%`, color: "var(--accent)" }}
          className="quote-comet pointer-events-auto absolute left-1/2 flex max-w-[68vw] items-center gap-2 focus-visible:outline focus-visible:outline-2"
        >
          <span aria-hidden className="shrink-0">
            ✦
          </span>
          <span
            aria-hidden
            className="line-clamp-2 text-left text-xs font-medium tracking-wide"
            style={{ color: "var(--foreground)" }}
          >
            {comet.quote.text}
          </span>
        </button>
      ))}

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
                setOpen({ quote, x: p.x, y: p.y, cometKey: null });
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

      {open && <QuoteCard quote={open.quote} x={open.x} y={open.y} onClose={closeCard} />}
    </div>
  );
}
