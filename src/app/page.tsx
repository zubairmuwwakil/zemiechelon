"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { WorldCanvas, type WorldCanvasHandle } from "@/components/world/WorldCanvas";
import type { CosmicMode } from "@/components/world/DayNightController";
import type { CameraTargetPreset } from "@/components/world/WorldCameraManager";
import { ShootingStarQuotes } from "@/components/world/ShootingStarQuotes";
import { WorldHUD } from "@/components/hud/WorldHUD";
import { CleanPlanetLandingModal } from "@/components/hud/CleanPlanetLandingModal";
import { InteractionHintsPill } from "@/components/hud/InteractionHintsPill";
import { PlanetPinsOverlay } from "@/components/world/PlanetPinsOverlay";
import { NoiseOverlay } from "@/components/world/NoiseOverlay";
import type { ScreenPoint } from "@/lib/atlas/types";
import { QuickDossierModal } from "@/components/hud/QuickDossierModal";
import { MiniTerminalModal } from "@/components/hud/MiniTerminalModal";
import { BodyCard } from "@/components/atlas/BodyCard";
import { loadBodies } from "@/lib/atlas/bodies";
import { sound } from "@/lib/audio";

export default function HomePage() {
  const bodies = useMemo(() => loadBodies(), []);
  const canvasHandleRef = useRef<WorldCanvasHandle>(null);

  // States
  const [cosmicMode, setCosmicMode] = useState<CosmicMode>("day");
  const [activePreset, setActivePreset] = useState<CameraTargetPreset>("galaxy");
  const [selectedBodyId, setSelectedBodyId] = useState<string | null>(null);
  const [screenPoints, setScreenPoints] = useState<ScreenPoint[]>([]);

  // Planetary Landing Workspace state
  const [activeLandingPlanet, setActiveLandingPlanet] = useState<string | null>(null);
  const [isDossierOpen, setIsDossierOpen] = useState(false);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);

  // Sector & Planet Landing Selection Handler
  const handleSelectSector = useCallback((sectorId: string) => {
    sound.playClick(600, 0.05);

    if (sectorId === "galaxy" || sectorId === "overview") {
      setActivePreset("galaxy");
      setActiveLandingPlanet(null);
    } else if (sectorId === "products" || sectorId === "planet-products") {
      setActivePreset("products");
      setActiveLandingPlanet("products");
    } else if (sectorId === "labs" || sectorId === "planet-labs") {
      setActivePreset("labs");
      setActiveLandingPlanet("labs");
    } else if (sectorId === "foundations" || sectorId === "planet-foundations") {
      setActivePreset("foundations");
      setActiveLandingPlanet("foundations");
    } else if (sectorId === "self" || sectorId === "planet-self" || sectorId === "founder") {
      setActivePreset("self");
      setActiveLandingPlanet("self");
    } else if (sectorId === "creative" || sectorId === "planet-creative") {
      setActivePreset("creative");
      setActiveLandingPlanet("creative");
    } else {
      setActivePreset("galaxy");
      setActiveLandingPlanet(null);
    }
  }, []);

  // Celestial Body Selection Handler
  const handleSelectBody = useCallback((bodyId: string) => {
    sound.playClick(700, 0.05);
    setSelectedBodyId(bodyId);
  }, []);

  // Reset to Galaxy Orbit
  const resetView = useCallback(() => {
    sound.playClick(400, 0.06);
    setActivePreset("galaxy");
    setSelectedBodyId(null);
    setActiveLandingPlanet(null);
  }, []);

  const selectedBody = useMemo(
    () => (selectedBodyId ? bodies.find((b) => b.id === selectedBodyId) ?? null : null),
    [bodies, selectedBodyId]
  );

  return (
    <main className="relative h-screen w-screen overflow-hidden select-none">
      {/* 1. 3D WebGL Minimalist Astrolabe Canvas */}
      <WorldCanvas
        ref={canvasHandleRef}
        bodies={bodies}
        cosmicMode={cosmicMode}
        cameraPreset={activePreset}
        onSelectSector={handleSelectSector}
        onSelectBody={handleSelectBody}
        onProjectPins={setScreenPoints}
      />

      {/* 2. Tactile Swiss Paper Grain & Archival Noise Overlay */}
      <NoiseOverlay />

      {/* 2. Floating Planet Pill Badges (Mockup Slides 1, 2, 4) */}
      <PlanetPinsOverlay
        points={screenPoints}
        activePreset={activePreset}
        cosmicMode={cosmicMode}
        onSelectPlanet={handleSelectSector}
      />

      {/* 3. Shooting Star Mantras & Night Star Tooltips (Mockup Slides 1, 2, 4) */}
      <ShootingStarQuotes cosmicMode={cosmicMode} />

      {/* 4. Top Segmented Capsule HUD (Mockup Slides 1, 2, 4) */}
      <WorldHUD
        cosmicMode={cosmicMode}
        onToggleCosmicMode={() =>
          setCosmicMode((prev) => (prev === "day" ? "night" : "day"))
        }
        activePreset={activePreset}
        onSelectPreset={handleSelectSector}
        onResetView={resetView}
        isDossierOpen={isDossierOpen}
        onToggleDossier={() => setIsDossierOpen((prev) => !prev)}
        onOpenTerminal={() => setIsTerminalOpen(true)}
      />

      {/* 5. Bottom Interaction Hints Capsule (Mockup Slide 1) */}
      {!activeLandingPlanet && !isDossierOpen && !isTerminalOpen && !selectedBodyId && (
        <InteractionHintsPill cosmicMode={cosmicMode} />
      )}

      {/* 6. Clean Planetary Landing Glass Workstation Modal ("Descent Mode" - Mockup Slide 3) */}
      <CleanPlanetLandingModal
        planetId={activeLandingPlanet}
        cosmicMode={cosmicMode}
        onClose={() => {
          setActiveLandingPlanet(null);
          setActivePreset("galaxy");
        }}
        onOpenTerminal={() => setIsTerminalOpen(true)}
        onSelectBody={handleSelectBody}
      />

      {/* 7. Global Dossier Search Modal (44 Repositories) */}
      <QuickDossierModal
        isOpen={isDossierOpen}
        onClose={() => setIsDossierOpen(false)}
        onSelectArmFromList={() => {}}
        onSelectBody={handleSelectBody}
      />

      {/* 8. Retro Command Quest CRT Terminal */}
      <MiniTerminalModal
        isOpen={isTerminalOpen}
        onClose={() => setIsTerminalOpen(false)}
      />

      {/* 9. Selected Celestial Body Card Modal */}
      {selectedBody && (
        <BodyCard body={selectedBody} onClose={() => setSelectedBodyId(null)} />
      )}
    </main>
  );
}
