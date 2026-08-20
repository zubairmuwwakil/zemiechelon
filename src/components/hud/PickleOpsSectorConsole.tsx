"use client";

import { useState } from "react";
import { Trophy, X, Award, ChevronRight, Activity } from "lucide-react";
import { sound } from "@/lib/audio";

interface PickleOpsSectorConsoleProps {
  isOpen: boolean;
  onClose: () => void;
  onHitPaddle: () => void;
}

export function PickleOpsSectorConsole({ isOpen, onClose, onHitPaddle }: PickleOpsSectorConsoleProps) {
  // Rally state
  const [rallyCount, setRallyCount] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);

  // Glicko-2 recalculator state
  const [playerRating, setPlayerRating] = useState(1500);
  const [playerRD] = useState(200); // Rating Deviation
  const [opponentRating, setOpponentRating] = useState(1620);
  const [matchOutcome, setMatchOutcome] = useState<"win" | "loss">("win");

  if (!isOpen) return null;

  // Pure Glicko-2 recalculation math
  const calculateGlicko2 = () => {
    const q = Math.log(10) / 400;
    const gRD = 1 / Math.sqrt(1 + (3 * q * q * (playerRD * playerRD)) / (Math.PI * Math.PI));
    const expected = 1 / (1 + Math.pow(10, (-gRD * (playerRating - opponentRating)) / 400));
    const actual = matchOutcome === "win" ? 1.0 : 0.0;
    const delta = 32 * (actual - expected);
    const newRating = Math.round(playerRating + delta);
    const newRD = Math.max(50, Math.round(playerRD * 0.92));
    return { newRating, newRD, change: newRating - playerRating };
  };

  const glickoResult = calculateGlicko2();

  const handlePaddleClick = () => {
    sound.playPaddleHit();
    onHitPaddle();
    const next = rallyCount + 1;
    setRallyCount(next);
    if (next > bestStreak) setBestStreak(next);
    if (next % 5 === 0) sound.playChime(750, 0.3);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl rounded-3xl border border-emerald-200/80 bg-white/95 p-6 sm:p-7 shadow-2xl space-y-6 text-zinc-900 max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-md">
              <Trophy className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-mono font-bold text-emerald-800 uppercase tracking-wider">
                  SHIPPED TO APP STORE
                </span>
                <span className="text-xs font-mono text-zinc-600">iOS 18 Native</span>
              </div>
              <h2 className="text-xl font-extrabold tracking-tight text-zinc-900">
                PickleOps &amp; The Pickleball Social
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

        {/* 1. 3D Court Volley Mini-Game Trigger */}
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center sm:text-left">
            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-950 flex items-center justify-center sm:justify-start gap-1.5">
              <Activity className="size-3.5 text-emerald-600" />
              <span>Interactive 3D Court Volley</span>
            </h4>
            <p className="text-xs text-emerald-800">
              Click to strike the 3D paddle on the court and build your rally streak!
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={handlePaddleClick}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-emerald-700 active:scale-95 transition-all"
            >
              <span>🎾 HIT 3D VOLLEY</span>
              <span className="rounded-md bg-emerald-800/60 px-2 py-0.5 text-[10px] font-mono">
                {rallyCount}
              </span>
            </button>
            <div className="text-right text-[11px] font-mono text-emerald-700 shrink-0">
              Best: <span className="font-bold text-emerald-900">{bestStreak}</span>
            </div>
          </div>
        </div>

        {/* 2. Interactive Glicko-2 Rating Recalculator */}
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50/60 p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="size-4 text-emerald-600" />
              <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-zinc-800">
                Glicko-2 Dynamic Rating Recalculator (`glicko2-ts`)
              </h3>
            </div>
            <span className="text-[10px] font-mono text-zinc-600">Pure TypeScript Math</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Player Rating Slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-zinc-600">Player 1 Rating</span>
                <span className="font-bold text-zinc-900">{playerRating}</span>
              </div>
              <input
                type="range"
                min="1000"
                max="2400"
                step="25"
                value={playerRating}
                onChange={(e) => setPlayerRating(Number(e.target.value))}
                className="w-full accent-emerald-600 cursor-pointer"
              />
            </div>

            {/* Opponent Rating Slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-zinc-600">Opponent Rating</span>
                <span className="font-bold text-zinc-900">{opponentRating}</span>
              </div>
              <input
                type="range"
                min="1000"
                max="2400"
                step="25"
                value={opponentRating}
                onChange={(e) => setOpponentRating(Number(e.target.value))}
                className="w-full accent-emerald-600 cursor-pointer"
              />
            </div>
          </div>

          {/* Outcome Selector & Calculation Result */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-200/60">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-zinc-600">Match Outcome:</span>
              <button
                onClick={() => setMatchOutcome("win")}
                className={`px-3 py-1 text-xs font-mono font-bold rounded-lg transition-colors ${
                  matchOutcome === "win"
                    ? "bg-emerald-600 text-white"
                    : "bg-zinc-200 text-zinc-700 hover:bg-zinc-300"
                }`}
              >
                WIN
              </button>
              <button
                onClick={() => setMatchOutcome("loss")}
                className={`px-3 py-1 text-xs font-mono font-bold rounded-lg transition-colors ${
                  matchOutcome === "loss"
                    ? "bg-rose-600 text-white"
                    : "bg-zinc-200 text-zinc-700 hover:bg-zinc-300"
                }`}
              >
                LOSS
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-zinc-600">New Rating:</span>
              <span className="text-sm font-black text-emerald-700">
                {glickoResult.newRating}{" "}
                <span className={glickoResult.change >= 0 ? "text-emerald-600" : "text-rose-600"}>
                  ({glickoResult.change >= 0 ? `+${glickoResult.change}` : glickoResult.change})
                </span>
              </span>
              <span className="text-[10px] text-zinc-600">RD: ±{glickoResult.newRD}</span>
            </div>
          </div>
        </div>

        {/* 3. 4-Court Round-Robin Rotation Schedule */}
        <div className="space-y-2">
          <div className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-600">
            Automated Round-Robin Court Rotations
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
            <div className="rounded-xl border border-zinc-200 bg-white p-2.5 flex justify-between items-center">
              <span className="font-bold text-zinc-800">Court 1 (Skill 4.0+)</span>
              <span className="text-zinc-600">Zubair / Marcus vs. Alex / Jordan</span>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-2.5 flex justify-between items-center">
              <span className="font-bold text-zinc-800">Court 2 (Skill 3.5+)</span>
              <span className="text-zinc-600">Taylor / Sam vs. Chris / Morgan</span>
            </div>
          </div>
        </div>

        {/* Footer Link */}
        <div className="flex items-center justify-between pt-2 border-t border-zinc-100 text-xs font-mono">
          <a
            href="https://github.com/zubairmuwwakil/pickleops"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-900 font-semibold"
          >
            <span>github.com/zubairmuwwakil/pickleops</span>
            <ChevronRight className="size-3.5" />
          </a>
          <span className="text-zinc-600">Full-Stack Tournament Ops</span>
        </div>
      </div>
    </div>
  );
}
