"use client";

import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import type { Body, ScreenPoint, Vec3 } from "@/lib/atlas/types";
import { DayNightController, type CosmicMode } from "./DayNightController";
import { WorldCameraManager, type CameraTargetPreset, PLANET_CENTERS } from "./WorldCameraManager";
import { WorldSceneBuilder } from "./WorldSceneBuilder";

export interface WorldCanvasHandle {
  triggerPaddleHit: () => void;
}

/** Anything the canvas can carry for an HTML overlay: an id and a scene position. */
export interface ProjectableAnchor {
  id: string;
  position: Vec3;
}

export interface WorldCanvasProps {
  bodies: Body[];
  cosmicMode: CosmicMode;
  cameraPreset: CameraTargetPreset;
  onSelectSector: (sectorId: string) => void;
  onSelectBody: (bodyId: string) => void;
  onProjectPins?: (points: ScreenPoint[]) => void;
  /**
   * Scene-space anchors projected alongside the planet pins each frame. This is
   * what lets an HTML layer be *in* the scene: the quote sky hangs on these, so
   * it parallaxes when the camera orbits instead of being painted on the monitor.
   */
  anchors?: ProjectableAnchor[];
  onProjectAnchors?: (points: ScreenPoint[]) => void;
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
    cameraPreset,
    onSelectSector,
    onSelectBody,
    onProjectPins,
    anchors,
    onProjectAnchors,
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

  // Expose handle methods
  useImperativeHandle(ref, () => ({
    triggerPaddleHit: () => {},
  }));

  // Sync Day/Night mode & bloom parameters
  useEffect(() => {
    dayNightRef.current?.setMode(cosmicMode);
    if (bloomPassRef.current) {
      bloomPassRef.current.strength = BLOOM[cosmicMode].strength;
      bloomPassRef.current.threshold = BLOOM[cosmicMode].threshold;
    }
  }, [cosmicMode]);

  // Sync Camera preset
  useEffect(() => {
    cameraManagerRef.current?.setPreset(cameraPreset);
  }, [cameraPreset]);

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
    const cameraManager = new WorldCameraManager(width, height);
    cameraManager.setPreset(cameraPreset);
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
    const sceneBuilder = new WorldSceneBuilder(scene, bodies, today);
    sceneBuilder.build();
    sceneBuilderRef.current = sceneBuilder;

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

    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging) return;
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
        const meshesToTest = sceneBuilder.hitObjects.map((h) => h.mesh);
        const intersects = raycaster.intersectObjects(meshesToTest, true);

        if (intersects.length > 0) {
          const hitMesh = intersects[0].object;
          // Find corresponding hit object
          const hitObj = sceneBuilder.hitObjects.find((h) => {
            let curr: THREE.Object3D | null = hitMesh;
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

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      cameraManager.onWheelZoom(e.deltaY);
    };

    canvas.addEventListener("pointerdown", onPointerDown);
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
      sceneBuilder.update(elapsed, delta);

      // Render through EffectComposer with Optical Bloom
      composer.render();

      // Project 2D pins for HUD labels
      if (onProjectPins) {
        const points: ScreenPoint[] = [];
        const cam = cameraManager.camera;

        // 5 Dedicated Planet Pins & Central Anchor Sun
        const planetPins = [
          { id: "galaxy", label: "Golden Zemí Sun", pos: new THREE.Vector3(PLANET_CENTERS.sun.x, 8.8, PLANET_CENTERS.sun.z) },
          { id: "self", label: "Planet Self", pos: new THREE.Vector3(PLANET_CENTERS.self.x, 5.8, PLANET_CENTERS.self.z) },
          { id: "foundations", label: "Planet Foundations", pos: new THREE.Vector3(PLANET_CENTERS.foundations.x, 6.2, PLANET_CENTERS.foundations.z) },
          { id: "products", label: "Planet Products", pos: new THREE.Vector3(PLANET_CENTERS.products.x, 7.8, PLANET_CENTERS.products.z) },
          { id: "labs", label: "Planet Labs", pos: new THREE.Vector3(PLANET_CENTERS.labs.x, 6.8, PLANET_CENTERS.labs.z) },
          { id: "creative", label: "Planet Creative", pos: new THREE.Vector3(PLANET_CENTERS.creative.x, 5.6, PLANET_CENTERS.creative.z) },
        ];

        planetPins.forEach((s) => {
          const p = projectToScreen(s.pos, cam, width, height);
          if (p.depth < 1) {
            points.push({ id: s.id, x: p.x, y: p.y, visible: true, depth: p.depth });
          }
        });

        onProjectPins(points);
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
    cosmicMode,
    cameraPreset,
  ]);

  return (
    <div ref={containerRef} className="absolute inset-0 size-full overflow-hidden touch-none">
      <canvas ref={canvasRef} className="size-full block" />
    </div>
  );
});
