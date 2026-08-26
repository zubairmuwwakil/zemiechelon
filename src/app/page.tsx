"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { WorldCanvas, type WorldCanvasHandle, type SurfaceTargetPoint } from "@/components/world/WorldCanvas";
import type { CosmicMode } from "@/components/world/DayNightController";
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
import {
  AT_SOLAR_SYSTEM,
  activeArm,
  framingFor,
  journeyReducer,
  panelScope,
  standingScope,
  deepLinkBodyId,
} from "@/lib/atlas/journey";
import { bodyIdToHash, hashToBodyId } from "@/lib/atlas/deepLink";
import type { ScreenPoint } from "@/lib/atlas/types";
import { sound } from "@/lib/audio";
import { THE_END } from "@/lib/atlas/timeline";

export default function HomePage() {
  const bodies = useMemo(() => loadBodies(), []);
  const canvasHandleRef = useRef<WorldCanvasHandle>(null);

  // States
  const [cosmicMode, setCosmicMode] = useState<CosmicMode>("day");
  /**
   * Where the visitor is, and what is open over it — one value.
   *
   * This replaced five `useState` slots (`activePreset`, `activeLandingPlanet`,
   * `flybyScope`, `flybyReturn`, `standingScope`) that between them encoded the
   * same fact. Six handlers wrote twenty-four assignments across them, each
   * responsible for clearing the slots it was not setting, and a missed one was
   * invisible: leaving a moon's surface cleared three and left the fourth
   * naming the frame just departed. Everything below is now derived from this,
   * so there is nothing left to keep in step by hand.
   */
  const [journey, travel] = useReducer(journeyReducer, AT_SOLAR_SYSTEM);

  /** What the camera should do about where the visitor is. */
  const framing = useMemo(() => framingFor(journey), [journey]);
  /** The surface underfoot, and the console panel — never both (see `journey`). */
  const onSurface = standingScope(journey);
  const landedPanel = panelScope(journey);

  /** How the visitor's environment answers, read where an event is raised. */
  const environment = useCallback(
    () => ({
      viewportWidth: window.innerWidth,
      reducedMotion: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
    }),
    [],
  );

  const [screenPoints, setScreenPoints] = useState<ScreenPoint[]>([]);
  // The quote sky rides the same projection bridge as the planet pins, so the
  // stars parallax with the scene instead of sitting on the viewport.
  const [quotePoints, setQuotePoints] = useState<ScreenPoint[]>([]);
  /** The reachable things on the surface underfoot, projected each frame. */
  const [surfaceTargets, setSurfaceTargets] = useState<SurfaceTargetPoint[]>([]);

  const [isDossierOpen, setIsDossierOpen] = useState(false);
  const [isLegendOpen, setIsLegendOpen] = useState(false);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  // The timeline transport's clock, as a calendar date. THE_END until the
  // transport reports its own default (the full span) — same "show
  // everything" state either way, so there is no flash of an empty galaxy.
  const [clockDate, setClockDate] = useState(THE_END);

  /**
   * Every control below raises an event; none of them decides what the event
   * means. `journeyReducer` owns that, which is why it can be tested without a
   * React tree, a canvas or a WebGL context — the same reason `navigation.ts`
   * and `planetPins.ts` already exist as their own modules.
   */
  const handleSelectSector = useCallback(
    (sectorId: string) => {
      sound.playClick(600, 0.05);
      travel({ type: "selectSector", sectorId, ...environment() });
    },
    [environment],
  );

  const handleSelectBody = useCallback((bodyId: string) => {
    sound.playClick(700, 0.05);
    travel({ type: "selectBody", bodyId });
  }, []);

  /** Closing a flyby's card ascends one level, to the planet it flew from. */
  const closeBodyCard = useCallback(() => travel({ type: "closeCard" }), []);

  /**
   * A control on the ground either switches the console on or names a body.
   * The overlay stays ignorant of which: it reports what was activated, and the
   * page decides, the same way `resolveBodySelection` decides what a tap means.
   */
  const activateSurfaceTarget = useCallback(
    (bodyId: string) => {
      const target = surfaceTargets.find((t) => t.bodyId === bodyId);
      if (target?.kind === "console") {
        travel({ type: "openConsole", consoleId: bodyId });
        return;
      }
      handleSelectBody(bodyId);
    },
    [surfaceTargets, handleSelectBody],
  );

  /** Leaving a surface ascends one level, to the frame it sits in. */
  const leaveSurface = useCallback(() => {
    sound.playClick(400, 0.06);
    travel({ type: "ascend" });
  }, []);

  // Reset to Galaxy Orbit
  const resetView = useCallback(() => {
    sound.playClick(400, 0.06);
    travel({ type: "reset" });
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
    // What the URL should say is a property of where the visitor is, so the
    // journey answers it rather than this effect re-deriving it from parts.
    const next = deepLinkBodyId(journey);
    const hash = next ? bodyIdToHash(next) : "";
    if (window.location.hash === hash) return;

    if (hash) {
      // Assigning the hash fires `hashchange`, so the listener has to be told
      // this one is ours. `replaceState` fires nothing, so flagging that case
      // would leave the guard raised and swallow the next genuine arrival —
      // which is exactly what it did.
      writingHash.current = true;
      window.location.hash = hash;
      return;
    }
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }, [journey]);

  useEffect(() => {
    if (!onSurface) return;
    const onKey = (e: KeyboardEvent) => {
      // The console handles its own Escape and stops it here, so this only
      // ever sees the key when nothing is switched on.
      if (e.key === "Escape") leaveSurface();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSurface, leaveSurface]);

  const selectedBody = useMemo(
    () => (journey.card ? bodies.find((b) => b.id === journey.card) ?? null : null),
    [bodies, journey.card]
  );

  /**
   * Whether the scene is clear enough to show the ambient chrome.
   *
   * Named once because it was written out three times — twice as an identical
   * five-term negation and once as a four-term variant — and every panel added
   * since has had to be remembered at each site.
   */
  const sceneIsClear =
    !landedPanel && !selectedBody && !isDossierOpen && !isLegendOpen && !isTerminalOpen;

  return (
    <main className="relative h-screen w-screen overflow-hidden select-none">
      {/* 1. 3D WebGL Minimalist Astrolabe Canvas */}
      <WorldCanvas
        ref={canvasHandleRef}
        bodies={bodies}
        cosmicMode={cosmicMode}
        framing={framing}
        onSelectSector={handleSelectSector}
        onSelectBody={handleSelectBody}
        onProjectPins={setScreenPoints}
        clockDate={clockDate}
        anchors={QUOTE_STARS}
        onProjectAnchors={setQuotePoints}
        onProjectSurfaceTargets={setSurfaceTargets}
      />

      {/* 2. Tactile Swiss Paper Grain & Archival Noise Overlay */}
      <NoiseOverlay />

      {/* 2. Floating Planet Pill Badges (Mockup Slides 1, 2, 4) */}
      <PlanetPinsOverlay
        points={screenPoints}
        activePreset={activeArm(journey)}
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
      {!onSurface && <QuoteSky cosmicMode={cosmicMode} points={quotePoints} />}

      {/* 4. Top Segmented Capsule HUD (Mockup Slides 1, 2, 4) */}
      <WorldHUD
        cosmicMode={cosmicMode}
        onToggleCosmicMode={() =>
          setCosmicMode((prev) => (prev === "day" ? "night" : "day"))
        }
        activePreset={activeArm(journey)}
        onSelectPreset={handleSelectSector}
        onResetView={resetView}
        isDossierOpen={isDossierOpen}
        onToggleDossier={() => setIsDossierOpen((prev) => !prev)}
        isLegendOpen={isLegendOpen}
        onToggleLegend={() => setIsLegendOpen((prev) => !prev)}
        onOpenTerminal={() => setIsTerminalOpen(true)}
      />

      {/* 5. Bottom Interaction Hints Capsule (Mockup Slide 1) */}
      {sceneIsClear && <InteractionHintsPill cosmicMode={cosmicMode} />}

      {/* 5b. Timeline transport: play, pause, scrub and speed the galaxy's own clock */}
      {sceneIsClear && (
        <TimelineTransport bodies={bodies} cosmicMode={cosmicMode} onClockDayChange={setClockDate} />
      )}

      {/* 6. Landed consoles. The descent is the camera's; this annotates it. */}
      <LandedConsolePanel
        scopeId={landedPanel}
        cosmicMode={cosmicMode}
        onClose={() => travel({ type: "ascend" })}
        onOpenTerminal={() => setIsTerminalOpen(true)}
        escapeEnabled={!isTerminalOpen && !isDossierOpen && !isLegendOpen && !selectedBody}
      />

      {/* 6b. The console, switched on. §3.1: a thing you approach and switch on,
             where approaching happens in the scene and this is the switching. */}
      <SurfaceConsolePanel
        consoleId={journey.console}
        cosmicMode={cosmicMode}
        onClose={() => travel({ type: "closeConsole" })}
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
