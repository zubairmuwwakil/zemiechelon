"use client";

import { useState, useEffect } from "react";
import { Sparkles, X, Quote } from "lucide-react";
import { FOUNDER_QUOTES, type FounderQuote } from "@/data/quotes";
import type { CosmicMode } from "./DayNightController";
import { sound } from "@/lib/audio";

interface ShootingStarQuotesProps {
  cosmicMode: CosmicMode;
}

export function ShootingStarQuotes({ cosmicMode }: ShootingStarQuotesProps) {
  const [activeComet, setActiveComet] = useState<FounderQuote | null>(null);
  const [selectedQuote, setSelectedQuote] = useState<{ quote: FounderQuote; x: number; y: number } | null>(null);
  const [cometTop, setCometTop] = useState(20);
  const [isCometVisible, setIsCometVisible] = useState(false);

  // Day Mode: Periodic Shooting Star Mantra gliding across the upper sky
  useEffect(() => {
    if (cosmicMode !== "day") {
      setIsCometVisible(false);
      return;
    }

    const triggerComet = () => {
      const randomQuote = FOUNDER_QUOTES[Math.floor(Math.random() * FOUNDER_QUOTES.length)];
      setActiveComet(randomQuote);
      setCometTop(14 + Math.random() * 12);
      setIsCometVisible(true);

      const timer = setTimeout(() => {
        setIsCometVisible(false);
      }, 10500);

      return timer;
    };

    const initialTimeout = setTimeout(triggerComet, 2500);
    const interval = setInterval(triggerComet, 16000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [cosmicMode]);

  const handleStarClick = (quote: FounderQuote, topPct: number, leftPct: number) => {
    sound.playChime(750, 0.15);
    setSelectedQuote({ quote, x: leftPct, y: topPct });
  };

  const nightStars = [
    { top: 22, left: 68, quote: FOUNDER_QUOTES[1] || FOUNDER_QUOTES[0] }, // 'Deterministic systems over speculation'
    { top: 18, left: 28, quote: FOUNDER_QUOTES[0] },
    { top: 38, left: 16, quote: FOUNDER_QUOTES[2] },
    { top: 32, left: 82, quote: FOUNDER_QUOTES[3] || FOUNDER_QUOTES[0] },
    { top: 48, left: 45, quote: FOUNDER_QUOTES[4] || FOUNDER_QUOTES[1] },
  ];

  return (
    <div className="pointer-events-none fixed inset-0 z-20 overflow-hidden select-none">
      {/* 1. Day Mode Shooting Star Mantra (Mockup Slides 1 & 4) */}
      {cosmicMode === "day" && isCometVisible && activeComet && (
        <div
          className="pointer-events-auto absolute cursor-pointer transition-all duration-300 animate-shooting-star"
          style={{ top: `${cometTop}%`, left: "50%" }}
        >
          <div className="flex items-center gap-2">
            <span className="text-amber-500 font-bold text-sm">✦</span>
            <span className="font-sans text-xs sm:text-sm font-medium tracking-wide text-zinc-700/90 whitespace-nowrap drop-shadow-xs">
              {activeComet.text}
            </span>
          </div>
        </div>
      )}

      {/* 2. Night Mode Constellation Star Nodes (Mockup Slide 2) */}
      {cosmicMode === "night" && (
        <div className="pointer-events-none absolute inset-0">
          {nightStars.map((star, idx) => (
            <button
              key={idx}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                handleStarClick(star.quote, (rect.top / window.innerHeight) * 100, (rect.left / window.innerWidth) * 100);
              }}
              className="pointer-events-auto absolute flex size-7 items-center justify-center rounded-full transition-transform hover:scale-160 focus:outline-hidden group"
              style={{ top: `${star.top}%`, left: `${star.left}%` }}
              title="Click star to reveal engineering principle"
            >
              <span className="absolute size-2 rounded-full bg-amber-300 animate-ping opacity-75" />
              <span className="absolute size-1.5 rounded-full bg-amber-200 shadow-lg shadow-amber-400" />
              <Sparkles className="size-3 text-amber-300/80 group-hover:text-amber-100 transition-colors" />
            </button>
          ))}
        </div>
      )}

      {/* 3. Anchored Frosted Glass Star Tooltip Callout (Mockup Slide 2) */}
      {selectedQuote && (
        <div
          onClick={() => setSelectedQuote(null)}
          className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-transparent"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "fixed",
              left: `${Math.min(80, Math.max(20, selectedQuote.x))}%`,
              top: `${Math.min(75, Math.max(20, selectedQuote.y))}%`,
              transform: "translate(-50%, -120%)",
            }}
            className="relative w-72 rounded-2xl border border-white/20 bg-zinc-950/85 p-4 text-zinc-100 shadow-2xl backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Triangular callout arrow pointing down */}
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 size-0 border-x-8 border-x-transparent border-t-8 border-t-zinc-950/85" />

            <div className="flex items-start justify-between gap-2">
              <p className="font-sans text-xs font-semibold leading-snug text-zinc-100">
                &lsquo;{selectedQuote.quote.text}&rsquo;
              </p>
              <button
                onClick={() => setSelectedQuote(null)}
                className="text-zinc-500 hover:text-zinc-300 transition-colors shrink-0"
              >
                <X className="size-3" />
              </button>
            </div>

            <div className="mt-2 text-[10px] font-mono text-amber-400/90 font-medium">
              &minus; Founder
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
