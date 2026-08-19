"use client";

import { useEffect, useRef, useMemo } from "react";
import * as THREE from "three";
import type { Body, ScreenPoint } from "@/lib/atlas/types";
import { loadBodies } from "@/lib/atlas/bodies";
import { placeBodies } from "@/lib/atlas/position";
import { AtlasCamera } from "./AtlasCamera";
import { FieldBuilder } from "./FieldBuilder";

export interface FieldProps {
  bodies?: Body[];
  today?: string;
  selectedId?: string | null;
  /** Bump to swing the camera back to the overview. */
  resetToken?: number;
  /**
   * Called once per frame with the projected hit targets and how far out the
   * camera currently sits — the Chart needs the distance to thin its labels.
   */
  onProject: (points: ScreenPoint[], cameraDistance: number) => void;
}

export function Field({
  bodies: propBodies,
  today: propToday,
  selectedId = null,
  resetToken = 0,
  onProject,
}: FieldProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraRef = useRef<AtlasCamera | null>(null);

  const bodies = useMemo(() => propBodies ?? loadBodies(), [propBodies]);
  const today = useMemo(() => propToday ?? new Date().toISOString().slice(0, 10), [propToday]);
  const placements = useMemo(() => placeBodies(bodies), [bodies]);
  const placementMap = useMemo(() => new Map(placements.map((p) => [p.id, p])), [placements]);

  const isDraggingRef = useRef(false);
  const pointerDownPosRef = useRef({ x: 0, y: 0 });

  // Mirrors of props the animation loop reads on every frame. The WebGL setup
  // effect runs once on mount, so it reads through these refs rather than closing
  // over the props directly — without this pattern the renderer would tear down
  // and rebuild whenever a parent re-renders.
  const onProjectRef = useRef(onProject);
  useEffect(() => {
    onProjectRef.current = onProject;
  }, [onProject]);

  // The HUD's reset control. Runs once on mount with the camera not yet built,
  // which is harmless: an unbuilt camera already sits at the overview.
  useEffect(() => {
    cameraRef.current?.focus(null);
  }, [resetToken]);

  // Focus camera when selection changes
  useEffect(() => {
    if (!cameraRef.current) return;
    if (selectedId) {
      const placement = placementMap.get(selectedId);
      if (placement) {
        cameraRef.current.focus(placement.position, 22);
      }
    } else {
      cameraRef.current.focus(null);
    }
  }, [selectedId, placementMap]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    let width = container.clientWidth;
    let height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf7f6f2);

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // Shadows disabled: no geometry to cast them and they cost real frame time.
    renderer.shadowMap.enabled = false;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const camera = new AtlasCamera(width, height);
    cameraRef.current = camera;

    const builder = new FieldBuilder(scene, bodies, today);
    builder.build();

    const handleResize = () => {
      if (!container) return;
      width = container.clientWidth;
      height = container.clientHeight;
      camera.resize(width, height);
      renderer.setSize(width, height);
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (isDraggingRef.current) {
        const dx = e.clientX - pointerDownPosRef.current.x;
        const dy = e.clientY - pointerDownPosRef.current.y;
        camera.orbit(-dx * 0.005, -dy * 0.005);
        pointerDownPosRef.current = { x: e.clientX, y: e.clientY };
      }
    };

    const handlePointerDown = (e: PointerEvent) => {
      isDraggingRef.current = true;
      pointerDownPosRef.current = { x: e.clientX, y: e.clientY };
    };

    const handlePointerUp = () => {
      isDraggingRef.current = false;
    };

    const handleWheel = (e: WheelEvent) => {
      camera.zoom(e.deltaY);
    };

    window.addEventListener("resize", handleResize);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    canvas.addEventListener("wheel", handleWheel, { passive: true });

    let animationFrameId: number;
    const clock = new THREE.Clock();

    const bodyPoints = bodies.map((b) => {
      const p = placementMap.get(b.id);
      return { id: b.id, pos: p ? p.position : { x: 0, y: 0, z: 0 } };
    });

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      builder.update(elapsed);
      camera.update(delta);
      renderer.render(scene, camera.camera);

      const screenPoints = camera.projectToScreen(bodyPoints, width, height);
      onProjectRef.current(screenPoints, camera.distance);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      canvas.removeEventListener("wheel", handleWheel);
      renderer.dispose();
    };
  }, [bodies, today, placementMap]);

  return (
    <div ref={containerRef} className="relative w-full h-full select-none touch-none overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full block cursor-grab active:cursor-grabbing" />
    </div>
  );
}
