"use client";

import { X, ArrowUpRight, Compass, Layers, ShieldCheck, Mail } from "lucide-react";
import { ZemiMark } from "../icons/ZemiMark";

interface FounderSectorConsoleProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FounderSectorConsole({ isOpen, onClose }: FounderSectorConsoleProps) {
  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl rounded-3xl border border-amber-300/80 bg-white/95 p-6 sm:p-8 shadow-2xl space-y-6 text-zinc-900 max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-amber-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-zinc-950 p-1.5 shadow-md">
              <ZemiMark className="size-full" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-mono font-bold text-amber-800 uppercase tracking-wider">
                  SEMPER PLUS ULTRA
                </span>
                <span className="text-xs font-mono text-zinc-600">Ancestral Anchor</span>
              </div>
              <h2 className="text-xl font-extrabold tracking-tight text-zinc-900">
                The Sacred Golden Zemí &amp; Founder Story
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-xl border border-zinc-200 text-zinc-600 hover:bg-zinc-100 transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* The Taíno Heritage & Plus Ultra Ethos */}
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 space-y-3">
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-amber-950 flex items-center gap-1.5">
            <Compass className="size-4 text-amber-600" />
            <span>The Taíno Trigonolith &amp; Echelon Engineering</span>
          </h3>
          <p className="text-xs text-zinc-700 leading-relaxed">
            <strong>Zemí</strong> originates from the sacred three-pointed stone trigonoliths of the Jamaican Taíno ancestors, embodying the three pillars: <em>the foundation, the tiered ascension, and the spiritual peak</em>.
          </p>
          <p className="text-xs text-zinc-700 leading-relaxed">
            The brand motto <strong>Semper Plus Ultra</strong> (<em>Always Further Beyond</em>) is the ancient cartographic command to sail past the edge of the known map into the uncharted frontier of sovereign engineering.
          </p>
        </div>

        {/* The 286-Day Slope */}
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-zinc-900">The 286-Day Evolution Slope</span>
            <span className="text-emerald-700 font-bold">44 Authored Repositories</span>
          </div>
          <div className="space-y-1.5 text-zinc-600 text-[11px]">
            <div>• <strong>2025-11-06 (Genesis)</strong>: First repo created (`HTMl_CAT_WEBSITE`).</div>
            <div>• <strong>2026-01-03 (Ingestion)</strong>: Java 21 / Spring Boot 4 pipeline (`marketdata`).</div>
            <div>• <strong>2026-07-15 (Execution)</strong>: Shipped iOS tournament operations engine (`pickleops`).</div>
            <div>• <strong>2026-08-19 (Frontier)</strong>: Multi-product financial continuum with deterministic engines (`Inunity`, `PickMe`).</div>
          </div>
        </div>

        {/* Profile Links */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-100">
          <a
            href="https://zubairmuwwakil.com"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-zinc-900 px-4 text-xs font-semibold text-white shadow-xs hover:bg-zinc-800 transition-colors"
          >
            <span>Visit Personal Portfolio (zubairmuwwakil.com)</span>
            <ArrowUpRight className="size-3.5" />
          </a>

          <div className="flex items-center gap-2 text-xs font-mono">
            <a
              href="mailto:zmuwwakil1@gmail.com"
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3.5 text-zinc-700 hover:bg-zinc-50 transition-colors"
            >
              <Mail className="size-3.5 text-zinc-500" />
              <span>Contact Zubair</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
