"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { WorldCanvas, type WorldCanvasHandle } from "@/components/world/WorldCanvas";
import type { CosmicMode } from "@/components/world/DayNightController";
import type { CameraTargetPreset } from "@/components/world/WorldCameraManager";
import { QuoteSky, QUOTE_STARS } from "@/components/world/QuoteSky";
import { WorldHUD } from "@/components/hud/WorldHUD";
import { LandedConsolePanel } from "@/components/hud/LandedConsolePanel";
import { InteractionHintsPill } from "@/components/hud/InteractionHintsPill";
import { PlanetPinsOverlay } from "@/components/world/PlanetPinsOverlay";
import { NoiseOverlay } from "@/components/world/NoiseOverlay";
import { QuickDossierModal } from "@/components/hud/QuickDossierModal";
import { MiniTerminalModal } from "@/components/hud/MiniTerminalModal";
import { BodyCard } from "@/components/atlas/BodyCard";
import { loadBodies } from "@/lib/atlas/bodies";
import { derivePlanetScopes, planetScopeId } from "@/lib/atlas/scopes";
import type { ScopeId, ScreenPoint } from "@/lib/atlas/types";
import { sound } from "@/lib/audio";

export default function HomePage() {
  const bodies = useMemo(() => loadBodies(), []);
  const canvasHandleRef = useRef<WorldCanvasHandle>(null);

  // States
  const [cosmicMode, setCosmicMode] = useState<CosmicMode>("day");
  const [activePreset, setActivePreset] = useState<CameraTargetPreset>("galaxy");
  const [selectedBodyId, setSelectedBodyId] = useState<string | null>(null);
  const [screenPoints, setScreenPoints] = useState<ScreenPoint[]>([]);
  // The quote sky rides the same projection bridge as the planet pins, so the
  // stars parallax with the scene instead of sitting on the viewport.
  const [quotePoints, setQuotePoints] = useState<ScreenPoint[]>([]);

  /**
   * The scopes there are to land in. Derived, not listed: a scope exists when an
   * arm has shipped something, so Products and Labs have one and the other three
   * do not. Clicking those stays a quiet no-op rather than an error.
   */
  const landableScopes = useMemo(
    () => new Set(derivePlanetScopes(bodies).map((s) => s.id)),
    [bodies],
  );

  // The scope the camera has descended into, or null for the galaxy.
  const [activeLandingPlanet, setActiveLandingPlanet] = useState<ScopeId | null>(null);
  const [isDossierOpen, setIsDossierOpen] = useState(false);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);

  // Sector & Planet Landing Selection Handler
  const handleSelectSector = useCallback(
    (sectorId: string) => {
      sound.playClick(600, 0.05);

      // "planet-products", "products" and "founder" all name the same arm.
      const arm = sectorId.replace(/^planet-/, "") === "founder"
        ? "self"
        : sectorId.replace(/^planet-/, "");

      if (arm === "galaxy" || arm === "overview") {
        setActivePreset("galaxy");
        setActiveLandingPlanet(null);
        return;
      }

      setActivePreset(arm);
      // Land only where there is a scope to land in; otherwise the preset still
      // frames the planet, which is what clicking it has always done.
      const scopeId = planetScopeId(arm);
      setActiveLandingPlanet(landableScopes.has(scopeId) ? scopeId : null);
    },
    [landableScopes],
  );

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
        landedScope={activeLandingPlanet}
        anchors={QUOTE_STARS}
        onProjectAnchors={setQuotePoints}
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

      {/* 3. Scene-space Quote Sky: pulsing stars at night, catchable comets by day */}
      <QuoteSky cosmicMode={cosmicMode} points={quotePoints} />

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

      {/* 6. Landed consoles. The descent is the camera's; this annotates it. */}
      <LandedConsolePanel
        scopeId={activeLandingPlanet}
        cosmicMode={cosmicMode}
        onClose={() => {
          setActiveLandingPlanet(null);
          setActivePreset("galaxy");
        }}
        onOpenTerminal={() => setIsTerminalOpen(true)}
        escapeEnabled={!isTerminalOpen && !isDossierOpen && !selectedBodyId}
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
