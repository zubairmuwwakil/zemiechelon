import * as THREE from "three";

export type TimeOfDay = "day" | "golden" | "night";

export interface AnimatedElement {
  mesh: THREE.Object3D;
  type: "rotate" | "bounce" | "float" | "pulse" | "cloud" | "spin_blades";
  speed?: number;
  amplitude?: number;
  offset?: number;
  initialY?: number;
  initialPos?: THREE.Vector3;
}

export interface InteractiveSectorObject {
  sectorId: string;
  group: THREE.Group;
  initialY: number;
  targetY: number;
}

export interface ScreenPinPosition {
  sectorId: string;
  x: number;
  y: number;
  visible: boolean;
}

export interface CourierBot {
  mesh: THREE.Group;
  path: THREE.Vector3[];
  progress: number; // 0 to 1
  speed: number;
  trailColor: number;
}
