"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { SceneBuilder } from "./SceneBuilder";
import { CameraManager } from "./CameraManager";
import { ScreenPinPosition, TimeOfDay } from "./types";
import { SECTORS } from "../data/ecosystem";
import { sound } from "@/lib/audio";

interface WorldCanvasProps {
  selectedSectorId: string | null;
  timeOfDay: TimeOfDay;
  onSelectSector: (sectorId: string | null) => void;
  onPinsUpdate: (pins: ScreenPinPosition[]) => void;
  onTriggerMinigame?: (gameType: "pickleball" | "terminal") => void;
}

export function WorldCanvas({
  selectedSectorId,
  timeOfDay,
  onSelectSector,
  onPinsUpdate,
}: WorldCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraManagerRef = useRef<CameraManager | null>(null);
  const sceneBuilderRef = useRef<SceneBuilder | null>(null);

  const hoveredSectorIdRef = useRef<string | null>(null);
  const isDraggingRef = useRef(false);
  const pointerDownPosRef = useRef({ x: 0, y: 0 });

  // Camera focus on sector change
  useEffect(() => {
    if (cameraManagerRef.current) {
      const sector = selectedSectorId
        ? SECTORS.find((s) => s.id === selectedSectorId) || null
        : null;
      cameraManagerRef.current.focusSector(sector);

      if (sector && sceneBuilderRef.current) {
        sound.playClick(500, 0.08);
        if (sector.id === "fintech") {
          sceneBuilderRef.current.triggerCardSpin();
          sceneBuilderRef.current.triggerMarketDance();
        } else if (sector.id === "founder") {
          sceneBuilderRef.current.triggerBeaconPulse();
          sound.playChime(600, 0.3);
        }
      }
    }
  }, [selectedSectorId]);

  // Lighting presets based on Time of Day
  const timePresets = {
    day: {
      bg: 0xf7f6f2,
      fogNear: 28,
      fogFar: 55,
      hemiSky: 0xffffff,
      hemiGround: 0xe5ded1,
      hemiInt: 1.1,
      sunColor: 0xfff7ed,
      sunInt: 1.6,
      fillColor: 0xe0f2fe,
      fillInt: 0.6,
      emissiveInt: 0.4,
    },
    golden: {
      bg: 0xfdebd0,
      fogNear: 25,
      fogFar: 50,
      hemiSky: 0xfed7aa,
      hemiGround: 0xd97706,
      hemiInt: 1.0,
      sunColor: 0xf59e0b,
      sunInt: 1.9,
      fillColor: 0xfb923c,
      fillInt: 0.8,
      emissiveInt: 0.7,
    },
    night: {
      bg: 0x1e1b4b,
      fogNear: 20,
      fogFar: 45,
      hemiSky: 0x312e81,
      hemiGround: 0x0f172a,
      hemiInt: 0.5,
      sunColor: 0x818cf8,
      sunInt: 0.7,
      fillColor: 0x4338ca,
      fillInt: 0.9,
      emissiveInt: 1.5,
    },
  };

  useEffect(() => {
    const scene = sceneRef.current;
    const builder = sceneBuilderRef.current;
    if (!scene || !builder) return;

    const p = timePresets[timeOfDay] || timePresets.day;

    scene.background = new THREE.Color(p.bg);
    if (scene.fog && scene.fog instanceof THREE.Fog) {
      scene.fog.color.setHex(p.bg);
      scene.fog.near = p.fogNear;
      scene.fog.far = p.fogFar;
    }

    builder.hemiLight.color.setHex(p.hemiSky);
    builder.hemiLight.groundColor.setHex(p.hemiGround);
    builder.hemiLight.intensity = p.hemiInt;

    builder.sunLight.color.setHex(p.sunColor);
    builder.sunLight.intensity = p.sunInt;

    builder.fillLight.color.setHex(p.fillColor);
    builder.fillLight.intensity = p.fillInt;

    builder.nightEmissives.forEach((mat) => {
      if ((mat as THREE.MeshStandardMaterial).emissiveIntensity !== undefined) {
        (mat as THREE.MeshStandardMaterial).emissiveIntensity = p.emissiveInt;
      }
    });
  }, [timeOfDay]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    let width = container.clientWidth;
    let height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf7f6f2);
    scene.fog = new THREE.Fog(0xf7f6f2, 28, 55);
    sceneRef.current = scene;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    rendererRef.current = renderer;

    const cameraManager = new CameraManager(width, height);
    cameraManagerRef.current = cameraManager;

    const sceneBuilder = new SceneBuilder(scene);
    sceneBuilder.buildWorld();
    sceneBuilderRef.current = sceneBuilder;

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handleResize = () => {
      if (!container || !renderer || !cameraManager) return;
      width = container.clientWidth;
      height = container.clientHeight;
      cameraManager.resize(width, height);
      renderer.setSize(width, height);
    };

    const handlePointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      if (isDraggingRef.current) {
        const dx = e.clientX - pointerDownPosRef.current.x;
        const dy = e.clientY - pointerDownPosRef.current.y;
        cameraManager.addDragOffset(dx, dy);
        pointerDownPosRef.current = { x: e.clientX, y: e.clientY };
        return;
      }

      raycaster.setFromCamera(mouse, cameraManager.camera);
      const intersects = raycaster.intersectObjects(sceneBuilder.interactiveMeshes, false);

      if (intersects.length > 0) {
        const hitMesh = intersects[0].object;
        const sectorId = hitMesh.userData.sectorId;
        if (sectorId) {
          hoveredSectorIdRef.current = sectorId;
          canvas.style.cursor = "pointer";
          return;
        }
      }

      hoveredSectorIdRef.current = null;
      canvas.style.cursor = "grab";
    };

    const handlePointerDown = (e: PointerEvent) => {
      isDraggingRef.current = true;
      pointerDownPosRef.current = { x: e.clientX, y: e.clientY };
    };

    const handlePointerUp = (e: PointerEvent) => {
      const dist = Math.hypot(
        e.clientX - pointerDownPosRef.current.x,
        e.clientY - pointerDownPosRef.current.y
      );

      if (dist < 6 && hoveredSectorIdRef.current) {
        onSelectSector(hoveredSectorIdRef.current);
      }

      isDraggingRef.current = false;
    };

    const handleWheel = (e: WheelEvent) => {
      if (cameraManager.camera.fov) {
        cameraManager.camera.fov = Math.max(
          25,
          Math.min(55, cameraManager.camera.fov + e.deltaY * 0.02)
        );
        cameraManager.camera.updateProjectionMatrix();
      }
    };

    window.addEventListener("resize", handleResize);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointerup", handlePointerUp);
    canvas.addEventListener("wheel", handleWheel, { passive: true });

    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const elapsedTime = clock.getElapsedTime();

      // Dynamic animations
      sceneBuilder.animatedElements.forEach((el) => {
        const speed = el.speed || 1;
        const amp = el.amplitude || 0.2;

        if (el.type === "rotate") {
          el.mesh.rotation.y += delta * speed;
        } else if (el.type === "spin_blades") {
          el.mesh.rotation.z += delta * speed;
        } else if (el.type === "bounce") {
          const bounce = Math.abs(Math.sin(elapsedTime * speed)) * amp;
          el.mesh.position.y = (el.initialY || 0) + bounce;
        } else if (el.type === "float") {
          const wave = Math.sin(elapsedTime * speed) * amp;
          el.mesh.position.y = (el.initialY || 0) + wave;
        } else if (el.type === "pulse") {
          const scale = 1 + Math.sin(elapsedTime * speed) * 0.1;
          el.mesh.scale.set(scale, scale, 1);
        } else if (el.type === "cloud" && el.initialPos) {
          el.mesh.position.x += delta * speed;
          if (el.mesh.position.x > 18) {
            el.mesh.position.x = -18;
          }
        }
      });

      // Animate Living City Courier Bots along pathways
      sceneBuilder.courierBots.forEach((bot) => {
        bot.progress = (bot.progress + delta * bot.speed) % 1;
        const totalSegments = bot.path.length;
        const scaledProgress = bot.progress * totalSegments;
        const currentIdx = Math.floor(scaledProgress);
        const nextIdx = (currentIdx + 1) % totalSegments;
        const segmentProgress = scaledProgress - currentIdx;

        const p1 = bot.path[currentIdx];
        const p2 = bot.path[nextIdx];
        bot.mesh.position.lerpVectors(p1, p2, segmentProgress);

        bot.mesh.position.y = 0.55 + Math.sin(elapsedTime * 4 + bot.progress * 10) * 0.08;
      });

      // Tactile Island Lift on Hover
      sceneBuilder.interactiveSectors.forEach((sec, id) => {
        const isHovered = hoveredSectorIdRef.current === id;
        const isSelected = selectedSectorId === id;
        const targetLift = isHovered || isSelected ? 0.35 : 0;
        sec.group.position.y = THREE.MathUtils.lerp(
          sec.group.position.y,
          sec.initialY + targetLift,
          delta * 8
        );
      });

      cameraManager.update(delta);
      renderer.render(scene, cameraManager.camera);

      const pins = cameraManager.calculateScreenPins(width, height);
      onPinsUpdate(pins);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointerup", handlePointerUp);
      canvas.removeEventListener("wheel", handleWheel);
      renderer.dispose();
    };
  }, []);

  return (
    <div ref={containerRef} className="relative w-full h-full select-none touch-none overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full block cursor-grab active:cursor-grabbing" />
    </div>
  );
}
