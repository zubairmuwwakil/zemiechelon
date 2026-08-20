"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  RotateCcw,
  Trophy,
  CreditCard,
  Bot,
  Compass,
  BookOpen,
  ExternalLink,
  Terminal,
} from "lucide-react";
import { sound } from "@/lib/audio";
import type { CosmicMode } from "../world/DayNightController";

interface CleanPlanetLandingModalProps {
  planetId: string | null;
  cosmicMode: CosmicMode;
  onClose: () => void;
  onOpenTerminal?: () => void;
  onSelectBody?: (bodyId: string) => void;
}

export function CleanPlanetLandingModal({
  planetId,
  cosmicMode,
  onClose,
  onOpenTerminal,
  onSelectBody,
}: CleanPlanetLandingModalProps) {
  // PickleOps State
  const [playerRating, setPlayerRating] = useState(1525);
  const [ratingDeviation, setRatingDeviation] = useState(35);
  const [teamAScore, setTeamAScore] = useState(10);
  const [teamBScore, setTeamBScore] = useState(8);
  const [gamesA, setGamesA] = useState(1);
  const [gamesB, setGamesB] = useState(0);

  // PickMe State
  const [centsPerPoint, setCentsPerPoint] = useState(1.8);

  const isOpen = Boolean(planetId && planetId !== "galaxy" && planetId !== "overview");

  // Dynamic Optimal Card based on Valuation
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

  return (
    <AnimatePresence>
      {isOpen && planetId && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="fixed inset-0 z-40 flex flex-col items-center justify-center p-3 sm:p-6 bg-zinc-950/45 backdrop-blur-md select-none overflow-y-auto"
        >
          {/* 1. Top Header Capsule: Landed on: Planet X + Return to Orbit */}
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -15, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 450, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="mb-4 sm:mb-6 flex items-center gap-3 rounded-full border border-white/20 bg-zinc-900/80 px-4 sm:px-6 py-2 sm:py-2.5 text-white shadow-2xl backdrop-blur-xl"
          >
            <span className="text-xs sm:text-sm font-medium tracking-wide text-zinc-300">
              Landed on:{" "}
              <strong className="text-white capitalize font-semibold">
                Planet {planetId}
              </strong>
            </span>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                sound.playClick(500, 0.05);
                onClose();
              }}
              className="flex items-center gap-1.5 rounded-full bg-white px-3 sm:px-4 py-1 sm:py-1.5 text-xs font-semibold text-zinc-900 shadow-md hover:bg-zinc-100 transition-colors"
            >
              <RotateCcw className="size-3 text-zinc-700" />
              <span>Return to Orbit</span>
            </motion.button>
          </motion.div>

          {/* 2. Main High-Craft Translucent Glass Workstation Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 25 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className={`relative w-full max-w-5xl rounded-3xl p-5 sm:p-8 shadow-2xl transition-colors duration-300 max-h-[84vh] overflow-y-auto border ${
              isDay
                ? "border-zinc-200/80 bg-white/92 text-zinc-900 shadow-zinc-950/10"
                : "border-white/10 bg-zinc-900/85 text-zinc-100 shadow-black/80"
            } backdrop-blur-2xl`}
          >
            {/* ================= PLANET PRODUCTS (SLIDE 3 DESIGN) ================= */}
            {planetId === "products" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
                {/* LEFT PANE: 🎾 PickleOps */}
                <div
                  className={`rounded-2xl border p-5 sm:p-6 space-y-5 ${
                    isDay
                      ? "border-zinc-200/80 bg-zinc-50/70"
                      : "border-white/10 bg-zinc-950/60"
                  }`}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">🎾</span>
                      <div>
                        <h3 className="text-base sm:text-lg font-bold tracking-tight">PickleOps</h3>
                        <p className="text-xs text-zinc-500 font-medium">Roon Tournament Manager</p>
                      </div>
                    </div>
                    <a
                      href="https://github.com/zubairmuwwakil/pickleops"
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 font-mono"
                    >
                      <span>iOS 18 Native</span>
                      <ExternalLink className="size-3" />
                    </a>
                  </div>

                  {/* 1. Round-Robin Court Schedule */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs font-semibold text-zinc-500">
                      <span>Round-Robin Court Schedule</span>
                      <span className="font-mono text-[11px]">Courts 1-4 Matches 1-3</span>
                    </div>
                    <div className="space-y-1.5 font-mono text-xs">
                      <div
                        className={`rounded-xl border p-2.5 flex items-center justify-between ${
                          isDay ? "bg-white border-zinc-200/80" : "bg-zinc-900/80 border-white/5"
                        }`}
                      >
                        <span className="font-bold text-zinc-600 dark:text-zinc-300">Court 1</span>
                        <span className="text-[11px] truncate ml-2">
                          10:00 - Smith/Doe vs. Jones/Lee <span className="text-zinc-600">[9/11, 11/8, 11/7]</span>
                        </span>
                      </div>
                      <div
                        className={`rounded-xl border p-2.5 flex items-center justify-between ${
                          isDay ? "bg-white border-zinc-200/80" : "bg-zinc-900/80 border-white/5"
                        }`}
                      >
                        <span className="font-bold text-zinc-600 dark:text-zinc-300">Court 2</span>
                        <span className="text-[11px] truncate ml-2">
                          11:30 - Mia/Ben vs. Leo/Ana <span className="text-zinc-600">[9/11, 11/8, 11/7]</span>
                        </span>
                      </div>
                      <div
                        className={`rounded-xl border p-2.5 flex items-center justify-between ${
                          isDay ? "bg-white border-zinc-200/80" : "bg-zinc-900/80 border-white/5"
                        }`}
                      >
                        <span className="font-bold text-zinc-600 dark:text-zinc-300">Court 3</span>
                        <span className="text-[11px] truncate ml-2">
                          10:00 - Mia/Ben vs. Jones/Lee <span className="text-zinc-600">[9/11, 11/8, 11/7]</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 2. Glicko-2 Rating Recalculation Slider */}
                  <div className="space-y-2 pt-2 border-t border-zinc-200/60 dark:border-white/10">
                    <div className="flex justify-between items-center text-xs font-semibold">
                      <span>Glicko-2 Rating Recalculation Slider</span>
                    </div>
                    <div className="text-[11px] text-zinc-600">Adjust Glicko-2 Deviation</div>

                    <div className="space-y-1">
                      <input
                        type="range"
                        min="1450"
                        max="1600"
                        step="5"
                        value={playerRating}
                        onChange={(e) => {
                          setPlayerRating(Number(e.target.value));
                          sound.playClick(500 + (Number(e.target.value) - 1450), 0.02);
                        }}
                        className="w-full accent-amber-500 cursor-pointer h-1.5 bg-zinc-300 dark:bg-zinc-700 rounded-lg"
                      />
                      <div className="flex justify-between text-[11px] font-mono text-zinc-600">
                        <span>1500</span>
                        <span className="font-bold text-amber-600 dark:text-amber-400">
                          1500 -&gt; {playerRating} (&plusmn;{ratingDeviation})
                        </span>
                        <span>1525</span>
                      </div>
                    </div>
                  </div>

                  {/* 3. Live Match Score Simulator */}
                  <div className="space-y-2 pt-2 border-t border-zinc-200/60 dark:border-white/10">
                    <div className="flex justify-between items-center text-xs font-semibold text-zinc-500">
                      <span>Live Match Score Simulator</span>
                      <span className="font-mono text-[11px]">Games {gamesA}</span>
                    </div>
                    <div className="text-[11px] text-zinc-600">Court 2</div>

                    <div className="flex items-center gap-2 font-mono text-xs">
                      {/* Score pill */}
                      <div
                        className={`flex-1 flex items-center justify-between rounded-xl border p-2.5 ${
                          isDay ? "bg-white border-zinc-200/80" : "bg-zinc-900/80 border-white/5"
                        }`}
                      >
                        <span>Team Alpha</span>
                        <div className="flex items-center gap-1">
                          <span className="font-black text-sm px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-300">
                            {teamAScore}
                          </span>
                          <span className="text-zinc-600">vs</span>
                          <span className="font-black text-sm px-1.5 py-0.5 rounded-md bg-zinc-500/20 text-zinc-700 dark:text-zinc-300">
                            {teamBScore}
                          </span>
                        </div>
                        <span>Team Beta</span>
                      </div>

                      {/* Score increment controls */}
                      <div className="flex gap-1">
                        <motion.button
                          whileTap={{ scale: 0.92 }}
                          onClick={() => handleScoreAdjust("A", 1)}
                          className="p-2 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-800 hover:bg-zinc-100 text-xs font-bold"
                          title="Add Point to Team Alpha"
                        >
                          &plusmn; pts
                        </motion.button>
                        <motion.button
                          whileTap={{ scale: 0.92 }}
                          onClick={handleNextSet}
                          className="p-2 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-800 hover:bg-zinc-100 text-xs font-bold"
                          title="Next Set"
                        >
                          Next Set
                        </motion.button>
                      </div>
                    </div>
                    <div className="text-[10px] font-mono text-zinc-600">
                      Games {gamesA}-{gamesB}
                    </div>
                  </div>
                </div>

                {/* RIGHT PANE: 💳 PickMe */}
                <div
                  className={`rounded-2xl border p-5 sm:p-6 space-y-5 ${
                    isDay
                      ? "border-zinc-200/80 bg-zinc-50/70"
                      : "border-white/10 bg-zinc-950/60"
                  }`}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">💳</span>
                      <div>
                        <h3 className="text-base sm:text-lg font-bold tracking-tight">PickMe</h3>
                        <p className="text-xs text-zinc-500 font-medium">iOS Card Copilot</p>
                      </div>
                    </div>
                    <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300">
                      Engine v2.4
                    </span>
                  </div>

                  {/* 1. Credit Card Reward Valuation Slider */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-zinc-500">
                        Credit Card Reward Valuation Slider
                      </span>
                      <div className="rounded-xl border border-sky-300/60 bg-sky-50 dark:bg-sky-950/50 px-2.5 py-1 text-[11px] font-mono font-bold text-sky-800 dark:text-sky-300 shadow-xs">
                        Optimal Card: {optimalCard.name}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <input
                        type="range"
                        min="0.5"
                        max="2.5"
                        step="0.1"
                        value={centsPerPoint}
                        onChange={(e) => {
                          setCentsPerPoint(Number(e.target.value));
                          sound.playClick(400 + Number(e.target.value) * 120, 0.02);
                        }}
                        className="w-full accent-sky-600 cursor-pointer h-1.5 bg-zinc-300 dark:bg-zinc-700 rounded-lg"
                      />
                      <div className="flex justify-between text-[11px] font-mono text-zinc-600">
                        <span>0.5cpp</span>
                        <span className="font-bold text-sky-600 dark:text-sky-400">
                          current: {centsPerPoint.toFixed(1)}cpp
                        </span>
                        <span>2.5cpp</span>
                      </div>
                    </div>
                  </div>

                  {/* 2. Earn Rate Breakdown Cards */}
                  <div className="space-y-2.5 pt-2 border-t border-zinc-200/60 dark:border-white/10">
                    <div className="text-xs font-semibold text-zinc-500">Earn Rate Breakdown</div>

                    {/* Sapphire Reserve Card */}
                    <div
                      className={`rounded-xl border p-3.5 space-y-2 ${
                        isDay ? "bg-white border-zinc-200/80" : "bg-zinc-900/80 border-white/5"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold font-mono">Sapphire Reserve</span>
                        <span className="text-[10px] font-mono text-emerald-600 font-semibold">Premium Travel</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                        <div className="rounded-lg bg-zinc-100 dark:bg-zinc-800/80 p-2 text-center">
                          <div className="text-[10px] text-zinc-600">Dining</div>
                          <div className="font-extrabold text-sm text-zinc-900 dark:text-zinc-100">3x</div>
                        </div>
                        <div className="rounded-lg bg-zinc-100 dark:bg-zinc-800/80 p-2 text-center">
                          <div className="text-[10px] text-zinc-600">Travel</div>
                          <div className="font-extrabold text-sm text-zinc-900 dark:text-zinc-100">3x</div>
                        </div>
                        <div className="rounded-lg bg-zinc-100 dark:bg-zinc-800/80 p-2 text-center">
                          <div className="text-[10px] text-zinc-600">Other</div>
                          <div className="font-extrabold text-sm text-zinc-900 dark:text-zinc-100">1x</div>
                        </div>
                      </div>
                    </div>

                    {/* Amex Gold Card */}
                    <div
                      className={`rounded-xl border p-3.5 space-y-2 ${
                        isDay ? "bg-white border-zinc-200/80" : "bg-zinc-900/80 border-white/5"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold font-mono">Amex Gold</span>
                        <span className="text-[10px] font-mono text-amber-600 font-semibold">Everyday Spender</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                        <div className="rounded-lg bg-zinc-100 dark:bg-zinc-800/80 p-2 text-center">
                          <div className="text-[10px] text-zinc-600">Groceries</div>
                          <div className="font-extrabold text-sm text-amber-700 dark:text-amber-400">4x</div>
                        </div>
                        <div className="rounded-lg bg-zinc-100 dark:bg-zinc-800/80 p-2 text-center">
                          <div className="text-[10px] text-zinc-600">Dining</div>
                          <div className="font-extrabold text-sm text-amber-700 dark:text-amber-400">4x</div>
                        </div>
                        <div className="rounded-lg bg-zinc-100 dark:bg-zinc-800/80 p-2 text-center">
                          <div className="text-[10px] text-zinc-600">Flights</div>
                          <div className="font-extrabold text-sm text-zinc-900 dark:text-zinc-100">3x</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ================= PLANET LABS (AUTONOMOUS AI RUNTIMES) ================= */}
            {planetId === "labs" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-zinc-200/60 dark:border-white/10 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-2xl bg-purple-600 text-white shadow-md">
                      <Bot className="size-5" />
                    </div>
                    <div>
                      <h2 className="text-lg sm:text-xl font-extrabold tracking-tight">Planet Labs &amp; Autonomous AI</h2>
                      <p className="text-xs text-zinc-500 font-mono">7 Experimental Repositories · Multi-Agent Orchestration</p>
                    </div>
                  </div>
                  {onOpenTerminal && (
                    <motion.button
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={onOpenTerminal}
                      className="flex items-center gap-1.5 rounded-xl border border-purple-300 dark:border-purple-800 bg-purple-50 dark:bg-purple-950 px-3 py-1.5 text-xs font-mono font-bold text-purple-900 dark:text-purple-200 shadow-sm hover:bg-purple-100 transition-colors"
                    >
                      <Terminal className="size-3.5" />
                      <span>Launch CRT Terminal (&gt;_)</span>
                    </motion.button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
                  <div className="rounded-2xl border border-purple-200 dark:border-purple-900/50 bg-purple-50/50 dark:bg-purple-950/30 p-4 space-y-2">
                    <div className="font-bold text-purple-950 dark:text-purple-200">Agent Orchestrator</div>
                    <div className="text-[11px] text-zinc-600 dark:text-zinc-400">
                      Deterministic DAG task scheduler with retry backoff and state serialization.
                    </div>
                    <div className="text-[10px] text-purple-700 dark:text-purple-400">TypeScript · LangChain</div>
                  </div>

                  <div className="rounded-2xl border border-purple-200 dark:border-purple-900/50 bg-purple-50/50 dark:bg-purple-950/30 p-4 space-y-2">
                    <div className="font-bold text-purple-950 dark:text-purple-200">MindSky</div>
                    <div className="text-[11px] text-zinc-600 dark:text-zinc-400">
                      AT Protocol Bluesky semantic embedding and clustering pipeline.
                    </div>
                    <div className="text-[10px] text-purple-700 dark:text-purple-400">Python · Vector Index</div>
                  </div>

                  <div className="rounded-2xl border border-purple-200 dark:border-purple-900/50 bg-purple-50/50 dark:bg-purple-950/30 p-4 space-y-2">
                    <div className="font-bold text-purple-950 dark:text-purple-200">Command Quest</div>
                    <div className="text-[11px] text-zinc-600 dark:text-zinc-400">
                      Retro text-based developer RPG running directly in browser terminal.
                    </div>
                    <div className="text-[10px] text-purple-700 dark:text-purple-400">TypeScript · WebGL/ANSI</div>
                  </div>
                </div>
              </div>
            )}

            {/* ================= PLANET FOUNDATIONS ================= */}
            {planetId === "foundations" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-zinc-200/60 dark:border-white/10 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-2xl bg-sky-500 text-white shadow-md">
                      <CreditCard className="size-5" />
                    </div>
                    <div>
                      <h2 className="text-lg sm:text-xl font-extrabold tracking-tight">Planet Foundations</h2>
                      <p className="text-xs text-zinc-500 font-mono">19 Bedrock Genesis Repositories (2018–2023)</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 font-mono text-xs">
                  {[
                    { name: "HTMl_CAT_WEBSITE", era: "Genesis (2018)", desc: "First HTML5/CSS canvas exploration" },
                    { name: "JavaAlgorithms", era: "2019", desc: "Data structures & graph algorithms in Java 11" },
                    { name: "CSharpDesignPatterns", era: "2020", desc: "Enterprise OOP architectural patterns" },
                    { name: "SQLServerAnalytics", era: "2021", desc: "Relational querying & stored procedures" },
                    { name: "ReactPortfolioV1", era: "2022", desc: "Early SPA design and state machines" },
                    { name: "GoMicroservices", era: "2023", desc: "Concurrent gRPC services in Golang" },
                  ].map((repo, idx) => (
                    <div
                      key={idx}
                      className={`rounded-2xl border p-3.5 space-y-1.5 ${
                        isDay ? "bg-white border-zinc-200/80" : "bg-zinc-950/60 border-white/10"
                      }`}
                    >
                      <div className="font-bold text-sky-600 dark:text-sky-400 truncate">{repo.name}</div>
                      <div className="text-[10px] text-zinc-500">{repo.era}</div>
                      <div className="text-[11px] text-zinc-600 dark:text-zinc-400">{repo.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ================= PLANET SELF ================= */}
            {planetId === "self" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-zinc-200/60 dark:border-white/10 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md">
                      <Compass className="size-5" />
                    </div>
                    <div>
                      <h2 className="text-lg sm:text-xl font-extrabold tracking-tight">Planet Self &amp; Sacred Zemí</h2>
                      <p className="text-xs text-zinc-500 font-mono">Founder Sphere · Zubair Muwwakil · Semper Plus Ultra</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 text-xs leading-relaxed">
                  <p className="font-serif italic text-base sm:text-lg text-zinc-800 dark:text-zinc-200">
                    &ldquo;Deterministic systems over speculation. Craft enduring software through clarity and discipline.&rdquo;
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono">
                    <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/30 p-4 space-y-2">
                      <div className="font-bold text-emerald-950 dark:text-emerald-200">The Taíno Zemí Triad</div>
                      <div className="text-[11px] text-zinc-600 dark:text-zinc-400">
                        Representing ancestral resilience, spiritual grounding, and unrelenting craft elevation.
                      </div>
                    </div>
                    <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/30 p-4 space-y-2">
                      <div className="font-bold text-emerald-950 dark:text-emerald-200">6 Personal Repositories</div>
                      <div className="text-[11px] text-zinc-600 dark:text-zinc-400">
                        zemiechelon.com, personal dotfiles, configuration vaults, and engineering logs.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ================= PLANET CREATIVE ================= */}
            {planetId === "creative" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-zinc-200/60 dark:border-white/10 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-2xl bg-rose-500 text-white shadow-md">
                      <BookOpen className="size-5" />
                    </div>
                    <div>
                      <h2 className="text-lg sm:text-xl font-extrabold tracking-tight">Planet Creative &amp; Vaults</h2>
                      <p className="text-xs text-zinc-500 font-mono">Knowledge Crucible &amp; Continuous Learning</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
                  <div className="rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/30 p-4 space-y-2">
                    <div className="font-bold text-rose-950 dark:text-rose-200">Today I Learned (TIL)</div>
                    <div className="text-[11px] text-zinc-600 dark:text-zinc-400">
                      Continuous micro-learnings on distributed systems, Swift 6 concurrency, and kernel internals.
                    </div>
                  </div>
                  <div className="rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/30 p-4 space-y-2">
                    <div className="font-bold text-rose-950 dark:text-rose-200">Obsidian Knowledge Vault</div>
                    <div className="text-[11px] text-zinc-600 dark:text-zinc-400">
                      Bi-directional linked notes mapping software engineering principles to real-world architectures.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
