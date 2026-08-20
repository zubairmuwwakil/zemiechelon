import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import type { Body } from "@/lib/atlas/types";
import { placeBodies } from "@/lib/atlas/position";
import { GALAXY_ZEMI, type Scope } from "@/lib/atlas/scopes";
import { magnitude } from "@/lib/atlas/magnitude";
import { derivePlanets, deriveWorldRadius } from "@/lib/atlas/planets";
import { idealsFor } from "@/lib/atlas/ideals";
import { DIRECTION_A } from "@/lib/theme/directionA";
import { SCENE_SCALE, toScene } from "./WorldCameraManager";
import { createAtmosphericGlowMesh } from "./AtmosphereShader";
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

function mulberry32(seed: number): () => number {
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
  scope: Scope = GALAXY_ZEMI,
): { positions: Float32Array } {
  const rand = mulberry32(seed);
  const positions = new Float32Array((BACKGROUND_STAR_COUNT + ARM_DUST_COUNT) * 3);
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

  return { positions };
}

export interface InteractiveHitObject {
  id: string;
  name: string;
  type: "planet" | "sector" | "body" | "ideal";
  mesh: THREE.Object3D;
  /**
   * Set when `mesh` is shared. The five planets are one InstancedMesh, so the
   * mesh alone no longer identifies which of them was hit.
   */
  instanceId?: number;
  position: THREE.Vector3;
}

/**
 * Scene units the planets ride above the plane. The pins in WorldCanvas are
 * placed relative to this, so it is one number rather than six.
 */
export const PLANET_Y = 1.0;

const RING_SEGMENTS = 192;

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
  public readonly hitObjects: InteractiveHitObject[] = [];
  public readonly bodySprites: Map<string, THREE.Object3D> = new Map();

  // Animated celestial elements
  private planetarySpheres: THREE.Mesh[] = [];
  private planetMaterial: THREE.ShaderMaterial | null = null;
  private idealRings: IdealRing[] = [];
  private hoveredIdeal: string | null = null;
  /**
   * Drawing-buffer size, shared by every screen-space line. Line2 needs it to
   * turn a pixel width into clip space; a stale value scales every ring wrongly
   * after a resize.
   */
  private readonly resolution = new THREE.Vector2(1, 1);
  private centralCoronaRings: THREE.Mesh[] = [];
  private astrolabeRings: THREE.Mesh[] = [];
  private atmosphereGlows: THREE.Mesh[] = [];

  constructor(
    private scene: THREE.Scene,
    private bodies: Body[],
    private today: string,
    /** Fraction of the field budget to draw. See `fieldDensityFor`. */
    private fieldDensity = 1,
  ) {
    this.rootGroup.name = "world-scene-root";
  }

  public build(): void {
    this.scene.add(this.rootGroup);

    this.buildAstrolabeConcentricRings();
    this.buildBackgroundField();
    this.buildCentralAnchorCore();
    this.buildPlanetarySpheres();
    this.buildIdealRings();
    this.buildSatellitesAndBodies();
  }

  /** 1. 💫 Concentric Astrolabe Orbital Hairline Rings across Expanded Cosmos */
  private buildAstrolabeConcentricRings(): void {
    const ringRadii = [36, 65, 96, 130, 168, 205];
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xd97706, // Warm golden ink
      transparent: true,
      opacity: 0.32,
      side: THREE.DoubleSide,
    });

    ringRadii.forEach((r) => {
      const ringGeo = new THREE.RingGeometry(r - 0.08, r + 0.08, 240);
      ringGeo.rotateX(-Math.PI / 2);
      const ring = new THREE.Mesh(ringGeo, ringMat);
      this.rootGroup.add(ring);
      this.astrolabeRings.push(ring);
    });

    // Subtle radial tick marks along the outer astrolabe boundary ring (r=205)
    const ticksCount = 120;
    const outerR = 205;
    const lineGeo = new THREE.BufferGeometry();
    const linePositions: number[] = [];

    for (let i = 0; i < ticksCount; i++) {
      const angle = (i / ticksCount) * Math.PI * 2;
      const isMajor = i % 5 === 0;
      const isSuper = i % 10 === 0;
      const len = isSuper ? 3.5 : isMajor ? 2.0 : 0.9;
      const r1 = outerR - len / 2;
      const r2 = outerR + len / 2;

      linePositions.push(
        Math.cos(angle) * r1, 0, Math.sin(angle) * r1,
        Math.cos(angle) * r2, 0, Math.sin(angle) * r2
      );
    }

    lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(linePositions, 3));
    const tickMat = new THREE.LineBasicMaterial({
      color: 0xd97706,
      transparent: true,
      opacity: 0.3,
    });
    const tickLines = new THREE.LineSegments(lineGeo, tickMat);
    this.rootGroup.add(tickLines);
  }

  /**
   * 2. The deep field. Dark points on a light ground: engraved, not emitted.
   *
   * The old haze re-derived the spiral from `GALAXY_ZEMI.arms` and then rotated
   * itself in `update()`, so within two minutes the drawn arms had slid off the
   * repositories they were drawing. This one is anchored on the placements and
   * does not move.
   */
  public buildBackgroundField(): void {
    const { positions } = buildFieldGeometry(this.bodies, 20260820, SCENE_SCALE);

    // The shell reads as sky and the dust as ground, so they need different
    // weights — but not different generation passes. Two geometries over
    // subarray views of one buffer: `setDrawRange` lives on the geometry, so
    // sharing one would give both layers the same range.
    const layer = (
      from: number,
      count: number,
      size: number,
      opacity: number,
      attenuate: boolean,
      name: string,
    ) => {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(positions.subarray(from * 3, (from + count) * 3), 3),
      );
      const points = new THREE.Points(
        geometry,
        new THREE.PointsMaterial({
          color: new THREE.Color(DIRECTION_A.dust),
          size,
          sizeAttenuation: attenuate,
          // The shell is sky. Fading it into the paper would delete it, since
          // the fog colour is the paper.
          fog: attenuate,
          transparent: true,
          opacity,
          depthWrite: false,
        }),
      );
      points.name = name;
      // The shell is larger than any frustum test three.js will infer cheaply,
      // and a wrongly-culled sky is indistinguishable from a missing one.
      points.frustumCulled = false;
      this.rootGroup.add(points);
    };

    // Stars do not attenuate: they sit 300-870 units out, where a world-space
    // size of 0.9 rasterises to half a pixel and is dropped entirely. A fixed
    // pixel size is also what a sky should do — it must not swell on zoom.
    // The buffer is always generated whole — it is one cheap pass — and the
    // narrow-viewport budget is taken as a prefix of each region. The generator
    // draws in random order, so a prefix is a uniform sample of the same field
    // rather than a different one.
    const budget = (n: number) => Math.max(1, Math.round(n * this.fieldDensity));
    layer(0, budget(BACKGROUND_STAR_COUNT), 1.6, 0.5, false, "background-field");
    layer(BACKGROUND_STAR_COUNT, budget(ARM_DUST_COUNT), 1.2, 0.5, true, "arm-dust");
  }

  /** 4. ☀️ Central Ancestral Core Sphere ("Nodes" / Anchor Sun) */
  private buildCentralAnchorCore(): void {
    const sunGroup = new THREE.Group();
    sunGroup.name = "central-anchor-core";
    sunGroup.position.set(0, 0, 0);

    const texture = this.createSolarPlasmaTexture();

    // Smooth shaded pearl/gold central anchor core
    const coreGeo = new THREE.SphereGeometry(7.5, 64, 64);
    const coreMat = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.2,
      metalness: 0.1,
      emissive: 0xfbbf24,
      emissiveIntensity: 0.45,
      emissiveMap: texture,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreMesh.castShadow = true;
    sunGroup.add(coreMesh);
    this.planetarySpheres.push(coreMesh);

    // Multi-layer glowing golden plasma corona rings
    [9.8, 12.5, 15.5].forEach((radius, idx) => {
      const ringGeo = new THREE.RingGeometry(radius - 0.08, radius + 0.08, 160);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.5 - idx * 0.14,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      sunGroup.add(ring);
      this.centralCoronaRings.push(ring);
    });

    // Soft Fresnel Atmospheric Aura Halo
    const halo = createAtmosphericGlowMesh(8.6, 0xfbbf24, 2.2, 0.75);
    sunGroup.add(halo);
    this.atmosphereGlows.push(halo);

    this.hitObjects.push({
      id: "galaxy",
      name: "Ancestral Anchor Core",
      type: "planet",
      mesh: coreMesh,
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
    const planets = derivePlanets(this.bodies);
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
      matrix.makeScale(radius, radius, radius);
      matrix.setPosition(center.x, PLANET_Y, center.z);
      mesh.setMatrixAt(i, matrix);

      pattern[i] = family.pattern;
      spin[i] = family.rotationRate;
      // .setStyle converts sRGB to the linear working space, which is what the
      // shader must emit for OutputPass to convert it back to the authored hex.
      colour.set(family.baseColor).toArray(base, i * 3);
      colour.set(family.accentColor).toArray(accent, i * 3);

      this.hitObjects.push({
        id: planet.arm,
        name: `Planet ${planet.arm[0].toUpperCase()}${planet.arm.slice(1)}`,
        type: "planet",
        mesh,
        instanceId: i,
        position: new THREE.Vector3(center.x, PLANET_Y, center.z),
      });
    });

    geometry.setAttribute(PLANET_ATTRIBUTES.pattern, new THREE.InstancedBufferAttribute(pattern, 1));
    geometry.setAttribute(PLANET_ATTRIBUTES.spin, new THREE.InstancedBufferAttribute(spin, 1));
    geometry.setAttribute(PLANET_ATTRIBUTES.base, new THREE.InstancedBufferAttribute(base, 3));
    geometry.setAttribute(PLANET_ATTRIBUTES.accent, new THREE.InstancedBufferAttribute(accent, 3));
    mesh.instanceMatrix.needsUpdate = true;

    this.planetMaterial = material;
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

    for (const planet of derivePlanets(this.bodies)) {
      const ideals = idealsFor(planet.arm);
      if (ideals.length === 0) continue;

      const center = toScene(planet.center);
      const radius = planet.radius * SCENE_SCALE;
      const family = SURFACE_FAMILIES[planet.arm];

      const group = new THREE.Group();
      group.name = `ideals-${planet.arm}`;
      group.position.set(center.x, PLANET_Y, center.z);
      // Derived, not authored: the old per-planet `tilt` was a typed table.
      // Reading the arm's own base angle gives every planet a different plane,
      // and a sixth arm gets one without anybody choosing a number.
      group.rotation.x = -Math.PI / 2 + GALAXY_ZEMI.arms[planet.arm] * 0.28;
      group.rotation.y = GALAXY_ZEMI.arms[planet.arm] * 0.14;

      for (const ideal of ideals) {
        const r = radius * (1.6 + ideal.ordinal * 0.36);
        const gold = new THREE.Color(DIRECTION_A.gold);

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
        group.add(new Line2(ringGeometry, ringMaterial));

        // A hairline is about a pixel wide at galaxy distance, which nothing can
        // hover. The raycaster skips `visible: false` but hits a fully
        // transparent material, so the target is fat while the line stays thin.
        const pick = new THREE.Mesh(
          new THREE.RingGeometry(r - radius * 0.3, r + radius * 0.3, 64),
          new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
        );
        group.add(pick);

        const pivot = new THREE.Group();
        const bead = new THREE.Mesh(
          new THREE.SphereGeometry(radius * 0.085, 12, 12),
          new THREE.MeshBasicMaterial({ color: gold, transparent: true, opacity: 0.9 }),
        );
        bead.position.set(r, 0, 0);
        pivot.add(bead);
        group.add(pivot);

        // World-up and outside the tilted group: the ring leans, the label must
        // not. Constant screen size, so it is legible from orbit — which is the
        // only place a claim about the whole ecosystem is worth reading.
        const label = this.createClaimLabel(ideal.claim, ideal.evidence.map((id) => labels.get(id) ?? id));
        label.position.set(center.x, PLANET_Y + r * 1.5 + ideal.ordinal * radius * 0.5, center.z);
        label.scale.set(CLAIM_LABEL_SCALE * CLAIM_LABEL_ASPECT, CLAIM_LABEL_SCALE, 1);
        label.material.opacity = 0;
        this.rootGroup.add(label);

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

      this.rootGroup.add(group);
    }
  }

  /** Ink on paper, drawn once. A sprite keeps the claim facing the camera. */
  private createClaimLabel(claim: string, cited: string[]): THREE.Sprite {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = Math.round(1024 / CLAIM_LABEL_ASPECT);
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const pad = 18;
      const radius = 44;
      // The same glass pill the HUD uses, so a claim reads as part of the
      // instrument rather than as something painted onto the sky.
      ctx.beginPath();
      ctx.roundRect(pad, pad, canvas.width - pad * 2, canvas.height - pad * 2, radius);
      ctx.fillStyle = "rgba(255,255,255,0.94)";
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = DIRECTION_A.rule;
      ctx.stroke();

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = DIRECTION_A.ink;
      ctx.font = "600 82px ui-sans-serif, system-ui, sans-serif";
      ctx.fillText(claim, canvas.width / 2, canvas.height * 0.4, canvas.width - pad * 4);
      ctx.fillStyle = DIRECTION_A.gold;
      ctx.font = "400 58px ui-monospace, SFMono-Regular, monospace";
      ctx.fillText(cited.join("   ·   "), canvas.width / 2, canvas.height * 0.68, canvas.width - pad * 4);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        // Constant screen size. With attenuation the label is four pixels tall
        // at galaxy framing and fills the frame the moment you fly in.
        sizeAttenuation: false,
      }),
    );
    sprite.renderOrder = 3;
    return sprite;
  }

  /**
   * Illuminate one ring and dim its siblings. Hovering is what turns a ring
   * from decoration into an instrument: the claim and the repositories behind
   * it appear together, so the claim is never on screen without its evidence.
   */
  /** Called on mount and on every resize. See `resolution`. */
  public setResolution(width: number, height: number): void {
    this.resolution.set(width, height);
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

  /** 6. 🛰️ Satellites and Repositories orbiting their respective planets */
  private buildSatellitesAndBodies(): void {
    const placements = placeBodies(this.bodies);
    const placementMap = new Map(placements.map((p) => [p.id, p]));

    for (const body of this.bodies) {
      const placement = placementMap.get(body.id);
      if (!placement) continue;

      const mag = magnitude(body);
      const col = body.kind === "system" ? 0xd97706 : 0x059669;

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
        emissiveIntensity: 0.5,
        roughness: 0.35,
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
    }
  }

  // ================= PROCEDURAL TEXTURE GENERATORS =================

  /** ☀️ Solar Core Plasma Texture Generator */
  private createSolarPlasmaTexture(): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) return new THREE.CanvasTexture(canvas);

    // Warm radiant gradient
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, "#fffbeb");
    grad.addColorStop(0.3, "#fef3c7");
    grad.addColorStop(0.6, "#fde68a");
    grad.addColorStop(0.85, "#fbbf24");
    grad.addColorStop(1, "#f59e0b");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Plasma swirls
    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    for (let i = 0; i < 40; i++) {
      const y = Math.random() * canvas.height;
      const h = 4 + Math.random() * 12;
      ctx.fillRect(0, y, canvas.width, h);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  }

  public update(elapsed: number, delta: number): void {
    // Rotate central corona rings
    this.centralCoronaRings.forEach((ring, idx) => {
      ring.rotation.z += delta * (0.07 + idx * 0.035);
    });

    // The planets turn inside the shader, each at its family's own rate, so the
    // whole set advances on one uniform. Only the core is a mesh that spins.
    if (this.planetMaterial) {
      this.planetMaterial.uniforms.uTime.value = elapsed;
    }
    this.planetarySpheres.forEach((ps, idx) => {
      ps.rotateY(delta * (0.18 + (idx % 3) * 0.04));
    });

    // One bead per ring, so a ring reads as moving before it is touched.
    this.idealRings.forEach((ring) => {
      ring.pivot.rotation.z += delta * ring.orbitRate;
    });

  }
}
