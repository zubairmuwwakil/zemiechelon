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
  scopeIdFor,
  siblingsOf,
  standingScope,
  deepLinkBodyId,
} from "@/lib/atlas/journey";
import { WorldBreadcrumb } from "@/components/hud/WorldBreadcrumb";
import { keysAreLive, navIntentFor } from "@/components/world/navKeys";
import { SOLAR_SYSTEM_ZEMI, scopeChain } from "@/lib/atlas/scopes";
import { bodyIdToHash, hashToBodyId } from "@/lib/atlas/deepLink";
import type { ScopeId, ScreenPoint } from "@/lib/atlas/types";
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

  /**
   * The solar system the visitor is in, at any depth. Read off the scope
   * chain rather than tracked alongside the journey — the same rule that
   * keeps `Position` free of a system field.
   */
  const activeSystem = useMemo(() => {
    const scope = scopeIdFor(journey.position);
    return scope
      ? (scopeChain(scope).find((s) => s.kind === "solarSystem")?.id ?? SOLAR_SYSTEM_ZEMI.id)
      : SOLAR_SYSTEM_ZEMI.id;
  }, [journey]);

  const handleSelectSolarSystem = useCallback((id: ScopeId) => {
    sound.playClick(520, 0.05);
    travel({ type: "selectSolarSystem", id });
  }, []);

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

  /**
   * One level out. The HUD's own nav pill and a deliberate scroll past a
   * solar system's zoom ceiling both mean this, so both raise the same event
   * through the same handler rather than each owning a copy of it.
   */
  const ascendToGalaxy = useCallback(() => travel({ type: "ascend" }), []);

  /**
   * Reset, in two stages: the solar system first, the galaxy on a second press.
   *
   * Which stage a press lands on depends on how recently the last one did — a
   * fact about the session rather than about where the visitor is — so it is
   * decided here and carried on the event, leaving the reducer pure.
   *
   * Outside the window a press is a first press again, so the button never
   * surprises anyone who walked away from it and came back.
   */
  const lastResetAt = useRef(0);
  const [galaxyHint, setGalaxyHint] = useState(false);
  const GALAXY_STAGE_MS = 4000;

  const resetView = useCallback(() => {
    sound.playClick(400, 0.06);
    const now = Date.now();
    const atSolarSystem = journey.position.kind === "solarSystem";
    const inWindow = now - lastResetAt.current < GALAXY_STAGE_MS;
    lastResetAt.current = now;

    if (atSolarSystem && inWindow) {
      setGalaxyHint(false);
      travel({ type: "reset", to: "galaxy" });
      return;
    }
    travel({ type: "reset" });
    setGalaxyHint(true);
  }, [journey.position.kind]);

  // The hint retracts on its own, and any later press restarts the timer.
  useEffect(() => {
    if (!galaxyHint) return;
    const id = window.setTimeout(() => setGalaxyHint(false), GALAXY_STAGE_MS);
    return () => window.clearTimeout(id);
  }, [galaxyHint]);

  /** A crumb, or `]`, names a scope; arriving at one is the same verb either way. */
  const goToScope = useCallback((scopeId: ScopeId) => {
    travel({ type: "descendTo", scopeId });
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

  /**
   * The keyboard, for the whole world rather than only for a surface.
   *
   * Escape used to be bound only while standing, so from a planet or a moon in
   * orbit the key was dead and the only way back out was the mouse. It ascends
   * from anywhere now; `ascendFrom` already answers what one level out means at
   * every level, including that the galaxy is its own parent, so there is no
   * level this has to special-case.
   *
   * What a key means lives in `navKeys` rather than in this switch — the same
   * split `wheelRouting` keeps for the wheel, and for the same reason: it is
   * decidable without a camera or a journey, so it is testable without either.
   *
   * The panels keep precedence. Each one binds its own Escape and stops
   * propagation, so this only ever sees the key with nothing switched on.
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!keysAreLive(e.target)) return;
      const intent = navIntentFor(e.key, e.shiftKey);
      if (!intent) return;

      switch (intent.kind) {
        case "ascend":
          // A surface leaves with a sound, because leaving the ground is the
          // one ascent that changes what is drawn rather than only where it is
          // seen from.
          if (onSurface) leaveSurface();
          else travel({ type: "ascend" });
          e.preventDefault();
          return;

        case "sibling": {
          // Stepping sideways is only meaningful where there are siblings to
          // step between, and standing on one is not a place you step from.
          if (onSurface) return;
          const ring = siblingsOf(journey.position, bodies);
          if (ring.length < 2) return;
          const here = ring.findIndex(
            (p) => scopeIdFor(p) === scopeIdFor(journey.position),
          );
          const next = ring[(here + intent.step + ring.length) % ring.length];
          const scopeId = scopeIdFor(next);
          if (scopeId) goToScope(scopeId);
          e.preventDefault();
          return;
        }

        // Orbit and zoom are the camera's, and the camera is inside the canvas.
        // Left unbound until `WorldCanvasHandle` can carry them — see the
        // navigation design doc.
        default:
          return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSurface, leaveSurface, journey.position, bodies, goToScope]);

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
        onAscend={ascendToGalaxy}
      />

      {/* 2. Tactile Swiss Paper Grain & Archival Noise Overlay */}
      <NoiseOverlay />

      {/* 2. Floating Planet Pill Badges (Mockup Slides 1, 2, 4) */}
      <PlanetPinsOverlay
        points={screenPoints}
        framingKind={framing.kind}
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
        activeSystem={activeSystem}
        onSelectSolarSystem={handleSelectSolarSystem}
        onAscendToGalaxy={ascendToGalaxy}
      />

      {/* 5. Bottom Interaction Hints Capsule (Mockup Slide 1) */}
      {sceneIsClear && <InteractionHintsPill cosmicMode={cosmicMode} />}

      {/* 5a. Where you are, and a way back up every level of it. */}
      {sceneIsClear && (
        <WorldBreadcrumb
          position={journey.position}
          cosmicMode={cosmicMode}
          onGoTo={goToScope}
        />
      )}

      {/* 5a-ii. What a second press of reset would do. Says so only just after
             the first one, because that is the only moment it is true. */}
      {galaxyHint && sceneIsClear && (
        <div
          role="status"
          className="pointer-events-none fixed right-3 top-16 z-30 select-none sm:right-5 sm:top-20"
        >
          <span
            className={`rounded-full border px-3 py-1.5 text-[11px] ${
              cosmicMode === "day"
                ? "glass-pill-day text-zinc-700"
                : "glass-pill-night text-zinc-300"
            }`}
          >
            Press again for the galaxy
          </span>
        </div>
      )}

      {/* 5b. Timeline transport: play, pause, scrub and speed the galaxy's own clock */}
      {sceneIsClear && (
        <TimelineTransport bodies={bodies} cosmicMode={cosmicMode} onClockDateChange={setClockDate} />
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
