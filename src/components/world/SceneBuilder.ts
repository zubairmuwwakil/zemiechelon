import * as THREE from "three";
import { AnimatedElement, CourierBot, InteractiveSectorObject } from "./types";

export class SceneBuilder {
  private scene: THREE.Scene;
  public animatedElements: AnimatedElement[] = [];
  public interactiveSectors: Map<string, InteractiveSectorObject> = new Map();
  public interactiveMeshes: THREE.Object3D[] = [];
  public courierBots: CourierBot[] = [];
  public nightEmissives: THREE.Material[] = [];

  // Lighting references
  public hemiLight!: THREE.HemisphereLight;
  public sunLight!: THREE.DirectionalLight;
  public fillLight!: THREE.DirectionalLight;

  // Interactive object references
  public cardMeshGroup: THREE.Group | null = null;
  public candleBars: THREE.Mesh[] = [];
  public founderBeam: THREE.Mesh | null = null;
  public ballMesh: THREE.Mesh | null = null;

  // Color palette - Clean, bright, warm sunlight diorama
  private colors = {
    ground: 0xf3eee5,
    groundDark: 0xe2dcd0,
    grass: 0xd9e5cf,
    path: 0xe8e2d5,
    water: 0xbae6fd,
    card: 0x38bdf8,
    chip: 0xfbbf24,
    candleGreen: 0x34d399,
    candleRed: 0xf87171,
    aiSpire: 0x8b5cf6,
    aiAccent: 0xc4b5fd,
    courtBlue: 0x38bdf8,
    courtGreen: 0x4ade80,
    courtLine: 0xffffff,
    ball: 0xa3e635,
    monolith: 0xd4d4d8,
    monolithGlow: 0xf59e0b,
    founderBase: 0xffffff,
    founderRoof: 0x3b82f6,
    wood: 0x92400e,
    foliage: 0x86efac,
    foliageDark: 0x4ade80,
    cloud: 0xffffff,
  };

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  public buildWorld() {
    this.setupLighting();
    this.buildMainIslands();
    this.buildFintechPlaza();
    this.buildAIYard();
    this.buildPickleballArena();
    this.buildPrinciplesMonoliths();
    this.buildFounderNexus();
    this.buildConnectingPathways();
    this.buildVegetation();
    this.buildClouds();
    this.buildWindTurbines();
    this.buildCourierBots();
  }

  private setupLighting() {
    this.hemiLight = new THREE.HemisphereLight(0xffffff, 0xe5ded1, 1.1);
    this.hemiLight.position.set(0, 50, 0);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff7ed, 1.6);
    this.sunLight.position.set(20, 35, 25);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 100;
    this.sunLight.shadow.camera.left = -22;
    this.sunLight.shadow.camera.right = 22;
    this.sunLight.shadow.camera.top = 22;
    this.sunLight.shadow.camera.bottom = -22;
    this.sunLight.shadow.bias = -0.0005;
    this.scene.add(this.sunLight);

    this.fillLight = new THREE.DirectionalLight(0xe0f2fe, 0.6);
    this.fillLight.position.set(-20, 20, -20);
    this.scene.add(this.fillLight);
  }

  private createChamferedBox(
    w: number,
    h: number,
    d: number,
    color: number,
    roughness: number = 0.4
  ): THREE.Mesh {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness,
      metalness: 0.05,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  private buildMainIslands() {
    const baseGeo = new THREE.CylinderGeometry(15.5, 14.5, 1.2, 8);
    const baseMat = new THREE.MeshStandardMaterial({
      color: this.colors.groundDark,
      roughness: 0.6,
    });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = -0.6;
    base.receiveShadow = true;
    this.scene.add(base);

    const topGeo = new THREE.CylinderGeometry(15.2, 15.2, 0.4, 8);
    const topMat = new THREE.MeshStandardMaterial({
      color: this.colors.ground,
      roughness: 0.5,
    });
    const top = new THREE.Mesh(topGeo, topMat);
    top.position.y = 0.1;
    top.receiveShadow = true;
    this.scene.add(top);

    const gridHelper = new THREE.GridHelper(26, 26, 0x000000, 0x000000);
    gridHelper.position.y = 0.31;
    const gridMat = gridHelper.material as THREE.Material;
    gridMat.opacity = 0.04;
    gridMat.transparent = true;
    this.scene.add(gridHelper);
  }

  // 1. FINTECH PLAZA
  private buildFintechPlaza() {
    const group = new THREE.Group();
    group.position.set(-7, 0.3, -4);
    group.userData = { sectorId: "fintech" };

    const platform = this.createChamferedBox(5.6, 0.4, 5.2, this.colors.grass, 0.5);
    platform.position.y = 0.2;
    group.add(platform);

    const buildingBase = this.createChamferedBox(2.2, 1.8, 1.8, 0xffffff, 0.2);
    buildingBase.position.set(-0.9, 1.2, -0.6);
    group.add(buildingBase);

    const glassGeo = new THREE.BoxGeometry(2.25, 0.4, 1.85);
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.85,
      roughness: 0.1,
      transmission: 0.6,
    });
    const glass = new THREE.Mesh(glassGeo, glassMat);
    glass.position.set(-0.9, 1.4, -0.6);
    group.add(glass);

    // Floating PickMe Credit Card
    const cardGroup = new THREE.Group();
    cardGroup.position.set(1.1, 1.5, 0.8);
    cardGroup.rotation.set(0.1, -0.4, 0.2);

    const cardGeo = new THREE.BoxGeometry(1.6, 1.0, 0.08);
    const cardMat = new THREE.MeshStandardMaterial({
      color: this.colors.card,
      metalness: 0.3,
      roughness: 0.2,
    });
    const card = new THREE.Mesh(cardGeo, cardMat);
    card.castShadow = true;
    cardGroup.add(card);

    const chipGeo = new THREE.BoxGeometry(0.28, 0.22, 0.09);
    const chipMat = new THREE.MeshStandardMaterial({
      color: this.colors.chip,
      metalness: 0.8,
      roughness: 0.2,
    });
    const chip = new THREE.Mesh(chipGeo, chipMat);
    chip.position.set(-0.4, 0.05, 0.01);
    cardGroup.add(chip);

    this.cardMeshGroup = cardGroup;
    group.add(cardGroup);

    this.animatedElements.push({
      mesh: cardGroup,
      type: "float",
      amplitude: 0.15,
      speed: 1.8,
      initialY: 1.5,
    });

    // MarketLens 3D Candlesticks
    const candleHeights = [0.8, 1.4, 1.0, 1.9, 1.5];
    const candleColors = [
      this.colors.candleGreen,
      this.colors.candleGreen,
      this.colors.candleRed,
      this.colors.candleGreen,
      this.colors.candleGreen,
    ];

    this.candleBars = [];
    candleHeights.forEach((h, idx) => {
      const candle = this.createChamferedBox(0.22, h, 0.22, candleColors[idx], 0.3);
      candle.position.set(-1.8 + idx * 0.45, 0.4 + h / 2, 1.4);
      candle.userData = { initialHeight: h, barIdx: idx };
      this.candleBars.push(candle);
      group.add(candle);

      const wickGeo = new THREE.CylinderGeometry(0.02, 0.02, h + 0.3, 4);
      const wickMat = new THREE.MeshBasicMaterial({ color: 0x475569 });
      const wick = new THREE.Mesh(wickGeo, wickMat);
      wick.position.set(-1.8 + idx * 0.45, 0.4 + h / 2, 1.4);
      group.add(wick);
    });

    this.registerInteractiveSector("fintech", group);
    this.scene.add(group);
  }

  // 2. AI & AUTONOMOUS SYSTEMS YARD
  private buildAIYard() {
    const group = new THREE.Group();
    group.position.set(7, 0.3, -4);
    group.userData = { sectorId: "intelligence" };

    const platform = this.createChamferedBox(5.4, 0.4, 5.2, 0xe0e7ff, 0.5);
    platform.position.y = 0.2;
    group.add(platform);

    const spireGeo = new THREE.CylinderGeometry(0.5, 0.9, 2.6, 6);
    const spireMat = new THREE.MeshStandardMaterial({
      color: this.colors.aiSpire,
      metalness: 0.2,
      roughness: 0.3,
    });
    const spire = new THREE.Mesh(spireGeo, spireMat);
    spire.position.set(0, 1.6, -0.4);
    spire.castShadow = true;
    group.add(spire);

    const ringGeo = new THREE.TorusGeometry(0.95, 0.08, 8, 24);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xc084fc,
      emissive: 0x9333ea,
      emissiveIntensity: 0.6,
      roughness: 0.2,
    });
    this.nightEmissives.push(ringMat);
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, 1.8, -0.4);
    group.add(ring);
    this.animatedElements.push({
      mesh: ring,
      type: "rotate",
      speed: 1.2,
    });

    // Floating Mindmap Neural Nodes
    const neuralGroup = new THREE.Group();
    neuralGroup.position.set(1.4, 1.6, 0.9);

    const nodeColors = [0x60a5fa, 0xa78bfa, 0x34d399];
    const nodePositions = [
      new THREE.Vector3(-0.4, 0.3, 0),
      new THREE.Vector3(0.4, 0.1, -0.3),
      new THREE.Vector3(0, -0.3, 0.4),
    ];

    nodePositions.forEach((pos, i) => {
      const sphereGeo = new THREE.SphereGeometry(0.18, 12, 12);
      const sphereMat = new THREE.MeshStandardMaterial({
        color: nodeColors[i],
        emissive: nodeColors[i],
        emissiveIntensity: 0.4,
        roughness: 0.1,
      });
      this.nightEmissives.push(sphereMat);
      const sphere = new THREE.Mesh(sphereGeo, sphereMat);
      sphere.position.copy(pos);
      neuralGroup.add(sphere);
    });

    const lineMat = new THREE.LineBasicMaterial({ color: 0x818cf8, transparent: true, opacity: 0.7 });
    const lineGeo = new THREE.BufferGeometry().setFromPoints(nodePositions);
    const lines = new THREE.LineLoop(lineGeo, lineMat);
    neuralGroup.add(lines);

    group.add(neuralGroup);
    this.animatedElements.push({
      mesh: neuralGroup,
      type: "rotate",
      speed: 0.8,
    });
    this.animatedElements.push({
      mesh: neuralGroup,
      type: "float",
      amplitude: 0.12,
      speed: 2,
      initialY: 1.6,
    });

    // Command Quest Arcade Machine
    const arcadeBase = this.createChamferedBox(0.8, 1.2, 0.7, 0x334155, 0.4);
    arcadeBase.position.set(-1.4, 0.9, 1.0);
    arcadeBase.rotation.y = 0.4;
    group.add(arcadeBase);

    const marquee = this.createChamferedBox(0.7, 0.25, 0.15, 0xf59e0b, 0.2);
    marquee.position.set(-1.35, 1.45, 1.25);
    marquee.rotation.y = 0.4;
    group.add(marquee);

    this.registerInteractiveSector("intelligence", group);
    this.scene.add(group);
  }

  // 3. PICKLEOPS & SPORTS ARENA
  private buildPickleballArena() {
    const group = new THREE.Group();
    group.position.set(-6, 0.3, 5);
    group.userData = { sectorId: "sports" };

    const platform = this.createChamferedBox(5.6, 0.4, 5.0, this.colors.grass, 0.5);
    platform.position.y = 0.2;
    group.add(platform);

    const courtOuter = this.createChamferedBox(3.4, 0.06, 2.2, this.colors.courtBlue, 0.4);
    courtOuter.position.set(0, 0.44, 0);
    group.add(courtOuter);

    const kitchen = this.createChamferedBox(1.2, 0.07, 2.05, this.colors.courtGreen, 0.4);
    kitchen.position.set(0, 0.445, 0);
    group.add(kitchen);

    const netPostGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.45, 8);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x334155 });
    const postL = new THREE.Mesh(netPostGeo, postMat);
    postL.position.set(0, 0.65, -1.1);
    const postR = new THREE.Mesh(netPostGeo, postMat);
    postR.position.set(0, 0.65, 1.1);
    group.add(postL);
    group.add(postR);

    const netMeshGeo = new THREE.BoxGeometry(0.02, 0.3, 2.2);
    const netMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.85,
      roughness: 0.2,
    });
    const net = new THREE.Mesh(netMeshGeo, netMat);
    net.position.set(0, 0.6, 0);
    group.add(net);

    // Animated Bouncing Pickleball
    const ballGeo = new THREE.SphereGeometry(0.12, 12, 12);
    const ballMat = new THREE.MeshStandardMaterial({
      color: this.colors.ball,
      roughness: 0.3,
    });
    const ball = new THREE.Mesh(ballGeo, ballMat);
    ball.position.set(0.6, 0.65, 0.3);
    ball.castShadow = true;
    this.ballMesh = ball;
    group.add(ball);

    this.animatedElements.push({
      mesh: ball,
      type: "bounce",
      speed: 3.5,
      amplitude: 0.65,
      initialY: 0.65,
    });

    const boardBase = this.createChamferedBox(0.8, 1.1, 0.3, 0x1e293b, 0.3);
    boardBase.position.set(-1.8, 0.9, -1.2);
    boardBase.rotation.y = 0.5;
    group.add(boardBase);

    const screen = this.createChamferedBox(0.7, 0.45, 0.05, 0x10b981, 0.2);
    screen.position.set(-1.7, 1.1, -1.05);
    screen.rotation.y = 0.5;
    group.add(screen);

    this.registerInteractiveSector("sports", group);
    this.scene.add(group);
  }

  // 4. PRINCIPLES & TENETS MONOLITHS
  private buildPrinciplesMonoliths() {
    const group = new THREE.Group();
    group.position.set(6, 0.3, 5);
    group.userData = { sectorId: "principles" };

    const platform = this.createChamferedBox(5.2, 0.4, 5.0, 0xfef3c7, 0.5);
    platform.position.y = 0.2;
    group.add(platform);

    const monolithConfigs = [
      { x: -1.2, z: -0.3, h: 2.2, rot: 0.15, color: 0x3b82f6 },
      { x: 0, z: 0.8, h: 2.7, rot: -0.2, color: 0x10b981 },
      { x: 1.3, z: -0.4, h: 2.0, rot: 0.35, color: 0xf59e0b },
    ];

    monolithConfigs.forEach((cfg) => {
      const pillar = this.createChamferedBox(0.7, cfg.h, 0.4, this.colors.monolith, 0.3);
      pillar.position.set(cfg.x, 0.4 + cfg.h / 2, cfg.z);
      pillar.rotation.y = cfg.rot;
      group.add(pillar);

      const stripGeo = new THREE.BoxGeometry(0.12, cfg.h * 0.7, 0.42);
      const stripMat = new THREE.MeshStandardMaterial({
        color: cfg.color,
        emissive: cfg.color,
        emissiveIntensity: 0.5,
        roughness: 0.1,
      });
      this.nightEmissives.push(stripMat);
      const strip = new THREE.Mesh(stripGeo, stripMat);
      strip.position.set(cfg.x, 0.4 + cfg.h / 2, cfg.z);
      strip.rotation.y = cfg.rot;
      group.add(strip);
    });

    this.registerInteractiveSector("principles", group);
    this.scene.add(group);
  }

  // 5. FOUNDER NEXUS
  private buildFounderNexus() {
    const group = new THREE.Group();
    group.position.set(0, 0.3, 0);
    group.userData = { sectorId: "founder" };

    const daisGeo = new THREE.CylinderGeometry(2.8, 3.0, 0.5, 16);
    const daisMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.3,
    });
    const dais = new THREE.Mesh(daisGeo, daisMat);
    dais.position.y = 0.25;
    dais.receiveShadow = true;
    group.add(dais);

    const studioBase = this.createChamferedBox(2.0, 1.4, 2.0, 0xf8fafc, 0.2);
    studioBase.position.set(0, 1.1, 0);
    group.add(studioBase);

    const domeGeo = new THREE.SphereGeometry(0.7, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    const domeMat = new THREE.MeshStandardMaterial({
      color: this.colors.founderRoof,
      roughness: 0.1,
      metalness: 0.1,
    });
    const dome = new THREE.Mesh(domeGeo, domeMat);
    dome.position.set(0, 1.8, 0);
    group.add(dome);

    const antennaStemGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.6, 8);
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x475569 });
    const stem = new THREE.Mesh(antennaStemGeo, stemMat);
    stem.position.set(0, 2.6, 0);
    group.add(stem);

    const dishGroup = new THREE.Group();
    dishGroup.position.set(0, 2.9, 0);

    const dishGeo = new THREE.ConeGeometry(0.35, 0.2, 12, 1, true);
    const dishMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      metalness: 0.4,
      roughness: 0.2,
      side: THREE.DoubleSide,
    });
    const dish = new THREE.Mesh(dishGeo, dishMat);
    dish.rotation.x = Math.PI / 3;
    dishGroup.add(dish);
    group.add(dishGroup);

    this.animatedElements.push({
      mesh: dishGroup,
      type: "rotate",
      speed: 1.5,
    });

    const haloGeo = new THREE.RingGeometry(1.6, 1.8, 24);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0x60a5fa,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.5,
    });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.51;
    group.add(halo);

    this.animatedElements.push({
      mesh: halo,
      type: "pulse",
      speed: 2,
    });

    // Celebratory vertical light beam (hidden until triggered)
    const beamGeo = new THREE.CylinderGeometry(0.2, 0.6, 10, 16);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x60a5fa,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.set(0, 6.5, 0);
    this.founderBeam = beam;
    group.add(beam);

    this.registerInteractiveSector("founder", group);
    this.scene.add(group);
  }

  // 6. LIVING CITY ADDITIONS: Wind Turbines
  private buildWindTurbines() {
    const turbinePositions = [
      { x: -11.5, z: 2.0 },
      { x: 11.5, z: 2.0 },
    ];

    turbinePositions.forEach((pos) => {
      const turbine = new THREE.Group();
      turbine.position.set(pos.x, 0.3, pos.z);

      const mastGeo = new THREE.CylinderGeometry(0.08, 0.12, 2.5, 8);
      const mastMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
      const mast = new THREE.Mesh(mastGeo, mastMat);
      mast.position.y = 1.25;
      turbine.add(mast);

      const nacelle = this.createChamferedBox(0.25, 0.2, 0.35, 0x38bdf8, 0.2);
      nacelle.position.set(0, 2.5, 0);
      turbine.add(nacelle);

      const bladesGroup = new THREE.Group();
      bladesGroup.position.set(0, 2.5, 0.2);

      for (let b = 0; b < 3; b++) {
        const bladeGeo = new THREE.BoxGeometry(0.08, 1.2, 0.02);
        const bladeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
        const blade = new THREE.Mesh(bladeGeo, bladeMat);
        blade.position.y = 0.6;
        const pivot = new THREE.Group();
        pivot.rotation.z = (b * Math.PI * 2) / 3;
        pivot.add(blade);
        bladesGroup.add(pivot);
      }

      turbine.add(bladesGroup);
      this.scene.add(turbine);

      this.animatedElements.push({
        mesh: bladesGroup,
        type: "spin_blades",
        speed: 2.2,
      });
    });
  }

  // 7. LIVING CITY ADDITIONS: Data Courier Bots traversing paths
  private buildCourierBots() {
    const paths = [
      // Bot 1: Founder -> Fintech -> Founder
      [
        new THREE.Vector3(0, 0.6, 0),
        new THREE.Vector3(-3.5, 0.6, -2),
        new THREE.Vector3(-7, 0.6, -4),
        new THREE.Vector3(-3.5, 0.6, -2),
      ],
      // Bot 2: Founder -> AI Spire -> Founder
      [
        new THREE.Vector3(0, 0.6, 0),
        new THREE.Vector3(3.5, 0.6, -2),
        new THREE.Vector3(7, 0.6, -4),
        new THREE.Vector3(3.5, 0.6, -2),
      ],
      // Bot 3: Founder -> PickleOps -> Founder
      [
        new THREE.Vector3(0, 0.6, 0),
        new THREE.Vector3(-3, 0.6, 2.5),
        new THREE.Vector3(-6, 0.6, 5),
        new THREE.Vector3(-3, 0.6, 2.5),
      ],
      // Bot 4: Founder -> Principles -> Founder
      [
        new THREE.Vector3(0, 0.6, 0),
        new THREE.Vector3(3, 0.6, 2.5),
        new THREE.Vector3(6, 0.6, 5),
        new THREE.Vector3(3, 0.6, 2.5),
      ],
    ];

    const botColors = [0x38bdf8, 0xa855f7, 0x22c55e, 0xf59e0b];

    paths.forEach((path, idx) => {
      const botGroup = new THREE.Group();
      botGroup.position.copy(path[0]);

      // Glowing spherical bot
      const sphereGeo = new THREE.SphereGeometry(0.2, 12, 12);
      const sphereMat = new THREE.MeshStandardMaterial({
        color: botColors[idx],
        emissive: botColors[idx],
        emissiveIntensity: 0.6,
        roughness: 0.1,
      });
      this.nightEmissives.push(sphereMat);
      const sphere = new THREE.Mesh(sphereGeo, sphereMat);
      botGroup.add(sphere);

      // Mini propulsion ring
      const ringGeo = new THREE.TorusGeometry(0.25, 0.03, 6, 16);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      botGroup.add(ring);

      this.scene.add(botGroup);

      this.courierBots.push({
        mesh: botGroup,
        path,
        progress: (idx * 0.25) % 1,
        speed: 0.12,
        trailColor: botColors[idx],
      });
    });
  }

  // Connecting stone walkways
  private buildConnectingPathways() {
    const pathPoints = [
      { from: new THREE.Vector3(0, 0.35, 0), to: new THREE.Vector3(-7, 0.35, -4) },
      { from: new THREE.Vector3(0, 0.35, 0), to: new THREE.Vector3(7, 0.35, -4) },
      { from: new THREE.Vector3(0, 0.35, 0), to: new THREE.Vector3(-6, 0.35, 5) },
      { from: new THREE.Vector3(0, 0.35, 0), to: new THREE.Vector3(6, 0.35, 5) },
    ];

    pathPoints.forEach(({ from, to }) => {
      const steps = 6;
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const pos = new THREE.Vector3().lerpVectors(from, to, t);
        const stone = this.createChamferedBox(0.6, 0.08, 0.6, this.colors.path, 0.6);
        stone.position.set(pos.x, pos.y, pos.z);
        stone.rotation.y = (i % 2 === 0 ? 0.2 : -0.2);
        this.scene.add(stone);
      }
    });
  }

  // Low-poly trees
  private buildVegetation() {
    const treePositions = [
      { x: -3.5, z: -1.5, s: 1.0 },
      { x: -4.5, z: 2.2, s: 0.8 },
      { x: 3.8, z: -2.0, s: 1.1 },
      { x: 4.2, z: 2.5, s: 0.9 },
      { x: -1.5, z: -4.5, s: 0.7 },
      { x: 2.0, z: -4.2, s: 0.85 },
      { x: 0, z: 4.5, s: 1.0 },
      { x: -9.5, z: -4.0, s: 0.8 },
      { x: 9.5, z: -4.2, s: 0.8 },
    ];

    treePositions.forEach((pos) => {
      const tree = new THREE.Group();
      tree.position.set(pos.x, 0.3, pos.z);
      tree.scale.setScalar(pos.s);

      const trunkGeo = new THREE.CylinderGeometry(0.1, 0.14, 0.7, 6);
      const trunkMat = new THREE.MeshStandardMaterial({
        color: this.colors.wood,
        roughness: 0.8,
      });
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 0.35;
      trunk.castShadow = true;
      tree.add(trunk);

      const foliageGeo = new THREE.ConeGeometry(0.6, 1.1, 6);
      const foliageMat = new THREE.MeshStandardMaterial({
        color: this.colors.foliageDark,
        roughness: 0.5,
      });
      const foliage = new THREE.Mesh(foliageGeo, foliageMat);
      foliage.position.y = 1.0;
      foliage.castShadow = true;
      tree.add(foliage);

      this.scene.add(tree);
    });
  }

  // Floating fluffy clouds
  private buildClouds() {
    const cloudConfigs = [
      { x: -10, y: 7.5, z: -8, scale: 1.2 },
      { x: 8, y: 8.5, z: -6, scale: 1.0 },
      { x: -6, y: 7.0, z: 8, scale: 0.9 },
      { x: 10, y: 8.0, z: 7, scale: 1.1 },
    ];

    cloudConfigs.forEach((cfg) => {
      const cloud = new THREE.Group();
      cloud.position.set(cfg.x, cfg.y, cfg.z);
      cloud.scale.setScalar(cfg.scale);

      const cloudMat = new THREE.MeshStandardMaterial({
        color: this.colors.cloud,
        roughness: 0.3,
        transparent: true,
        opacity: 0.9,
      });

      const p1 = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 8), cloudMat);
      const p2 = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 8), cloudMat);
      p2.position.set(0.6, -0.1, 0.2);
      const p3 = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8), cloudMat);
      p3.position.set(-0.6, -0.1, -0.1);

      cloud.add(p1);
      cloud.add(p2);
      cloud.add(p3);

      this.scene.add(cloud);

      this.animatedElements.push({
        mesh: cloud,
        type: "cloud",
        speed: 0.15,
        initialPos: cloud.position.clone(),
      });
    });
  }

  // Trigger: Card Spin animation
  public triggerCardSpin() {
    if (!this.cardMeshGroup) return;
    const startRot = this.cardMeshGroup.rotation.y;
    let progress = 0;
    const interval = setInterval(() => {
      progress += 0.1;
      if (this.cardMeshGroup) {
        this.cardMeshGroup.rotation.y = startRot + Math.sin(progress) * Math.PI * 2;
      }
      if (progress >= Math.PI) {
        clearInterval(interval);
        if (this.cardMeshGroup) this.cardMeshGroup.rotation.y = startRot;
      }
    }, 16);
  }

  // Trigger: MarketLens candlestick volatility dance
  public triggerMarketDance() {
    this.candleBars.forEach((bar) => {
      const randScale = 0.5 + Math.random() * 1.2;
      bar.scale.set(1, randScale, 1);
      setTimeout(() => {
        bar.scale.set(1, 1, 1);
      }, 1200);
    });
  }

  // Trigger: Founder Nexus light beacon celebration
  public triggerBeaconPulse() {
    if (!this.founderBeam) return;
    const mat = this.founderBeam.material as THREE.MeshBasicMaterial;
    mat.opacity = 0.85;
    setTimeout(() => {
      mat.opacity = 0;
    }, 1400);
  }

  private registerInteractiveSector(sectorId: string, group: THREE.Group) {
    this.interactiveSectors.set(sectorId, {
      sectorId,
      group,
      initialY: group.position.y,
      targetY: group.position.y,
    });

    group.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.userData = { sectorId };
        this.interactiveMeshes.push(child);
      }
    });
  }
}
