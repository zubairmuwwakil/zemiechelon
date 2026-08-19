import * as THREE from "three";
import { SECTORS, SectorData } from "../data/ecosystem";
import { ScreenPinPosition } from "./types";

export class CameraManager {
  public camera: THREE.PerspectiveCamera;
  private currentLookAt: THREE.Vector3;
  private targetLookAt: THREE.Vector3;
  private targetPos: THREE.Vector3;
  private isTransitioning: boolean = false;

  // Overview default settings
  private defaultPos = new THREE.Vector3(0, 17, 21);
  private defaultLookAt = new THREE.Vector3(0, 0, 0);

  // Manual rotation offsets (for drag pan)
  public rotationOffset = { x: 0, y: 0 };
  private targetRotationOffset = { x: 0, y: 0 };

  constructor(width: number, height: number) {
    this.camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 1000);
    this.camera.position.copy(this.defaultPos);
    this.currentLookAt = this.defaultLookAt.clone();
    this.targetLookAt = this.defaultLookAt.clone();
    this.targetPos = this.defaultPos.clone();
    this.camera.lookAt(this.currentLookAt);
  }

  public resize(width: number, height: number) {
    this.camera.aspect = width / height;
    // Adapt FOV slightly on smaller mobile screens so the whole island fits nicely
    if (width < 768) {
      this.camera.fov = 48;
    } else {
      this.camera.fov = 38;
    }
    this.camera.updateProjectionMatrix();
  }

  public focusSector(sector: SectorData | null) {
    if (!sector) {
      this.targetPos.copy(this.defaultPos);
      this.targetLookAt.copy(this.defaultLookAt);
    } else {
      this.targetPos.set(
        sector.cameraTarget.position.x,
        sector.cameraTarget.position.y,
        sector.cameraTarget.position.z
      );
      this.targetLookAt.set(
        sector.cameraTarget.lookAt.x,
        sector.cameraTarget.lookAt.y,
        sector.cameraTarget.lookAt.z
      );
    }
    this.isTransitioning = true;
  }

  public addDragOffset(dx: number, dy: number) {
    this.targetRotationOffset.x = Math.max(-0.5, Math.min(0.5, this.targetRotationOffset.x + dx * 0.003));
    this.targetRotationOffset.y = Math.max(-0.3, Math.min(0.3, this.targetRotationOffset.y + dy * 0.003));
  }

  public resetRotation() {
    this.targetRotationOffset.x = 0;
    this.targetRotationOffset.y = 0;
  }

  public update(delta: number) {
    // Smoothly lerp camera position
    const lerpFactor = Math.min(1, delta * 4.5);
    this.camera.position.lerp(this.targetPos, lerpFactor);
    this.currentLookAt.lerp(this.targetLookAt, lerpFactor);

    // Smoothly lerp manual rotation offsets
    this.rotationOffset.x += (this.targetRotationOffset.x - this.rotationOffset.x) * 0.1;
    this.rotationOffset.y += (this.targetRotationOffset.y - this.rotationOffset.y) * 0.1;

    // Apply lookAt with small rotation offset
    const finalLookAt = this.currentLookAt.clone();
    finalLookAt.x += this.rotationOffset.x * 4;
    finalLookAt.z += this.rotationOffset.y * 4;
    this.camera.lookAt(finalLookAt);
  }

  public calculateScreenPins(width: number, height: number): ScreenPinPosition[] {
    const pins: ScreenPinPosition[] = [];

    SECTORS.forEach((sector) => {
      // 3D coordinate slightly above the sector center
      const worldPos = new THREE.Vector3(
        sector.coordinates.x,
        sector.coordinates.y + 2.8,
        sector.coordinates.z
      );

      // Project 3D coordinate to 2D NDC space (-1 to +1)
      const projected = worldPos.clone().project(this.camera);

      // Check if behind camera
      const isVisible = projected.z < 1.0;

      // Convert NDC to screen pixel coordinates
      const screenX = ((projected.x + 1) * width) / 2;
      const screenY = ((-projected.y + 1) * height) / 2;

      pins.push({
        sectorId: sector.id,
        x: screenX,
        y: screenY,
        visible: isVisible && screenX > 0 && screenX < width && screenY > 0 && screenY < height,
      });
    });

    return pins;
  }
}
