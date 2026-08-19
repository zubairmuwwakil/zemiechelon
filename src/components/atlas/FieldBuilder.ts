import * as THREE from "three";
import type { Body, ArmId } from "@/lib/atlas/types";
import { placeBodies, ARM_ANGLES, WIND_RATE, daysSinceEpoch, radiusScale, BULGE } from "@/lib/atlas/position";
import { magnitude, temperature } from "@/lib/atlas/magnitude";

const RAMP: Array<[number, number]> = [
  [0.0, 0x27272a], // obsidian - cold
  [0.5, 0x047857], // emerald - living
  [0.78, 0xd97706], // deep gold
  [1.0, 0xfbbf24], // gold leaf - frontier
];

function hexToRgb(h: number): [number, number, number] {
  return [(h >> 16) & 255, (h >> 8) & 255, h & 255];
}

function rgbToHex(r: number, g: number, b: number): number {
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}

function getTemperatureColor(t: number): THREE.Color {
  const x = Math.max(0, Math.min(1, t));
  for (let i = 1; i < RAMP.length; i++) {
    if (x <= RAMP[i][0]) {
      const [t0, c0] = RAMP[i - 1];
      const [t1, c1] = RAMP[i];
      const k = (x - t0) / (t1 - t0);
      const [r0, g0, b0] = hexToRgb(c0);
      const [r1, g1, b1] = hexToRgb(c1);
      const r = r0 + (r1 - r0) * k;
      const g = g0 + (g1 - g0) * k;
      const b = b0 + (b1 - b0) * k;
      return new THREE.Color(rgbToHex(r, g, b));
    }
  }
  return new THREE.Color(RAMP[RAMP.length - 1][1]);
}

/**
 * Procedurally builds and manages the WebGL field layer:
 * 1. Background stars (>= 10,000 points scattered spherically)
 * 2. Arm dust (points sampled along logarithmic arm spirals)
 * 3. Body trails (lines connecting birth position to last-touched position)
 * 4. Body sprites/systems (stars, discs, system rings, and satellite dots)
 *
 * Fully data-driven: no per-body branch methods, no 3D raycasting/picking.
 */
export class FieldBuilder {
  public readonly bodySprites: Map<string, THREE.Object3D> = new Map();
  public readonly trailLines: THREE.Line[] = [];
  public readonly backgroundStarCount = 12_000;

  private built = false;
  private rootGroup = new THREE.Group();
  private satellites: Array<{ mesh: THREE.Mesh; orbitRadius: number; speed: number; phase: number }> = [];

  constructor(
    private scene: THREE.Scene,
    private bodies: Body[],
    private today: string,
  ) {
    this.rootGroup.name = "atlas-field-root";
  }

  public build(): void {
    if (this.built) return;
    this.built = true;

    this.scene.add(this.rootGroup);

    this.buildBackgroundStars();
    this.buildArmDust();
    this.buildTrailsAndBodies();
  }

  private buildBackgroundStars(): void {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.backgroundStarCount * 3);
    const colors = new Float32Array(this.backgroundStarCount * 3);

    const baseColor = new THREE.Color(0x27272a);
    const warmInk = new THREE.Color(0x78716c);

    for (let i = 0; i < this.backgroundStarCount; i++) {
      // Distribute randomly across an expansive spherical dome
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 180 + Math.random() * 220;

      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = Math.abs(r * Math.cos(phi)) * 0.7 + 10; // Keep slightly domed above the plane
      const z = r * Math.sin(phi) * Math.sin(theta);

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      const starColor = Math.random() > 0.8 ? warmInk : baseColor;
      colors[i * 3] = starColor.r;
      colors[i * 3 + 1] = starColor.g;
      colors[i * 3 + 2] = starColor.b;
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.9,
      vertexColors: true,
      transparent: true,
      opacity: 0.28,
      sizeAttenuation: true,
    });

    const starPoints = new THREE.Points(geometry, material);
    this.rootGroup.add(starPoints);
  }

  private buildArmDust(): void {
    const dustCountPerArm = 800;
    const arms = Object.keys(ARM_ANGLES) as ArmId[];
    const totalDust = dustCountPerArm * arms.length;

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(totalDust * 3);
    const colors = new Float32Array(totalDust * 3);

    let idx = 0;
    const inkColor = new THREE.Color(0x27272a);
    const goldDust = new THREE.Color(0xd97706);

    for (const arm of arms) {
      const baseAngle = ARM_ANGLES[arm];
      for (let i = 0; i < dustCountPerArm; i++) {
        const t = i / dustCountPerArm;
        const radius = BULGE + t * 24 + (Math.random() - 0.5) * 1.5;
        const theta = baseAngle + WIND_RATE * Math.log(1 + radius) + (Math.random() - 0.5) * 0.25;

        const x = Math.cos(theta) * radius;
        const y = (Math.random() - 0.5) * 0.2; // Keep extremely close to plane
        const z = Math.sin(theta) * radius;

        positions[idx * 3] = x;
        positions[idx * 3 + 1] = y;
        positions[idx * 3 + 2] = z;

        const col = Math.random() > 0.85 ? goldDust : inkColor;
        colors[idx * 3] = col.r;
        colors[idx * 3 + 1] = col.g;
        colors[idx * 3 + 2] = col.b;

        idx++;
      }
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.7,
      vertexColors: true,
      transparent: true,
      opacity: 0.35,
      sizeAttenuation: true,
    });

    const dustCloud = new THREE.Points(geometry, material);
    this.rootGroup.add(dustCloud);
  }

  private buildTrailsAndBodies(): void {
    const placements = placeBodies(this.bodies);
    const placementMap = new Map(placements.map((p) => [p.id, p]));

    for (const body of this.bodies) {
      const placement = placementMap.get(body.id);
      if (!placement) continue;

      const mag = magnitude(body);
      const temp = temperature(body, this.today);
      const col = getTemperatureColor(temp);

      // 1. Trail Line: from birth position to lastTouched trailEnd along spiral lane
      const birthRadius = Math.max(radiusScale(daysSinceEpoch(body.bornAt)), BULGE);
      const touchRadius = Math.max(radiusScale(daysSinceEpoch(body.lastTouchedAt)), BULGE);
      const lane = placement.lane;
      const armAngle = ARM_ANGLES[body.arm];

      const sampleCount = Math.max(2, Math.min(32, Math.ceil((touchRadius - birthRadius) * 4)));
      const linePoints: THREE.Vector3[] = [];

      for (let s = 0; s < sampleCount; s++) {
        const frac = s / (sampleCount - 1);
        const r = birthRadius + (touchRadius - birthRadius) * frac;
        const theta = armAngle + WIND_RATE * Math.log(1 + r) + lane;
        linePoints.push(new THREE.Vector3(Math.cos(theta) * r, 0, Math.sin(theta) * r));
      }

      const trailGeo = new THREE.BufferGeometry().setFromPoints(linePoints);
      const trailMat = new THREE.LineBasicMaterial({
        color: col,
        transparent: true,
        opacity: Math.max(0.12, Math.min(0.65, 0.15 + temp * 0.35 + mag * 0.05)),
      });
      const trailLine = new THREE.Line(trailGeo, trailMat);
      this.trailLines.push(trailLine);
      this.rootGroup.add(trailLine);

      // 2. Body Sprite / Node Group
      const bodyGroup = new THREE.Group();
      bodyGroup.name = `body-${body.id}`;
      bodyGroup.position.set(placement.position.x, 0, placement.position.z);

      const discRadius = Math.max(0.08, 0.08 + mag * 0.04);
      const circleGeo = new THREE.CircleGeometry(discRadius, 24);
      circleGeo.rotateX(-Math.PI / 2); // Lay flat on XZ disk plane

      const discMat = new THREE.MeshBasicMaterial({
        color: col,
        side: THREE.DoubleSide,
      });
      const discMesh = new THREE.Mesh(circleGeo, discMat);
      bodyGroup.add(discMesh);

      // System bodies get an outer orbit ring + satellite dots
      if (body.kind === "system") {
        const ringGeo = new THREE.RingGeometry(discRadius * 1.5, discRadius * 1.5 + 0.02, 32);
        ringGeo.rotateX(-Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({
          color: col,
          transparent: true,
          opacity: 0.5,
          side: THREE.DoubleSide,
        });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        bodyGroup.add(ringMesh);

        const satelliteCount = body.satellites?.length ?? 2;
        for (let k = 0; k < satelliteCount; k++) {
          const satGeo = new THREE.CircleGeometry(0.03, 12);
          satGeo.rotateX(-Math.PI / 2);
          const satMat = new THREE.MeshBasicMaterial({
            color: col,
            side: THREE.DoubleSide,
          });
          const satMesh = new THREE.Mesh(satGeo, satMat);
          const orbitR = discRadius * 2.2 + k * 0.12;
          const phase = (k * 2 * Math.PI) / satelliteCount;
          satMesh.position.set(Math.cos(phase) * orbitR, 0, Math.sin(phase) * orbitR);
          bodyGroup.add(satMesh);

          this.satellites.push({
            mesh: satMesh,
            orbitRadius: orbitR,
            speed: 0.8 + k * 0.4,
            phase,
          });
        }
      }

      this.bodySprites.set(body.id, bodyGroup);
      this.rootGroup.add(bodyGroup);
    }
  }

  public update(elapsed: number): void {
    // Subtle satellite rotation around system nodes
    for (const sat of this.satellites) {
      const angle = sat.phase + elapsed * sat.speed;
      sat.mesh.position.set(
        Math.cos(angle) * sat.orbitRadius,
        0,
        Math.sin(angle) * sat.orbitRadius,
      );
    }
  }
}
