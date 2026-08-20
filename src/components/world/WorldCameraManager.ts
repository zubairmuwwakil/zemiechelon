import * as THREE from "three";

export type CameraTargetPreset =
  | "galaxy"
  | "overview"
  | "products"
  | "labs"
  | "foundations"
  | "self"
  | "creative"
  | string;

export interface CameraPose {
  position: THREE.Vector3;
  target: THREE.Vector3;
}

// 5 Dedicated Planet Centers - Expanded Orbital Distance for dramatic depth
export const PLANET_CENTERS = {
  sun: new THREE.Vector3(0, 0, 0),
  self: new THREE.Vector3(0, 0, 36),
  foundations: new THREE.Vector3(-52, 0, -38),
  products: new THREE.Vector3(-68, 0, 68),
  labs: new THREE.Vector3(105, 0, -75),
  creative: new THREE.Vector3(120, 0, 118),
};

export const CAMERA_PRESETS: Record<string, CameraPose> = {
  galaxy: {
    position: new THREE.Vector3(0, 185, 230),
    target: new THREE.Vector3(0, 0, 0),
  },
  overview: {
    position: new THREE.Vector3(0, 185, 230),
    target: new THREE.Vector3(0, 0, 0),
  },
  self: {
    position: new THREE.Vector3(0, 22, 36 + 28),
    target: new THREE.Vector3(0, 2, 36),
  },
  founder: {
    position: new THREE.Vector3(0, 22, 36 + 28),
    target: new THREE.Vector3(0, 2, 36),
  },
  foundations: {
    position: new THREE.Vector3(-52, 24, -38 + 32),
    target: new THREE.Vector3(-52, 2, -38),
  },
  products: {
    position: new THREE.Vector3(-68, 28, 68 + 36),
    target: new THREE.Vector3(-68, 2.5, 68),
  },
  pickleops: {
    position: new THREE.Vector3(-68, 28, 68 + 36),
    target: new THREE.Vector3(-68, 2.5, 68),
  },
  fintech: {
    position: new THREE.Vector3(-68, 28, 68 + 36),
    target: new THREE.Vector3(-68, 2.5, 68),
  },
  labs: {
    position: new THREE.Vector3(105, 25, -75 + 34),
    target: new THREE.Vector3(105, 2, -75),
  },
  ai: {
    position: new THREE.Vector3(105, 25, -75 + 34),
    target: new THREE.Vector3(105, 2, -75),
  },
  creative: {
    position: new THREE.Vector3(120, 22, 118 + 30),
    target: new THREE.Vector3(120, 2, 118),
  },
};

export class WorldCameraManager {
  public camera: THREE.PerspectiveCamera;
  public target = new THREE.Vector3(0, 0, 0);

  private currentPose: CameraPose = {
    position: new THREE.Vector3(0, 185, 230),
    target: new THREE.Vector3(0, 0, 0),
  };

  private desiredPose: CameraPose = {
    position: new THREE.Vector3(0, 185, 230),
    target: new THREE.Vector3(0, 0, 0),
  };

  // Orbit state
  private spherical = new THREE.Spherical(295, Math.PI / 3.1, Math.PI / 4);
  private sphericalTarget = new THREE.Spherical(295, Math.PI / 3.1, Math.PI / 4);
  private isUserInteracting = false;

  // Limits
  private minDistance = 15;
  private maxDistance = 480;
  private minPolarAngle = 0.12;
  private maxPolarAngle = Math.PI / 2 - 0.04; // Stay above plane

  constructor(width: number, height: number) {
    this.camera = new THREE.PerspectiveCamera(42, width / height, 0.5, 2000);
    this.camera.position.copy(this.currentPose.position);
    this.camera.lookAt(this.currentPose.target);
  }

  public setPreset(presetKey: CameraTargetPreset, customPose?: CameraPose): void {
    if (customPose) {
      this.desiredPose = {
        position: customPose.position.clone(),
        target: customPose.target.clone(),
      };
    } else if (CAMERA_PRESETS[presetKey]) {
      const p = CAMERA_PRESETS[presetKey];
      this.desiredPose = {
        position: p.position.clone(),
        target: p.target.clone(),
      };
    }

    // Sync spherical from desired offset
    const offset = new THREE.Vector3().subVectors(this.desiredPose.position, this.desiredPose.target);
    this.sphericalTarget.setFromVector3(offset);
  }

  public onPointerDrag(deltaX: number, deltaY: number): void {
    this.isUserInteracting = true;
    const rotateSpeed = 0.005;
    this.sphericalTarget.theta -= deltaX * rotateSpeed;
    this.sphericalTarget.phi -= deltaY * rotateSpeed;
    this.sphericalTarget.phi = Math.max(
      this.minPolarAngle,
      Math.min(this.maxPolarAngle, this.sphericalTarget.phi)
    );
  }

  public onWheelZoom(deltaY: number): void {
    const zoomFactor = 1 + Math.abs(deltaY) * 0.0012;
    if (deltaY > 0) {
      this.sphericalTarget.radius = Math.min(this.maxDistance, this.sphericalTarget.radius * zoomFactor);
    } else {
      this.sphericalTarget.radius = Math.max(this.minDistance, this.sphericalTarget.radius / zoomFactor);
    }
  }

  public resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  public update(deltaSeconds: number): void {
    const lerpRate = Math.min(1, deltaSeconds * 3.8);

    // Smooth target lookAt lerp
    this.currentPose.target.lerp(this.desiredPose.target, lerpRate);
    this.target.copy(this.currentPose.target);

    // Smooth spherical lerp
    this.spherical.theta = THREE.MathUtils.lerp(this.spherical.theta, this.sphericalTarget.theta, lerpRate);
    this.spherical.phi = THREE.MathUtils.lerp(this.spherical.phi, this.sphericalTarget.phi, lerpRate);
    this.spherical.radius = THREE.MathUtils.lerp(this.spherical.radius, this.sphericalTarget.radius, lerpRate);

    // Reconstruct camera position from target + spherical offset
    const offset = new THREE.Vector3().setFromSpherical(this.spherical);
    this.camera.position.copy(this.currentPose.target).add(offset);
    this.camera.lookAt(this.currentPose.target);
  }
}
