import * as THREE from "three";
import type { Body } from "@/lib/atlas/types";
import { placeBodies } from "@/lib/atlas/position";
import { GALAXY_ZEMI } from "@/lib/atlas/scopes";
import { magnitude } from "@/lib/atlas/magnitude";
import { PLANET_CENTERS, PLANET_RADII, SCENE_SCALE, toScene } from "./WorldCameraManager";
import { createAtmosphericGlowMesh } from "./AtmosphereShader";

export interface InteractiveHitObject {
  id: string;
  name: string;
  type: "planet" | "sector" | "body";
  mesh: THREE.Object3D;
  position: THREE.Vector3;
}

export class WorldSceneBuilder {
  public readonly rootGroup = new THREE.Group();
  public readonly hitObjects: InteractiveHitObject[] = [];
  public readonly bodySprites: Map<string, THREE.Object3D> = new Map();

  // Animated celestial elements
  private planetarySpheres: THREE.Mesh[] = [];
  private planetEquatorialRings: THREE.Group[] = [];
  private centralCoronaRings: THREE.Mesh[] = [];
  private astrolabeRings: THREE.Mesh[] = [];
  private constellationLines: THREE.LineSegments | null = null;
  private stardustPoints: THREE.Points | null = null;
  private atmosphereGlows: THREE.Mesh[] = [];

  constructor(
    private scene: THREE.Scene,
    private bodies: Body[],
    private today: string,
  ) {
    this.rootGroup.name = "world-scene-root";
  }

  public build(): void {
    this.scene.add(this.rootGroup);

    this.buildAstrolabeConcentricRings();
    this.buildStardustHaze();
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

  /** 2. 🌌 Deep Stardust Particle Cloud */
  private buildStardustHaze(): void {
    const dustCount = 4500;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(dustCount * 3);
    const colors = new Float32Array(dustCount * 3);

    const goldColor = new THREE.Color(0xd97706);
    const emeraldColor = new THREE.Color(0x059669);
    const pearlColor = new THREE.Color(0xa1a1aa);
    const violetColor = new THREE.Color(0xa855f7);

    // The dust IS the arms, so it has to be the same spiral the bodies are laid
    // out on. It used to carry its own wind rate (0.38 against the layout's
    // 0.55) and its own radius range, which put every planet 25 degrees off the
    // arm it belongs to — a third of the way to its neighbour.
    const armNames = Object.keys(GALAXY_ZEMI.arms);
    const reach = placeBodies(this.bodies).map((p) => Math.hypot(p.position.x, p.position.z));
    const innerR = Math.min(...reach);
    const outerR = Math.max(...reach);

    for (let i = 0; i < dustCount; i++) {
      const u = i / dustCount;
      const arm = armNames[i % armNames.length];
      // Layout units: theta is a function of the layout radius, so the curve is
      // the arm's own curve. Only the drawn position is converted to the scene.
      const radius = innerR + u * (outerR - innerR) + (Math.random() - 0.5) * 0.6;
      const theta =
        GALAXY_ZEMI.arms[arm] + GALAXY_ZEMI.windRate * Math.log(1 + radius) + (Math.random() - 0.5) * 0.3;

      positions[i * 3] = Math.cos(theta) * radius * SCENE_SCALE;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 1.2;
      positions[i * 3 + 2] = Math.sin(theta) * radius * SCENE_SCALE;

      const r = Math.random();
      const col = r > 0.65 ? goldColor : r > 0.4 ? emeraldColor : r > 0.2 ? violetColor : pearlColor;
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.75,
      vertexColors: true,
      transparent: true,
      opacity: 0.5,
      sizeAttenuation: true,
    });

    this.stardustPoints = new THREE.Points(geometry, material);
    this.rootGroup.add(this.stardustPoints);
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

  /** 5. 🪐 The 5 Core Celestial Spheres with Distinct Personalities */
  private buildPlanetarySpheres(): void {
    const planetConfigs = [
      // 1. Planet Self (The Founder's Sphere / Sacred Zemí) - r=36, Size=4.6
      {
        id: "self",
        name: "Planet Self",
        center: PLANET_CENTERS.self,
        radius: PLANET_RADII.self,
        texture: this.createMarbleGoldTexture(),
        emissive: 0x10b981,
        emissiveIntensity: 0.35,
        ringColor: 0x10b981,
        ringRadii: [1.391, 1.696].map((m) => m * PLANET_RADII.self),
        tilt: -0.22,
        haloColor: 0x34d399,
      },
      // 2. Planet Foundations (Bedrock Genesis & Algorithms) - r=64, Size=5.0
      {
        id: "foundations",
        name: "Planet Foundations",
        center: PLANET_CENTERS.foundations,
        radius: PLANET_RADII.foundations,
        texture: this.createCrystallineOceanTexture(),
        emissive: 0x38bdf8,
        emissiveIntensity: 0.35,
        ringColor: 0x38bdf8,
        ringRadii: [1.36, 1.68].map((m) => m * PLANET_RADII.foundations),
        tilt: 0.25,
        haloColor: 0x38bdf8,
      },
      // 3. Planet Products (PickleOps & Fintech Gas Giant) - r=96, Size=6.4 (Grandest Planet)
      {
        id: "products",
        name: "Planet Products",
        center: PLANET_CENTERS.products,
        radius: PLANET_RADII.products,
        texture: this.createGasGiantTexture(),
        emissive: 0xf59e0b,
        emissiveIntensity: 0.4,
        ringColor: 0xf59e0b,
        ringRadii: [1.375, 1.641, 1.906, 2.125].map((m) => m * PLANET_RADII.products),
        tilt: 0.38,
        haloColor: 0xfbbf24,
      },
      // 4. Planet Labs (Autonomous AI & Neural Runtimes) - r=129, Size=5.4
      {
        id: "labs",
        name: "Planet Labs",
        center: PLANET_CENTERS.labs,
        radius: PLANET_RADII.labs,
        texture: this.createCyberGridTexture(),
        emissive: 0xa855f7,
        emissiveIntensity: 0.4,
        ringColor: 0xa855f7,
        ringRadii: [1.407, 1.741, 2.037].map((m) => m * PLANET_RADII.labs),
        tilt: -0.32,
        haloColor: 0xc084fc,
      },
      // 5. Planet Creative (Knowledge Crucible & Obsidian Vault) - r=168, Size=4.2
      {
        id: "creative",
        name: "Planet Creative",
        center: PLANET_CENTERS.creative,
        radius: PLANET_RADII.creative,
        texture: this.createNebulaTexture(),
        emissive: 0xf43f5e,
        emissiveIntensity: 0.38,
        ringColor: 0xf43f5e,
        ringRadii: [1.476, 1.857].map((m) => m * PLANET_RADII.creative),
        tilt: 0.35,
        haloColor: 0xfb7185,
      },
    ];

    planetConfigs.forEach((cfg) => {
      const planetGroup = new THREE.Group();
      planetGroup.name = `planet-${cfg.id}`;
      planetGroup.position.copy(cfg.center);

      // Smooth shaded spherical body with high-resolution procedural texture map
      const geo = new THREE.SphereGeometry(cfg.radius, 64, 64);
      const mat = new THREE.MeshStandardMaterial({
        map: cfg.texture,
        roughness: 0.3,
        metalness: 0.15,
        emissive: cfg.emissive,
        emissiveIntensity: cfg.emissiveIntensity,
      });
      const sphere = new THREE.Mesh(geo, mat);
      sphere.position.y = 1.0;
      sphere.castShadow = true;
      sphere.receiveShadow = true;
      planetGroup.add(sphere);
      this.planetarySpheres.push(sphere);

      // Delicate Hairline Concentric Equatorial Rings
      const eqGroup = new THREE.Group();
      eqGroup.position.y = 1.0;
      eqGroup.rotation.x = cfg.tilt;
      eqGroup.rotation.z = cfg.tilt * 0.55;

      cfg.ringRadii.forEach((r, idx) => {
        const ringGeo = new THREE.RingGeometry(r - 0.06, r + 0.06, 128);
        ringGeo.rotateX(-Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({
          color: cfg.ringColor,
          transparent: true,
          opacity: 0.55 - idx * 0.12,
          side: THREE.DoubleSide,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        eqGroup.add(ring);
      });

      planetGroup.add(eqGroup);
      this.planetEquatorialRings.push(eqGroup);

      // Soft Fresnel Atmospheric Glow Shell
      const halo = createAtmosphericGlowMesh(cfg.radius * 1.15, cfg.haloColor, 2.5, 0.7);
      halo.position.y = 1.0;
      planetGroup.add(halo);
      this.atmosphereGlows.push(halo);

      this.hitObjects.push({
        id: cfg.id,
        name: cfg.name,
        type: "planet",
        mesh: sphere,
        position: cfg.center.clone(),
      });

      this.rootGroup.add(planetGroup);
    });
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

  /** 🪐 Planet Products: Gas Giant Banding Texture Generator */
  private createGasGiantTexture(): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) return new THREE.CanvasTexture(canvas);

    // Base amber gold background
    ctx.fillStyle = "#fffbeb";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Stratified atmospheric horizontal bands
    const bandColors = [
      "#fef3c7",
      "#fde68a",
      "#f59e0b",
      "#d97706",
      "#b45309",
      "#fef3c7",
      "#fcd34d",
      "#fbbf24",
      "#b45309",
      "#d97706",
      "#fef3c7",
    ];

    let y = 0;
    while (y < canvas.height) {
      const h = 6 + Math.random() * 24;
      const col = bandColors[Math.floor(Math.random() * bandColors.length)];
      ctx.fillStyle = col;
      ctx.fillRect(0, y, canvas.width, h);

      // Fine cloud filament
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      ctx.fillRect(0, y + h * 0.4, canvas.width, 2);

      y += h;
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  }

  /** 🤖 Planet Labs: Cyber Amethyst Neural Grid Texture Generator */
  private createCyberGridTexture(): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) return new THREE.CanvasTexture(canvas);

    // Dark Amethyst space background
    ctx.fillStyle = "#2e1065";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle violet nebula wash
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, "#3b0764");
    grad.addColorStop(0.5, "#581c87");
    grad.addColorStop(1, "#2e1065");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Neural Grid Lines
    ctx.strokeStyle = "rgba(168, 85, 247, 0.55)";
    ctx.lineWidth = 1.5;

    // Latitudes
    for (let y = 16; y < canvas.height; y += 24) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Longitudes
    for (let x = 16; x < canvas.width; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }

    // Glowing Node Dots
    ctx.fillStyle = "#c084fc";
    for (let x = 16; x < canvas.width; x += 64) {
      for (let y = 16; y < canvas.height; y += 48) {
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  }

  /** 💎 Planet Foundations: Crystalline Aquamarine Ocean Texture Generator */
  private createCrystallineOceanTexture(): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) return new THREE.CanvasTexture(canvas);

    // Deep cyan oceanic base
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, "#f0f9ff"); // Polar ice cap
    grad.addColorStop(0.25, "#bae6fd");
    grad.addColorStop(0.5, "#38bdf8");
    grad.addColorStop(0.75, "#0284c7");
    grad.addColorStop(1, "#f0f9ff"); // South ice cap
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Crystalline ice-shelf strata & algorithmic lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
    ctx.lineWidth = 1;
    for (let y = 30; y < canvas.height - 30; y += 28) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    for (let i = 0; i < 20; i++) {
      const x = Math.random() * canvas.width;
      const y = 40 + Math.random() * (canvas.height - 80);
      const w = 30 + Math.random() * 60;
      const h = 8 + Math.random() * 16;
      ctx.fillRect(x, y, w, h);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  }

  /** 🌿 Planet Self: Sacred Emerald & Gold Marble Texture Generator */
  private createMarbleGoldTexture(): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) return new THREE.CanvasTexture(canvas);

    // Rich Emerald base
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, "#064e3b");
    grad.addColorStop(0.4, "#047857");
    grad.addColorStop(0.7, "#10b981");
    grad.addColorStop(1, "#065f46");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Golden marble veins
    ctx.strokeStyle = "rgba(251, 191, 36, 0.65)";
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      const startX = (i / 8) * canvas.width;
      ctx.moveTo(startX, 0);
      ctx.bezierCurveTo(
        startX + 40, canvas.height * 0.3,
        startX - 40, canvas.height * 0.7,
        startX + 20, canvas.height
      );
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  }

  /** 🔮 Planet Creative: Crimson Nebula Texture Generator */
  private createNebulaTexture(): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) return new THREE.CanvasTexture(canvas);

    // Deep Ruby / Crimson Cosmos
    const grad = ctx.createRadialGradient(
      canvas.width * 0.5, canvas.height * 0.5, 20,
      canvas.width * 0.5, canvas.height * 0.5, canvas.width * 0.6
    );
    grad.addColorStop(0, "#f43f5e");
    grad.addColorStop(0.4, "#be123c");
    grad.addColorStop(0.8, "#881337");
    grad.addColorStop(1, "#4c0519");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Aurora gas clouds
    ctx.fillStyle = "rgba(254, 205, 211, 0.35)";
    for (let i = 0; i < 25; i++) {
      const y = Math.random() * canvas.height;
      const h = 5 + Math.random() * 18;
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

    // Rotate planetary spheres smoothly
    this.planetarySpheres.forEach((ps, idx) => {
      ps.rotateY(delta * (0.18 + (idx % 3) * 0.04));
    });

    // Gently rotate equatorial astrolabe rings
    this.planetEquatorialRings.forEach((eq, idx) => {
      eq.rotation.y += delta * (0.12 + (idx % 3) * 0.04);
    });

    // Slowly rotate stardust haze
    if (this.stardustPoints) {
      this.stardustPoints.rotation.y += delta * 0.015;
    }
  }
}
