"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Bot, ExternalLink, Terminal } from "lucide-react";
import { sound } from "@/lib/audio";
import type { ScopeId } from "@/lib/atlas/types";
import type { CosmicMode } from "../world/DayNightController";

interface LandedConsolePanelProps {
  /** The scope the camera has descended into, or null when in orbit. */
  scopeId: ScopeId | null;
  cosmicMode: CosmicMode;
  onClose: () => void;
  onOpenTerminal?: () => void;
  /**
   * False while something is stacked above the panel. Escape belongs to the
   * topmost thing on screen; without this, dismissing the terminal launched
   * from here also evicted the camera from the planet behind it.
   */
  escapeEnabled?: boolean;
}

/**
 * The consoles' home between the landing modal and the diorama.
 *
 * The landing modal this replaces covered the whole viewport and blurred it, so
 * "landing" was asserted by hiding the scene rather than shown by moving the
 * camera into it. This docks to one edge: the descent is the evidence, and the
 * consoles annotate the frame you have arrived in rather than replacing it.
 *
 * Plan 3 mounts these on the diorama surface, at which point the panel goes.
 */
export function LandedConsolePanel({
  scopeId,
  cosmicMode,
  onClose,
  onOpenTerminal,
  escapeEnabled = true,
}: LandedConsolePanelProps) {
  // PickleOps state
  const [playerRating, setPlayerRating] = useState(1525);
  const [ratingDeviation] = useState(35);
  const [teamAScore, setTeamAScore] = useState(10);
  const [teamBScore, setTeamBScore] = useState(8);
  const [gamesA, setGamesA] = useState(1);
  const [gamesB, setGamesB] = useState(0);

  // PickMe state
  const [centsPerPoint, setCentsPerPoint] = useState(1.8);

  const isOpen = Boolean(scopeId);
  const arm = scopeId?.replace("planet:", "") ?? null;

  // Escape ascends — but only while this panel is the topmost thing, so it
  // never steals the key from a dialog opened on top of it.
  useEffect(() => {
    if (!isOpen || !escapeEnabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, escapeEnabled, onClose]);

  // Dynamic optimal card based on valuation
  const optimalCard =
    centsPerPoint >= 1.6
      ? { name: "Sapphire Reserve", rate: "3x / 1.8cpp", badge: "Max Flight ROI" }
      : centsPerPoint >= 1.2
      ? { name: "Amex Cobalt", rate: "5x Points", badge: "Max Multiplier" }
      : { name: "Scotia Momentum", rate: "4% Cash Back", badge: "Pure Cash" };

  const handleScoreAdjust = (team: "A" | "B", delta: number) => {
    sound.playClick(600 + delta * 50, 0.04);
    if (team === "A") setTeamAScore((s) => Math.max(0, s + delta));
    else setTeamBScore((s) => Math.max(0, s + delta));
  };

  const handleNextSet = () => {
    sound.playChime(700, 0.2);
    if (teamAScore > teamBScore) setGamesA((g) => g + 1);
    else if (teamBScore > teamAScore) setGamesB((g) => g + 1);
    setTeamAScore(0);
    setTeamBScore(0);
  };

  const isDay = cosmicMode === "day";

  /**
   * One theme source. Tailwind's `dark:` variant is media-driven, so it answers
   * the OS rather than the atlas's own day/night control — on a machine that
   * prefers dark it painted white text onto this light panel. Everything below
   * reads `isDay` and nothing reads the media query.
   */
  const c = {
    panel: isDay
      ? "border-zinc-200/80 bg-white/92 text-zinc-900 shadow-zinc-950/10"
      : "border-white/10 bg-zinc-900/88 text-zinc-100 shadow-black/80",
    divider: isDay ? "border-zinc-200/70" : "border-white/10",
    well: isDay ? "border-zinc-200/80 bg-zinc-50/70" : "border-white/10 bg-zinc-950/60",
    card: isDay ? "border-zinc-200/80 bg-white" : "border-white/5 bg-zinc-900/80",
    muted: isDay ? "text-zinc-500" : "text-zinc-400",
    dim: isDay ? "text-zinc-600" : "text-zinc-400",
    strong: isDay ? "text-zinc-900" : "text-zinc-50",
    exit: isDay ? "bg-zinc-900 text-white hover:bg-zinc-700" : "bg-white text-zinc-900 hover:bg-zinc-200",
    button: isDay
      ? "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-100"
      : "border-white/10 bg-zinc-800 text-zinc-100 hover:bg-zinc-700",
    track: isDay ? "bg-zinc-300" : "bg-zinc-700",
    amber: isDay ? "text-amber-700" : "text-amber-400",
    sky: isDay ? "text-sky-700" : "text-sky-300",
    skyChip: isDay
      ? "border-sky-300/60 bg-sky-50 text-sky-800"
      : "border-sky-400/30 bg-sky-950/50 text-sky-300",
    tile: isDay ? "bg-zinc-100" : "bg-zinc-800/80",
    labCard: isDay
      ? "border-purple-200 bg-purple-50/50 text-purple-950"
      : "border-purple-900/50 bg-purple-950/30 text-purple-200",
    labButton: isDay
      ? "border-purple-300 bg-purple-50 text-purple-900 hover:bg-purple-100"
      : "border-purple-800 bg-purple-950 text-purple-200 hover:bg-purple-900",
  };

  return (
    <AnimatePresence>
      {isOpen && arm && (
        <motion.aside
          key="landed-panel"
          initial={{ opacity: 0, x: 40, y: 40 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          exit={{ opacity: 0, x: 30, y: 30 }}
          transition={{ type: "spring", stiffness: 380, damping: 34 }}
          aria-label={`Landed on planet ${arm}`}
          className={`pointer-events-auto fixed z-40 flex flex-col overflow-hidden border shadow-2xl backdrop-blur-xl
            inset-x-2 bottom-2 max-h-[58vh] rounded-2xl
            sm:inset-x-auto sm:right-4 sm:top-24 sm:bottom-4 sm:w-[26rem] sm:max-h-none sm:rounded-3xl ${c.panel}`}
        >
          {/* Header: where you are, and the way back out */}
          <div
            className={`flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3 ${c.divider}`}
          >
            <span className={`text-xs font-medium tracking-wide ${c.muted}`}>
              Landed on:{" "}
              <strong className={`font-semibold capitalize ${c.strong}`}>
                Planet {arm}
              </strong>
            </span>
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                sound.playClick(500, 0.05);
                onClose();
              }}
              title="Return to orbit (Esc)"
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors ${c.exit}`}
            >
              <RotateCcw className="size-3" />
              <span>Return to Orbit</span>
            </motion.button>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            {/* ================= PLANET PRODUCTS ================= */}
            {arm === "products" && (
              <>
                {/* 🎾 PickleOps */}
                <div
                  className={`space-y-5 rounded-2xl border p-4 ${c.well}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">🎾</span>
                      <div>
                        <h3 className="text-base font-bold tracking-tight">PickleOps</h3>
                        <p className={`text-xs font-medium ${c.muted}`}>Roon Tournament Manager</p>
                      </div>
                    </div>
                    <a
                      href="https://github.com/zubairmuwwakil/pickleops"
                      target="_blank"
                      rel="noreferrer"
                      className={`flex items-center gap-1 font-mono text-xs hover:underline ${c.amber}`}
                    >
                      <span>iOS 18</span>
                      <ExternalLink className="size-3" />
                    </a>
                  </div>

                  {/* 1. Round-Robin Court Schedule */}
                  <div className="space-y-2">
                    <div className={`flex items-center justify-between text-xs font-semibold ${c.muted}`}>
                      <span>Round-Robin Court Schedule</span>
                      <span className="font-mono text-[11px]">Courts 1-4</span>
                    </div>
                    <div className="space-y-1.5 font-mono text-xs">
                      {[
                        { court: "Court 1", line: "10:00 - Smith/Doe vs. Jones/Lee" },
                        { court: "Court 2", line: "11:30 - Mia/Ben vs. Leo/Ana" },
                        { court: "Court 3", line: "10:00 - Mia/Ben vs. Jones/Lee" },
                      ].map((row) => (
                        <div
                          key={row.court}
                          className={`flex items-center justify-between rounded-xl border p-2.5 ${c.card}`}
                        >
                          <span className={`font-bold ${c.dim}`}>{row.court}</span>
                          <span className="ml-2 truncate text-[11px]">
                            {row.line} <span className={c.muted}>[9/11, 11/8, 11/7]</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 2. Glicko-2 Rating Recalculation Slider */}
                  <div className={`space-y-2 border-t pt-2 ${c.divider}`}>
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span>Glicko-2 Rating Recalculation</span>
                    </div>
                    <div className={`text-[11px] ${c.dim}`}>Adjust Glicko-2 Deviation</div>
                    <div className="space-y-1">
                      <input
                        type="range"
                        min="1450"
                        max="1600"
                        step="5"
                        value={playerRating}
                        aria-label="Glicko-2 rating"
                        onChange={(e) => {
                          setPlayerRating(Number(e.target.value));
                          sound.playClick(500 + (Number(e.target.value) - 1450), 0.02);
                        }}
                        className={`h-1.5 w-full cursor-pointer rounded-lg accent-amber-500 ${c.track}`}
                      />
                      <div className={`flex justify-between font-mono text-[11px] ${c.dim}`}>
                        <span>1450</span>
                        <span className={`font-bold ${c.amber}`}>
                          1500 -&gt; {playerRating} (&plusmn;{ratingDeviation})
                        </span>
                        <span>1600</span>
                      </div>
                    </div>
                  </div>

                  {/* 3. Live Match Score Simulator */}
                  <div className={`space-y-2 border-t pt-2 ${c.divider}`}>
                    <div className={`flex items-center justify-between text-xs font-semibold ${c.muted}`}>
                      <span>Live Match Score Simulator</span>
                      <span className="font-mono text-[11px]">Court 2</span>
                    </div>
                    <div
                      className={`flex items-center justify-between rounded-xl border p-2.5 font-mono text-xs ${c.card}`}
                    >
                      <span>Team Alpha</span>
                      <div className="flex items-center gap-1">
                        <span className={`rounded-md bg-amber-500/25 px-1.5 py-0.5 text-sm font-black ${c.amber}`}>
                          {teamAScore}
                        </span>
                        <span className={c.muted}>vs</span>
                        <span className={`rounded-md bg-zinc-500/20 px-1.5 py-0.5 text-sm font-black ${c.strong}`}>
                          {teamBScore}
                        </span>
                      </div>
                      <span>Team Beta</span>
                    </div>
                    <div className="flex gap-1.5">
                      <motion.button
                        whileTap={{ scale: 0.92 }}
                        onClick={() => handleScoreAdjust("A", 1)}
                        title="Add Point to Team Alpha"
                        className={`flex-1 rounded-xl border p-2 text-xs font-bold ${c.button}`}
                      >
                        + Alpha
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.92 }}
                        onClick={() => handleScoreAdjust("B", 1)}
                        title="Add Point to Team Beta"
                        className={`flex-1 rounded-xl border p-2 text-xs font-bold ${c.button}`}
                      >
                        + Beta
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.92 }}
                        onClick={handleNextSet}
                        title="Next Set"
                        className={`flex-1 rounded-xl border p-2 text-xs font-bold ${c.button}`}
                      >
                        Next Set
                      </motion.button>
                    </div>
                    <div className={`font-mono text-[10px] ${c.dim}`}>
                      Games {gamesA}-{gamesB}
                    </div>
                  </div>
                </div>

                {/* 💳 PickMe */}
                <div
                  className={`space-y-5 rounded-2xl border p-4 ${c.well}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">💳</span>
                      <div>
                        <h3 className="text-base font-bold tracking-tight">PickMe</h3>
                        <p className={`text-xs font-medium ${c.muted}`}>iOS Card Copilot</p>
                      </div>
                    </div>
                    <span className={`rounded-md border px-2 py-0.5 font-mono text-xs ${c.skyChip}`}>
                      Engine v2.4
                    </span>
                  </div>

                  {/* 1. Credit Card Reward Valuation Slider */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-xs font-semibold ${c.muted}`}>Reward Valuation</span>
                      <div className={`rounded-xl border px-2.5 py-1 font-mono text-[11px] font-bold shadow-xs ${c.skyChip}`}>
                        Optimal: {optimalCard.name}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <input
                        type="range"
                        min="0.5"
                        max="2.5"
                        step="0.1"
                        value={centsPerPoint}
                        aria-label="Cents per point"
                        onChange={(e) => {
                          setCentsPerPoint(Number(e.target.value));
                          sound.playClick(400 + Number(e.target.value) * 120, 0.02);
                        }}
                        className={`h-1.5 w-full cursor-pointer rounded-lg accent-sky-600 ${c.track}`}
                      />
                      <div className={`flex justify-between font-mono text-[11px] ${c.dim}`}>
                        <span>0.5cpp</span>
                        <span className={`font-bold ${c.sky}`}>
                          current: {centsPerPoint.toFixed(1)}cpp
                        </span>
                        <span>2.5cpp</span>
                      </div>
                      <div className={`font-mono text-[10px] ${c.muted}`}>
                        {optimalCard.rate} · {optimalCard.badge}
                      </div>
                    </div>
                  </div>

                  {/* 2. Earn Rate Breakdown Cards */}
                  <div className={`space-y-2.5 border-t pt-2 ${c.divider}`}>
                    <div className={`text-xs font-semibold ${c.muted}`}>Earn Rate Breakdown</div>
                    {[
                      {
                        card: "Sapphire Reserve",
                        tag: "Premium Travel",
                        tagClass: isDay ? "text-emerald-700" : "text-emerald-400",
                        rows: [
                          { label: "Dining", value: "3x", accent: false },
                          { label: "Travel", value: "3x", accent: false },
                          { label: "Other", value: "1x", accent: false },
                        ],
                      },
                      {
                        card: "Amex Gold",
                        tag: "Everyday Spender",
                        tagClass: isDay ? "text-amber-700" : "text-amber-400",
                        rows: [
                          { label: "Groceries", value: "4x", accent: true },
                          { label: "Dining", value: "4x", accent: true },
                          { label: "Flights", value: "3x", accent: false },
                        ],
                      },
                    ].map((card) => (
                      <div
                        key={card.card}
                        className={`space-y-2 rounded-xl border p-3.5 ${c.card}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold">{card.card}</span>
                          <span className={`font-mono text-[10px] font-semibold ${card.tagClass}`}>
                            {card.tag}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 font-mono text-xs">
                          {card.rows.map((r) => (
                            <div
                              key={r.label}
                              className={`rounded-lg p-2 text-center ${c.tile}`}
                            >
                              <div className={`text-[10px] ${c.dim}`}>{r.label}</div>
                              <div
                                className={`text-sm font-extrabold ${
                                  r.accent ? c.amber : c.strong
                                }`}
                              >
                                {r.value}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* ================= PLANET LABS ================= */}
            {arm === "labs" && (
              <div className="space-y-4">
                <div className={`flex items-center gap-3 border-b pb-4 ${c.divider}`}>
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-purple-600 text-white shadow-md">
                    <Bot className="size-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold tracking-tight">Labs &amp; Autonomous AI</h2>
                    <p className={`font-mono text-xs ${c.muted}`}>Multi-Agent Orchestration</p>
                  </div>
                </div>

                {onOpenTerminal && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={onOpenTerminal}
                    className={`flex w-full items-center justify-center gap-1.5 rounded-xl border px-3 py-2 font-mono text-xs font-bold shadow-sm transition-colors ${c.labButton}`}
                  >
                    <Terminal className="size-3.5" />
                    <span>Launch CRT Terminal (&gt;_)</span>
                  </motion.button>
                )}

                <div className="grid grid-cols-1 gap-3 font-mono text-xs">
                  {[
                    {
                      name: "Agent Orchestrator",
                      desc: "Deterministic DAG task scheduler with retry backoff and state serialization.",
                      stack: "TypeScript · LangChain",
                    },
                    {
                      name: "MindSky",
                      desc: "AT Protocol Bluesky semantic embedding and clustering pipeline.",
                      stack: "Python · Vector Index",
                    },
                    {
                      name: "Command Quest",
                      desc: "Retro text-based developer RPG running directly in browser terminal.",
                      stack: "TypeScript · WebGL/ANSI",
                    },
                  ].map((repo) => (
                    <div
                      key={repo.name}
                      className={`space-y-2 rounded-2xl border p-4 ${c.labCard}`}
                    >
                      <div className="font-bold">{repo.name}</div>
                      <div className={`text-[11px] ${c.dim}`}>{repo.desc}</div>
                      <div className={`text-[10px] ${isDay ? "text-purple-700" : "text-purple-400"}`}>{repo.stack}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
