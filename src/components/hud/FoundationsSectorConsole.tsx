"use client";

import { useState } from "react";
import { Code2, X, Terminal, ChevronRight, Binary, Cpu, Sparkles } from "lucide-react";
import { sound } from "@/lib/audio";

interface FoundationsSectorConsoleProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectBody?: (id: string) => void;
}

export function FoundationsSectorConsole({ isOpen, onClose, onSelectBody }: FoundationsSectorConsoleProps) {
  const [selectedAlgo, setSelectedAlgo] = useState<string>("html_cat");

  if (!isOpen) return null;

  const foundationsList = [
    { id: "HTMl_CAT_WEBSITE", name: "HTML Cat Website", date: "2025-11-06", tag: "GENESIS: FIRST WEBSITE", desc: "The very first authored repository. Pure HTML structure and early semantic markup." },
    { id: "JS_Cash_Register", name: "JS Cash Register", date: "2025-11-18", tag: "ALGORITHMIC CORE", desc: "Floating-point precision currency change calculation algorithm." },
    { id: "JS_Cipher", name: "JS Caesar Cipher", date: "2025-11-20", tag: "CRYPTOGRAPHY", desc: "ROT13 substitution cipher encoder and decoder." },
    { id: "Palindrome_Checker", name: "Palindrome Checker", date: "2025-11-22", tag: "STRING PROCESSING", desc: "Regex sanitized bidirectional string evaluation." },
    { id: "Java-Practice", name: "Java Practice", date: "2025-12-04", tag: "OOP & CONCURRENCY", desc: "Object-oriented systems, class hierarchies, and JVM fundamentals." },
  ];

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl rounded-3xl border border-sky-300/80 bg-white/95 p-6 sm:p-7 shadow-2xl space-y-6 text-zinc-900 max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-sky-600 text-white shadow-md">
              <Binary className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-[10px] font-mono font-bold text-sky-800 uppercase tracking-wider">
                  BEDROCK ORIGIN
                </span>
                <span className="text-xs font-mono text-zinc-600">19 Genesis Repositories</span>
              </div>
              <h2 className="text-xl font-extrabold tracking-tight text-zinc-900">
                Planet Foundations
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
        <div className="rounded-2xl border border-sky-200 bg-sky-50/70 p-4 space-y-2 text-xs text-sky-950">
          <div className="flex items-center gap-2 font-bold font-mono uppercase tracking-wider">
            <Sparkles className="size-3.5 text-sky-600" />
            <span>The Genesis Spark (Nov 2025)</span>
          </div>
          <p className="text-sky-900 leading-relaxed">
            Where the journey began. From a repository literally named <em>HTML Cat Website</em> on Nov 6, 2025, to data structures, C# practice, algorithms, and Java OOP mastery that paved the way for enterprise systems.
          </p>
        </div>

        {/* Genesis Repository Archive List */}
        <div className="space-y-2">
          <div className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-600">
            Foundational Milestones Archive (19 Repos)
          </div>
          <div className="space-y-2">
            {foundationsList.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  sound.playClick(600, 0.04);
                  if (onSelectBody) onSelectBody(item.id);
                }}
                className="rounded-2xl border border-zinc-200/80 bg-white p-3.5 hover:border-sky-400 hover:shadow-xs transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-zinc-900">{item.name}</span>
                    <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[9px] font-mono text-zinc-600">
                      {item.tag}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-600">{item.desc}</p>
                </div>
                <div className="text-right text-[10px] font-mono text-zinc-600 shrink-0">
                  {item.date}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-zinc-100 text-xs font-mono">
          <span className="text-zinc-600">Tier 1: Core Algorithms &amp; Syntax</span>
          <span className="text-sky-700 font-semibold">19 Repositories Placed</span>
        </div>
      </div>
    </div>
  );
}
