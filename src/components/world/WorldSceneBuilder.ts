import * as THREE from "three";
import type { Body } from "@/lib/atlas/types";
import { placeBodies } from "@/lib/atlas/position";
import { GALAXY_ZEMI, type Scope } from "@/lib/atlas/scopes";
import { magnitude } from "@/lib/atlas/magnitude";
import { derivePlanets, deriveWorldRadius } from "@/lib/atlas/planets";
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
  type: "planet" | "sector" | "body";
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

export class WorldSceneBuilder {
  public readonly rootGroup = new THREE.Group();
  public readonly hitObjects: InteractiveHitObject[] = [];
  public readonly bodySprites: Map<string, THREE.Object3D> = new Map();

  // Animated celestial elements
  private planetarySpheres: THREE.Mesh[] = [];
  private planetMaterial: THREE.ShaderMaterial | null = null;
  private centralCoronaRings: THREE.Mesh[] = [];
  private astrolabeRings: THREE.Mesh[] = [];
  private constellationLines: THREE.LineSegments | null = null;
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
    this.buildConstellationGrid();
    this.buildCentralAnchorCore();
    this.buildPlanetarySpheres();
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

  /** 3. 🕸️ Constellation Network across Expanded Cosmos */
  private buildConstellationGrid(): void {
    const constellationPoints = [
      new THREE.Vector3(-100, 20, -70),
      new THREE.Vector3(-52, 18, -38),
      new THREE.Vector3(-20, 26, -110),
      new THREE.Vector3(45, 24, -120),
      new THREE.Vector3(105, 20, -75),
      new THREE.Vector3(135, 18, 20),
      new THREE.Vector3(120, 22, 118),
      new THREE.Vector3(50, 16, 125),
      new THREE.Vector3(0, 18, 36),
      new THREE.Vector3(-68, 22, 68),
      new THREE.Vector3(-115, 20, 25),
    ];

    const linePositions: number[] = [];
    for (let i = 0; i < constellationPoints.length; i++) {
      const nextIdx = (i + 1) % constellationPoints.length;
      linePositions.push(
        constellationPoints[i].x, constellationPoints[i].y, constellationPoints[i].z,
        constellationPoints[nextIdx].x, constellationPoints[nextIdx].y, constellationPoints[nextIdx].z
      );

      // Connect inward towards center astrolabe
      if (i % 2 === 0) {
        linePositions.push(
          constellationPoints[i].x, constellationPoints[i].y, constellationPoints[i].z,
          0, 6, 0
        );
      }
    }

    const constGeo = new THREE.BufferGeometry();
    constGeo.setAttribute("position", new THREE.Float32BufferAttribute(linePositions, 3));
    const constMat = new THREE.LineBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.22,
    });

    this.constellationLines = new THREE.LineSegments(constGeo, constMat);
    this.rootGroup.add(this.constellationLines);
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

  }
}
