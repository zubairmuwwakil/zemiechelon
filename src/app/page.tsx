"use client";

import { useCallback, useState } from "react";
import { Compass } from "lucide-react";
import { AtlasStage } from "@/components/atlas/AtlasStage";
import { WorldHUD } from "@/components/hud/WorldHUD";
import { SectorDrawer } from "@/components/hud/SectorDrawer";
import { QuickDossierModal } from "@/components/hud/QuickDossierModal";
import { MiniTerminalModal } from "@/components/hud/MiniTerminalModal";
import { bodyIdToHash } from "@/lib/atlas/deepLink";
import type { ArmId } from "@/lib/atlas/types";

export default function HomePage() {
  const [selectedArmId, setSelectedArmId] = useState<ArmId | null>(null);
  const [isDossierOpen, setIsDossierOpen] = useState(false);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [resetToken, setResetToken] = useState(0);

  // Selection lives in the URL hash, which AtlasStage listens to. The page never
  // holds a selected body, so the drawer and the dossier reach the map the same
  // way a pasted link does.
  const selectBody = useCallback((bodyId: string) => {
    window.location.hash = bodyIdToHash(bodyId);
  }, []);

  // AtlasStage owns the hash and the camera; the page only asks for a reset.
  const resetView = useCallback(() => {
    setSelectedArmId(null);
    setResetToken((n) => n + 1);
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#f7f6f2]">
      {/* Field + Chart + BodyCard, over one shared camera */}
      <AtlasStage resetToken={resetToken} />

      {/* Top HUD Navigation Bar with Arm Dock and Audio Controls */}
      <WorldHUD
        selectedArmId={selectedArmId}
        onSelectArm={setSelectedArmId}
        onResetView={resetView}
        isDossierOpen={isDossierOpen}
        onToggleDossier={() => setIsDossierOpen((prev) => !prev)}
        onOpenTerminal={() => setIsTerminalOpen(true)}
      />

      {/* Slide-in Arm Dossier Drawer */}
      <SectorDrawer
        selectedArmId={selectedArmId}
        onClose={() => setSelectedArmId(null)}
        onSelectArm={setSelectedArmId}
        onSelectBody={selectBody}
        onOpenTerminal={() => setIsTerminalOpen(true)}
      />

      {/* Full Structured Dossier Modal */}
      <QuickDossierModal
        isOpen={isDossierOpen}
        onClose={() => setIsDossierOpen(false)}
        onSelectArmFromList={(armId) => {
          setSelectedArmId(armId);
          setIsDossierOpen(false);
        }}
        onSelectBody={selectBody}
      />

      {/* Retro Command Quest CRT Terminal Modal */}
      <MiniTerminalModal
        isOpen={isTerminalOpen}
        onClose={() => setIsTerminalOpen(false)}
      />

      {/* Bottom Interaction Hint */}
      {!selectedArmId && !isDossierOpen && !isTerminalOpen && (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-20 flex justify-center px-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200/80 bg-white/85 px-4 py-1.5 text-xs font-mono text-zinc-600 shadow-md backdrop-blur-md">
            <Compass className="size-3.5 text-zinc-400" />
            <span className="hidden sm:inline">
              45 bodies, five arms · Drag to orbit · Scroll to zoom · Click a body to open it
            </span>
            <span className="sm:hidden">
              Tap any body to open it
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
