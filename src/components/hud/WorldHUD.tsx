"use client";

import { useState } from "react";
import {
  FileText,
  FlaskConical,
  Map,
  PenTool,
  RotateCcw,
  Rocket,
  Sprout,
  Terminal,
  User,
  Volume2,
  VolumeX,
} from "lucide-react";
import { ARMS } from "@/data/arms";
import type { ArmId } from "@/lib/atlas/types";
import { GithubIcon } from "../icons/GithubIcon";
import { ZemiMark } from "../icons/ZemiMark";
import { sound } from "@/lib/audio";

interface WorldHUDProps {
  selectedArmId: ArmId | null;
  onSelectArm: (armId: ArmId | null) => void;
  onResetView: () => void;
  isDossierOpen: boolean;
  onToggleDossier: () => void;
  onOpenTerminal: () => void;
}

const ICONS_MAP: Record<string, React.ElementType> = {
  Sprout,
  Rocket,
  FlaskConical,
  User,
  PenTool,
};

export function WorldHUD({
  selectedArmId,
  onSelectArm,
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

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-30 p-3 sm:p-5">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        {/* Brand Badge */}
        <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-zinc-200/80 bg-white/90 px-3.5 py-2 shadow-lg backdrop-blur-md transition-all hover:bg-white">
          <div className="flex size-9 items-center justify-center rounded-xl bg-zinc-950 p-1 shadow-sm">
            <ZemiMark className="size-full" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-extrabold tracking-tight text-zinc-900">
              ZEMI ECHELON
            </span>
            <span className="text-[9px] font-mono tracking-wider text-zinc-600">
              CELESTIAL ATLAS
            </span>
          </div>
        </div>

        {/* Center Quick Jump Arm Dock (Desktop & Tablet) */}
        <nav className="pointer-events-auto hidden md:flex items-center gap-1 rounded-2xl border border-zinc-200/80 bg-white/90 p-1 shadow-lg backdrop-blur-md">
          {ARMS.map((arm) => {
            const isSelected = selectedArmId === arm.id;
            const IconComponent = ICONS_MAP[arm.icon] || Sprout;

            return (
              <button
                key={arm.id}
                onClick={() => {
                  sound.playClick(600, 0.05);
                  onSelectArm(isSelected ? null : arm.id);
                }}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all duration-150 ${
                  isSelected
                    ? "bg-zinc-900 text-white shadow-sm"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                }`}
              >
                <IconComponent className="size-3.5" />
                <span>{arm.shortName}</span>
              </button>
            );
          })}
        </nav>

        {/* Right Controls */}
        <div className="pointer-events-auto flex items-center gap-2">
          {/* Sound Toggle */}
          <button
            onClick={handleToggleSound}
            className={`flex size-9 items-center justify-center rounded-xl border shadow-lg backdrop-blur-md transition-all ${
              !isMuted
                ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                : "border-zinc-200/80 bg-white/90 text-zinc-600 hover:bg-zinc-50"
            }`}
            title={isMuted ? "Unmute sound effects" : "Mute audio"}
          >
            {!isMuted ? (
              <Volume2 className="size-4" />
            ) : (
              <VolumeX className="size-4" />
            )}
          </button>

          {/* Command Quest Terminal Button */}
          <button
            onClick={() => {
              sound.playTerminalKey();
              onOpenTerminal();
            }}
            className="hidden sm:flex size-9 items-center justify-center rounded-xl border border-zinc-200/80 bg-white/90 text-zinc-700 shadow-lg backdrop-blur-md hover:bg-zinc-50 hover:text-zinc-900 transition-colors"
            title="Command Quest Terminal"
          >
            <Terminal className="size-4" />
          </button>

          {/* Reset Camera button */}
          <button
            onClick={() => {
              sound.playClick(400, 0.06);
              onResetView();
            }}
            className="flex size-9 items-center justify-center rounded-xl border border-zinc-200/80 bg-white/90 text-zinc-700 shadow-lg backdrop-blur-md hover:bg-zinc-50 hover:text-zinc-900 transition-colors"
            title="Reset to Overview"
          >
            <RotateCcw className="size-4" />
          </button>

          {/* Toggle Dossier / List View */}
          <button
            onClick={() => {
              sound.playClick(500, 0.06);
              onToggleDossier();
            }}
            className={`flex h-9 items-center gap-1.5 rounded-xl border px-3.5 text-xs font-semibold shadow-lg backdrop-blur-md transition-all ${
              isDossierOpen
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-200/80 bg-white/90 text-zinc-700 hover:bg-white hover:text-zinc-900"
            }`}
          >
            {isDossierOpen ? (
              <>
                <Map className="size-3.5" />
                <span className="hidden sm:inline">Atlas</span>
              </>
            ) : (
              <>
                <FileText className="size-3.5" />
                <span className="hidden sm:inline">Dossier</span>
              </>
            )}
          </button>

          {/* GitHub link */}
          <a
            href="https://github.com/zubairmuwwakil"
            target="_blank"
            rel="noreferrer"
            className="hidden lg:flex size-9 items-center justify-center rounded-xl border border-zinc-200/80 bg-white/90 text-zinc-700 shadow-lg backdrop-blur-md hover:bg-zinc-50 hover:text-zinc-900 transition-colors"
            aria-label="GitHub Profile"
          >
            <GithubIcon className="size-4" />
          </a>
        </div>
      </div>
    </header>
  );
}
