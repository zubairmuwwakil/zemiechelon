import * as THREE from "three";
import type { ScreenPoint, Vec3 } from "@/lib/atlas/types";

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Radians above the disk. Never edge-on, where the galaxy collapses to a line,
 * and never from below, where the plate would read mirrored.
 */
const ELEVATION = { min: 0.15, max: 1.35 };

/** World units from the target. Nearer than min you are inside a body. */
const DISTANCE = { min: 6, max: 400 };

/**
 * The overview. Elevation sits high because this is a plate first and a galaxy
 * second; distance holds the whole disk, whose outermost body is at ~19.5.
 */
const OVERVIEW = { azimuth: 0, elevation: 1.2, distance: 58 };

/** Degrees. A narrow viewport needs a wider lens to hold the disk. */
const FOV = { wide: 38, narrow: 48 };
const NARROW_VIEWPORT = 768;

/** How fast the camera catches up to its goal. Matches the old CameraManager. */
const LERP_RATE = 4.5;

/** Zoom is proportional, so a wheel notch covers the same fraction at any scale. */
const ZOOM_SENSITIVITY = 0.0015;

interface Orbit {
  azimuth: number;
  elevation: number;
  distance: number;
}

const fovFor = (width: number) => (width < NARROW_VIEWPORT ? FOV.narrow : FOV.wide);

/**
 * An orbit camera in spherical coordinates around a target, plus the 3D -> screen
 * projection the Chart layer positions its DOM hit targets with.
 *
 * Replaces CameraManager, which modelled the camera as position + lookAt and
 * applied drag to the lookAt point. That cannot orbit: swinging where the camera
 * looks shears the scene instead of rotating around it. Here the camera moves on
 * a sphere and always looks at the centre of that sphere.
 */
export class AtlasCamera {
  public camera: THREE.PerspectiveCamera;

  private current: Orbit;
  private goal: Orbit;
  private target = new THREE.Vector3();
  private goalTarget = new THREE.Vector3();

  constructor(width: number, height: number) {
    this.camera = new THREE.PerspectiveCamera(fovFor(width), width / height, 0.1, 2000);
    this.current = { ...OVERVIEW };
    this.goal = { ...OVERVIEW };
    this.apply();
  }

  public resize(width: number, height: number) {
    this.camera.aspect = width / height;
    this.camera.fov = fovFor(width);
    this.camera.updateProjectionMatrix();
  }

  /** Drag input. Azimuth runs free; elevation is clamped to keep the disk legible. */
  public orbit(dAzimuth: number, dElevation: number) {
    this.goal.azimuth += dAzimuth;
    this.goal.elevation = clamp(this.goal.elevation + dElevation, ELEVATION.min, ELEVATION.max);
  }

  /** Wheel or pinch input. Negative pulls in. */
  public zoom(delta: number) {
    this.goal.distance = clamp(
      this.goal.distance * Math.exp(delta * ZOOM_SENSITIVITY),
      DISTANCE.min,
      DISTANCE.max,
    );
  }

  /** Point the camera at a body, or pass null to return to the overview. */
  public focus(target: Vec3 | null, distance?: number) {
    if (!target) {
      this.goalTarget.set(0, 0, 0);
      this.goal = { ...OVERVIEW };
      return;
    }
    this.goalTarget.set(target.x, target.y, target.z);
    if (distance !== undefined) {
      this.goal.distance = clamp(distance, DISTANCE.min, DISTANCE.max);
    }
  }

  public update(delta: number) {
    const k = Math.min(1, delta * LERP_RATE);
    this.current.azimuth += (this.goal.azimuth - this.current.azimuth) * k;
    this.current.elevation += (this.goal.elevation - this.current.elevation) * k;
    this.current.distance += (this.goal.distance - this.current.distance) * k;
    this.target.lerp(this.goalTarget, k);
    this.apply();
  }

  private apply() {
    const { azimuth, elevation, distance } = this.current;
    const horizontal = Math.cos(elevation) * distance;
    this.camera.position.set(
      this.target.x + Math.sin(azimuth) * horizontal,
      this.target.y + Math.sin(elevation) * distance,
      this.target.z + Math.cos(azimuth) * horizontal,
    );
    this.camera.lookAt(this.target);
  }

  /**
   * Project world points to screen pixels. Ported from CameraManager's
   * calculateScreenPins, generalised off the hardcoded SECTORS list and given a
   * depth so the Chart can z-order labels that land on top of each other.
   */
  public projectToScreen(
    points: Array<{ id: string; pos: Vec3 }>,
    width: number,
    height: number,
  ): ScreenPoint[] {
    return points.map(({ id, pos }) => {
      const p = new THREE.Vector3(pos.x, pos.y, pos.z).project(this.camera);
      const x = ((p.x + 1) * width) / 2;
      const y = ((-p.y + 1) * height) / 2;
      return { id, x, y, depth: p.z, visible: p.z < 1 && x > 0 && x < width && y > 0 && y < height };
    });
  }
}
