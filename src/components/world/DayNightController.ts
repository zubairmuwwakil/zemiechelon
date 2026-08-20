import * as THREE from "three";

export type CosmicMode = "day" | "night";

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
  groundBaseColor: number;
  groundGrassColor: number;
  roadColor: number;
  accentGold: number;
  accentEmerald: number;
  emissiveIntensity: number;
}

export const DAY_PALETTE: DayNightPalette = {
  background: 0xf7f6f2, // Luxury warm parchment/cream
  ambientLight: 0xfffbf5,
  ambientIntensity: 1.6,
  sunLight: 0xfff7ed,
  sunIntensity: 1.8,
  sunPosition: [30, 60, 30],
  fogColor: 0xf7f6f2,
  fogNear: 100,
  fogFar: 350,
  groundBaseColor: 0xe5e2db,
  groundGrassColor: 0x86efac,
  roadColor: 0xe5e2db,
  accentGold: 0xd97706,
  accentEmerald: 0x059669,
  emissiveIntensity: 0.1,
};

export const NIGHT_PALETTE: DayNightPalette = {
  background: 0x09090b, // Deep luxury obsidian cosmos
  ambientLight: 0x18181b,
  ambientIntensity: 0.9,
  sunLight: 0x38bdf8, // Subtle cyan-rim moonlight
  sunIntensity: 1.4,
  sunPosition: [-25, 45, -25],
  fogColor: 0x09090b,
  fogNear: 110,
  fogFar: 380,
  groundBaseColor: 0x18181b,
  groundGrassColor: 0x064e3b,
  roadColor: 0x27272a,
  accentGold: 0xfbbf24,
  accentEmerald: 0x10b981,
  emissiveIntensity: 0.85,
};

export class DayNightController {
  private currentMode: CosmicMode = "day";
  private transitionProgress: number = 0; // 0 = day, 1 = night
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
    this.directionalSun.position.set(...palette.sunPosition);
    this.directionalSun.castShadow = true;
    this.directionalSun.shadow.mapSize.width = 2048;
    this.directionalSun.shadow.mapSize.height = 2048;
    this.directionalSun.shadow.camera.near = 0.5;
    this.directionalSun.shadow.camera.far = 150;
    const d = 35;
    this.directionalSun.shadow.camera.left = -d;
    this.directionalSun.shadow.camera.right = d;
    this.directionalSun.shadow.camera.top = d;
    this.directionalSun.shadow.camera.bottom = -d;
    this.directionalSun.shadow.bias = -0.0005;

    this.scene.add(this.directionalSun);
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

    this.directionalSun.position.lerpVectors(
      new THREE.Vector3(...day.sunPosition),
      new THREE.Vector3(...night.sunPosition),
      t
    );
  }

  public getProgress(): number {
    return this.transitionProgress;
  }
}
