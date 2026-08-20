"use client";

import { X, BookOpen, Sparkles, PenTool } from "lucide-react";

interface CreativeSectorConsoleProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreativeSectorConsole({ isOpen, onClose }: CreativeSectorConsoleProps) {
  if (!isOpen) return null;

  const notes = [
    { title: "Deterministic State Machines over Speculative LLMs", date: "Aug 2026", category: "Systems Design" },
    { title: "Zero-Bank-Login Architectures: iOS Shortcut Ingestion", date: "Jul 2026", category: "Fintech Privacy" },
    { title: "Glicko-2 vs ELO: Rating Deviations in Club Tournaments", date: "Jul 2026", category: "Mathematics" },
    { title: "Idempotent Pipeline Ingestion with Row Quarantine", date: "Jan 2026", category: "Spring Boot" },
  ];

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl rounded-3xl border border-rose-300/80 bg-white/95 p-6 sm:p-7 shadow-2xl space-y-6 text-zinc-900 max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-rose-600 text-white shadow-md">
              <PenTool className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-mono font-bold text-rose-800 uppercase tracking-wider">
                  KNOWLEDGE CRUCIBLE
                </span>
                <span className="text-xs font-mono text-zinc-600">Obsidian Vaults &amp; TIL</span>
              </div>
              <h2 className="text-xl font-extrabold tracking-tight text-zinc-900">
                Planet Creative
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

        {/* Narrative */}
        <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4 space-y-2 text-xs text-rose-950">
          <div className="flex items-center gap-2 font-bold font-mono uppercase tracking-wider">
            <Sparkles className="size-3.5 text-rose-600" />
            <span>Continuous Synthesis &amp; Daily Learnings</span>
          </div>
          <p className="text-rose-900 leading-relaxed">
            The intellectual incubator of Zemi Echelon. Housing the <strong>Today I Learned</strong> engineering archive, structured Obsidian knowledge graphs, and architectural blueprints.
          </p>
        </div>

        {/* Notes & Essays */}
        <div className="space-y-2">
          <div className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-600">
            Selected Architectural Essays &amp; Notes
          </div>
          <div className="space-y-2">
            {notes.map((n, idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-zinc-200/80 bg-white p-3.5 flex items-center justify-between gap-3 hover:border-rose-300 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                    <BookOpen className="size-3.5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-zinc-900">{n.title}</div>
                    <div className="text-[10px] font-mono text-zinc-600">{n.category}</div>
                  </div>
                </div>
                <div className="text-[10px] font-mono text-zinc-600 shrink-0">{n.date}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-zinc-100 text-xs font-mono">
          <span className="text-zinc-600">Knowledge Crucible</span>
          <span className="text-rose-700 font-semibold">Continuous Synthesis</span>
        </div>
      </div>
    </div>
  );
}
