import * as THREE from "three";
import { ASTROLABE_OUTER } from "./WorldCameraManager";

export type CosmicMode = "day" | "night";

/**
 * Ground, grass and road went with the island build the spec cut, and the two
 * accents had no reader once the canvas moved to Direction A tokens. What is
 * left is what the controller actually applies.
 */
export interface DayNightPalette {
  background: number;
  ambientLight: number;
  ambientIntensity: number;
  sunLight: number;
  sunIntensity: number;
  sunPosition: [number, number, number];
  fogColor: number;
  fogNear: number;
  fogFar: number;
}

export const DAY_PALETTE: DayNightPalette = {
  background: 0xf7f6f2, // Luxury warm parchment/cream
  ambientLight: 0xfffbf5,
  ambientIntensity: 1.6,
  sunLight: 0xfff7ed,
  sunIntensity: 1.8,
  sunPosition: [30, 60, 30],
  fogColor: 0xf7f6f2,
  // Derived from the drawn instrument, not typed. The old 100/350 predates the
  // world being scaled to the astrolabe: it put the fog's far plane inside the
  // galaxy, so every planet was 40-100% painted over with its own background.
  fogNear: ASTROLABE_OUTER * 1.6,
  fogFar: ASTROLABE_OUTER * 5,
};

export const NIGHT_PALETTE: DayNightPalette = {
  background: 0x09090b, // Deep luxury obsidian cosmos
  ambientLight: 0x18181b,
  ambientIntensity: 0.9,
  sunLight: 0x38bdf8, // Subtle cyan-rim moonlight
  sunIntensity: 1.4,
  sunPosition: [-25, 45, -25],
  fogColor: 0x09090b,
  fogNear: ASTROLABE_OUTER * 1.7,
  fogFar: ASTROLABE_OUTER * 5.4,
};

/**
 * Seconds for the sun to travel once around the map.
 *
 * Eight minutes. The terminator has to crawl rather than sweep: what makes a
 * sphere read as a body is that its lit edge is in a different place when you
 * look back, not that you can watch it move.
 */
export const SUN_ARC_PERIOD_SECONDS = 8 * 60;

export class DayNightController {
  private currentMode: CosmicMode = "day";
  private transitionProgress: number = 0; // 0 = day, 1 = night
  /** Radians travelled around the arc. Advanced by `update`, not by the palette. */
  private arcAngle = 0;
  private reducedMotion = false;
  /** Reused so `sunDirection` allocates nothing in the render loop. */
  private readonly sunDir = new THREE.Vector3();
  /**
   * The palette's sun position: a direction and an authored height, in the
   * frame of whatever the light is lighting.
   *
   * Held here rather than read back off `directionalSun.position`, which is no
   * longer the same thing — the light is placed at `shadowCenter + sunOffset`
   * so its shadow volume can travel, and only this vector still answers "which
   * way is the sun".
   */
  private readonly sunBase = new THREE.Vector3();
  /** `sunBase` pushed out to the standoff `placeSun` solves for. */
  private readonly sunOffset = new THREE.Vector3();
  /** What the shadow volume is centred on. See `setShadowCenter`. */
  private readonly shadowCenter = new THREE.Vector3();
  /** Half-width of the shadow volume. See `setShadowReach`. */
  private shadowRadius = 35;
  private isTransitioning: boolean = false;
  private transitionSpeed: number = 2.5;

  private ambientLight: THREE.AmbientLight;
  private directionalSun: THREE.DirectionalLight;
  private hemisphereLight: THREE.HemisphereLight;
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene, initialMode: CosmicMode = "day") {
    this.scene = scene;
    this.currentMode = initialMode;
    this.transitionProgress = initialMode === "day" ? 0 : 1;

    const palette = initialMode === "day" ? DAY_PALETTE : NIGHT_PALETTE;

    this.scene.background = new THREE.Color(palette.background);
    this.scene.fog = new THREE.Fog(palette.fogColor, palette.fogNear, palette.fogFar);

    this.ambientLight = new THREE.AmbientLight(palette.ambientLight, palette.ambientIntensity);
    this.scene.add(this.ambientLight);

    this.hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
    this.scene.add(this.hemisphereLight);

    this.directionalSun = new THREE.DirectionalLight(palette.sunLight, palette.sunIntensity);
    this.sunBase.set(...palette.sunPosition);
    this.directionalSun.castShadow = true;
    this.directionalSun.shadow.mapSize.width = 2048;
    this.directionalSun.shadow.mapSize.height = 2048;
    this.directionalSun.shadow.bias = -0.0005;

    this.scene.add(this.directionalSun);
    // **The target has to be in the scene.** A `DirectionalLight`'s shadow
    // camera aims at `light.target`, and three only refreshes that object's
    // world matrix if something is walking it — so a target left out of the
    // graph reports the identity, and the shadow volume is pinned to the world
    // origin no matter where the light goes. That is what it did: standing on a
    // shard 115 units out set a frustum three units wide around the origin, so
    // the landed frame was never in the shadow map at all.
    this.scene.add(this.directionalSun.target);
    // One definition of the frustum, rather than a constructor that states it
    // in numbers and a setter that states it in a rule.
    this.setShadowReach(this.shadowRadius);
  }

  /**
   * Put the light where it can see the volume it is lighting.
   *
   * A directional light shades by its DIRECTION alone, so moving the light and
   * its target together by the same offset changes the shadow volume and
   * nothing else about the lighting — which is what lets the volume travel
   * without the terminator moving on a single planet.
   *
   * The standoff is solved rather than authored. `sunPosition` puts the sun 73
   * units out, which was outside the world when the world was an island and is
   * *inside* it now: a caster standing higher than the light falls behind the
   * near plane and stops casting. Pushing the light to at least twice the
   * frustum's half-width guarantees the whole volume is in front of it, at
   * every scale, without touching the authored bearing or height ratio.
   */
  private placeSun(): void {
    const standoff = Math.max(this.sunBase.length(), this.shadowRadius * 2);
    this.sunOffset.copy(this.sunBase).setLength(standoff);
    this.directionalSun.position.copy(this.shadowCenter).add(this.sunOffset);
    this.directionalSun.target.position.copy(this.shadowCenter);
  }

  /**
   * Centre the shadow volume on a point in the world — the frame being looked
   * at, which the render loop reads off the camera every frame.
   *
   * Per frame rather than per framing change, because the frames it has to
   * cover MOVE: the pattern turns and carries the planets, and a moon rides its
   * orbit. `setShadowReach` says how wide the volume is, which only a change of
   * framing can change; this says where it is, which every frame can.
   */
  public setShadowCenter(center: THREE.Vector3): void {
    if (this.shadowCenter.equals(center)) return;
    this.shadowCenter.copy(center);
    this.placeSun();
  }

  /**
   * Pull the fog in to a frame's own scale.
   *
   * The palette's planes are galaxy-sized — day fog starts at 328 and ends at
   * 1025 — which means nothing in a landed frame is ever fogged: the parent is
   * about 35 away and the far rim of the galaxy about 300. The sky renders as
   * flat paper with no depth cue at all, which is a large part of why the first
   * spike's landed frame read as a white void.
   *
   * `reference` is the distance to the frame's parent, so the parent itself
   * stays crisp and the galaxy behind it recedes. Fog that started before the
   * parent would wash out the one thing §3.2 requires to be legible.
   */
  public setFogReference(reference: number | null): void {
    // The scene is constructed with linear Fog, which is the only kind that
    // has planes to move; the narrowing keeps that explicit rather than assumed.
    const fog = this.scene.fog;
    if (!(fog instanceof THREE.Fog)) return;
    const palette = this.currentMode === "day" ? DAY_PALETTE : NIGHT_PALETTE;
    if (reference === null) {
      fog.near = palette.fogNear;
      fog.far = palette.fogFar;
      return;
    }
    fog.near = reference * 1.8;
    fog.far = reference * 9;
  }

  /**
   * Travel removed, content kept — the same rule descent already follows. The
   * sun stops where it is; it is not moved to some neutral position, because
   * that would change the lighting rather than only the motion in it.
   */
  public setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
  }

  /**
   * Where the light is, as a unit vector from the origin. World space.
   *
   * The planet shader needs this because it does its own lighting: its lambert
   * term was a hardcoded direction, so no planet had a terminator that moved.
   */
  public sunDirection(): THREE.Vector3 {
    // From `sunBase`, not from the light's position: the position now carries
    // the shadow volume's centre as well, and normalising THAT would swing the
    // planets' terminator around as the camera moved.
    return this.sunDir.copy(this.sunBase).normalize();
  }

  /**
   * Swing the palette's sun position around the vertical axis.
   *
   * The palettes keep their two authored positions and the day/night lerp keeps
   * writing them; the arc is applied on top as a rotation about +Y, so the
   * sun's height and distance are still the palette's to state and only its
   * bearing is this method's. Rotating about +Y is also what keeps the light
   * above the plane at every angle — a light that dipped below would rake the
   * map from underneath once a circuit.
   */
  private applyArc(): void {
    const palette = this.currentMode === "day" ? DAY_PALETTE : NIGHT_PALETTE;
    const [x, y, z] = palette.sunPosition;
    const base = new THREE.Vector3(x, y, z);
    // Mid-transition the palette lerp owns the base, so the arc is applied on
    // top of whatever it just wrote rather than on top of one endpoint.
    if (this.isTransitioning) base.copy(this.sunBase);
    const radius = Math.hypot(base.x, base.z);
    const bearing = Math.atan2(base.z, base.x) + this.arcAngle;
    this.sunBase.set(Math.cos(bearing) * radius, base.y, Math.sin(bearing) * radius);
    this.placeSun();
  }

  /** The sun's shadow camera, so callers can size it and tests can read it. */
  public get shadowCamera(): THREE.OrthographicCamera {
    return this.directionalSun.shadow.camera;
  }

  /**
   * Size the shadow frustum to the frame being looked at.
   *
   * The constructor's `d = 35` and `far = 150` predate the world being scaled
   * to the astrolabe: against a reach of 205 they put every planet outside the
   * frustum, so `castShadow` on the planet mesh bought nothing at all. This is
   * the same rule `setFrameScale` follows for the near and far planes and
   * `setFogReference` follows for the fog — one number derived from the frame,
   * rather than a constant that was right at one scale.
   *
   * A 2048² map spread over the whole galaxy is coarse, which is why this
   * narrows again on descent rather than being set once to the widest case.
   */
  public setShadowReach(radius: number): void {
    this.shadowRadius = radius;
    const camera = this.shadowCamera;
    camera.left = -radius;
    camera.right = radius;
    camera.top = radius;
    camera.bottom = -radius;
    // The standoff changed with the radius, so the light moves before the depth
    // range is solved against where it now stands.
    this.placeSun();
    // Solved, not padded. The volume is the sphere of `radius` about the
    // centre, so along the light's own axis it starts one radius short of the
    // centre and ends one radius past it. `Math.max(150, radius * 4)` was a
    // guess that happened to clear one scale and clipped at the others.
    const standoff = this.sunOffset.length();
    camera.near = Math.max(0.5, standoff - radius);
    camera.far = standoff + radius;
    camera.updateProjectionMatrix();
  }

  public setMode(mode: CosmicMode) {
    if (this.currentMode === mode) return;
    this.currentMode = mode;
    this.isTransitioning = true;
  }

  public getMode(): CosmicMode {
    return this.currentMode;
  }

  public update(deltaSeconds: number): void {
    if (this.isTransitioning) {
      const target = this.currentMode === "day" ? 0 : 1;
      if (Math.abs(this.transitionProgress - target) < 0.01) {
        this.transitionProgress = target;
        this.isTransitioning = false;
      } else {
        this.transitionProgress +=
          Math.sign(target - this.transitionProgress) * this.transitionSpeed * deltaSeconds;
        this.transitionProgress = Math.max(0, Math.min(1, this.transitionProgress));
      }

      this.applyPaletteInterpolation();
    }

    // Outside the transition branch: the sun travels whether or not the palette
    // is changing, which is the difference between a light and a light switch.
    if (!this.reducedMotion) {
      this.arcAngle =
        (this.arcAngle + (2 * Math.PI * deltaSeconds) / SUN_ARC_PERIOD_SECONDS) % (2 * Math.PI);
      this.applyArc();
    }
  }

  private applyPaletteInterpolation() {
    const t = this.transitionProgress; // 0 = day, 1 = night
    const day = DAY_PALETTE;
    const night = NIGHT_PALETTE;

    const bgCol = new THREE.Color(day.background).lerp(new THREE.Color(night.background), t);
    this.scene.background = bgCol;

    if (this.scene.fog) {
      this.scene.fog.color.lerpColors(new THREE.Color(day.fogColor), new THREE.Color(night.fogColor), t);
    }

    const ambCol = new THREE.Color(day.ambientLight).lerp(new THREE.Color(night.ambientLight), t);
    this.ambientLight.color = ambCol;
    this.ambientLight.intensity = THREE.MathUtils.lerp(day.ambientIntensity, night.ambientIntensity, t);

    const sunCol = new THREE.Color(day.sunLight).lerp(new THREE.Color(night.sunLight), t);
    this.directionalSun.color = sunCol;
    this.directionalSun.intensity = THREE.MathUtils.lerp(day.sunIntensity, night.sunIntensity, t);

    this.sunBase.lerpVectors(
      new THREE.Vector3(...day.sunPosition),
      new THREE.Vector3(...night.sunPosition),
      t
    );
    this.placeSun();
  }

  public getProgress(): number {
    return this.transitionProgress;
  }
}
