"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  RotateCcw,
  Terminal,
  Volume2,
  VolumeX,
  Sun,
  Moon,
  Search,
} from "lucide-react";
import type { CosmicMode } from "../world/DayNightController";
import type { CameraTargetPreset } from "../world/WorldCameraManager";
import { GithubIcon } from "../icons/GithubIcon";
import { ZemiMark } from "../icons/ZemiMark";
import { sound } from "@/lib/audio";

interface WorldHUDProps {
  cosmicMode: CosmicMode;
  onToggleCosmicMode: () => void;
  activePreset: CameraTargetPreset;
  onSelectPreset: (preset: CameraTargetPreset) => void;
  onResetView: () => void;
  isDossierOpen: boolean;
  onToggleDossier: () => void;
  onOpenTerminal: () => void;
}

export function WorldHUD({
  cosmicMode,
  onToggleCosmicMode,
  activePreset,
  onSelectPreset,
  onResetView,
  isDossierOpen,
  onToggleDossier,
  onOpenTerminal,
}: WorldHUDProps) {
  const [isMuted, setIsMuted] = useState(sound.getMuted());

  const handleToggleSound = () => {
    const nextMuted = !isMuted;
    sound.setMuted(nextMuted);
    setIsMuted(nextMuted);
  };

  const isDay = cosmicMode === "day";

  const sectors = [
    { id: "foundations", label: "Foundations" },
    { id: "products", label: "Products" },
    { id: "labs", label: "Labs" },
    { id: "self", label: "Self" },
    { id: "creative", label: "Creative" },
  ];

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-30 p-3 sm:p-5 select-none">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        {/* 1. Left Brand Badge */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.96 }}
          onClick={onResetView}
          className={`pointer-events-auto cursor-pointer flex items-center gap-3 rounded-2xl px-3.5 py-2 transition-colors duration-300 ${
            isDay ? "glass-pill-day text-zinc-900" : "glass-pill-night text-zinc-100"
          }`}
          title="Reset to Celestial Galaxy Orbit"
        >
          <div className="flex size-8 items-center justify-center rounded-xl bg-zinc-950 p-1 shadow-sm text-white">
            <ZemiMark className="size-full" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-extrabold tracking-tight">
              ZEMI ECHELON
            </span>
            <span className="text-[9px] font-mono tracking-widest text-amber-600 dark:text-amber-400 font-semibold">
              CELESTIAL ATLAS
            </span>
          </div>
        </motion.div>

        {/* 2. Center Segmented Capsule Pill Dock with Fluid Framer-Motion Spring Morphing */}
        <nav
          className={`pointer-events-auto hidden md:flex items-center rounded-full p-1.5 transition-all duration-300 ${
            isDay ? "glass-pill-day" : "glass-pill-night"
          }`}
        >
          {sectors.map((sec, idx) => {
            const isSelected = activePreset === sec.id;

            return (
              <div key={sec.id} className="flex items-center relative">
                {idx > 0 && (
                  <div
                    className={`h-3 w-px mx-0.5 ${
                      isDay ? "bg-zinc-300/70" : "bg-white/10"
                    }`}
                  />
                )}
                <button
                  onClick={() => {
                    sound.playClick(600, 0.05);
                    onSelectPreset(sec.id);
                  }}
                  className={`relative rounded-full px-4 py-1.5 text-xs font-medium transition-colors duration-200 z-10 ${
                    isSelected
                      ? isDay
                        ? "text-zinc-950 font-semibold"
                        : "text-white font-semibold"
                      : isDay
                      ? "text-zinc-600 hover:text-zinc-900"
                      : "text-zinc-400 hover:text-zinc-100"
                  }`}
                >
                  {/* Fluid Spring Morphing Pill */}
                  {isSelected && (
                    <motion.div
                      layoutId="activeSegmentPill"
                      className={`absolute inset-0 rounded-full shadow-md z-[-1] ${
                        isDay
                          ? "bg-white border border-zinc-200/90 shadow-zinc-950/10"
                          : "bg-white/18 border border-white/25 shadow-black/40 backdrop-blur-md"
                      }`}
                      transition={{
                        type: "spring",
                        stiffness: 480,
                        damping: 36,
                      }}
                    />
                  )}
                  <span>{sec.label}</span>
                </button>
              </div>
            );
          })}
        </nav>

        {/* 3. Right Utility Icons with Micro-Spring Interactions */}
        <div className="pointer-events-auto flex items-center gap-2">
          {/* Day / Night Mode Toggle */}
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => {
              sound.playClick(500, 0.06);
              onToggleCosmicMode();
            }}
            className={`flex size-9 items-center justify-center rounded-full transition-colors ${
              isDay ? "glass-pill-day text-amber-700" : "glass-pill-night text-amber-300"
            }`}
            title={`Switch to ${isDay ? "Cosmic Night" : "Solar Day"} Mode`}
          >
            {isDay ? <Sun className="size-4 text-amber-600" /> : <Moon className="size-4 text-amber-300" />}
          </motion.button>

          {/* Quick Dossier (44 Repos) */}
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => {
              sound.playClick(500, 0.06);
              onToggleDossier();
            }}
            className={`flex size-9 items-center justify-center rounded-full transition-colors ${
              isDossierOpen
                ? "bg-zinc-900 text-white shadow-lg"
                : isDay
                ? "glass-pill-day text-zinc-700 hover:text-zinc-900"
                : "glass-pill-night text-zinc-300 hover:text-white"
            }`}
            title="Dossier & Repo Search (44 Repositories)"
          >
            <Search className="size-3.5" />
          </motion.button>

          {/* Command Quest Terminal (>_) */}
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => {
              sound.playTerminalKey();
              onOpenTerminal();
            }}
            className={`hidden sm:flex size-9 items-center justify-center rounded-full transition-colors ${
              isDay
                ? "glass-pill-day text-zinc-700 hover:text-zinc-900"
                : "glass-pill-night text-zinc-300 hover:text-white"
            }`}
            title="Command Quest CRT Terminal (>_)"
          >
            <Terminal className="size-3.5" />
          </motion.button>

          {/* Sound Toggle */}
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onClick={handleToggleSound}
            className={`flex size-9 items-center justify-center rounded-full transition-colors ${
              !isMuted
                ? isDay
                  ? "glass-pill-day text-emerald-700"
                  : "glass-pill-night text-emerald-400"
                : isDay
                ? "glass-pill-day text-zinc-500"
                : "glass-pill-night text-zinc-500"
            }`}
            title={isMuted ? "Unmute Audio Effects" : "Mute Audio Effects"}
          >
            {!isMuted ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}
          </motion.button>

          {/* Reset Orbit View */}
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => {
              sound.playClick(400, 0.06);
              onResetView();
            }}
            className={`flex size-9 items-center justify-center rounded-full transition-colors ${
              isDay
                ? "glass-pill-day text-zinc-700 hover:text-zinc-900"
                : "glass-pill-night text-zinc-300 hover:text-white"
            }`}
            title="Reset to Galaxy Overview"
          >
            <RotateCcw className="size-3.5" />
          </motion.button>

          {/* GitHub link */}
          <motion.a
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            href="https://github.com/zubairmuwwakil"
            target="_blank"
            rel="noreferrer"
            className={`hidden lg:flex size-9 items-center justify-center rounded-full transition-colors ${
              isDay
                ? "glass-pill-day text-zinc-700 hover:text-zinc-900"
                : "glass-pill-night text-zinc-300 hover:text-white"
            }`}
            aria-label="GitHub Profile"
          >
            <GithubIcon className="size-3.5" />
          </motion.a>
        </div>
      </div>
    </header>
  );
}
