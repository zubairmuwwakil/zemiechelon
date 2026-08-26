"use client";

import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import type { Body, ScopeId, ScreenPoint, Vec3 } from "@/lib/atlas/types";
import { DayNightController, type CosmicMode } from "./DayNightController";
import { WorldCameraManager, ASTROLABE_OUTER } from "./WorldCameraManager";
import { framedBody, framedSystem } from "./planetFrames";
import type { Framing } from "@/lib/atlas/journey";
import { planetPinAnchors } from "./planetPins";
import { scrollOwnerFor } from "./wheelRouting";
import {
  WorldSceneBuilder,
  fieldDensityFor,
  type HoverTarget,
  type SurfaceTarget,
} from "./WorldSceneBuilder";
import { GalaxyBuilder } from "./GalaxyBuilder";
import { GALAXY_REACH } from "@/lib/atlas/galaxyPlacement";
import { shardRadiusFor } from "@/lib/atlas/surfaces";
import { SOLAR_SYSTEMS, SOLAR_SYSTEM_ZEMI, getScope } from "@/lib/atlas/scopes";
import { bodiesFor } from "@/lib/atlas/bodies";
import { THE_END } from "@/lib/atlas/timeline";

export interface WorldCanvasHandle {
  triggerPaddleHit: () => void;
  setHoveredPlanet?: (id: string | null) => void;
}

/** Anything the canvas can carry for an HTML overlay: an id and a scene position. */
export interface ProjectableAnchor {
  id: string;
  position: Vec3;
}

export interface WorldCanvasProps {
  bodies: Body[];
  cosmicMode: CosmicMode;
  /**
   * Where the visitor is, resolved to what the camera should do about it.
   *
   * One prop rather than the four this replaced (`cameraPreset`, `landedScope`,
   * `flybyScope`, `standingScope`). Four independent props meant the canvas had
   * to re-decide precedence between them, and that decision drifted apart from
   * the one `page.tsx` was making when it set them.
   */
  framing: Framing;
  onSelectSector: (sectorId: string) => void;
  onSelectBody: (bodyId: string) => void;
  onProjectPins?: (points: ScreenPoint[]) => void;
  /**
   * The timeline transport's clock, as a calendar date. Drives only what the
   * scene shows — see `WorldSceneBuilder.setClockDate` — never a rebuild:
   * applied through a dedicated effect, not the scene's own deps, so scrubbing
   * never tears down and reconstructs the map underneath it.
   */
  clockDate?: string;
  /**
   * Scene-space anchors projected alongside the planet pins each frame. This is
   * what lets an HTML layer be *in* the scene: the quote sky hangs on these, so
   * it parallaxes when the camera orbits instead of being painted on the monitor.
   */
  anchors?: ProjectableAnchor[];
  onProjectAnchors?: (points: ScreenPoint[]) => void;
  /**
   * The reachable things on the surface the visitor is standing on, projected
   * each frame. Nothing inside a canvas is focusable on its own; this is what
   * lets the overlay give props and the orrery real controls (§6).
   */
  onProjectSurfaceTargets?: (points: SurfaceTargetPoint[]) => void;
  /**
   * A deliberate scroll out past a solar system's zoom ceiling, reported by
   * `WorldCameraManager.onWheelZoom`. Only raised while `framing.kind ===
   * "solarSystem"` — the canvas reports the gesture, same as `onSelectSector`;
   * what leaving means is the caller's call.
   */
  onAscend?: () => void;
}

/** A projected surface target: a screen point that also knows what it is. */
export interface SurfaceTargetPoint extends ScreenPoint {
  label: string;
  bodyId: string;
  kind: "prop" | "moon" | "console";
}

/**
 * Bloom is off in day mode, and that is the treatment, not a compromise.
 *
 * The pass extracts everything above a luminance threshold, blurs it, and adds
 * it back. Direction A's ground is #F7F6F2 — luminance 0.97 — so at the old
 * 0.82 threshold every pixel of the *background* qualified: the whole frame was
 * blurred and re-added at 35%, flooding an ink-on-paper scene into flat white.
 * Raising the threshold cannot fix it, because nothing in this treatment is
 * meant to be brighter than the paper. Direction A is engraved, not emitted.
 *
 * Night (R2) is emissive and keeps it.
 */
const BLOOM: Record<CosmicMode, { strength: number; threshold: number }> = {
  day: { strength: 0, threshold: 1 },
  night: { strength: 0.85, threshold: 0.6 },
};

/**
 * The output curve, per ground.
 *
 * ACES is a film curve: it exists to roll off highlights that would otherwise
 * blow out, which is exactly what the night ground wants under a bloom of 0.85.
 * Day draws `strength: 0` — there is no bloom to tame, and nothing in the scene
 * exceeds one — so all the curve does is compress the top end, where every
 * value in an ink-on-paper treatment lives. It pulled `#F7F6F2` down to roughly
 * `#E8E7E3` and squeezed the band the hairlines are drawn inside, while the DOM
 * around the canvas kept the honest token. `directionA.ts` names that mismatch
 * as the most visible way this treatment fails; this is where it came from.
 *
 * `OutputPass` rebuilds its defines when `renderer.toneMapping` changes, so
 * these can be swapped live without rebuilding the scene.
 */
const TONE_MAPPING: Record<CosmicMode, { mapping: THREE.ToneMapping; exposure: number }> = {
  day: { mapping: THREE.NoToneMapping, exposure: 1 },
  night: { mapping: THREE.ACESFilmicToneMapping, exposure: 1.12 },
};

/**
 * Scene point -> viewport pixels. `visible` is false behind the camera and past
 * a small off-screen margin, so the overlay never keeps DOM nodes for stars the
 * camera has turned away from.
 */
function projectToScreen(
  pos: THREE.Vector3,
  camera: THREE.Camera,
  width: number,
  height: number,
): { x: number; y: number; depth: number; visible: boolean } {
  const v = pos.clone().project(camera);
  const x = ((v.x + 1) * width) / 2;
  const y = ((-v.y + 1) * height) / 2;
  const inFront = pos.clone().applyMatrix4(camera.matrixWorldInverse).z < 0;
  const margin = 0.08;
  const onScreen =
    x >= -margin * width &&
    x <= width * (1 + margin) &&
    y >= -margin * height &&
    y <= height * (1 + margin);
  return { x, y, depth: v.z, visible: inFront && onScreen };
}

export const WorldCanvas = forwardRef<WorldCanvasHandle, WorldCanvasProps>(function WorldCanvas(
  {
    bodies,
    cosmicMode,
    framing,
    onSelectSector,
    onSelectBody,
    onProjectPins,
    clockDate = THE_END,
    anchors,
    onProjectAnchors,
    onProjectSurfaceTargets,
    onAscend,
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  /**
   * One builder per solar system, in registry order.
   *
   * A map rather than a field per system, because almost nothing here wants to
   * know which system is which: every per-frame call iterates it. Insertion
   * order is `SOLAR_SYSTEMS` order, which is what keeps the atlas first
   * wherever order decides an otherwise ambiguous answer.
   */
  const sceneBuildersRef = useRef<Map<ScopeId, WorldSceneBuilder>>(new Map());
  /**
   * The builder drawing one named system, or null if this scene has not built
   * it. Null rather than a throw: the framing owner runs before construction on
   * the first render, and "not yet" is not a data error.
   */
  const builderFor = (scopeId: ScopeId): WorldSceneBuilder | null =>
    sceneBuildersRef.current.get(scopeId) ?? null;
  const galaxyBuilderRef = useRef<GalaxyBuilder | null>(null);
  const cameraManagerRef = useRef<WorldCameraManager | null>(null);
  const dayNightRef = useRef<DayNightController | null>(null);
  const bloomPassRef = useRef<UnrealBloomPass | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);
  /** Held for the mode effect: the output curve belongs to the ground. See `TONE_MAPPING`. */
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  // Read at construction time only — see the mount effect below. Kept fresh by
  // its own effect so a scene rebuild (day/night, a resized body set) always
  // reads the clock the transport is actually on, not the one from first mount.
  const clockDateRef = useRef(clockDate);
  clockDateRef.current = clockDate;
  // Read inside the wheel handler below, which lives in the mount effect and
  // must not rebuild the GL scene on every framing change — the same reason
  // `clockDateRef` exists rather than `clockDate` in that effect's deps.
  const framingRef = useRef(framing);
  framingRef.current = framing;

  // Read by the scene-construction effect below, which must NOT rebuild the GL
  // scene when the ground swaps — the same reason `clockDateRef` exists.
  //
  // The effect only ever needs the mode to SEED what it has just constructed:
  // on mount the dedicated effect above runs first, when every ref it writes
  // through is still null. Everything after that is the live path's job, and
  // the live path already covers every mode-dependent value here. Keeping
  // `cosmicMode` in the dependencies instead cost a visitor the world: the
  // effect disposes the renderer, the composer and the camera manager, so a
  // toggle put whoever was standing on a surface back at the default pose and
  // flew the entire descent again to return them to where they already were.
  const cosmicModeRef = useRef(cosmicMode);
  cosmicModeRef.current = cosmicMode;

  // Expose handle methods
  useImperativeHandle(ref, () => ({
    triggerPaddleHit: () => {},
    // Told to every system, not just the atlas. `validateGalaxy` guarantees arm
    // ids are unique across the galaxy, so the one system that owns the arm
    // lights its label and the rest clear theirs — which is also the clearing
    // the system the pointer just left needs.
    setHoveredPlanet: (id: string | null) => {
      for (const builder of sceneBuildersRef.current.values()) {
        builder.setHoveredTarget(id ? { type: "planet", id } : null);
      }
    },
  }));

  // Sync the timeline transport's clock. A dedicated effect, not a dependency
  // of the scene-construction effect below: that effect rebuilds the whole
  // THREE scene on every dependency change, and a scrub drag can fire many
  // times a second — this only ever touches the already-built scene.
  useEffect(() => {
    for (const builder of sceneBuildersRef.current.values()) builder.setClockDate(clockDate);
  }, [clockDate]);

  // Sync Day/Night mode & bloom parameters
  useEffect(() => {
    dayNightRef.current?.setMode(cosmicMode);
    for (const builder of sceneBuildersRef.current.values()) builder.setCosmicMode(cosmicMode);
    galaxyBuilderRef.current?.setCosmicMode(cosmicMode);
    if (bloomPassRef.current) {
      bloomPassRef.current.strength = BLOOM[cosmicMode].strength;
      bloomPassRef.current.threshold = BLOOM[cosmicMode].threshold;
    }
    const renderer = rendererRef.current;
    if (renderer) {
      renderer.toneMapping = TONE_MAPPING[cosmicMode].mapping;
      renderer.toneMappingExposure = TONE_MAPPING[cosmicMode].exposure;
    }
  }, [cosmicMode]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    let width = container.clientWidth || window.innerWidth;
    let height = container.clientHeight || window.innerHeight;

    // 1. Scene & High-Precision ACES Filmic Renderer
    const scene = new THREE.Scene();
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = TONE_MAPPING[cosmicModeRef.current].mapping;
    renderer.toneMappingExposure = TONE_MAPPING[cosmicModeRef.current].exposure;
    rendererRef.current = renderer;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 2. DayNight Controller
    const dayNight = new DayNightController(scene, cosmicModeRef.current);
    dayNightRef.current = dayNight;

    // 3. Camera Manager
    // Read once, here: prefers-reduced-motion decides whether the camera flies
    // or arrives, and nothing downstream needs to ask again.
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    // The sun's arc is travel, so it stops on the same preference (spec §3.10).
    // The controller is built above; this is the first line that can ask.
    dayNight.setReducedMotion(reduced);
    const cameraManager = new WorldCameraManager(width, height, reduced);
    cameraManagerRef.current = cameraManager;

    // 4. Post-Processing Effect Composer (Selective Bloom & ACES Output)
    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, cameraManager.camera);
    composer.addPass(renderPass);

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      BLOOM[cosmicModeRef.current].strength,
      0.45, // Bloom radius
      BLOOM[cosmicModeRef.current].threshold
    );
    composer.addPass(bloomPass);
    bloomPassRef.current = bloomPass;

    const outputPass = new OutputPass();
    composer.addPass(outputPass);
    composerRef.current = composer;

    // 5. Scene Builder
    //
    // The galaxy frame goes up first, because the solar system hangs off it.
    // It owns the sky — sized to the whole galaxy rather than to the atlas —
    // and it is what `attach` parents each system's root to. The atlas resolves
    // to the origin, unleaned, so nothing on screen moves because of this.
    const today = new Date().toISOString().slice(0, 10);
    const galaxyBuilder = new GalaxyBuilder(scene, fieldDensityFor(width), reduced);
    galaxyBuilder.build();
    galaxyBuilder.setPixelRatio(renderer.getPixelRatio());
    galaxyBuilder.setCosmicMode(cosmicModeRef.current);
    galaxyBuilderRef.current = galaxyBuilder;

    // One loop over the registry, not one construction per system: a second
    // orrery is this builder with a different scope, and the day a third
    // system is registered nothing here should have to be edited to draw it.
    // Each system's bodies come from `bodiesFor` rather than from the `bodies`
    // prop, because the prop can only ever describe one of them.
    const builders = new Map<ScopeId, WorldSceneBuilder>();
    for (const system of SOLAR_SYSTEMS) {
      const builder = new WorldSceneBuilder(
        scene,
        system,
        bodiesFor(system),
        today,
        fieldDensityFor(width),
        reduced,
      );
      builder.build();
      builder.setResolution(width, height);
      builder.setPixelRatio(renderer.getPixelRatio());
      builder.setCosmicMode(cosmicModeRef.current);
      // Not a dependency (see the dedicated clock effect above) — read fresh at
      // construction time only, via the ref.
      builder.setClockDate(clockDateRef.current);
      // Reparents the root off the scene and onto the galaxy frame, which is
      // also what applies the system's centre and its lean.
      galaxyBuilder.attach(system, builder.rootGroup);
      builders.set(system.id, builder);
    }
    sceneBuildersRef.current = builders;

    // Both refs are live now, so the framing owner can seed the initial pose —
    // and re-seed it whenever this effect rebuilds the scene.
    frameRef.current();

    // 6. Raycasting and pointer interaction
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    /**
     * Every hit target in the galaxy, each paired with the system that owns it.
     *
     * Paired rather than flattened, because `isHitVisible` and
     * `setHoveredTarget` are a builder's own business: a target is only
     * meaningful next to the scene it was registered from. Order follows the
     * map, so the atlas comes first and an ambiguous hit resolves the way it
     * resolved when the atlas was the only system there was.
     */
    const hitObjects = () =>
      [...builders.values()].flatMap((builder) =>
        builder.hitObjects.map((hitObj) => ({ builder, hitObj })),
      );

    /**
     * Hover is one visitor's attention, so at most one system may hold it.
     * The others are cleared rather than left alone — a highlight in the system
     * the pointer has just left would otherwise stay lit for good.
     */
    const setHovered = (owner: WorldSceneBuilder | null, target: HoverTarget | null) => {
      for (const builder of builders.values()) {
        builder.setHoveredTarget(builder === owner ? target : null);
      }
    };
    let isDragging = false;
    let dragDistance = 0;
    let previousPointer = { x: 0, y: 0 };

    const onPointerDown = (e: PointerEvent) => {
      isDragging = true;
      dragDistance = 0;
      previousPointer = { x: e.clientX, y: e.clientY };
    };

    /** Hover resolves ideal rings, astrolabe month rings, planets, and arms. */
    const onPointerHover = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, cameraManager.camera);

      const hoverTypes = new Set(["ideal", "planet", "ring", "arm"]);
      // isHitVisible is a no-op for ring/arm (always true) and only actually
      // filters ideal/planet — an un-born one must not be hoverable either.
      const candidates = hitObjects().filter(
        ({ builder, hitObj }) => hoverTypes.has(hitObj.type) && builder.isHitVisible(hitObj),
      );
      if (candidates.length === 0) return;

      const meshes = candidates.map((c) => c.hitObj.mesh);
      const intersects = raycaster.intersectObjects(meshes, true);

      if (intersects.length === 0) {
        setHovered(null, null);
        return;
      }

      // Prioritize specific foreground objects (ideals, planets, astrolabe rings) over the broad arm dust background
      const typePriority: Record<string, number> = {
        ideal: 4,
        planet: 3,
        ring: 2,
        arm: 1,
      };

      const resolvedHits = intersects
        .map((hit) => {
          const owner = candidates.find(({ hitObj: h }) => {
            if (h.instanceId !== undefined && h.instanceId !== hit.instanceId) return false;
            let curr: THREE.Object3D | null = hit.object;
            while (curr) {
              if (curr === h.mesh) return true;
              curr = curr.parent;
            }
            return false;
          });
          return owner ? { ...owner, hit } : null;
        })
        .filter(
          (item): item is (typeof candidates)[0] & { hit: THREE.Intersection } => item !== null,
        );

      if (resolvedHits.length === 0) {
        setHovered(null, null);
        return;
      }

      resolvedHits.sort((a, b) => {
        const prioA = typePriority[a.hitObj.type] ?? 0;
        const prioB = typePriority[b.hitObj.type] ?? 0;
        if (prioA !== prioB) return prioB - prioA;
        return a.hit.distance - b.hit.distance;
      });

      const best = resolvedHits[0];
      setHovered(best.builder, {
        type: best.hitObj.type as "ideal" | "planet" | "ring" | "arm",
        id: best.hitObj.id,
        instanceId: best.hit.instanceId,
      });
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging) {
        onPointerHover(e);
        return;
      }
      const dx = e.clientX - previousPointer.x;
      const dy = e.clientY - previousPointer.y;
      dragDistance += Math.hypot(dx, dy);
      previousPointer = { x: e.clientX, y: e.clientY };
      cameraManager.onPointerDrag(dx, dy);
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!isDragging) return;
      isDragging = false;

      // If user merely clicked without dragging, perform raycast picking
      if (dragDistance < 6) {
        const rect = canvas.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, cameraManager.camera);
        // Raycasting ignores `Object3D.visible`, so a body the timeline
        // transport hasn't drawn yet must be excluded here explicitly rather
        // than relying on it being hidden.
        const clickable = hitObjects().filter(
          ({ builder, hitObj }) =>
            (hitObj.type === "planet" || hitObj.type === "sector" || hitObj.type === "body") &&
            builder.isHitVisible(hitObj),
        );
        const meshesToTest = clickable.map((c) => c.hitObj.mesh);
        const intersects = raycaster.intersectObjects(meshesToTest, true);

        if (intersects.length > 0) {
          const hit = intersects[0];
          // The five planets are one InstancedMesh, so the mesh alone no longer
          // says which was clicked — without the instance check every planet
          // resolves to whichever registered first.
          const hitObj = clickable.find(({ hitObj: h }) => {
            if (h.instanceId !== undefined && h.instanceId !== hit.instanceId) return false;
            let curr: THREE.Object3D | null = hit.object;
            while (curr) {
              if (curr === h.mesh) return true;
              curr = curr.parent;
            }
            return false;
          })?.hitObj;

          if (hitObj) {
            if (hitObj.type === "planet" || hitObj.type === "sector") {
              onSelectSector(hitObj.id);
            } else if (hitObj.type === "body") {
              onSelectBody(hitObj.id);
            }
          }
        }
      }
    };

    const onPointerLeave = () => {
      setHovered(null, null);
    };

    // On `window`, not on the canvas: the pins, surface targets and HUD are
    // siblings of the canvas rather than children, so a wheel over any of them
    // bubbled past it and zoom did nothing. `scrollOwnerFor` hands the event
    // back to a panel that has its own content to scroll — see `wheelRouting`.
    const onWheel = (e: WheelEvent) => {
      if (scrollOwnerFor(e.target)) return;
      e.preventDefault();
      const wantsToAscend = cameraManager.onWheelZoom(e.deltaY);
      if (wantsToAscend && framingRef.current.kind === "solarSystem") onAscend?.();
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("wheel", onWheel, { passive: false });

    // 7. Resize handler
    const onResize = () => {
      if (!container) return;
      width = container.clientWidth;
      height = container.clientHeight;
      cameraManager.resize(width, height);
      // Dragging the window between a retina and a non-retina display fires a
      // resize and changes the ratio without changing a CSS pixel of the canvas.
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(width, height);
      composer.setSize(width, height);
      bloomPass.resolution.set(width, height);
      galaxyBuilder.setPixelRatio(renderer.getPixelRatio());
      for (const builder of builders.values()) {
        builder.setResolution(width, height);
        builder.setPixelRatio(renderer.getPixelRatio());
        // Through the ref because this closure outlives the toggle now: read as
        // a captured value it would repaint every builder back to whichever
        // ground was current when the scene was last built.
        builder.setCosmicMode(cosmicModeRef.current);
      }
    };
    window.addEventListener("resize", onResize);

    // 8. Render Loop with Post-Processing
    let animationId: number;
    let lastTime = performance.now();

    const animate = (currentTime: number) => {
      animationId = requestAnimationFrame(animate);
      const delta = Math.min((currentTime - lastTime) / 1000, 0.1);
      lastTime = currentTime;
      const elapsed = currentTime / 1000;

      // Update controllers
      dayNight.update(delta);
      cameraManager.update(delta);
      // The shadow volume follows what the camera is looking at. `setShadowReach`
      // sizes it when the framing changes, which is as often as its WIDTH can
      // change; where it sits is a per-frame question, because the frames it has
      // to cover move — the pattern turns and carries the planets, and a moon
      // rides its orbit. The camera's target is already that point, lerped and
      // live, so there is nothing here to keep in step with it.
      dayNight.setShadowCenter(cameraManager.target);
      // Once, and before the systems that hang off it.
      galaxyBuilder.update(elapsed);
      // The sun travels, so the planets are told where it is every frame — one
      // sun for the whole galaxy, read once. `sunDirection` returns a vector it
      // reuses and `setLightDirection` copies it, so asking per builder would
      // buy nothing but the same answer twice.
      const sun = dayNight.sunDirection();
      for (const builder of builders.values()) {
        builder.setLightDirection(sun);
        builder.update(elapsed, delta);
      }

      // Render through EffectComposer with Optical Bloom
      composer.render();

      // Project 2D pins for HUD labels
      if (onProjectPins) {
        const points: ScreenPoint[] = [];
        const cam = cameraManager.camera;

        // 5 Dedicated Planet Pins & Central Anchor Sun. Anchored in
        // `planetPins.ts`, where the rule can be tested: heights are authored,
        // the horizontal comes off the scene graph every frame, because the
        // pattern turns and a constant would leave the pins behind.
        // Per builder and concatenated. `PIN_HEIGHTS` is keyed by arm,
        // `validateGalaxy` guarantees arm ids are unique across the galaxy, and
        // `planetFrame` answers only for the arms its own system declares — so
        // no two builders offer the same arm.
        //
        // The core is the exception, and not one uniqueness can settle: every
        // solar system HAS one, and they all answer to the id `solarSystem`.
        // The overlay keys pins by id, so only the atlas's is projected. Which
        // system's core is worth naming is the system switcher's question, and
        // it is answered where that lands.
        for (const [scopeId, builder] of builders) {
          const isAtlas = scopeId === SOLAR_SYSTEM_ZEMI.id;
          for (const { id, anchor } of planetPinAnchors(builder)) {
            if (id === "solarSystem" && !isAtlas) continue;
            const p = projectToScreen(anchor, cam, width, height);
            if (p.depth < 1) {
              points.push({ id, x: p.x, y: p.y, visible: true, depth: p.depth });
            }
          }
        }

        onProjectPins(points);
      }

      // Surface targets ride the same projection bridge. Their world positions
      // move — an orrery bead is on a turning pivot — so they are read from the
      // scene graph frame rather than cached with the target list.
      if (onProjectSurfaceTargets) {
        const cam = cameraManager.camera;
        const scratch = new THREE.Vector3();
        onProjectSurfaceTargets(
          surfaceTargetsRef.current.map((t) => {
            t.object.updateWorldMatrix(true, false);
            scratch.setFromMatrixPosition(t.object.matrixWorld);
            const p = projectToScreen(scratch, cam, width, height);
            return {
              id: t.id,
              label: t.label,
              bodyId: t.bodyId,
              kind: t.kind,
              x: p.x,
              y: p.y,
              visible: p.visible,
              depth: p.depth,
            };
          }),
        );
      }

      // Project the scene-space overlay anchors (the quote sky) down the same path.
      if (onProjectAnchors && anchors && anchors.length > 0) {
        const cam = cameraManager.camera;
        onProjectAnchors(
          anchors.map((a) => {
            const p = projectToScreen(
              new THREE.Vector3(a.position.x, a.position.y, a.position.z),
              cam,
              width,
              height,
            );
            return { id: a.id, x: p.x, y: p.y, visible: p.visible, depth: p.depth };
          }),
        );
      }
    };

    animationId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationId);
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", onResize);
      // Every system, then the frame they hang off. A day/night toggle no
      // longer comes through here — that is the whole point of `cosmicModeRef`
      // — but this still runs whenever the handler props or the anchors change,
      // and anything missed is stranded on the GPU for the life of the page.
      for (const builder of builders.values()) builder.dispose();
      galaxyBuilder.dispose();
      composer.dispose();
      renderer.dispose();
      rendererRef.current = null;
    };
  }, [
    // `bodies` is deliberately absent: each system's body set now comes from
    // `bodiesFor`, so the prop no longer describes anything this effect builds.
    // It is still what the framing owner below measures against.
    onSelectSector,
    onSelectBody,
    onProjectPins,
    anchors,
    onProjectAnchors,
    onProjectSurfaceTargets,
    onAscend,
    // `cosmicMode` is deliberately absent, and is read through `cosmicModeRef`
    // above: a ground swap repaints the scene it already has rather than
    // building a new one. See that ref for what the rebuild used to cost.
  ]);

  /**
   * Re-apply the current framing. Called by the effect below and by scene
   * construction, so a rebuild (a day/night toggle, a resize of the body set)
   * lands the camera where the app already thinks it is instead of at the
   * galaxy.
   *
   * One exhaustive switch over `Framing`, not a chain of guards over four
   * props. That is the whole reason `Framing` exists: precedence between
   * standing, flying past and framing used to be decided here AND in
   * `page.tsx`, and the two came apart — `scopeGroups.has` silently routed the
   * two scoped arms down a different path from the other three. A union the
   * compiler checks cannot grow a branch that nobody handles.
   */
  /** Rebuilt only when the standing frame changes; projected every frame. */
  const surfaceTargetsRef = useRef<SurfaceTarget[]>([]);
  const frameRef = useRef<() => void>(() => {});
  frameRef.current = () => {
    // Asks for the atlas by name rather than for "the builder". Every framing
    // this switch handles today names something in the atlas; which system a
    // framing belongs to is the galaxy camera's question, and it is answered
    // where that lands.
    const builder = builderFor(SOLAR_SYSTEM_ZEMI.id);
    const camera = cameraManagerRef.current;
    if (!builder || !camera) return;

    // Standing on a surface is the innermost frame there is, and the only one
    // that changes what the scene draws rather than only where it is seen from.
    if (framing.kind === "surface" && builder.scopeGroups.has(framing.scope)) {
      const scope = framing.scope;
      const parentId = getScope(scope).parent ?? SOLAR_SYSTEM_ZEMI.id;
      const parent = builder.scopeGroups.get(parentId) ?? builder.rootGroup;
      const frameGroup = builder.groupFor(scope);
      camera.landOnSurface(frameGroup, parent, shardRadiusFor(scope, bodies));
      builder.setStandingOn(scope);
      surfaceTargetsRef.current = builder.surfaceTargets(scope);
      builder.setScopeCull(scope);
      // Fog is pulled in to the distance of the parent, so it recedes the
      // galaxy without touching the frame §3.2 requires to stay legible.
      frameGroup.updateWorldMatrix(true, false);
      parent.updateWorldMatrix(true, false);
      dayNightRef.current?.setFogReference(
        new THREE.Vector3()
          .setFromMatrixPosition(frameGroup.matrixWorld)
          .distanceTo(new THREE.Vector3().setFromMatrixPosition(parent.matrixWorld)) || 60,
      );
      // Shadows follow the fog down to the frame's own scale. A frustum sized
      // for the galaxy would spend the whole 2048² map on ground you cannot see.
      dayNightRef.current?.setShadowReach(shardRadiusFor(scope, bodies));
      return;
    }

    surfaceTargetsRef.current = [];
    builder.setStandingOn(null);
    builder.setScopeCull(null);
    // The palette's own planes are sized to the atlas — `fogFar` is
    // `ASTROLABE_OUTER * 5` — so at the galaxy pose the atlas at the origin is
    // already past `fogNear` and the far rim is past `fogFar` entirely: in day
    // mode, where the fog colour IS the paper, the whole view washes out. The
    // galaxy gets the fog referenced to its own scale, the same lever the
    // surface branch above pulls in the other direction.
    dayNightRef.current?.setFogReference(framing.kind === "galaxy" ? GALAXY_REACH : null);
    // Back out to the galaxy: the frustum has to reach the planets again.
    dayNightRef.current?.setShadowReach(
      framing.kind === "galaxy" ? GALAXY_REACH : ASTROLABE_OUTER,
    );

    // A place, not a body: the galaxy frame does not rotate and solar systems
    // do not revolve in it, which is what makes a fixed pose honest here and
    // nowhere below.
    if (framing.kind === "galaxy") {
      camera.ascend("galaxy");
      return;
    }

    if (framing.kind === "solarSystem") {
      const target = framedSystem(sceneBuildersRef.current, framing.scope);
      // A system this scene does not draw is framed from the galaxy rather
      // than throwing — the same answer the pins already give.
      if (target) camera.descend(target.frame, target.radius, target.offset);
      else camera.ascend("galaxy");
      return;
    }

    // Everything else names a body, and framing a body means following it:
    // L1 carries planets and L3 carries moons, so a pose derived once is stale
    // by the next frame. `descend` re-aims from the frame's live matrix and
    // releases whatever was being tracked before — which is how "an explicit
    // preset wins" is honoured while still following.
    //
    // `framedBody` answers for a planet with a scope, a planet without one, and
    // a moon, so there is no branch here that could treat them differently.
    // A `surface` whose scope this scene does not draw falls through to here
    // too, and is framed from orbit rather than throwing.
    const target = framedBody(builder, bodies, framing.kind === "surface"
      ? { kind: "moon", scope: framing.scope }
      : framing);
    if (target) camera.descend(target.frame, target.radius, target.offset);
  };

  useEffect(() => {
    frameRef.current();
  }, [framing]);

  return (
    <div ref={containerRef} className="absolute inset-0 size-full overflow-hidden touch-none">
      <canvas ref={canvasRef} className="size-full block" />
    </div>
  );
});
