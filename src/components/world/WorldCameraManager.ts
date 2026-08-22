import * as THREE from "three";
import { derivePlanets, deriveWorldRadius } from "@/lib/atlas/planets";
import { loadBodies } from "@/lib/atlas/bodies";

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

const bodies = loadBodies();
const derived = derivePlanets(bodies);

/**
 * The drawn instrument's own size. This is the one authored length in the scene:
 * everything else is a repository date pushed through `radiusScale`.
 */
export const ASTROLABE_OUTER = 205;

/**
 * Layout units -> scene units. `radiusScale` caps the galaxy near 19.5 layout
 * units, while the astrolabe is drawn ten times wider; this is the single place
 * the two meet. Deriving it rather than typing it is what makes the outermost
 * repository land exactly on the outermost ring — the astrolabe stops being
 * decoration and becomes a scale.
 */
export const SCENE_SCALE = ASTROLABE_OUTER / deriveWorldRadius(bodies);

/** Layout-unit vector -> scene-unit vector. */
export function toScene(v: { x: number; y: number; z: number }): THREE.Vector3 {
  return new THREE.Vector3(v.x * SCENE_SCALE, v.y * SCENE_SCALE, v.z * SCENE_SCALE);
}

/** Drawn radius in scene units, per planet. */
export const PLANET_RADII: Record<string, number> = Object.fromEntries(
  derived.map((p) => [p.arm, p.radius * SCENE_SCALE]),
);

/** Derived from repository metadata. Nothing here is authored. */
export const PLANET_CENTERS: Record<string, THREE.Vector3> = {
  sun: new THREE.Vector3(0, 0, 0),
  ...Object.fromEntries(derived.map((p) => [p.arm, toScene(p.center)])),
};

/** Frame a planet from just outside its own rim, so framing scales with mass. */
function orbitPose(arm: string): CameraPose {
  const center = PLANET_CENTERS[arm];
  const r = PLANET_RADII[arm];
  return {
    position: new THREE.Vector3(center.x, r * 3.6, center.z + r * 4.8),
    target: new THREE.Vector3(center.x, r * 0.3, center.z),
  };
}

/**
 * Derived, not authored: the elevation and framing ratios are kept from the
 * original pose, but the distance comes from how far the galaxy actually
 * reaches, so a later epoch reframes itself.
 */
const GALAXY_REACH = ASTROLABE_OUTER;
const GALAXY_POSE: CameraPose = {
  position: new THREE.Vector3(0, GALAXY_REACH * 0.9, GALAXY_REACH * 1.12),
  target: new THREE.Vector3(0, 0, 0),
};

export const CAMERA_PRESETS: Record<string, CameraPose> = {
  galaxy: GALAXY_POSE,
  overview: GALAXY_POSE,
  ...Object.fromEntries(derived.map((p) => [p.arm, orbitPose(p.arm)])),
  // Retained alias: the HUD and page.tsx both still dispatch "founder".
  founder: orbitPose("self"),
};

export class WorldCameraManager {
  public camera: THREE.PerspectiveCamera;
  public target = new THREE.Vector3(0, 0, 0);

  // Seeded from the derived galaxy pose rather than from a pair of numbers that
  // happened to frame the world when it was a different size.
  private currentPose: CameraPose = {
    position: GALAXY_POSE.position.clone(),
    target: GALAXY_POSE.target.clone(),
  };

  private desiredPose: CameraPose = {
    position: GALAXY_POSE.position.clone(),
    target: GALAXY_POSE.target.clone(),
  };

  // Orbit state
  private spherical = new THREE.Spherical(295, Math.PI / 3.1, Math.PI / 4);
  private sphericalTarget = new THREE.Spherical(295, Math.PI / 3.1, Math.PI / 4);
  private isUserInteracting = false;

  /**
   * Clipping and orbit limits, as functions of the frame being looked at.
   *
   * These used to be four constants sized for the galaxy. That works while the
   * galaxy is the only scale; one level down, `near = 0.5` clips the ground out
   * from under a surface camera — the nearest ground a standing pose can see is
   * only `0.202 * shardRadius` away — and `minDistance = 15` makes it
   * impossible to approach anything smaller than a planet at all. Deriving them
   * from the framed radius is what lets one camera serve every depth, which is
   * the rule `descend()` already follows for framing.
   */
  public depth = { near: 0.5, far: 2000, minDistance: 15, maxDistance: 480 };
  private minPolarAngle = 0.12;
  private maxPolarAngle = Math.PI / 2 - 0.04; // Stay above plane

  constructor(
    width: number,
    height: number,
    /** OS-level `prefers-reduced-motion`. Read once, at construction. */
    private reducedMotion = false,
  ) {
    this.camera = new THREE.PerspectiveCamera(42, width / height, 0.5, 2000);
    this.setFrameScale(ASTROLABE_OUTER);
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

    // Travel removed, content kept — and removed for every camera move, not
    // only for descent, since the preference is about motion rather than about
    // which control started it.
    if (this.reducedMotion) this.snap();
  }

  /**
   * Size the camera's depth range to the frame it is looking at.
   *
   * `near` is a fraction of the framed radius rather than a constant, because
   * what has to stay inside it is the nearest surface the camera can see. It is
   * clamped at the top so galaxy framing keeps exactly the near plane it has
   * today: this must not be a visible change at the scale that already works.
   *
   * 0.06 rather than something smaller. The binding constraint is the ground at
   * a standing pose, `0.202 * radius` away, so 0.06 clears it more than three
   * times over — while keeping the far/near ratio around 11,000 at surface
   * scale. That matters: banding was observed at a ratio of 40,000, and a
   * needlessly tiny near plane buys nothing and spends depth precision.
   *
   * `far` is deliberately NOT a multiple of `near`. A ratio rule would put the
   * far plane 240 units out from a surface and clip the far side of the galaxy
   * out of the sky — and standing on a moon, the core and the opposite arm are
   * exactly what you see when you turn away from the parent. What `far` has to
   * reach is the world, not the frame.
   */
  public setFrameScale(radius: number): void {
    const near = THREE.MathUtils.clamp(radius * 0.06, 0.02, 0.5);
    this.depth = {
      near,
      far: Math.max(2000, radius * 10),
      minDistance: radius * 0.12,
      maxDistance: Math.max(480, radius * 2.4),
    };
    this.camera.near = this.depth.near;
    this.camera.far = this.depth.far;
    this.camera.updateProjectionMatrix();
    // An orbit already outside the new band is pulled in rather than left
    // stranded: a preset that arrived before the scale was set would otherwise
    // keep a radius the limits now forbid, and the first wheel event would jump.
    this.sphericalTarget.radius = THREE.MathUtils.clamp(
      this.sphericalTarget.radius,
      this.depth.minDistance,
      this.depth.maxDistance,
    );
  }

  /**
   * Frame any object in the scene graph. Takes the object and its size, not a
   * scope id: the camera never needs to know what a scope is, only where a
   * frame sits and how big it is. That is what lets a `universe` root use this
   * unchanged.
   *
   * The world matrix is read rather than the local position, so a frame nested
   * two deep is composed by Object3D rather than by arithmetic here.
   */
  public descend(target: THREE.Object3D, radius: number): void {
    this.setFrameScale(radius);
    const center = target.getWorldPosition(new THREE.Vector3());
    this.setPreset("", {
      position: new THREE.Vector3(center.x, radius * 3.6, center.z + radius * 4.8),
      target: new THREE.Vector3(center.x, radius * 0.3, center.z),
    });
  }

  /** The named inverse of descend: back to the frame the scope sits in. */
  public ascend(): void {
    this.setFrameScale(ASTROLABE_OUTER);
    this.setPreset("galaxy");
  }

  /** Arrive rather than fly. Every pose the lerps were heading for, taken now. */
  private snap(): void {
    this.currentPose.target.copy(this.desiredPose.target);
    this.target.copy(this.desiredPose.target);
    this.spherical.copy(this.sphericalTarget);
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
      this.sphericalTarget.radius = Math.min(this.depth.maxDistance, this.sphericalTarget.radius * zoomFactor);
    } else {
      this.sphericalTarget.radius = Math.max(this.depth.minDistance, this.sphericalTarget.radius / zoomFactor);
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
