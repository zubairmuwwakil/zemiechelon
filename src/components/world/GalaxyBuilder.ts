import * as THREE from "three";
import { GALAXY_ZEMI, type Scope } from "@/lib/atlas/scopes";
import {
  GALAXY_REACH,
  SKY_SHELL_DEPTH,
  SKY_SHELL_INNER,
  placeSolarSystem,
} from "@/lib/atlas/galaxyPlacement";
import { DIRECTION_A } from "@/lib/theme/directionA";
import type { CosmicMode } from "./DayNightController";
import { createFieldMaterial } from "./FieldShader";
import { BACKGROUND_STAR_COUNT, mulberry32 } from "./WorldSceneBuilder";

/** The shell's name in the scene graph. Renamed on the move: it is a sky now, not a backdrop. */
export const GALAXY_SKY = "galaxy-sky";

/**
 * Seeded with the same number the solar system's field uses, and drawing the
 * same first loop off it, so every star keeps the direction it has today. The
 * shell's RADIUS is the only thing this task changes — which is what makes the
 * visible diff exactly "the sky got bigger" and nothing else.
 */
const SKY_SEED = 20260820;

/**
 * The galaxy's own sky.
 *
 * Generated here rather than moved out of `buildFieldGeometry`, and that is
 * deliberate: stars and arm dust share one `mulberry32` stream there, stars
 * first, so lifting the star loop out would leave the dust drawing from a
 * stream 36,000 draws earlier and move every mote in the map. The solar-system
 * builder therefore keeps generating star positions it no longer draws — a few
 * hundred microseconds at construction, against a field that stays exactly
 * where it is.
 *
 * The radius is a multiple of `GALAXY_REACH`, not of one system's own reach.
 * A sky sized to the atlas would leave the channel outside it.
 *
 * Phase is drawn after the whole star loop, off the same stream — the idiom
 * `buildFieldGeometry` already uses, so the positions above keep their values.
 * It is not optional: `FieldShader` reads `aPhase` for both the twinkle and the
 * drift, and a geometry without it is not an error — WebGL feeds 0.0 to every
 * vertex and the entire sky pulses in unison.
 */
function buildGalaxySky(
  reach: number,
  seed: number,
  count: number,
): THREE.BufferGeometry {
  const rand = mulberry32(seed);
  // Always generated whole, then taken as a prefix — the same contract the
  // solar system's `budget` relies on. The generator draws in random order, so
  // a prefix is a uniform sample of the same sky rather than a different one.
  const positions = new Float32Array(BACKGROUND_STAR_COUNT * 3);
  const phases = new Float32Array(BACKGROUND_STAR_COUNT);
  let i = 0;
  for (let n = 0; n < BACKGROUND_STAR_COUNT; n++) {
    const theta = rand() * Math.PI * 2;
    const phi = Math.acos(2 * rand() - 1);
    const r = reach * (SKY_SHELL_INNER + rand() * SKY_SHELL_DEPTH);
    positions[i++] = Math.sin(phi) * Math.cos(theta) * r;
    positions[i++] = Math.cos(phi) * r;
    positions[i++] = Math.sin(phi) * Math.sin(theta) * r;
  }
  for (let n = 0; n < BACKGROUND_STAR_COUNT; n++) phases[n] = rand();

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions.subarray(0, count * 3), 3));
  geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases.subarray(0, count), 1));
  return geometry;
}

/**
 * The galaxy's own frame, and the only furniture that belongs to it.
 *
 * The sky lives here because it is the galaxy's sky, not the atlas's.
 * `WorldSceneBuilder` used to own the 12,000-point shell and hand it back the
 * pattern rotation every frame — `skyShell.rotation.y = -pattern` — because
 * the shell rode a rotating solar-system root and rotation is only perceptible
 * against something that is not rotating. With a frame above the rotation,
 * that correction has nothing to correct and is gone. Net behaviour is
 * identical; one fewer fact represented twice.
 *
 * This frame does not rotate. Solar systems do not revolve around the core —
 * pattern rotation stays inside each system, which is what lets the sky be the
 * fixed reference it was always meant to be.
 */
export class GalaxyBuilder {
  public readonly rootGroup = new THREE.Group();
  private skyShell: THREE.Points | null = null;
  /** The sky's material, held for the same two callers the solar system holds its own for. */
  private readonly fieldMaterials: THREE.ShaderMaterial[] = [];

  constructor(
    private scene: THREE.Scene,
    /** Fraction of the field budget to draw. See `fieldDensityFor`. */
    private fieldDensity = 1,
    /** OS-level `prefers-reduced-motion`. Read once, at construction, as everywhere else. */
    private reducedMotion = false,
  ) {}

  public build(): void {
    this.rootGroup.name = GALAXY_ZEMI.id;
    this.scene.add(this.rootGroup);
    this.buildSky();
  }

  private buildSky(): void {
    const count = Math.max(1, Math.round(BACKGROUND_STAR_COUNT * this.fieldDensity));
    const points = new THREE.Points(
      buildGalaxySky(GALAXY_REACH, SKY_SEED, count),
      // Stars do not attenuate: they sit a thousand units out and further,
      // where a world-space size rasterises to half a pixel and is dropped
      // entirely. A fixed pixel size is also what a sky should do — it must not
      // swell on zoom. Fog follows attenuation: the fog colour IS the paper, so
      // fading the shell into it would delete it.
      createFieldMaterial({ size: 1.6, opacity: 0.5, attenuate: false, fog: false }),
    );
    points.name = GALAXY_SKY;
    // The shell is larger than any frustum test three.js will infer cheaply,
    // and a wrongly-culled sky is indistinguishable from a missing one.
    points.frustumCulled = false;
    this.fieldMaterials.push(points.material as THREE.ShaderMaterial);
    this.rootGroup.add(points);
    this.skyShell = points;
  }

  /**
   * Parent a solar system's root at its place in the galaxy.
   *
   * The atlas's epoch is the galaxy epoch, so its centre is the origin and its
   * tilt is zero — it is attached by exactly this call and does not move,
   * which is what keeps every camera preset and pin anchor correct.
   *
   * `group` is `WorldSceneBuilder.rootGroup`, which sets its OWN `rotation.y`
   * absolutely every frame for pattern rotation. Leaning `group` directly here
   * would put both writes on one Euler: the frame's own spin would overwrite
   * the lean's x/z components rather than compose with them. A child's local
   * rotation never touches its parent's, so the lean lives on a placement
   * node this builder owns, and `group` hangs off it untouched — free to spin
   * however it likes without ever being asked about the lean again.
   */
  public attach(system: Scope, group: THREE.Object3D): void {
    const { center, tilt } = placeSolarSystem(system);
    const placement = new THREE.Group();
    placement.name = `${system.id}:placement`;
    placement.position.set(center.x, center.y, center.z);
    // Leaned about the axis pointing back at the core, so the lean is a lean
    // rather than a yaw — a rotation about +Y would only spin the system in
    // its own plane and change nothing you can see. The bearing is spent and
    // then given back, so the system's own pattern rotation starts from zero.
    const bearing = Math.atan2(center.z, center.x);
    placement.rotateY(bearing);
    placement.rotateZ(tilt);
    placement.rotateY(-bearing);
    placement.add(group);
    this.rootGroup.add(placement);
  }

  /**
   * Takes no `delta`, unlike every other builder's `update`: the frame itself
   * integrates nothing per-frame, and the twinkle reads an absolute clock. The
   * repo's lint config has no `argsIgnorePattern`, so an unused `_delta` kept
   * for symmetry would fail the gate rather than document the shape.
   *
   * The frame itself is static; see the class comment. The sky still breathes,
   * because the twinkle is content rather than travel — the same reason
   * `WorldSceneBuilder` advances its own field clock, and the same reason
   * reduced motion pins it to zero rather than switching it off.
   */
  public update(elapsed: number): void {
    const fieldTime = this.reducedMotion ? 0 : elapsed;
    for (const material of this.fieldMaterials) material.uniforms.uTime.value = fieldTime;
  }

  /**
   * Direction A is ink on paper, so on the night ground the two swap roles.
   * Mirrors `WorldSceneBuilder.setCosmicMode` exactly: the sky is one layer of
   * one field, and it must not be repainted on a different schedule from the
   * dust it sits behind.
   */
  public setCosmicMode(mode: CosmicMode): void {
    const mark = new THREE.Color(mode === "day" ? DIRECTION_A.dust : DIRECTION_A.ground);
    for (const material of this.fieldMaterials) {
      (material.uniforms.uColor.value as THREE.Color).copy(mark);
    }
  }

  public dispose(): void {
    this.skyShell?.geometry.dispose();
    (this.skyShell?.material as THREE.Material | undefined)?.dispose();
    this.scene.remove(this.rootGroup);
  }
}
