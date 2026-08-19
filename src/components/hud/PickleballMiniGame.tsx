"use client";

import { useState } from "react";
import { Trophy } from "lucide-react";
import { sound } from "@/lib/audio";

interface PickleballMiniGameProps {
  onScore?: (score: number) => void;
}

export function PickleballMiniGame({ onScore }: PickleballMiniGameProps) {
  const [rallyCount, setRallyCount] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [isSwinging, setIsSwinging] = useState(false);
  const [message, setMessage] = useState("Click to serve & volley!");

  const handlePaddleHit = () => {
    sound.playPaddleHit();
    setIsSwinging(true);
    setTimeout(() => setIsSwinging(false), 150);

    const nextRally = rallyCount + 1;
    setRallyCount(nextRally);

    if (nextRally > bestStreak) {
      setBestStreak(nextRally);
    }

    if (nextRally === 1) {
      setMessage("Nice serve! Keep the rally going!");
    } else if (nextRally === 5) {
      sound.playChime(600, 0.2);
      setMessage("🔥 Dinking master! 5 in a row!");
    } else if (nextRally === 10) {
      sound.playChime(800, 0.4);
      setMessage("🏆 PRO TOUR CHAMPION! 10 Rally Streak!");
    } else {
      setMessage(`Rally streak: ${nextRally} hits!`);
    }

    if (onScore) onScore(nextRally);
  };

  const handleReset = () => {
    sound.playClick(400, 0.05);
    setRallyCount(0);
    setMessage("Ready for a new match!");
  };

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-500 text-white shadow-xs">
            <Trophy className="size-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
              PickleOps Mini-Court Rally
            </h4>
            <p className="text-[11px] font-mono text-emerald-700">
              {message}
            </p>
          </div>
        </div>

        <div className="text-right font-mono">
          <div className="text-sm font-black text-emerald-900">
            {rallyCount} <span className="text-[10px] text-emerald-600">RALLIES</span>
          </div>
          <div className="text-[10px] text-emerald-600">
            Best: {bestStreak}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={handlePaddleHit}
          className={`flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 px-4 text-xs font-bold text-white shadow-md transition-all active:scale-95 hover:bg-emerald-700 ${
            isSwinging ? "scale-95 bg-emerald-800" : ""
          }`}
        >
          <span>🎾 HIT PADDLE VOLLEY</span>
        </button>
        {rallyCount > 0 && (
          <button
            onClick={handleReset}
            className="rounded-xl border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
