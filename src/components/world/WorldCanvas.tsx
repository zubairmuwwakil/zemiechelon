"use client";

import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import type { Body, ScreenPoint } from "@/lib/atlas/types";
import { DayNightController, type CosmicMode } from "./DayNightController";
import { WorldCameraManager, type CameraTargetPreset, PLANET_CENTERS } from "./WorldCameraManager";
import { WorldSceneBuilder, type InteractiveHitObject } from "./WorldSceneBuilder";

export interface WorldCanvasHandle {
  triggerPaddleHit: () => void;
}

export interface WorldCanvasProps {
  bodies: Body[];
  cosmicMode: CosmicMode;
  cameraPreset: CameraTargetPreset;
  onSelectSector: (sectorId: string) => void;
  onSelectBody: (bodyId: string) => void;
  onProjectPins?: (points: ScreenPoint[]) => void;
}

export const WorldCanvas = forwardRef<WorldCanvasHandle, WorldCanvasProps>(function WorldCanvas(
  { bodies, cosmicMode, cameraPreset, onSelectSector, onSelectBody, onProjectPins },
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
      bloomPassRef.current.strength = cosmicMode === "day" ? 0.35 : 0.85;
      bloomPassRef.current.threshold = cosmicMode === "day" ? 0.82 : 0.6;
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
      cosmicMode === "day" ? 0.35 : 0.85, // Bloom strength
      0.45, // Bloom radius
      cosmicMode === "day" ? 0.82 : 0.6 // Luminance threshold
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
          const v = s.pos.clone().project(cam);
          if (v.z < 1) {
            const x = ((v.x + 1) * width) / 2;
            const y = ((-v.y + 1) * height) / 2;
            points.push({
              id: s.id,
              x,
              y,
              visible: true,
              depth: v.z,
            });
          }
        });

        onProjectPins(points);
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
  }, [bodies, onSelectSector, onSelectBody, onProjectPins, cosmicMode, cameraPreset]);

  return (
    <div ref={containerRef} className="absolute inset-0 size-full overflow-hidden touch-none">
      <canvas ref={canvasRef} className="size-full block" />
    </div>
  );
});
