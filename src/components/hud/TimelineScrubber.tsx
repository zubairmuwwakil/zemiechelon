"use client";

import { useState } from "react";
import { History, Calendar, Sparkles } from "lucide-react";
import { sound } from "@/lib/audio";

interface TimelineScrubberProps {
  onDateChange?: (days: number) => void;
}

export function TimelineScrubber({ onDateChange }: TimelineScrubberProps) {
  const [dayOffset, setDayOffset] = useState(286); // 286 days total span
  const [isOpen, setIsOpen] = useState(false);

  const milestones = [
    { day: 0, date: "Nov 06, 2025", title: "Genesis: First Website", repos: "1 repo" },
    { day: 58, date: "Jan 03, 2026", title: "MarketLens Spring Boot Pipeline", repos: "8 repos" },
    { day: 251, date: "Jul 15, 2026", title: "PickleOps Shipped to App Store", repos: "28 repos" },
    { day: 286, date: "Aug 19, 2026", title: "Inunity & PickMe Continuum", repos: "44 repos" },
  ];

  const currentMilestone = milestones.reduce((prev, curr) => (dayOffset >= curr.day ? curr : prev));

  const handleSliderChange = (val: number) => {
    setDayOffset(val);
    sound.playClick(300 + val * 2, 0.02);
    if (onDateChange) onDateChange(val);
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center px-4">
      <div className="pointer-events-auto flex flex-col items-center gap-2 max-w-xl w-full">
        {/* Toggleable Detailed Milestone Card */}
        {isOpen && (
          <div className="w-full rounded-2xl border border-zinc-200/80 bg-white/95 p-4 shadow-xl backdrop-blur-md space-y-2 animate-in fade-in slide-in-from-bottom-2 text-zinc-900">
            <div className="flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-1.5 font-bold text-amber-800">
                <Sparkles className="size-3.5 text-amber-500" />
                <span>The 286-Day Evolution Trajectory</span>
              </div>
              <span className="text-zinc-500">Day {dayOffset} / 286</span>
            </div>

            <div className="flex justify-between items-center bg-amber-50/70 p-2.5 rounded-xl border border-amber-200/70 text-xs font-mono">
              <div>
                <div className="font-bold text-zinc-900">{currentMilestone.title}</div>
                <div className="text-[10px] text-zinc-500">{currentMilestone.date}</div>
              </div>
              <span className="rounded-md bg-amber-200/80 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                {currentMilestone.repos}
              </span>
            </div>

            {/* Slider */}
            <div className="pt-1">
              <input
                type="range"
                min="0"
                max="286"
                value={dayOffset}
                onChange={(e) => handleSliderChange(Number(e.target.value))}
                className="w-full accent-amber-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] font-mono text-zinc-500 pt-1">
                <span>Nov 2025 (Genesis)</span>
                <span>Jul 2026 (PickleOps)</span>
                <span>Aug 2026 (Frontier)</span>
              </div>
            </div>
          </div>
        )}

        {/* Minimalist Floating Pill Bar */}
        <div className="flex items-center gap-2 rounded-full border border-zinc-200/80 bg-white/90 px-4 py-1.5 text-xs font-mono text-zinc-700 shadow-lg backdrop-blur-md">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="inline-flex items-center gap-1.5 font-bold text-amber-800 hover:text-amber-950 transition-colors"
          >
            <History className="size-3.5 text-amber-600" />
            <span>286-Day Evolution: {currentMilestone.date}</span>
          </button>
          <span className="text-zinc-300">|</span>
          <span className="hidden sm:inline text-zinc-500">
            Click any 3D sector to interact
          </span>
          <span className="sm:hidden text-zinc-500">Tap sector to open</span>
        </div>
      </div>
    </div>
  );
}
