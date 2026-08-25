"use client";

import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import type { Body, ScreenPoint, Vec3 } from "@/lib/atlas/types";
import { DayNightController, type CosmicMode } from "./DayNightController";
import { WorldCameraManager, ASTROLABE_OUTER } from "./WorldCameraManager";
import { framedBody } from "./planetFrames";
import type { Framing } from "@/lib/atlas/journey";
import { planetPinAnchors } from "./planetPins";
import { WorldSceneBuilder, fieldDensityFor, type SurfaceTarget } from "./WorldSceneBuilder";
import { shardRadiusFor } from "@/lib/atlas/surfaces";
import { SOLAR_SYSTEM_ZEMI, getScope } from "@/lib/atlas/scopes";

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
   * The timeline transport's clock, in days since the galaxy epoch. Drives only
   * what the scene shows — see `WorldSceneBuilder.setClockDay` — never a
   * rebuild: applied through a dedicated effect, not the scene's own deps, so
   * scrubbing never tears down and reconstructs the map underneath it.
   */
  clockDay?: number;
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
    clockDay = Infinity,
    anchors,
    onProjectAnchors,
    onProjectSurfaceTargets,
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneBuilderRef = useRef<WorldSceneBuilder | null>(null);
  const cameraManagerRef = useRef<WorldCameraManager | null>(null);
  const dayNightRef = useRef<DayNightController | null>(null);
  const bloomPassRef = useRef<UnrealBloomPass | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);
  // Read at construction time only — see the mount effect below. Kept fresh by
  // its own effect so a scene rebuild (day/night, a resized body set) always
  // reads the clock the transport is actually on, not the one from first mount.
  const clockDayRef = useRef(clockDay);
  clockDayRef.current = clockDay;

  // Expose handle methods
  useImperativeHandle(ref, () => ({
    triggerPaddleHit: () => {},
    setHoveredPlanet: (id: string | null) => {
      const builder = sceneBuilderRef.current;
      if (!builder) return;
      builder.setHoveredTarget(id ? { type: "planet", id } : null);
    },
  }));

  // Sync the timeline transport's clock. A dedicated effect, not a dependency
  // of the scene-construction effect below: that effect rebuilds the whole
  // THREE scene on every dependency change, and a scrub drag can fire many
  // times a second — this only ever touches the already-built scene.
  useEffect(() => {
    sceneBuilderRef.current?.setClockDay(clockDay);
  }, [clockDay]);

  // Sync Day/Night mode & bloom parameters
  useEffect(() => {
    dayNightRef.current?.setMode(cosmicMode);
    sceneBuilderRef.current?.setCosmicMode(cosmicMode);
    if (bloomPassRef.current) {
      bloomPassRef.current.strength = BLOOM[cosmicMode].strength;
      bloomPassRef.current.threshold = BLOOM[cosmicMode].threshold;
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
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 2. DayNight Controller
    const dayNight = new DayNightController(scene, cosmicMode);
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
      BLOOM[cosmicMode].strength,
      0.45, // Bloom radius
      BLOOM[cosmicMode].threshold
    );
    composer.addPass(bloomPass);
    bloomPassRef.current = bloomPass;

    const outputPass = new OutputPass();
    composer.addPass(outputPass);
    composerRef.current = composer;

    // 5. Scene Builder
    const today = new Date().toISOString().slice(0, 10);
    const sceneBuilder = new WorldSceneBuilder(
      scene,
      bodies,
      today,
      fieldDensityFor(width),
      reduced,
    );
    sceneBuilder.build();
    sceneBuilder.setResolution(width, height);
    sceneBuilder.setCosmicMode(cosmicMode);
    // Not a dependency (see the dedicated clock effect above) — read fresh at
    // construction time only, via the ref.
    sceneBuilder.setClockDay(clockDayRef.current);
    sceneBuilderRef.current = sceneBuilder;

    // Both refs are live now, so the framing owner can seed the initial pose —
    // and re-seed it whenever this effect rebuilds the scene.
    frameRef.current();

    // 6. Raycasting and pointer interaction
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
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
      const candidates = sceneBuilder.hitObjects.filter(
        (h) => hoverTypes.has(h.type) && sceneBuilder.isHitVisible(h),
      );
      if (candidates.length === 0) return;

      const meshes = candidates.map((h) => h.mesh);
      const intersects = raycaster.intersectObjects(meshes, true);

      if (intersects.length === 0) {
        sceneBuilder.setHoveredTarget(null);
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
          const hitObj = candidates.find((h) => {
            if (h.instanceId !== undefined && h.instanceId !== hit.instanceId) return false;
            let curr: THREE.Object3D | null = hit.object;
            while (curr) {
              if (curr === h.mesh) return true;
              curr = curr.parent;
            }
            return false;
          });
          return hitObj ? { hitObj, hit } : null;
        })
        .filter((item): item is { hitObj: (typeof candidates)[0]; hit: THREE.Intersection } => item !== null);

      if (resolvedHits.length === 0) {
        sceneBuilder.setHoveredTarget(null);
        return;
      }

      resolvedHits.sort((a, b) => {
        const prioA = typePriority[a.hitObj.type] ?? 0;
        const prioB = typePriority[b.hitObj.type] ?? 0;
        if (prioA !== prioB) return prioB - prioA;
        return a.hit.distance - b.hit.distance;
      });

      const best = resolvedHits[0];
      sceneBuilder.setHoveredTarget({
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
        const clickable = sceneBuilder.hitObjects.filter(
          (h) =>
            (h.type === "planet" || h.type === "sector" || h.type === "body") &&
            sceneBuilder.isHitVisible(h),
        );
        const meshesToTest = clickable.map((h) => h.mesh);
        const intersects = raycaster.intersectObjects(meshesToTest, true);

        if (intersects.length > 0) {
          const hit = intersects[0];
          // The five planets are one InstancedMesh, so the mesh alone no longer
          // says which was clicked — without the instance check every planet
          // resolves to whichever registered first.
          const hitObj = clickable.find((h) => {
            if (h.instanceId !== undefined && h.instanceId !== hit.instanceId) return false;
            let curr: THREE.Object3D | null = hit.object;
            while (curr) {
              if (curr === h.mesh) return true;
              curr = curr.parent;
            }
            return false;
          });

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
      sceneBuilder.setHoveredTarget(null);
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      cameraManager.onWheelZoom(e.deltaY);
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    // 7. Resize handler
    const onResize = () => {
      if (!container) return;
      width = container.clientWidth;
      height = container.clientHeight;
      cameraManager.resize(width, height);
      renderer.setSize(width, height);
      composer.setSize(width, height);
      bloomPass.resolution.set(width, height);
      sceneBuilder.setResolution(width, height);
    sceneBuilder.setCosmicMode(cosmicMode);
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
      // The sun travels, so the planets are told where it is every frame.
      sceneBuilder.setLightDirection(dayNight.sunDirection());
      cameraManager.update(delta);
      sceneBuilder.update(elapsed, delta);

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
        for (const { id, anchor } of planetPinAnchors(sceneBuilder)) {
          const p = projectToScreen(anchor, cam, width, height);
          if (p.depth < 1) {
            points.push({ id, x: p.x, y: p.y, visible: true, depth: p.depth });
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
      canvas.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", onResize);
      composer.dispose();
      renderer.dispose();
    };
  }, [
    bodies,
    onSelectSector,
    onSelectBody,
    onProjectPins,
    anchors,
    onProjectAnchors,
    onProjectSurfaceTargets,
    cosmicMode,
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
    const builder = sceneBuilderRef.current;
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
    dayNightRef.current?.setFogReference(null);
    // Back out to the galaxy: the frustum has to reach the planets again.
    dayNightRef.current?.setShadowReach(ASTROLABE_OUTER);

    if (framing.kind === "solarSystem") {
      camera.ascend();
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
