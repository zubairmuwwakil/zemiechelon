import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import type { Body, ScopeId } from "@/lib/atlas/types";
import { BULGE, daysSinceEpoch, placeBodies, radiusScale } from "@/lib/atlas/position";
import { SOLAR_SYSTEM_ZEMI, derivePlanetScopes, planetScopeId, scopeChain, type Scope } from "@/lib/atlas/scopes";
import { magnitude } from "@/lib/atlas/magnitude";
import { THE_END } from "@/lib/atlas/timeline";
import { derivePlanets, deriveWorldRadius, planetGrowthAt } from "@/lib/atlas/planets";
import { idealsFor } from "@/lib/atlas/ideals";
import { deriveMoons, moonIds } from "@/lib/atlas/moons";
import { obliquityFor, patternAngle } from "@/lib/atlas/motion";
import { createFieldMaterial } from "./FieldShader";
import { moonScopeId } from "@/lib/atlas/galaxy";
import { surfaceScopeIds } from "@/lib/atlas/surfaces";
import { buildSurface, type SurfaceHandle } from "./SurfaceBuilder";
import { buildOrrery, updateOrreries, type OrreryHandle } from "./Orrery";
import {
  deriveArmAnnotation,
  derivePlanetAnnotation,
  deriveRingAnnotation,
} from "@/lib/atlas/derivedFigures";
import { DIRECTION_A } from "@/lib/theme/directionA";
import type { CosmicMode } from "./DayNightController";
import { SCENE_SCALE, toScene } from "./WorldCameraManager";
import { PLANET_ATTRIBUTES, SURFACE_FAMILIES, createPlanetMaterial } from "./PlanetSurfaces";

export const BACKGROUND_STAR_COUNT = 12_000;
export const ARM_DUST_COUNT = 4_500;

/** Mobile budget. Applied by WorldCanvas when the viewport is narrow. */
export const MOBILE_FIELD_SCALE = 0.35;

/** Below this CSS width the field draws at MOBILE_FIELD_SCALE. */
export const NARROW_VIEWPORT = 768;

export function fieldDensityFor(width: number): number {
  return width < NARROW_VIEWPORT ? MOBILE_FIELD_SCALE : 1;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Pure, so density is testable without a GL context. Background stars fill a
 * shell; dust follows the arms, which is what makes the spiral legible at rest.
 *
 * Everything here is in LAYOUT units — the same ones `placeBodies` produces —
 * and `scale` is the single conversion to scene units, so the shell cannot
 * drift out of step with the bodies it surrounds. The shell radius is a
 * multiple of how far the galaxy actually reaches rather than a number typed
 * when the world happened to be a particular size.
 */
export function buildFieldGeometry(
  bodies: Body[],
  seed: number,
  scale = 1,
  scope: Scope = SOLAR_SYSTEM_ZEMI,
): { positions: Float32Array; armDustDays: Float32Array; phases: Float32Array } {
  const rand = mulberry32(seed);
  const positions = new Float32Array((BACKGROUND_STAR_COUNT + ARM_DUST_COUNT) * 3);
  // Arm dust follows its anchor bodies (§3.8): each dust point is tagged with
  // its own anchor's birth day, in generation order, so the timeline transport
  // can gate it without touching where any point is drawn.
  const armDustDays = new Float32Array(ARM_DUST_COUNT);
  const phases = new Float32Array(BACKGROUND_STAR_COUNT + ARM_DUST_COUNT);
  const bornDayOf = new Map(bodies.map((b) => [b.id, daysSinceEpoch(b.bornAt, scope.epoch)]));
  const reach = deriveWorldRadius(bodies, scope);
  let i = 0;

  for (let n = 0; n < BACKGROUND_STAR_COUNT; n++) {
    const theta = rand() * Math.PI * 2;
    const phi = Math.acos(2 * rand() - 1);
    // Outside the outermost repository, so the field reads as sky rather than
    // as more bodies. Depth comes from the shell being thick, not from haze.
    const r = reach * (1.5 + rand() * 1.3);
    positions[i++] = Math.sin(phi) * Math.cos(theta) * r * scale;
    positions[i++] = Math.cos(phi) * r * scale;
    positions[i++] = Math.sin(phi) * Math.sin(theta) * r * scale;
  }

  // Anchored on the real placements rather than re-deriving the spiral, so the
  // dust cannot wander off the arm it is drawing — the failure b394093 fixed
  // for the old haze, made structural here.
  const placements = placeBodies(bodies, scope);
  const armOf = new Map(bodies.map((b) => [b.id, b.arm]));

  // Each arm's reach and how many bodies share it. The mean gap is the distance
  // dust has to bridge for a run of repositories to read as one arm instead of
  // as a string of separate puffs.
  const spans = new Map<string, { min: number; max: number; n: number }>();
  for (const p of placements) {
    const arm = armOf.get(p.id);
    if (arm === undefined) continue;
    const r = Math.hypot(p.position.x, p.position.z);
    const s = spans.get(arm) ?? { min: r, max: r, n: 0 };
    spans.set(arm, { min: Math.min(s.min, r), max: Math.max(s.max, r), n: s.n + 1 });
  }

  for (let n = 0; n < ARM_DUST_COUNT; n++) {
    const anchor = placements[Math.floor(rand() * placements.length)];
    const arm = armOf.get(anchor.id)!;
    const span = spans.get(arm)!;
    armDustDays[n] = bornDayOf.get(anchor.id) ?? 0;
    const r0 = Math.hypot(anchor.position.x, anchor.position.z);
    const theta0 = Math.atan2(anchor.position.z, anchor.position.x);

    // Slide along the arm from the anchor, then follow the scope's own wind
    // rate round to the new radius. Starting from the body's angle rather than
    // the bare spine matters: `placeBodies` fans crowded runs off the spine, so
    // spine dust would sit beside the very bodies it is meant to be tracing.
    // Two thirds of the motes slide freely along the whole arm, from its first
    // repository to its last, so the arm reads as one continuous curve; the
    // rest stay near a body, so the dust is thickest where the work actually
    // is. Uniform-only draws five clean but uninformative ribbons; anchored-only
    // draws forty-five separate puffs with the arm missing between them.
    const r = rand() < 0.66
      ? span.min + rand() * (span.max - span.min)
      : Math.max(0, r0 + (rand() - 0.5) * ((span.max - span.min) / Math.max(1, span.n)) * 2.2);
    const theta = theta0 + scope.windRate * (Math.log(1 + r) - Math.log(1 + r0));

    // Width is a fraction of radius, so an arm is narrow at the core and flares
    // at the frontier the way an arm does — and stays in proportion if the
    // galaxy grows. A fixed width wide enough to read at the rim is a quarter
    // of the whole map at the core, which is a blob, not an arm.
    const spread = 0.04 + r * 0.035;
    positions[i++] = (Math.cos(theta) * r + (rand() - 0.5) * spread * 2) * scale;
    positions[i++] = (rand() - 0.5) * spread * 0.6 * scale;
    positions[i++] = (Math.sin(theta) * r + (rand() - 0.5) * spread * 2) * scale;
  }

  // Same `rand` stream, so the field stays deterministic. Drawn LAST so every
  // existing draw keeps its value and the parity golden is untouched.
  for (let n = 0; n < phases.length; n++) phases[n] = rand();

  return { positions, armDustDays, phases };
}

/** Something on a surface a visitor can reach, by pointer or by keyboard. */
export interface SurfaceTarget {
  /** Unique on screen. An orrery bead and its moon in the sky are not the same control. */
  id: string;
  label: string;
  /** The body whose card or flight this opens. */
  bodyId: string;
  kind: "prop" | "moon" | "console";
  object: THREE.Object3D;
}

export interface InteractiveHitObject {
  id: string;
  name: string;
  type: "planet" | "sector" | "body" | "ideal" | "ring" | "arm";
  mesh: THREE.Object3D;
  /**
   * Set when `mesh` is shared. The five planets are one InstancedMesh, so the
   * mesh alone no longer identifies which of them was hit.
   */
  instanceId?: number;
  position: THREE.Vector3;
}

export interface HoverTarget {
  type: "ideal" | "planet" | "ring" | "arm";
  id: string;
  instanceId?: number;
}

interface AnnotatedRing {
  id: string;
  lineMaterial: LineMaterial;
  baseOpacity: number;
  label: THREE.Sprite;
}

/**
 * Scene units the planets ride above the plane. The pins in WorldCanvas are
 * placed relative to this, so it is one number rather than six.
 */
export const PLANET_Y = 1.0;

const RING_SEGMENTS = 192;

/** Astrolabe ring cadence. One ring a month, quarters drawn heavier. */
const DAYS_PER_MONTH = 30;
const ASTROLABE_TICKS = 120;

/** Moon size and label, as fractions of the planet they belong to. */
const MOON_SIZE = 0.34;

/**
 * How much larger a moon's invisible pick sphere is than the moon.
 *
 * The planets use 1.2x, but a planet is already a comfortable target. A moon is
 * drawn at 0.34 of its planet's radius — about 14 screen pixels across at
 * galaxy framing — which is what made them sub-pointer targets in the first
 * place. 2.6x brings that to roughly 37, comfortably past a fingertip.
 *
 * At this size two proxies overlap when adjacent moons pass at the same phase:
 * the orbit lanes are 4.735 apart and each proxy reaches 5.23. That is left
 * alone deliberately. Shrinking the proxy far enough to guarantee no overlap
 * would put it back under 1.2x and undo the fix, and the raycaster already
 * resolves the ambiguity the right way by taking the nearest hit.
 */
const MOON_PICK_SCALE = 2.6;
const MOON_LABEL_SCALE = 0.022;
const MOON_LABEL_REACH = 1.75;
const MOON_LABEL_ASPECT = 4.6;

/** Annotation HUD pill scaling. */
const ANNOTATION_LABEL_SCALE = 0.056;
const ANNOTATION_LABEL_ASPECT = 4.2;

/**
 * A canvas label that repaints when the ground changes. Tinting cannot do this
 * job: a sprite's `color` multiplies the whole map, so darkening the pill for
 * night takes the ink down with it and the text vanishes. The canvas has to be
 * drawn again with the two roles swapped.
 */
interface PaperLabel {
  texture: THREE.CanvasTexture;
  paint: (mode: CosmicMode) => void;
}

interface MoonOrbit {
  pivot: THREE.Group;
  rate: number;
}

/** The core is the epoch, so its size is the one thing here that is not a date. */
const CORE_RADIUS = 7.5;

/**
 * Sprite scale with `sizeAttenuation: false`, where scale is a fraction of the
 * frustum rather than a world length: 0.064 lands the pill at about 60 CSS px
 * tall on a 720 px viewport, whatever the camera distance.
 */
const CLAIM_LABEL_SCALE = 0.064;
const CLAIM_LABEL_ASPECT = 3.4;

/** Rest, hovered, and hovered-sibling. Dimming is what makes lighting mean something. */
export const RING_OPACITY = { rest: 0.5, lit: 1, dimmed: 0.12 } as const;

interface IdealRing {
  id: string;
  ringMaterial: LineMaterial;
  label: THREE.Sprite;
  pivot: THREE.Group;
  /** Radians per second. */
  orbitRate: number;
}

export class WorldSceneBuilder {
  public readonly rootGroup = new THREE.Group();
  /**
   * The scene graph mirrors the scope tree. `rootGroup` is the galaxy's own
   * group; each planet scope gets a child group at that planet's centre.
   * Descent is then moving the camera into a group's local space, and the
   * transform composition is Object3D's job rather than ours.
   */
  public readonly scopeGroups = new Map<ScopeId, THREE.Group>();
  public readonly hitObjects: InteractiveHitObject[] = [];
  /** Arm -> its row in the planet InstancedMesh, so one planet can be culled. */
  private readonly planetInstanceIndices = new Map<string, number>();
  /** The instance matrices as built, so a cull can be released rather than recomputed. */
  private readonly planetInstanceMatrices: THREE.Matrix4[] = [];
  private planetMesh: THREE.InstancedMesh | null = null;
  /** Arm -> the drawn radius of its moons, so callers need not re-derive MOON_SIZE. */
  private readonly moonDrawnRadii = new Map<string, number>();
  /** One per scope that declares a surface. Hidden until the visitor lands. */
  private readonly surfaces = new Map<ScopeId, SurfaceHandle>();
  /** The scope whose surface is currently shown, or null in orbit. */
  private standingOn: ScopeId | null = null;
  /** One per surface that has moons to travel between. */
  private readonly orreries = new Map<ScopeId, OrreryHandle>();

  /** The arm a scope cull is keeping, or null when nothing is culled. */
  private cullKeepArm: string | null = null;
  /** Root children hidden by the current cull, so releasing it restores exactly those. */
  private culled: THREE.Object3D[] = [];
  public readonly bodySprites: Map<string, THREE.Object3D> = new Map();

  // Animated celestial elements
  private planetarySpheres: THREE.Mesh[] = [];
  private planetMaterial: THREE.ShaderMaterial | null = null;
  private idealRings: IdealRing[] = [];
  private annotatedRings: AnnotatedRing[] = [];
  private planetAnnotations: Map<string, THREE.Sprite> = new Map();
  private armAnnotations: Map<string, THREE.Sprite> = new Map();
  private moons: MoonOrbit[] = [];
  private hoveredIdeal: string | null = null;
  private fieldMaterials: THREE.ShaderMaterial[] = [];
  private paperLabels: PaperLabel[] = [];
  /**
   * Drawing-buffer size, shared by every screen-space line. Line2 needs it to
   * turn a pixel width into clip space; a stale value scales every ring wrongly
   * after a resize.
   */
  private readonly resolution = new THREE.Vector2(1, 1);
  private centralCoronaRings: THREE.Object3D[] = [];

  // --- Timeline transport gating -------------------------------------------
  //
  // Positions are laid out once, in the builders above, over the full body
  // set — never touched again. The clock only ever toggles what is drawn and,
  // for planets alone, how big they are. See `setClockDate` and §3.8 of the
  // surface design spec.

  /** No `setClockDate` call yet means "show everything" — the pre-transport behaviour. */
  private clockDate = THE_END;
  /** Every drawn body/moon: the day it exists from, and what to show or hide. */
  private readonly bodyGates: Array<{ id: string; day: number; objects: THREE.Object3D[] }> = [];
  /** Ids currently shown, kept because raycasting ignores `Object3D.visible`. */
  private readonly visibleBodyIds = new Set<string>();
  /** Every ideal ring: the day its last citation is born, and what to show or hide. */
  private readonly idealGates: Array<{ id: string; day: number; objects: THREE.Object3D[] }> = [];
  private readonly visibleIdealIds = new Set<string>();
  /** Each arm's frozen centre and instance index in the shared planet mesh. */
  private readonly planetInstances: Array<{
    arm: string;
    index: number;
    center: THREE.Vector3;
    /** L2. Held here because `setClockDate` rebuilds the matrix and must re-compose it. */
    tilt: THREE.Quaternion;
  }> = [];
  private readonly visiblePlanetArms = new Set<string>();
  /** Arm dust, sorted by its anchor's birth day so a draw range can gate it without reordering. */
  private armDustGeometry: THREE.BufferGeometry | null = null;
  private armDustSortedDays: Float32Array = new Float32Array(0);

  /** Every body's own birth day, since the galaxy epoch. Computed once; gating reads it many times. */
  private readonly bornDayById = new Map<string, number>();

  constructor(
    private scene: THREE.Scene,
    /**
     * The solar system this builder draws.
     *
     * Everything below is derived from it: the root group's id, the epoch days
     * are counted from, and the arm angles the spiral is wound on. A second
     * orrery is this builder with a different scope, which is the whole reason
     * there is no second builder.
     */
    public readonly scope: Scope,
    private bodies: Body[],
    private today: string,
    /** Fraction of the field budget to draw. See `fieldDensityFor`. */
    private fieldDensity = 1,
    /**
     * OS-level `prefers-reduced-motion`. Read once, at construction, exactly as
     * `WorldCameraManager` reads it.
     *
     * Removes travel, never content: L1, L4 and L5 stop, and the axial tilt
     * stays — a tilt is orientation, and turning it off would delete something
     * a visitor can see rather than something that moves.
     */
    private reducedMotion = false,
  ) {
    for (const body of bodies) this.bornDayById.set(body.id, daysSinceEpoch(body.bornAt, this.scope.epoch));
  }

  public build(): void {
    this.scene.add(this.rootGroup);
    this.registerScopeGroups();

    this.buildAstrolabeConcentricRings();
    this.buildBackgroundField();
    this.buildArmDustPickTargets();
    this.buildCentralAnchorCore();
    this.buildPlanetarySpheres();
    this.buildIdealRings();
    this.buildMoons();
    this.buildSatellitesAndBodies();
    this.buildSurfaces();

    // One code path decides what is drawn, whatever day it runs at — so the
    // freshly-built scene and a later `setClockDate` call can never disagree.
    this.setClockDate(this.clockDate);
  }

  public groupFor(scopeId: ScopeId): THREE.Group {
    const group = this.scopeGroups.get(scopeId);
    if (!group) {
      // Loud, not defaulted — the same rule an unknown scope already follows.
      throw new Error(`no group built for scope "${scopeId}"`);
    }
    return group;
  }

  /**
   * One group per scope, built before any builder runs so a builder can ask
   * for the frame it is drawing into rather than re-deriving the planet's
   * centre and expressing everything in galaxy coordinates.
   *
   * The planet groups are deliberately axis-aligned: they are coordinate
   * frames the camera will descend into, not a place to hide a tilt. The
   * ideals' lean stays on the ring group inside.
   */
  private registerScopeGroups(): void {
    this.rootGroup.name = this.scope.id;
    this.scopeGroups.set(this.scope.id, this.rootGroup);

    const centers = new Map(
      derivePlanets(this.bodies, this.scope).map((p) => [p.arm, toScene(p.center)]),
    );
    for (const planetScope of derivePlanetScopes(this.bodies, this.scope)) {
      const center = centers.get(planetScope.id.replace("planet:", ""));
      if (!center) continue;
      const group = new THREE.Group();
      group.name = planetScope.id;
      group.position.set(center.x, PLANET_Y, center.z);
      this.rootGroup.add(group);
      this.scopeGroups.set(planetScope.id, group);
    }
  }

  /**
   * 1. The astrolabe: the drawn scale the whole map is measured against.
   *
   * The radii used to be six typed numbers, so only the outermost ring meant
   * anything — `SCENE_SCALE` lands the newest repository exactly on it. The
   * rest were decoration on an instrument whose whole claim is that it is not.
   * They are now month boundaries pushed through the same `radiusScale` the
   * bodies use, with the quarters drawn heavier: the rings crowd toward the rim
   * because radius is the square root of days, which is the map's own thesis
   * made visible rather than asserted.
   */
  private buildAstrolabeConcentricRings(): void {
    const reach = deriveWorldRadius(this.bodies, this.scope);

    for (let month = 1; ; month++) {
      const layoutRadius = radiusScale(month * DAYS_PER_MONTH);
      if (layoutRadius > reach) break;
      const rScene = layoutRadius * SCENE_SCALE;
      const baseOpacity = month % 3 === 0 ? 0.95 : 0.55;

      const line = this.addHairlineRing(
        this.rootGroup,
        rScene,
        baseOpacity,
        DIRECTION_A.rule,
      ) as Line2;

      // Generous invisible pick ring so thin hairline can be hovered reliably
      const bandHalf = Math.max(1.8, rScene * 0.045);
      const pickGeo = new THREE.RingGeometry(
        Math.max(0.1, rScene - bandHalf),
        rScene + bandHalf,
        96,
      );
      const pick = new THREE.Mesh(
        pickGeo,
        new THREE.MeshBasicMaterial({
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      pick.rotation.x = -Math.PI / 2;
      this.rootGroup.add(pick);

      const ann = deriveRingAnnotation(month, this.bodies, this.scope, DAYS_PER_MONTH);
      const label = this.createAnnotationLabel(ann.title, ann.subtitle);
      label.position.set(0, 0.8, -rScene);
      label.scale.set(ANNOTATION_LABEL_SCALE * ANNOTATION_LABEL_ASPECT, ANNOTATION_LABEL_SCALE, 1);
      label.material.opacity = 0;
      this.rootGroup.add(label);

      this.annotatedRings.push({
        id: ann.id,
        lineMaterial: line.material as LineMaterial,
        baseOpacity,
        label,
      });

      this.hitObjects.push({
        id: ann.id,
        name: ann.title,
        type: "ring",
        mesh: pick,
        position: new THREE.Vector3(0, 0.8, -rScene),
      });
    }

    // The frontier itself: the newest repository's own radius.
    const frontierR = reach * SCENE_SCALE;
    const frontierLine = this.addHairlineRing(
      this.rootGroup,
      frontierR,
      0.85,
      DIRECTION_A.gold,
      1.4,
    ) as Line2;

    const frontierBandHalf = Math.max(2.0, frontierR * 0.045);
    const frontierPickGeo = new THREE.RingGeometry(
      Math.max(0.1, frontierR - frontierBandHalf),
      frontierR + frontierBandHalf,
      96,
    );
    const frontierPick = new THREE.Mesh(
      frontierPickGeo,
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    frontierPick.rotation.x = -Math.PI / 2;
    this.rootGroup.add(frontierPick);

    const frontierAnn = deriveRingAnnotation("frontier", this.bodies, this.scope);
    const frontierLabel = this.createAnnotationLabel(frontierAnn.title, frontierAnn.subtitle);
    frontierLabel.position.set(0, 0.8, -frontierR);
    frontierLabel.scale.set(ANNOTATION_LABEL_SCALE * ANNOTATION_LABEL_ASPECT, ANNOTATION_LABEL_SCALE, 1);
    frontierLabel.material.opacity = 0;
    this.rootGroup.add(frontierLabel);

    this.annotatedRings.push({
      id: frontierAnn.id,
      lineMaterial: frontierLine.material as LineMaterial,
      baseOpacity: 0.85,
      label: frontierLabel,
    });

    this.hitObjects.push({
      id: frontierAnn.id,
      name: frontierAnn.title,
      type: "ring",
      mesh: frontierPick,
      position: new THREE.Vector3(0, 0.8, -frontierR),
    });

    // Radial ticks along the frontier, quarter marks longest.
    const ticks: number[] = [];
    const outerR = reach * SCENE_SCALE;
    for (let i = 0; i < ASTROLABE_TICKS; i++) {
      const angle = (i / ASTROLABE_TICKS) * Math.PI * 2;
      const len = i % 30 === 0 ? 3.5 : i % 5 === 0 ? 2.0 : 0.9;
      ticks.push(
        Math.cos(angle) * (outerR - len / 2), 0, Math.sin(angle) * (outerR - len / 2),
        Math.cos(angle) * (outerR + len / 2), 0, Math.sin(angle) * (outerR + len / 2),
      );
    }
    const tickGeometry = new LineSegmentsGeometry();
    tickGeometry.setPositions(ticks);
    this.rootGroup.add(
      new LineSegments2(
        tickGeometry,
        new LineMaterial({
          color: new THREE.Color(DIRECTION_A.rule).getHex(),
          linewidth: 1.2,
          transparent: true,
          opacity: 0.55,
          resolution: this.resolution,
        }),
      ),
    );
  }

  /**
   * A flat ring drawn as a screen-space line. Every ring in the scene goes
   * through here: a RingGeometry band thin enough to read as a hairline is a
   * fraction of a pixel and covers no sample centre, and a plain GL line is
   * half a CSS pixel at devicePixelRatio 2. Line2 expands in screen space.
   */
  private addHairlineRing(
    parent: THREE.Object3D,
    radius: number,
    opacity: number,
    color: string,
    linewidth = 1,
  ): THREE.Object3D {
    const points: number[] = [];
    for (let seg = 0; seg <= RING_SEGMENTS; seg++) {
      const a = (seg / RING_SEGMENTS) * Math.PI * 2;
      points.push(Math.cos(a) * radius, 0, Math.sin(a) * radius);
    }
    const geometry = new LineGeometry();
    geometry.setPositions(points);
    const line = new Line2(
      geometry,
      new LineMaterial({
        color: new THREE.Color(color).getHex(),
        linewidth,
        transparent: true,
        opacity,
        resolution: this.resolution,
      }),
    );
    parent.add(line);
    return line;
  }

  /**
   * 2. The deep field. Dark points on a light ground: engraved, not emitted.
   *
   * The old haze re-derived the spiral from the system's own `arms` and then rotated
   * itself in `update()`, so within two minutes the drawn arms had slid off the
   * repositories they were drawing. This one is anchored on the placements and
   * does not move.
   */
  public buildBackgroundField(): void {
    const { positions, armDustDays, phases } = buildFieldGeometry(this.bodies, 20260820, SCENE_SCALE, this.scope);

    // The buffer is always generated whole — it is one cheap pass — and the
    // narrow-viewport budget is taken as a prefix. The generator draws in
    // random order, so a prefix is a uniform sample of the same field rather
    // than a different one.
    //
    // Only the dust half is drawn here. The sky belongs to `GalaxyBuilder`, and
    // the star half of this buffer is now generated and dropped on the floor —
    // deliberately, and it must stay that way: the two halves come off ONE
    // `mulberry32` stream, stars first, so skipping the star loop would leave
    // the dust drawing from a stream 36,000 draws earlier and move every mote
    // in the map. `dustParity.test.ts` is the guard on exactly that.
    const budget = (n: number) => Math.max(1, Math.round(n * this.fieldDensity));

    // Arm dust follows its anchor bodies (§3.8): the buffer is re-ordered by
    // each point's anchor birth day so a plain `setDrawRange` prefix is exactly
    // "every dust point whose anchor already exists" — no point ever moves,
    // the drawn count only grows. The mobile budget is taken as a prefix of
    // the ORIGINAL random order first, preserving the uniform-sample property
    // `layer` above relies on, and only that budgeted subset is then sorted.
    const dustBudget = budget(ARM_DUST_COUNT);
    const dustBase = BACKGROUND_STAR_COUNT * 3;
    const order = Array.from({ length: dustBudget }, (_, k) => k);
    order.sort((a, b) => armDustDays[a] - armDustDays[b]);

    const dustPositions = new Float32Array(dustBudget * 3);
    const dustDays = new Float32Array(dustBudget);
    const dustPhases = new Float32Array(dustBudget);
    order.forEach((srcIndex, sortedIndex) => {
      const src = dustBase + srcIndex * 3;
      const dst = sortedIndex * 3;
      dustPositions[dst] = positions[src];
      dustPositions[dst + 1] = positions[src + 1];
      dustPositions[dst + 2] = positions[src + 2];
      dustDays[sortedIndex] = armDustDays[srcIndex];
      // Re-ordered with its point: phase belongs to the point, not to the slot.
      dustPhases[sortedIndex] = phases[BACKGROUND_STAR_COUNT + srcIndex];
    });

    const dustGeometry = new THREE.BufferGeometry();
    dustGeometry.setAttribute("position", new THREE.BufferAttribute(dustPositions, 3));
    dustGeometry.setAttribute("aPhase", new THREE.BufferAttribute(dustPhases, 1));
    const dustPoints = new THREE.Points(
      dustGeometry,
      createFieldMaterial({ size: 1.2, opacity: 0.5, attenuate: true, fog: true }),
    );
    dustPoints.name = "arm-dust";
    this.fieldMaterials.push(dustPoints.material as THREE.ShaderMaterial);
    dustPoints.frustumCulled = false;
    this.rootGroup.add(dustPoints);

    this.armDustGeometry = dustGeometry;
    this.armDustSortedDays = dustDays;
  }

  /**
   * 4. The core: the epoch itself, radius zero, where every arm starts.
   *
   * It used to be an emissive plasma sun in ambers that are not in the palette.
   * Direction A is engraved, not emitted, so the origin is gold leaf on paper —
   * the densest mark on the map rather than the brightest light on it. The
   * Fresnel halo went with the emission for the same reason the planets' did.
   */
  private buildCentralAnchorCore(): void {
    const sunGroup = new THREE.Group();
    sunGroup.name = "central-anchor-core";
    sunGroup.position.set(0, 0, 0);

    const coreMesh = new THREE.Mesh(
      new THREE.SphereGeometry(CORE_RADIUS, 64, 64),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(DIRECTION_A.gold),
        roughness: 0.55,
        metalness: 0.25,
        emissive: new THREE.Color(DIRECTION_A.gold),
        emissiveIntensity: 0.12,
      }),
    );
    coreMesh.castShadow = true;
    sunGroup.add(coreMesh);
    this.planetarySpheres.push(coreMesh);

    [1.3, 1.67, 2.07].forEach((multiple, idx) => {
      this.centralCoronaRings.push(
        this.addHairlineRing(sunGroup, CORE_RADIUS * multiple, 0.5 - idx * 0.13, DIRECTION_A.gold),
      );
    });

    const corePick = new THREE.Mesh(
      new THREE.SphereGeometry(CORE_RADIUS * 1.25, 16, 16),
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    corePick.position.set(0, 0, 0);
    sunGroup.add(corePick);

    const coreAnn = derivePlanetAnnotation("solarSystem", this.bodies, this.scope);
    const coreLabel = this.createAnnotationLabel(coreAnn.title, coreAnn.subtitle);
    coreLabel.position.set(0, 1.2, CORE_RADIUS + 4.2);
    coreLabel.scale.set(ANNOTATION_LABEL_SCALE * ANNOTATION_LABEL_ASPECT, ANNOTATION_LABEL_SCALE, 1);
    coreLabel.material.opacity = 0;
    this.rootGroup.add(coreLabel);
    this.planetAnnotations.set("solarSystem", coreLabel);
    this.planetAnnotations.set(coreAnn.id, coreLabel);

    this.hitObjects.push({
      id: "solarSystem",
      name: "Ancestral Anchor Core",
      type: "planet",
      mesh: corePick,
      position: sunGroup.position.clone(),
    });

    this.rootGroup.add(sunGroup);
  }

  /**
   * 5. The five surface families, as ONE InstancedMesh over ONE shader.
   *
   * Five bespoke materials is five draw-call groups and five compile paths for
   * what is one family of surfaces (§5.4). Everything that differs between the
   * planets — pattern, spin, base, accent — rides on instance attributes.
   */
  private buildPlanetarySpheres(): void {
    const planets = derivePlanets(this.bodies, this.scope);
    const count = planets.length;

    // Radius 1: the drawn size is the instance scale, so mass stays a property
    // of the metadata rather than of the geometry.
    const geometry = new THREE.SphereGeometry(1, 64, 48);
    const material = createPlanetMaterial();
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.name = "planet-surfaces";
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const pattern = new Float32Array(count);
    const spin = new Float32Array(count);
    const base = new Float32Array(count * 3);
    const accent = new Float32Array(count * 3);
    const matrix = new THREE.Matrix4();
    const colour = new THREE.Color();

    planets.forEach((planet, i) => {
      const family = SURFACE_FAMILIES[planet.arm];
      if (!family) {
        // Loud, not defaulted — the same rule an unassigned arm already follows.
        throw new Error(`arm "${planet.arm}" has no surface family`);
      }

      const center = toScene(planet.center);
      const radius = planet.radius * SCENE_SCALE;
      // Read the pole off a vector rather than assembling Euler angles by hand.
      // Composing angles by hand is exactly the error that put the surface
      // spike's first landing ninety degrees off its parent.
      const lean = obliquityFor(planet.arm, this.scope);
      const pole = new THREE.Vector3(
        Math.sin(lean.magnitude) * Math.cos(lean.azimuth),
        Math.cos(lean.magnitude),
        Math.sin(lean.magnitude) * Math.sin(lean.azimuth),
      );
      const tilt = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), pole);
      matrix.compose(
        new THREE.Vector3(center.x, PLANET_Y, center.z),
        tilt,
        new THREE.Vector3(radius, radius, radius),
      );
      mesh.setMatrixAt(i, matrix);
      this.planetInstanceIndices.set(planet.arm, i);
      this.planetInstanceMatrices[i] = matrix.clone();

      pattern[i] = family.pattern;
      spin[i] = family.rotationRate;
      // .setStyle converts sRGB to the linear working space, which is what the
      // shader must emit for OutputPass to convert it back to the authored hex.
      colour.set(family.baseColor).toArray(base, i * 3);
      colour.set(family.accentColor).toArray(accent, i * 3);

      // Generous pick sphere for hovering and picking each individual planet
      const pickSphere = new THREE.Mesh(
        new THREE.SphereGeometry(radius * 1.2, 16, 16),
        new THREE.MeshBasicMaterial({
          transparent: true,
          opacity: 0,
          depthWrite: false,
        }),
      );
      pickSphere.position.set(center.x, PLANET_Y, center.z);
      this.rootGroup.add(pickSphere);

      const ann = derivePlanetAnnotation(planet.arm, this.bodies, this.scope);
      const label = this.createAnnotationLabel(ann.title, ann.subtitle);
      label.position.set(center.x, PLANET_Y, center.z + radius + 4.5);
      label.scale.set(ANNOTATION_LABEL_SCALE * ANNOTATION_LABEL_ASPECT, ANNOTATION_LABEL_SCALE, 1);
      label.material.opacity = 0;
      this.rootGroup.add(label);

      this.planetAnnotations.set(planet.arm, label);
      this.planetAnnotations.set(ann.id, label);

      const planetAnchor = new THREE.Vector3();
      this.hitObjects.push({
        id: planet.arm,
        name: `Planet ${planet.arm[0].toUpperCase()}${planet.arm.slice(1)}`,
        type: "planet",
        mesh: pickSphere,
        // Same reason as the moons: the pattern turns, so the planet's centre
        // is a live read off the pick sphere the click already resolved to,
        // not a constant that was true when the scene was assembled.
        get position() {
          pickSphere.updateWorldMatrix(true, false);
          return planetAnchor.setFromMatrixPosition(pickSphere.matrixWorld);
        },
      });

      // The centre is frozen here, from the full-set derivation. `setClockDate`
      // only ever rewrites this instance's scale, never its position.
      this.planetInstances.push({
        arm: planet.arm,
        index: i,
        center: new THREE.Vector3(center.x, PLANET_Y, center.z),
        tilt,
      });
    });

    geometry.setAttribute(PLANET_ATTRIBUTES.pattern, new THREE.InstancedBufferAttribute(pattern, 1));
    geometry.setAttribute(PLANET_ATTRIBUTES.spin, new THREE.InstancedBufferAttribute(spin, 1));
    geometry.setAttribute(PLANET_ATTRIBUTES.base, new THREE.InstancedBufferAttribute(base, 3));
    geometry.setAttribute(PLANET_ATTRIBUTES.accent, new THREE.InstancedBufferAttribute(accent, 3));
    mesh.instanceMatrix.needsUpdate = true;

    this.planetMaterial = material;
    this.planetMesh = mesh;
    this.rootGroup.add(mesh);
  }

  /**
   * 5b. Ideals rings.
   *
   * Radius already *is* time, so these encode ideals rather than skill tiers —
   * a tier ring would state the same fact twice (§5.3). A planet that declares
   * no ideals draws nothing, which is the state four of the five are in until
   * the author's claims land. That is not an empty case to be papered over: an
   * ideal is only allowed on screen once `validateIdeals` can resolve every
   * body it cites.
   */
  private buildIdealRings(): void {
    const labels = new Map(this.bodies.map((b) => [b.id, b.label || b.id]));

    for (const planet of derivePlanets(this.bodies, this.scope)) {
      const ideals = idealsFor(planet.arm);
      if (ideals.length === 0) continue;

      const center = toScene(planet.center);
      const radius = planet.radius * SCENE_SCALE;
      const family = SURFACE_FAMILIES[planet.arm];

      const planetGroup = this.groupFor(planetScopeId(planet.arm));
      // The lean stays here rather than on the planet's own group: that group
      // is the frame the camera descends into, and a tilted frame would take
      // the whole descent with it.
      const group = new THREE.Group();
      group.name = `ideals-${planet.arm}`;
      // Derived, not authored: the old per-planet `tilt` was a typed table.
      // Reading the arm's own base angle gives every planet a different plane,
      // and a sixth arm gets one without anybody choosing a number.
      group.rotation.x = -Math.PI / 2 + this.scope.arms[planet.arm] * 0.28;
      group.rotation.y = this.scope.arms[planet.arm] * 0.14;

      for (const ideal of ideals) {
        const r = radius * (1.6 + ideal.ordinal * 0.36);
        const gold = new THREE.Color(DIRECTION_A.gold);

        // Everything this one ideal draws, so `setClockDate` can show or hide
        // the whole claim — ring, hover target and orbiting bead — in one
        // assignment rather than three.
        const idealGroup = new THREE.Group();
        idealGroup.name = `ideal-${ideal.id}`;
        group.add(idealGroup);

        // Line2, not LineLoop and not RingGeometry, and both alternatives fail
        // for the same reason. A band thin enough to read as a hairline is a
        // third of a pixel at galaxy distance, and a triangle that thin covers
        // no sample centre — the ring is not faint, it is absent. A plain GL
        // line is no better: WebGL ignores `linewidth`, so at devicePixelRatio
        // 2 it draws half a CSS pixel. Line2 expands the line in screen space,
        // so `linewidth` really is pixels, at any dpr and any zoom.
        const ringMaterial = new LineMaterial({
          color: gold.getHex(),
          linewidth: 1.6,
          transparent: true,
          opacity: RING_OPACITY.rest,
          resolution: this.resolution,
        });
        const points: number[] = [];
        for (let seg = 0; seg <= RING_SEGMENTS; seg++) {
          const a = (seg / RING_SEGMENTS) * Math.PI * 2;
          points.push(Math.cos(a) * r, Math.sin(a) * r, 0);
        }
        const ringGeometry = new LineGeometry();
        ringGeometry.setPositions(points);
        idealGroup.add(new Line2(ringGeometry, ringMaterial));

        // A hairline is about a pixel wide at galaxy distance, which nothing can
        // hover. The raycaster skips `visible: false` but hits a fully
        // transparent material, so the target is fat while the line stays thin.
        const pick = new THREE.Mesh(
          new THREE.RingGeometry(r - radius * 0.3, r + radius * 0.3, 64),
          new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
        );
        idealGroup.add(pick);

        const pivot = new THREE.Group();
        const bead = new THREE.Mesh(
          new THREE.SphereGeometry(radius * 0.085, 12, 12),
          new THREE.MeshBasicMaterial({ color: gold, transparent: true, opacity: 0.9 }),
        );
        bead.position.set(r, 0, 0);
        pivot.add(bead);
        idealGroup.add(pivot);

        // World-up and outside the tilted group: the ring leans, the label must
        // not. Constant screen size, so it is legible from orbit — which is the
        // only place a claim about the whole ecosystem is worth reading.
        const label = this.createClaimLabel(ideal.claim, ideal.evidence.map((id) => labels.get(id) ?? id));
        // In the planet's frame, so the horizontal offsets the world-space
        // version carried are the frame's own — and PLANET_Y with them. Only
        // the height above the planet is this label's to state.
        label.position.set(0, r * 1.5 + ideal.ordinal * radius * 0.5, 0);
        label.scale.set(CLAIM_LABEL_SCALE * CLAIM_LABEL_ASPECT, CLAIM_LABEL_SCALE, 1);
        label.material.opacity = 0;

        // A claim's evidence visibly accumulates: the ring appears only once
        // every repository it cites exists (§3.8).
        const unlockDay = Math.max(...ideal.evidence.map((id) => this.bornDayById.get(id) ?? 0));
        this.idealGates.push({ id: ideal.id, day: unlockDay, objects: [idealGroup, label] });
        planetGroup.add(label);

        this.idealRings.push({
          id: ideal.id,
          ringMaterial,
          label,
          pivot,
          // Tied to the planet's own rate, so the bead belongs to this world
          // rather than to a global animation clock.
          orbitRate: family.rotationRate * 6,
        });

        this.hitObjects.push({
          id: ideal.id,
          name: ideal.claim,
          type: "ideal",
          mesh: pick,
          position: new THREE.Vector3(center.x, PLANET_Y, center.z),
        });
      }

      planetGroup.add(group);
    }
  }

  /**
   * A pill in the HUD's own idiom, so a label reads as part of the instrument
   * rather than as something painted onto the sky. Direction A is ink on paper,
   * so on the night ground the two swap: the pill becomes ink and the text
   * becomes paper. Without that the pill is pure white against #09090b and the
   * night bloom turns every label into a solid block.
   */
  private createPaperLabel(
    aspect: number,
    width: number,
    draw: (ctx: CanvasRenderingContext2D, ink: string, canvas: HTMLCanvasElement) => void,
  ): THREE.Sprite {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = Math.round(width / aspect);
    const ctx = canvas.getContext("2d");
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;

    const paint = (mode: CosmicMode) => {
      if (!ctx) return;
      const day = mode === "day";
      const ground = day ? DIRECTION_A.hud : DIRECTION_A.ink;
      const ink = day ? DIRECTION_A.ink : DIRECTION_A.ground;
      const pad = Math.round(canvas.height * 0.07);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.beginPath();
      ctx.roundRect(pad, pad, canvas.width - pad * 2, canvas.height - pad * 2, canvas.height * 0.28);
      ctx.globalAlpha = day ? 0.94 : 0.88;
      ctx.fillStyle = ground;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 3;
      ctx.strokeStyle = DIRECTION_A.rule;
      ctx.stroke();

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      draw(ctx, ink, canvas);
      texture.needsUpdate = true;
    };

    paint("day");
    this.paperLabels.push({ texture, paint });

    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        // Constant screen size. With attenuation a label is four pixels tall at
        // galaxy framing and fills the frame the moment you fly in.
        sizeAttenuation: false,
      }),
    );
    sprite.renderOrder = 3;
    return sprite;
  }

  private createClaimLabel(claim: string, cited: string[]): THREE.Sprite {
    return this.createPaperLabel(CLAIM_LABEL_ASPECT, 1024, (ctx, ink, canvas) => {
      ctx.fillStyle = ink;
      ctx.font = "600 82px ui-sans-serif, system-ui, sans-serif";
      ctx.fillText(claim, canvas.width / 2, canvas.height * 0.4, canvas.width * 0.9);
      ctx.fillStyle = DIRECTION_A.gold;
      ctx.font = "400 58px ui-monospace, SFMono-Regular, monospace";
      ctx.fillText(cited.join("   ·   "), canvas.width / 2, canvas.height * 0.68, canvas.width * 0.9);
    });
  }

  private createAnnotationLabel(title: string, subtitle: string): THREE.Sprite {
    return this.createPaperLabel(ANNOTATION_LABEL_ASPECT, 1024, (ctx, ink, canvas) => {
      ctx.fillStyle = ink;
      ctx.font = "600 70px ui-sans-serif, system-ui, sans-serif";
      ctx.fillText(title, canvas.width / 2, canvas.height * 0.38, canvas.width * 0.9);
      ctx.fillStyle = DIRECTION_A.gold;
      ctx.font = "500 50px ui-monospace, SFMono-Regular, monospace";
      ctx.fillText(subtitle, canvas.width / 2, canvas.height * 0.70, canvas.width * 0.9);
    });
  }

  /**
   * Generates generous invisible ribbon pick meshes and constant screen-size labels for all galactic arms.
   */
  private buildArmDustPickTargets(): void {
    const placements = placeBodies(this.bodies, this.scope);
    const armOf = new Map(this.bodies.map((b) => [b.id, b.arm]));
    const spans = new Map<string, { min: number; max: number; count: number }>();

    for (const p of placements) {
      const arm = armOf.get(p.id);
      if (arm === undefined) continue;
      const r = Math.hypot(p.position.x, p.position.z);
      const s = spans.get(arm) ?? { min: r, max: r, count: 0 };
      spans.set(arm, { min: Math.min(s.min, r), max: Math.max(s.max, r), count: s.count + 1 });
    }

    const segments = 36;
    for (const [arm, span] of spans.entries()) {
      const ann = deriveArmAnnotation(arm, this.bodies);
      const baseAngle = this.scope.arms[arm];
      if (baseAngle === undefined) continue;

      const rMin = Math.max(BULGE, span.min * 0.85);
      const rMax = span.max * 1.15;
      const positions: number[] = [];
      const indices: number[] = [];

      for (let s = 0; s <= segments; s++) {
        const t = s / segments;
        const r = rMin + t * (rMax - rMin);
        const theta = baseAngle + this.scope.windRate * Math.log(1 + r);
        const dTheta = 0.35 + r * 0.012;

        const rScene = r * SCENE_SCALE;
        positions.push(Math.cos(theta - dTheta) * rScene, 0, Math.sin(theta - dTheta) * rScene);
        positions.push(Math.cos(theta + dTheta) * rScene, 0, Math.sin(theta + dTheta) * rScene);

        if (s < segments) {
          const v0 = s * 2;
          const v1 = s * 2 + 1;
          const v2 = (s + 1) * 2;
          const v3 = (s + 1) * 2 + 1;
          indices.push(v0, v1, v2);
          indices.push(v1, v3, v2);
        }
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geo.setIndex(indices);
      geo.computeVertexNormals();

      const pickMesh = new THREE.Mesh(
        geo,
        new THREE.MeshBasicMaterial({
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      pickMesh.name = `pick-arm-${arm}`;
      this.rootGroup.add(pickMesh);

      const rMid = (rMin + rMax) / 2;
      const thetaMid = baseAngle + this.scope.windRate * Math.log(1 + rMid);
      const labelPos = new THREE.Vector3(
        Math.cos(thetaMid) * rMid * SCENE_SCALE,
        1.2,
        Math.sin(thetaMid) * rMid * SCENE_SCALE,
      );

      const label = this.createAnnotationLabel(ann.title, ann.subtitle);
      label.position.copy(labelPos);
      label.scale.set(ANNOTATION_LABEL_SCALE * ANNOTATION_LABEL_ASPECT, ANNOTATION_LABEL_SCALE, 1);
      label.material.opacity = 0;
      this.rootGroup.add(label);

      this.armAnnotations.set(arm, label);
      this.armAnnotations.set(ann.id, label);

      this.hitObjects.push({
        id: ann.id,
        name: ann.title,
        type: "arm",
        mesh: pickMesh,
        position: labelPos.clone(),
      });
    }
  }

  /**
   * Illuminate one ring and dim its siblings. Hovering is what turns a ring
   * from decoration into an instrument: the claim and the repositories behind
   * it appear together, so the claim is never on screen without its evidence.
   */
  /**
   * Direction A is ink on paper, so on the night ground the two swap roles: the
   * mark becomes paper and the ground becomes ink. No new token — night uses the
   * palette it already has, from the other end. Direction C is still R2.
   */
  public setCosmicMode(mode: CosmicMode): void {
    const mark = new THREE.Color(mode === "day" ? DIRECTION_A.dust : DIRECTION_A.ground);
    for (const material of this.fieldMaterials) {
      (material.uniforms.uColor.value as THREE.Color).copy(mark);
    }
    for (const label of this.paperLabels) label.paint(mode);
  }

  /**
   * Point the planets at the scene's sun. Called every frame from the render
   * loop, because the sun travels — see `DayNightController.sunDirection`.
   */
  public setLightDirection(direction: THREE.Vector3): void {
    if (!this.planetMaterial) return;
    (this.planetMaterial.uniforms.uLightDir.value as THREE.Vector3)
      .copy(direction)
      .normalize();
  }

  /** Called on mount and on every resize. See `resolution`. */
  public setResolution(width: number, height: number): void {
    this.resolution.set(width, height);
    // three.js sizes attenuated points by canvas half-height. The field draws
    // its own points now, so it has to be told the same number.
    for (const material of this.fieldMaterials) material.uniforms.uScale.value = height / 2;
  }

  public setHoveredIdeal(id: string | null): void {
    if (id === this.hoveredIdeal) return;
    this.hoveredIdeal = id;
    for (const ring of this.idealRings) {
      const state = id === null ? "rest" : ring.id === id ? "lit" : "dimmed";
      ring.ringMaterial.opacity = RING_OPACITY[state];
      ring.label.material.opacity = state === "lit" ? 1 : 0;
    }
  }

  /**
   * Universal hover handler for element annotations (rings, planets, arms, ideals).
   */
  public setHoveredTarget(target: HoverTarget | null): void {
    if (!target) {
      this.setHoveredIdeal(null);
      for (const ring of this.annotatedRings) {
        ring.lineMaterial.opacity = ring.baseOpacity;
        ring.label.material.opacity = 0;
      }
      for (const label of this.planetAnnotations.values()) {
        label.material.opacity = 0;
      }
      for (const label of this.armAnnotations.values()) {
        label.material.opacity = 0;
      }
      return;
    }

    if (target.type === "ideal") {
      this.setHoveredIdeal(target.id);
      for (const ring of this.annotatedRings) {
        ring.lineMaterial.opacity = ring.baseOpacity;
        ring.label.material.opacity = 0;
      }
      for (const label of this.planetAnnotations.values()) label.material.opacity = 0;
      for (const label of this.armAnnotations.values()) label.material.opacity = 0;
      return;
    }

    this.setHoveredIdeal(null);

    if (target.type === "ring") {
      for (const ring of this.annotatedRings) {
        const isHit = ring.id === target.id;
        ring.lineMaterial.opacity = isHit ? 1.0 : ring.baseOpacity * 0.35;
        ring.label.material.opacity = isHit ? 1 : 0;
      }
      for (const label of this.planetAnnotations.values()) label.material.opacity = 0;
      for (const label of this.armAnnotations.values()) label.material.opacity = 0;
      return;
    }

    if (target.type === "planet") {
      for (const ring of this.annotatedRings) {
        ring.lineMaterial.opacity = ring.baseOpacity;
        ring.label.material.opacity = 0;
      }
      for (const label of this.planetAnnotations.values()) label.material.opacity = 0;
      for (const label of this.armAnnotations.values()) label.material.opacity = 0;

      const activeLabel =
        this.planetAnnotations.get(target.id) ??
        this.planetAnnotations.get(target.id.replace("planet-", "")) ??
        this.planetAnnotations.get(`planet-${target.id}`);
      if (activeLabel) {
        activeLabel.material.opacity = 1;
      }
      return;
    }

    if (target.type === "arm") {
      for (const ring of this.annotatedRings) {
        ring.lineMaterial.opacity = ring.baseOpacity;
        ring.label.material.opacity = 0;
      }
      for (const label of this.planetAnnotations.values()) label.material.opacity = 0;
      for (const label of this.armAnnotations.values()) label.material.opacity = 0;

      const activeLabel =
        this.armAnnotations.get(target.id) ??
        this.armAnnotations.get(target.id.replace("arm-", "")) ??
        this.armAnnotations.get(`arm-${target.id}`);
      if (activeLabel) {
        activeLabel.material.opacity = 1;
      }
      return;
    }
  }

  /**
   * The timeline transport's clock. Per §3.8 of the surface design spec,
   * positions were laid out once, above, over the full body set — this method
   * never touches a position. It only decides what is currently drawn (bodies,
   * moons, ideal rings) and, for planets alone, how much mass they show.
   *
   * Safe to call before `bornDayById` and the gate lists are populated: `build()`
   * calls it once at the end, at whatever `clockDate` the builder was given, so
   * the freshly-built scene and a later call agree by construction.
   */
  public setClockDate(date: string): void {
    this.clockDate = date;
    const day = daysSinceEpoch(date, this.scope.epoch);

    this.visibleBodyIds.clear();
    for (const gate of this.bodyGates) {
      const visible = gate.day <= day;
      for (const object of gate.objects) object.visible = visible;
      if (visible) this.visibleBodyIds.add(gate.id);
    }

    this.visibleIdealIds.clear();
    for (const gate of this.idealGates) {
      const visible = gate.day <= day;
      for (const object of gate.objects) object.visible = visible;
      if (visible) this.visibleIdealIds.add(gate.id);
    }

    if (this.planetMesh) {
      const growthByArm = new Map(planetGrowthAt(this.bodies, day, this.scope).map((p) => [p.arm, p]));
      this.visiblePlanetArms.clear();
      for (const instance of this.planetInstances) {
        const growth = growthByArm.get(instance.arm);
        const radius = growth?.visible ? growth.radius * SCENE_SCALE : 0;
        // Composed, not scaled-then-positioned: the instance carries an L2 tilt
        // and this method runs last in `build()`, so a matrix rebuilt without
        // the rotation would erase the tilt before the first frame.
        const matrix = new THREE.Matrix4().compose(
          instance.center,
          instance.tilt,
          new THREE.Vector3(radius, radius, radius),
        );
        // The clock owns the matrix, not the draw: `applyPlanetInstances`
        // below composes it with the cull and with standing.

        // `setScopeCull`'s restore reads this array, not the mesh, when it puts
        // a culled instance back — it must restore to the clock's current
        // radius, not the full-size matrix captured at build time.
        this.planetInstanceMatrices[instance.index] = matrix;
        if (growth?.visible) this.visiblePlanetArms.add(instance.arm);
      }
      this.applyPlanetInstances();
    }

    if (this.armDustGeometry) {
      // `armDustSortedDays` is sorted ascending, so the count of unlocked dust
      // points is the insertion point of `day` — everything before it exists.
      let lo = 0;
      let hi = this.armDustSortedDays.length;
      while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (this.armDustSortedDays[mid] <= day) lo = mid + 1;
        else hi = mid;
      }
      this.armDustGeometry.setDrawRange(0, lo);
    }
  }

  /**
   * Whether a hit-test target is currently part of the drawn map. Needed
   * because three.js raycasting does not consult `Object3D.visible` — an
   * un-born body's mesh is still geometrically present, so a click on empty
   * space where it *will* appear must be rejected explicitly rather than by
   * hiding it and hoping.
   */
  public isHitVisible(hit: InteractiveHitObject): boolean {
    if (hit.type === "planet") {
      return hit.id === "solarSystem" || this.visiblePlanetArms.has(hit.id);
    }
    if (hit.type === "ideal") return this.visibleIdealIds.has(hit.id);
    if (hit.type === "body") return this.visibleBodyIds.has(hit.id);
    return true;
  }

  /**
   * 5c. The shipped systems, in orbit around their own planet.
   *
   * §5.2 wants Products' four ventures readable as moons from orbit with zero
   * clicks — the ecosystem is the argument, and a visitor should not have to
   * click to find out there is one. They orbit rather than sitting on the arm
   * because that is what they are: a planet's own bodies, not more of the
   * field. Orbit radius is ordered by birth date, so `radius is time` survives
   * the change of scale.
   *
   * `buildSatellitesAndBodies` skips these ids, so nothing is drawn twice.
   */
  private buildMoons(): void {
    const centers = new Map(
      derivePlanets(this.bodies, this.scope).map((p) => [
        p.arm,
        { center: toScene(p.center), radius: p.radius * SCENE_SCALE },
      ]),
    );

    for (const moon of deriveMoons(this.bodies, this.scope)) {
      const planet = centers.get(moon.arm);
      if (!planet) continue;

      const orbitRadius = planet.radius * moon.orbit;

      // This builder used to make an anonymous group at the planet's centre
      // and hang the moons inside it — a planet scope without a name. It now
      // asks for the registered one, so the moons' local coordinates, which
      // were already relative to the planet, mean what they say.
      const group = this.groupFor(planetScopeId(moon.arm));

      // Ring and pivot together on one inclined group, so the path a visitor
      // sees is the path the moon is actually on. The inclination goes HERE and
      // not on the planet scope group: that group is the frame the camera
      // descends into, and `moonFrames.test.ts` pins that a moon group's local
      // -X points at its planet whatever the phase — a property a frame riding
      // its own inclined orbit holds exactly (dot = 1.000000 at every phase)
      // and a counter-levelled one loses (0.978148 at ninety degrees).
      const orbit = new THREE.Group();
      orbit.name = `orbit:${moon.id}`;
      orbit.rotation.z = moon.inclination;
      group.add(orbit);

      const orbitRing = this.addHairlineRing(orbit, orbitRadius, 0.4, DIRECTION_A.rule);
      orbitRing.name = `orbit-ring:${moon.id}`;

      const pivot = new THREE.Group();
      pivot.rotation.y = moon.phase;

      // The moon body gets its own frame, hung on the pivot at the orbit
      // radius. This is what makes a tracked camera nearly free: the group
      // rides the orbit, so its local -X points at the planet whatever the
      // phase, and a camera posed in local space is looking down the
      // moon->planet radial by construction rather than by arithmetic.
      const moonRadius = planet.radius * MOON_SIZE;
      const moonGroup = new THREE.Group();
      moonGroup.name = moonScopeId(moon.id);
      moonGroup.position.set(orbitRadius, 0, 0);

      const body = new THREE.Mesh(
        new THREE.SphereGeometry(moonRadius, 20, 20),
        new THREE.MeshStandardMaterial({
          color: new THREE.Color(DIRECTION_A.gold),
          emissive: new THREE.Color(DIRECTION_A.gold),
          emissiveIntensity: 0.15,
          roughness: 0.45,
          metalness: 0.2,
        }),
      );
      body.name = `moon-body:${moon.id}`;
      moonGroup.add(body);
      pivot.add(moonGroup);
      orbit.add(pivot);
      this.scopeGroups.set(moonGroup.name, moonGroup);
      this.moonDrawnRadii.set(moon.arm, moonRadius);

      // Spec §2: moons are sub-pointer click targets at planet framing — two
      // misses were logged with `hits: 0`. A moon is drawn at a third of its
      // planet's radius, so where the planets get a 1.2x pick sphere, a moon
      // needs proportionally more of one to be hit reliably at all.
      const pickSphere = new THREE.Mesh(
        new THREE.SphereGeometry(moonRadius * MOON_PICK_SCALE, 12, 12),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
      );
      moonGroup.add(pickSphere);

      // Labelled from orbit: constant screen size, so the ecosystem reads at
      // galaxy framing rather than only once you have flown in.
      //
      // The label rides the pivot further out on the same radial rather than
      // sitting above the moon. Four labels stacked over a planet a hundred
      // pixels wide overlap each other; fanned outward they inherit the phase
      // separation the moons already have.
      const label = this.createMoonLabel(moon.label);
      label.scale.set(MOON_LABEL_SCALE * MOON_LABEL_ASPECT, MOON_LABEL_SCALE, 1);
      label.position.set(orbitRadius * MOON_LABEL_REACH, 0, 0);
      pivot.add(label);

      this.bodySprites.set(moon.id, body);
      this.moons.push({ pivot, rate: moon.rate });

      // The position used to be the planet's centre, which is why clicking a
      // moon flew to the planet. A flyby needs the moon's own place, so it is
      // read from the group's world matrix once the graph is assembled.
      moonGroup.updateWorldMatrix(true, false);
      const moonAnchor = new THREE.Vector3();
      this.hitObjects.push({
        id: moon.id,
        name: moon.label,
        type: "body",
        mesh: pickSphere,
        // Read, not remembered. A moon orbits and the galaxy turns, so a
        // position captured at build time is stale by the first frame — and
        // `descend()` aiming at a stale position is the bug this fixes.
        get position() {
          moonGroup.updateWorldMatrix(true, false);
          return moonAnchor.setFromMatrixPosition(moonGroup.matrixWorld);
        },
      });

      // A moon appears when its system is born (§3.8) — orbit line, pivot and
      // sphere together, so nothing is left ringing an empty point.
      this.bodyGates.push({
        id: moon.id,
        day: this.bornDayById.get(moon.id) ?? 0,
        objects: [orbitRing, pivot, body],
      });
    }
  }

  /** A venture's name, in the HUD's own pill so the map reads as one surface. */
  private createMoonLabel(text: string): THREE.Sprite {
    return this.createPaperLabel(MOON_LABEL_ASPECT, 512, (ctx, ink, canvas) => {
      ctx.fillStyle = ink;
      ctx.font = "600 52px ui-sans-serif, system-ui, sans-serif";
      ctx.fillText(text, canvas.width / 2, canvas.height / 2, canvas.width * 0.86);
    });
  }

  /** 6. 🛰️ Satellites and Repositories orbiting their respective planets */
  private buildSatellitesAndBodies(): void {
    const placements = placeBodies(this.bodies, this.scope);
    const placementMap = new Map(placements.map((p) => [p.id, p]));
    // Drawn in orbit by buildMoons. `placeBodies` still lays all of them out —
    // the layout is untouched — but a body belongs on screen exactly once.
    const inOrbit = moonIds(this.bodies, this.scope);

    for (const body of this.bodies) {
      if (inOrbit.has(body.id)) continue;
      const placement = placementMap.get(body.id);
      if (!placement) continue;

      const mag = magnitude(body);
      // Gold for what shipped, verdigris for what was learned. A direct token
      // substitution: the amber and emerald here were the pre-atlas palette,
      // and the two-kind distinction they carried is kept.
      const col = new THREE.Color(
        body.kind === "moon" ? DIRECTION_A.gold : DIRECTION_A.verdigris,
      );

      const bodyGroup = new THREE.Group();
      bodyGroup.name = `body-${body.id}`;

      // placeBodies already solved this: the crowd-run fan is what keeps two
      // repositories born the same day from sharing a point. Ringing bodies
      // around their planet at an authored offset threw that away and put them
      // nowhere in particular.
      const scenePos = toScene(placement.position);
      bodyGroup.position.set(scenePos.x, 1.0, scenePos.z);

      const sphereGeo = new THREE.SphereGeometry(Math.max(0.4, 0.4 + mag * 0.12), 16, 16);
      const sphereMat = new THREE.MeshStandardMaterial({
        color: col,
        emissive: col,
        // Low, not off: engraved on paper, but night still has to show them.
        emissiveIntensity: 0.15,
        roughness: 0.45,
      });
      const sphere = new THREE.Mesh(sphereGeo, sphereMat);
      bodyGroup.add(sphere);

      this.bodySprites.set(body.id, bodyGroup);
      this.rootGroup.add(bodyGroup);

      this.hitObjects.push({
        id: body.id,
        name: body.label || body.id,
        type: "body",
        mesh: sphere,
        position: bodyGroup.position.clone(),
      });

      // A body is drawn once its own bornAt has passed the clock (§3.8).
      this.bodyGates.push({
        id: body.id,
        day: this.bornDayById.get(body.id) ?? 0,
        objects: [bodyGroup],
      });
    }
  }

  public update(elapsed: number, delta: number): void {
    // L1. One angle for the whole galaxy: rigid, so no relative angle between
    // any two bodies changes and no radius does. That is what lets the map keep
    // claiming that angle means arm and radius means time.
    const pattern = this.reducedMotion ? 0 : patternAngle(elapsed);
    this.rootGroup.rotation.y = pattern;

    // Rotate central corona rings
    this.centralCoronaRings.forEach((ring, idx) => {
      ring.rotation.z += delta * (0.07 + idx * 0.035);
    });

    // The planets turn inside the shader, each at its family's own rate, so the
    // whole set advances on one uniform. Only the core is a mesh that spins.
    if (this.planetMaterial) {
      this.planetMaterial.uniforms.uTime.value = elapsed;
    }
    const fieldTime = this.reducedMotion ? 0 : elapsed;
    for (const material of this.fieldMaterials) material.uniforms.uTime.value = fieldTime;
    this.planetarySpheres.forEach((ps, idx) => {
      ps.rotateY(delta * (0.18 + (idx % 3) * 0.04));
    });

    updateOrreries([...this.orreries.values()], delta);

    this.moons.forEach((moon) => {
      moon.pivot.rotation.y += delta * moon.rate;
    });

    // One bead per ring, so a ring reads as moving before it is touched.
    this.idealRings.forEach((ring) => {
      ring.pivot.rotation.z += delta * ring.orbitRate;
    });

  }

  /** The drawn radius of an arm's moons, in scene units. */
  public moonDrawnRadius(arm: string): number {
    const radius = this.moonDrawnRadii.get(arm);
    if (radius === undefined) {
      // Loud, not defaulted — the same rule an unassigned arm already follows.
      throw new Error(`arm "${arm}" has no moons`);
    }
    return radius;
  }

  /** Which row of the planet InstancedMesh an arm occupies. */
  public planetInstanceIndex(arm: string): number {
    const index = this.planetInstanceIndices.get(arm);
    if (index === undefined) {
      // Loud, not defaulted — the same rule an unassigned arm already follows.
      throw new Error(`arm "${arm}" has no planet instance`);
    }
    return index;
  }

  /**
   * Thin the sky to one scope. `null` restores everything.
   *
   * The field goes because at surface altitude arm dust reads as grey speckle
   * smeared across the horizon, not because it costs frame time — measured at
   * 120.2 fps with it and 120.1 without, with 1,543 of 16,500 points inside the
   * frustum. Spec §7 risk 4 files this under frame budget; it is a treatment
   * problem, and optimising draw calls here would be effort spent on the wrong
   * thing.
   *
   * The planets need per-instance culling rather than a visibility toggle.
   * They are one InstancedMesh by design, so the parent that has to stay in
   * frame shares a mesh with the four that must not — hiding the object hides
   * all five, which is exactly the trap this method exists to avoid.
   */
  public setScopeCull(keep: ScopeId | null): void {
    for (const object of this.culled) object.visible = true;
    this.culled = [];
    this.cullKeepArm = null;
    if (!keep) {
      this.applyPlanetInstances();
      return;
    }

    const kept = this.scopeGroups.get(keep);
    const scopeNames = new Set(this.scopeGroups.keys());
    for (const child of this.rootGroup.children) {
      // The planet mesh is never hidden wholesale; it is culled per instance
      // below, because the kept scope's own planet lives inside it.
      if (child === this.planetMesh) continue;
      if (kept && (child === kept || this.contains(child, kept))) continue;
      if (!child.visible) continue;

      // What thins is the population, not the instrument. Dust, field and the
      // bodies of other frames go; the astrolabe's rings and the core stay,
      // because from a planet's surface those *are* the parent frame — the
      // galaxy has no body of its own worth framing, and culling them would
      // take away the very thing §3.2 asks to keep in view.
      const isField = (child as THREE.Points).isPoints === true;
      const isOtherScope = scopeNames.has(child.name);
      const isArmBody = child.name.startsWith("body-");
      if (!isField && !isOtherScope && !isArmBody) continue;

      child.visible = false;
      this.culled.push(child);
    }

    // The arm the kept scope sits in, whether that scope is a planet or a moon
    // inside one. `scopeChain` resolves both without a second code path.
    const planetScope = scopeChain(keep).find((scope) => scope.id.startsWith("planet:"));
    this.cullKeepArm = planetScope ? planetScope.id.replace("planet:", "") : null;
    this.applyPlanetInstances();
  }

  private contains(root: THREE.Object3D, node: THREE.Object3D): boolean {
    let cursor: THREE.Object3D | null = node;
    while (cursor) {
      if (cursor === root) return true;
      cursor = cursor.parent;
    }
    return false;
  }

  /**
   * The single owner of what the planet InstancedMesh draws.
   *
   * Three things now decide whether a planet is on screen — the timeline clock
   * decides how big it is, a scope cull decides whether it belongs to the frame
   * the visitor is in, and standing on one hides it because you are on it
   * rather than looking at it. Each of them used to write the instance matrix
   * directly, which meant the last writer won and the order they ran in was the
   * behaviour. They are inputs to this method now, and nothing else touches the
   * mesh.
   */
  private applyPlanetInstances(): void {
    const mesh = this.planetMesh;
    if (!mesh) return;

    const standingArm = this.standingOn?.startsWith("planet:")
      ? this.standingOn.slice("planet:".length)
      : null;
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);

    for (const [arm, index] of this.planetInstanceIndices) {
      const culled = this.cullKeepArm !== null && arm !== this.cullKeepArm;
      const standingOnIt = arm === standingArm;
      // `planetInstanceMatrices` is what the clock says this planet should be:
      // its position, and the mass it has accumulated by the current day.
      const matrix = this.planetInstanceMatrices[index];
      mesh.setMatrixAt(index, culled || standingOnIt || !matrix ? zero : matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  /**
   * One ground per scope that declares a surface, built into that scope's own
   * group and hidden. Which scopes those are is derived from where the evidence
   * is — see `surfaces.ts` — so nothing here names a body.
   */
  private buildSurfaces(): void {
    for (const scopeId of surfaceScopeIds(this.bodies)) {
      const group = this.scopeGroups.get(scopeId);
      if (!group) continue;
      const surface = buildSurface(group, scopeId, this.bodies);
      this.surfaces.set(scopeId, surface);

      // The instrument stands on the ground, so it is built into the surface
      // and inherits its visibility rather than needing its own gate.
      const orrery = buildOrrery(surface.group, scopeId, this.bodies);
      if (!orrery) continue;
      this.orreries.set(scopeId, orrery);
      for (const [moonId, bead] of orrery.targets) {
        const proxy = bead.parent?.getObjectByName(`orrery-hit:${moonId}`) ?? bead;
        this.hitObjects.push({
          id: moonId,
          name: moonId,
          type: "body",
          mesh: proxy,
          position: bead.position.clone(),
        });
      }
    }
  }

  /**
   * Everything on a surface a visitor can reach, so the overlay can give each
   * one a focusable, named control.
   *
   * Spec §6 asks for props, orrery and console to be focusable with accessible
   * names. Nothing inside a canvas is reachable by keyboard on its own — the
   * planets solved this by projecting to real DOM buttons, and this is the same
   * answer one frame further in. It improves pointing too: these are the same
   * sub-fingertip targets the moons were.
   */
  public surfaceTargets(scopeId: ScopeId | null): SurfaceTarget[] {
    if (!scopeId) return [];
    const out: SurfaceTarget[] = [];

    const surface = this.surfaces.get(scopeId);
    if (surface) {
      for (const [id, mesh] of surface.props) {
        const meta = surface.labels.get(id);
        out.push({
          id,
          label: meta?.label ?? id,
          bodyId: meta?.bodyId ?? id,
          kind: "prop",
          object: mesh,
        });
      }
    }

    // The console goes first: it is what the visitor came for, so it should be
    // the first thing the tab order offers, not the last after seven plinths.
    if (surface?.console) {
      out.unshift({
        id: `console:${surface.console.id}`,
        label: "Console",
        bodyId: surface.console.id,
        kind: "console",
        object: surface.console.object,
      });
    }

    const orrery = this.orreries.get(scopeId);
    if (orrery) {
      const named = new Map(this.bodies.map((b) => [b.id, b.label || b.id]));
      for (const [moonId, bead] of orrery.targets) {
        out.push({
          id: `orrery:${moonId}`,
          label: named.get(moonId) ?? moonId,
          bodyId: moonId,
          kind: "moon",
          object: bead,
        });
      }
    }
    return out;
  }

  /** The moons an instrument on this surface can launch a flight to. */
  public orreryTargets(scopeId: ScopeId): string[] {
    return [...(this.orreries.get(scopeId)?.targets.keys() ?? [])];
  }

  /**
   * Stand on a scope's surface, or `null` to go back to orbit.
   *
   * This is the level-of-detail swap, and it has to be a hard substitution.
   * At any shard radius the sphere and the shard drawn together read as a gold
   * ball sitting on a plate — the exact frame the first spike reported — so the
   * body a surface replaces is hidden for as long as the surface is shown.
   */
  public setStandingOn(scopeId: ScopeId | null): void {
    if (this.standingOn === scopeId) return;
    this.standingOn = scopeId;

    for (const [id, surface] of this.surfaces) {
      const showing = id === scopeId;
      surface.group.visible = showing;

      // The body this ground replaces. A moon has a sphere to hide; a planet
      // is an instance in the shared mesh, and hiding it there would take the
      // parent-in-frame guarantee with it, so a planet keeps its sphere and the
      // shard simply sits on it.
      if (id.startsWith("moon:")) {
        const body = this.bodySprites.get(id.slice("moon:".length));
        if (body) body.visible = !showing;
      }
    }
    // A planet is an instance in the shared mesh rather than an object, so its
    // half of the same swap happens there.
    this.applyPlanetInstances();

    // Constant-screen-size labels are a galaxy-framing affordance: they exist
    // because a moon is about fourteen screen pixels across from out there. On
    // a surface they are the wrong size by construction — a sibling's pill
    // lands across the parent's face — and the wrong idea besides, since the
    // orrery is how a moon is found and reached from here.
    //
    // Resolved by traversal rather than at the creation sites. Every one of
    // these is a Sprite, and asking the scene is a rule the next label added
    // obeys for free; a list built as they are made is a list to forget to add
    // to, which is how the first attempt missed one.
    this.rootGroup.traverse((object) => {
      if ((object as THREE.Sprite).isSprite) object.visible = scopeId === null;
    });
  }

  /** The scope whose surface the camera is standing on, if any. */
  public get standingScope(): ScopeId | null {
    return this.standingOn;
  }
}
