"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { FounderQuote } from "@/data/quotes";

interface QuoteCardProps {
  quote: FounderQuote;
  /** Viewport pixel position of the star or comet this card belongs to. */
  x: number;
  y: number;
  onClose: () => void;
}

/** Half the card's width (`w-72`), plus the gutter we refuse to cross. */
const HALF_WIDTH = 144;
const GUTTER = 12;

/**
 * The card sits above its anchor unless that would push it off the top, in
 * which case it flips below. Anchors are pixel positions from the projection,
 * so the clamp is in pixels too — the previous tooltip clamped a percentage
 * and the value was carried over into a `px` unit, pinning every card to the
 * left gutter.
 */
function place(x: number, y: number, height: number) {
  const width = typeof window === "undefined" ? 1024 : window.innerWidth;
  const viewportHeight = typeof window === "undefined" ? 768 : window.innerHeight;
  const halfWidth = Math.min(HALF_WIDTH, width / 2 - GUTTER);

  const flip = y - height * 1.2 < GUTTER;
  const top = flip
    ? Math.min(y + 20, viewportHeight - height - GUTTER)
    : Math.min(y, viewportHeight - GUTTER);

  return {
    left: Math.min(width - halfWidth - GUTTER, Math.max(halfWidth + GUTTER, x)),
    top: Math.max(GUTTER, top),
    flip,
  };
}

/**
 * Ground comes from tokens, not literals. The previous tooltip hardcoded
 * bg-zinc-950/85, which is correct on obsidian and wrong on paper.
 */
export function QuoteCard({ quote, x, y, onClose }: QuoteCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(140);

  useLayoutEffect(() => {
    const measured = ref.current?.offsetHeight;
    if (measured) setHeight(measured);
  }, [quote.id]);

  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const { left, top, flip } = place(x, y, height);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Founder principle"
      aria-modal="false"
      tabIndex={-1}
      style={{
        position: "fixed",
        left: `${left}px`,
        top: `${top}px`,
        transform: flip ? "translate(-50%, 0)" : "translate(-50%, -120%)",
        background: "var(--card)",
        color: "var(--card-foreground)",
        borderColor: "var(--border)",
        maxWidth: "calc(100vw - 24px)",
      }}
      className="pointer-events-auto z-50 w-72 rounded-2xl border p-4 shadow-xl backdrop-blur-xl focus:outline-none"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold leading-snug">{quote.text}</p>
        <button
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 opacity-60 transition-opacity hover:opacity-100"
        >
          <X className="size-3" />
        </button>
      </div>
      {quote.era && (
        <div className="mt-2 font-mono text-[10px]" style={{ color: "var(--accent)" }}>
          {quote.era}
        </div>
      )}
    </div>
  );
}
