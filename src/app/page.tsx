"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { WorldCanvas, type WorldCanvasHandle, type SurfaceTargetPoint } from "@/components/world/WorldCanvas";
import type { CosmicMode } from "@/components/world/DayNightController";
import type { CameraTargetPreset } from "@/components/world/WorldCameraManager";
import { QuoteSky, QUOTE_STARS } from "@/components/world/QuoteSky";
import { WorldHUD } from "@/components/hud/WorldHUD";
import { LandedConsolePanel } from "@/components/hud/LandedConsolePanel";
import { SurfaceConsolePanel } from "@/components/hud/SurfaceConsolePanel";
import { InteractionHintsPill } from "@/components/hud/InteractionHintsPill";
import { PlanetPinsOverlay } from "@/components/world/PlanetPinsOverlay";
import { SurfaceTargetsOverlay } from "@/components/world/SurfaceTargetsOverlay";
import { NoiseOverlay } from "@/components/world/NoiseOverlay";
import { QuickDossierModal } from "@/components/hud/QuickDossierModal";
import { LegendModal } from "@/components/hud/LegendModal";
import { MiniTerminalModal } from "@/components/hud/MiniTerminalModal";
import { TimelineTransport } from "@/components/hud/TimelineTransport";
import { BodyCard } from "@/components/atlas/BodyCard";
import { loadBodies } from "@/lib/atlas/bodies";
import { derivePlanetScopes, planetScopeId } from "@/lib/atlas/scopes";
import { landingMode, resolveBodySelection } from "@/lib/atlas/navigation";
import { bodyIdToHash, hashToBodyId } from "@/lib/atlas/deepLink";
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
  /** The reachable things on the surface underfoot, projected each frame. */
  const [surfaceTargets, setSurfaceTargets] = useState<SurfaceTargetPoint[]>([]);
  /** The console the visitor has switched on, or null. */
  const [openConsoleId, setOpenConsoleId] = useState<string | null>(null);

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
  /**
   * The moon the camera has swung in close to, and the frame leaving it returns
   * to. A flyby is not a landing: the scene stays live, no console opens, and
   * ascending goes one level to the planet rather than all the way out (§2).
   */
  const [flybyScope, setFlybyScope] = useState<ScopeId | null>(null);
  const [flybyReturn, setFlybyReturn] = useState<ScopeId | null>(null);
  /** The surface the visitor is standing on, or null in orbit. */
  const [standingScope, setStandingScope] = useState<ScopeId | null>(null);
  const [isDossierOpen, setIsDossierOpen] = useState(false);
  const [isLegendOpen, setIsLegendOpen] = useState(false);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  // The timeline transport's clock, in days since the galaxy epoch. Infinity
  // until the transport reports its own default (the full span) — same "show
  // everything" state either way, so there is no flash of an empty galaxy.
  const [clockDay, setClockDay] = useState(Infinity);

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
      const scopeId = planetScopeId(arm);
      if (!landableScopes.has(scopeId)) {
        // No scope to land in. The preset still frames the planet, which is
        // what clicking it has always done.
        setActiveLandingPlanet(null);
        setStandingScope(null);
        return;
      }

      // Spec §3.1: landing means standing on the ground, with the panel kept
      // for the cases where flying to a surface is the wrong interaction.
      const mode = landingMode({
        scopeId,
        viewportWidth: window.innerWidth,
        reducedMotion: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
        bodies,
      });
      setStandingScope(mode === "surface" ? scopeId : null);
      setActiveLandingPlanet(mode === "panel" ? scopeId : null);
      setFlybyScope(null);
      // Leaving a planet's surface goes out to the galaxy: it is the frame the
      // planet sits in, and the one level up from here.
      setFlybyReturn(mode === "surface" ? null : flybyReturn);
    },
    [bodies, landableScopes, flybyReturn],
  );

  // Celestial Body Selection Handler
  const handleSelectBody = useCallback(
    (bodyId: string) => {
      sound.playClick(700, 0.05);
      // What a tap means is a rule about the body, not a branch here.
      const selection = resolveBodySelection(bodyId, bodies);
      setSelectedBodyId(selection.cardId);
      setFlybyReturn(selection.ascendTo);
      // A landing and a flyby are different arrivals, not the same one with a
      // flag: landing owns the camera all the way down to the ground, so the
      // flyby framing has to be released rather than layered under it.
      setStandingScope(selection.landed ? selection.flyTo : null);
      setFlybyScope(selection.landed ? null : selection.flyTo);
      // Arriving anywhere leaves the frame you were in. Without this a visitor
      // who lands on a planet and then takes its orrery to a moon ends up
      // standing on the moon with the planet's console still open over it —
      // two frames claiming to be where you are.
      if (selection.flyTo) setActiveLandingPlanet(null);
    },
    [bodies],
  );

  /** Closing a flyby's card ascends one level, to the planet it flew from. */
  const closeBodyCard = useCallback(() => {
    setSelectedBodyId(null);
    if (flybyScope && flybyReturn) {
      setActivePreset(flybyReturn.replace("planet:", ""));
    }
    setFlybyScope(null);
    setFlybyReturn(null);
  }, [flybyScope, flybyReturn]);

  /**
   * A control on the ground either switches the console on or names a body.
   * The overlay stays ignorant of which: it reports what was activated, and the
   * page decides, the same way `resolveBodySelection` decides what a tap means.
   */
  const activateSurfaceTarget = useCallback(
    (bodyId: string) => {
      const target = surfaceTargets.find((t) => t.bodyId === bodyId);
      if (target?.kind === "console") {
        setOpenConsoleId(bodyId);
        return;
      }
      handleSelectBody(bodyId);
    },
    [surfaceTargets, handleSelectBody],
  );

  /** Leaving a surface ascends one level, to the frame it sits in. */
  const leaveSurface = useCallback(() => {
    sound.playClick(400, 0.06);
    // One level out: a moon's surface returns to its planet, a planet's to the
    // galaxy. Spec §2 found ascending a level at a time is what reads right.
    setActivePreset(flybyReturn ? flybyReturn.replace("planet:", "") : "galaxy");
    setStandingScope(null);
    setFlybyReturn(null);
    setOpenConsoleId(null);
  }, [flybyReturn]);

  // Reset to Galaxy Orbit
  const resetView = useCallback(() => {
    sound.playClick(400, 0.06);
    setActivePreset("galaxy");
    setSelectedBodyId(null);
    setActiveLandingPlanet(null);
    setFlybyScope(null);
    setFlybyReturn(null);
    setStandingScope(null);
  }, []);

  /**
   * The URL hash names a body, and naming one arrives at it.
   *
   * Spec §7 risk 2 offsets the cost of depth — galaxy, planet, moon is three
   * flights before the console — with "the deep link lands directly on the
   * console". `deepLink.ts` has existed and been tested since the atlas shell,
   * but only `AtlasStage` ever read it, so on this page the mitigation did not
   * exist. Arriving goes through the same rule a tap does, so a link lands the
   * visitor exactly where tapping would have.
   */
  const writingHash = useRef(false);
  useEffect(() => {
    const arrive = () => {
      if (writingHash.current) {
        writingHash.current = false;
        return;
      }
      const id = hashToBodyId(window.location.hash, bodies);
      if (id) handleSelectBody(id);
    };
    arrive();
    window.addEventListener("hashchange", arrive);
    return () => window.removeEventListener("hashchange", arrive);
  }, [bodies, handleSelectBody]);

  useEffect(() => {
    const id = standingScope?.startsWith("moon:")
      ? standingScope.slice("moon:".length)
      : standingScope
        ? null // A planet's surface names no repository, so it names nothing.
        : selectedBodyId;

    // A hash left pointing at the last moon while the visitor stands on a
    // planet is a link that lies about where they are. Better to say nothing.
    const next = id ? bodyIdToHash(id) : "";
    if (window.location.hash === next) return;

    if (next) {
      // Assigning the hash fires `hashchange`, so the listener has to be told
      // this one is ours. `replaceState` fires nothing, so flagging that case
      // would leave the guard raised and swallow the next genuine arrival —
      // which is exactly what it did.
      writingHash.current = true;
      window.location.hash = next;
      return;
    }
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }, [selectedBodyId, standingScope]);

  useEffect(() => {
    if (!standingScope) return;
    const onKey = (e: KeyboardEvent) => {
      // The console handles its own Escape and stops it here, so this only
      // ever sees the key when nothing is switched on.
      if (e.key === "Escape") leaveSurface();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [standingScope, leaveSurface]);

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
        clockDay={clockDay}
        landedScope={activeLandingPlanet}
        flybyScope={flybyScope}
        standingScope={standingScope}
        anchors={QUOTE_STARS}
        onProjectAnchors={setQuotePoints}
        onProjectSurfaceTargets={setSurfaceTargets}
      />

      {/* 2. Tactile Swiss Paper Grain & Archival Noise Overlay */}
      <NoiseOverlay />

      {/* 2. Floating Planet Pill Badges (Mockup Slides 1, 2, 4) */}
      <PlanetPinsOverlay
        points={screenPoints}
        activePreset={activePreset}
        cosmicMode={cosmicMode}
        bodies={bodies}
        onSelectPlanet={handleSelectSector}
        onHoverPlanet={(id) => canvasHandleRef.current?.setHoveredPlanet?.(id)}
      />

      {/* 2b. Real controls for what stands on the surface: focusable, named, and
             larger than the few pixels the thing itself occupies (§6). */}
      <SurfaceTargetsOverlay
        points={surfaceTargets}
        cosmicMode={cosmicMode}
        onActivate={activateSurfaceTarget}
      />

      {/* 3. Scene-space Quote Sky: pulsing stars at night, catchable comets by day.
             Suppressed on a surface: the quotes hang at galaxy distances, so from
             the ground they land as running text across the parent's face — the one
             thing §3.2 asks to keep legible. */}
      {!standingScope && <QuoteSky cosmicMode={cosmicMode} points={quotePoints} />}

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
        isLegendOpen={isLegendOpen}
        onToggleLegend={() => setIsLegendOpen((prev) => !prev)}
        onOpenTerminal={() => setIsTerminalOpen(true)}
      />

      {/* 5. Bottom Interaction Hints Capsule (Mockup Slide 1) */}
      {!activeLandingPlanet && !isDossierOpen && !isLegendOpen && !isTerminalOpen && !selectedBodyId && (
        <InteractionHintsPill cosmicMode={cosmicMode} />
      )}

      {/* 5b. Timeline transport: play, pause, scrub and speed the galaxy's own clock */}
      {!activeLandingPlanet && !isDossierOpen && !isLegendOpen && !isTerminalOpen && !selectedBodyId && (
        <TimelineTransport bodies={bodies} cosmicMode={cosmicMode} onClockDayChange={setClockDay} />
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
        escapeEnabled={!isTerminalOpen && !isDossierOpen && !isLegendOpen && !selectedBodyId}
      />

      {/* 6b. The console, switched on. §3.1: a thing you approach and switch on,
             where approaching happens in the scene and this is the switching. */}
      <SurfaceConsolePanel
        consoleId={openConsoleId}
        cosmicMode={cosmicMode}
        onClose={() => setOpenConsoleId(null)}
      />

      {/* 7. Global Dossier Search Modal (44 Repositories) */}
      <QuickDossierModal
        isOpen={isDossierOpen}
        onClose={() => setIsDossierOpen(false)}
        onSelectArmFromList={() => {}}
        onSelectBody={handleSelectBody}
      />

      {/* 8. Celestial Atlas Grammar & Legend Modal */}
      <LegendModal
        isOpen={isLegendOpen}
        onClose={() => setIsLegendOpen(false)}
        cosmicMode={cosmicMode}
        bodies={bodies}
      />

      {/* 9. Retro Command Quest CRT Terminal */}
      <MiniTerminalModal
        isOpen={isTerminalOpen}
        onClose={() => setIsTerminalOpen(false)}
      />

      {/* 10. Selected Celestial Body Card Modal */}
      {selectedBody && (
        <BodyCard body={selectedBody} onClose={closeBodyCard} />
      )}
    </main>
  );
}
