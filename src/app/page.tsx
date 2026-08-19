"use client";

import { useState } from "react";
import { WorldCanvas } from "@/components/world/WorldCanvas";
import { WorldPinsOverlay } from "@/components/hud/WorldPin";
import { WorldHUD } from "@/components/hud/WorldHUD";
import { SectorDrawer } from "@/components/hud/SectorDrawer";
import { QuickDossierModal } from "@/components/hud/QuickDossierModal";
import { MiniTerminalModal } from "@/components/hud/MiniTerminalModal";
import { ScreenPinPosition, TimeOfDay } from "@/components/world/types";
import { Compass } from "lucide-react";
import { sound } from "@/lib/audio";

export default function HomePage() {
  const [selectedSectorId, setSelectedSectorId] = useState<string | null>(null);
  const [pins, setPins] = useState<ScreenPinPosition[]>([]);
  const [isDossierOpen, setIsDossierOpen] = useState(false);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>("day");

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#f7f6f2]">
      {/* 3D WebGL Canvas Layer */}
      <WorldCanvas
        selectedSectorId={selectedSectorId}
        timeOfDay={timeOfDay}
        onSelectSector={setSelectedSectorId}
        onPinsUpdate={setPins}
      />

      {/* Floating 2D Screen-projected Island Pins */}
      <WorldPinsOverlay
        pins={pins}
        selectedSectorId={selectedSectorId}
        onSelectSector={(sectorId) => {
          sound.playClick(600, 0.05);
          setSelectedSectorId(sectorId);
        }}
      />

      {/* Top HUD Navigation Bar with Time-of-Day and Audio Controls */}
      <WorldHUD
        selectedSectorId={selectedSectorId}
        timeOfDay={timeOfDay}
        onSetTimeOfDay={setTimeOfDay}
        onSelectSector={setSelectedSectorId}
        onResetCamera={() => setSelectedSectorId(null)}
        isDossierOpen={isDossierOpen}
        onToggleDossier={() => setIsDossierOpen((prev) => !prev)}
        onOpenTerminal={() => setIsTerminalOpen(true)}
      />

      {/* Slide-in Sector Project Dossier Drawer */}
      <SectorDrawer
        selectedSectorId={selectedSectorId}
        onClose={() => setSelectedSectorId(null)}
        onSelectSector={setSelectedSectorId}
        onOpenTerminal={() => setIsTerminalOpen(true)}
      />

      {/* Full Structured Dossier Modal */}
      <QuickDossierModal
        isOpen={isDossierOpen}
        onClose={() => setIsDossierOpen(false)}
        onSelectSectorFromList={(sectorId) => {
          setSelectedSectorId(sectorId);
          setIsDossierOpen(false);
        }}
      />

      {/* Retro Command Quest CRT Terminal Modal */}
      <MiniTerminalModal
        isOpen={isTerminalOpen}
        onClose={() => setIsTerminalOpen(false)}
      />

      {/* Bottom Interaction & Living City Hint */}
      {!selectedSectorId && !isDossierOpen && !isTerminalOpen && (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-20 flex justify-center px-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200/80 bg-white/85 px-4 py-1.5 text-xs font-mono text-zinc-600 shadow-md backdrop-blur-md">
            <Compass className="size-3.5 text-zinc-400" />
            <span className="hidden sm:inline">
              Living City · Drag to orbit · Scroll to zoom · Click islands to explore micro-games
            </span>
            <span className="sm:hidden">
              Tap any island to explore
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
