import * as THREE from "three";
import { DIRECTION_A } from "@/lib/theme/directionA";

export interface SurfaceFamily {
  arm: string;
  /** Branch selector in the shared fragment shader. */
  pattern: number;
  /** Radians per second. All slow: slow reads as alive, fast as a screensaver. */
  rotationRate: number;
  baseColor: string;
  accentColor: string;
}

/**
 * One entry per arm across the whole galaxy, not five colours of one object.
 *
 * Foundations carries banded sediment because ZemiMark.tsx is already a
 * stratified cross-section with obsidian at its base — putting that geology on
 * the origin planet makes the mark and the map say the same thing.
 *
 * Direction A has five hues for five atlas planets, one of which is the
 * ground itself, so Labs and Creative already share a base and an accent —
 * the palette's limit rather than an oversight. The channel's four arms reuse
 * that same five-hue set rather than widening the palette, for the same
 * reason. Every arm is still told apart by surface pattern and rotation rate,
 * which is what §5.1 asks identity to come from.
 */
export const SURFACE_FAMILIES: Record<string, SurfaceFamily> = {
  foundations: {
    arm: "foundations",
    pattern: 0, // banded sediment strata
    rotationRate: 0.004,
    baseColor: DIRECTION_A.ink,
    accentColor: DIRECTION_A.rule,
  },
  products: {
    arm: "products",
    pattern: 1, // gas-giant bands
    rotationRate: 0.011,
    baseColor: DIRECTION_A.gold,
    accentColor: DIRECTION_A.oxide,
  },
  labs: {
    arm: "labs",
    pattern: 2, // fractured crystalline shell
    rotationRate: 0.018,
    baseColor: DIRECTION_A.oxide,
    accentColor: DIRECTION_A.gold,
  },
  self: {
    arm: "self",
    pattern: 3, // ocean and cloud
    rotationRate: 0.008,
    baseColor: DIRECTION_A.verdigris,
    accentColor: DIRECTION_A.ground,
  },
  creative: {
    arm: "creative",
    pattern: 4, // molten ember crust
    rotationRate: 0.026,
    baseColor: DIRECTION_A.oxide,
    accentColor: DIRECTION_A.gold,
  },
  vlogs: {
    arm: "vlogs",
    pattern: 0, // banded sediment strata
    rotationRate: 0.006,
    baseColor: DIRECTION_A.verdigris,
    accentColor: DIRECTION_A.rule,
  },
  shorts: {
    arm: "shorts",
    pattern: 3, // ocean and cloud
    rotationRate: 0.022,
    baseColor: DIRECTION_A.gold,
    accentColor: DIRECTION_A.ink,
  },
  tutorials: {
    arm: "tutorials",
    pattern: 1, // gas-giant bands
    rotationRate: 0.009,
    baseColor: DIRECTION_A.oxide,
    accentColor: DIRECTION_A.gold,
  },
  devlogs: {
    arm: "devlogs",
    pattern: 2, // fractured crystalline shell
    rotationRate: 0.014,
    baseColor: DIRECTION_A.ink,
    accentColor: DIRECTION_A.verdigris,
  },
};

/** Per-instance attribute names, so the builder and the shader cannot drift. */
export const PLANET_ATTRIBUTES = {
  pattern: "aPattern",
  spin: "aSpin",
  base: "aBase",
  accent: "aAccent",
} as const;

/**
 * ONE material for all five planets. Five bespoke materials means five
 * draw-call groups and five compile paths for what is one family of surfaces;
 * it costs nothing to do this way from the start and is a rewrite later.
 *
 * Per-planet variation rides on instance attributes, not on separate programs.
 * `instanceMatrix` is declared by three.js itself when the material is used on
 * an InstancedMesh — redeclaring it here is a compile error.
 *
 * Rotation happens on the *sampling* coordinate rather than the geometry. A
 * sphere is rotationally symmetric, so spinning the pattern and spinning the
 * mesh are indistinguishable — except this way the CPU never rewrites an
 * instance matrix, and the raking light stays where it is instead of orbiting
 * with the planet.
 */
export function createPlanetMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      // Seeded to the day palette's own bearing so the first frame is lit
      // before `setLightDirection` has ever been called.
      uLightDir: { value: new THREE.Vector3(30, 60, 30).normalize() },
    },
    vertexShader: /* glsl */ `
      attribute float aPattern;
      attribute float aSpin;
      attribute vec3 aBase;
      attribute vec3 aAccent;
      varying float vPattern;
      varying float vSpin;
      varying vec3 vBase;
      varying vec3 vAccent;
      varying vec3 vNormal;
      varying vec3 vWorldNormal;
      varying vec3 vLocal;
      void main() {
        vPattern = aPattern;
        vSpin = aSpin;
        vBase = aBase;
        vAccent = aAccent;
        // Through instanceMatrix as well. normalMatrix alone is correct only
        // while instances are pure scale and translation -- uniform scale does
        // not change a normal's direction, but a tilt does, and a tilted planet
        // lit by the old expression is lit as though it were upright.
        // (No backticks in here: this is inside a JS template literal.)
        vNormal = normalize(normalMatrix * mat3(instanceMatrix) * normal);
        // World space, so the lit side belongs to the sun rather than to the
        // viewer. vNormal stays view-space for the engraved raking term.
        vWorldNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
        vLocal = position;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uLightDir;
      varying float vPattern;
      varying float vSpin;
      varying vec3 vBase;
      varying vec3 vAccent;
      varying vec3 vNormal;
      varying vec3 vWorldNormal;
      varying vec3 vLocal;

      float bands(float y, float freq) {
        return smoothstep(0.35, 0.65, fract(y * freq));
      }

      vec3 spun(vec3 p, float a) {
        float s = sin(a);
        float c = cos(a);
        return vec3(c * p.x + s * p.z, p.y, c * p.z - s * p.x);
      }

      float hash31(vec3 p) {
        p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }

      /** Value noise. Cheap, and five spheres is the whole budget it serves. */
      float vnoise(vec3 x) {
        vec3 i = floor(x);
        vec3 f = fract(x);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(mix(hash31(i + vec3(0.0, 0.0, 0.0)), hash31(i + vec3(1.0, 0.0, 0.0)), f.x),
              mix(hash31(i + vec3(0.0, 1.0, 0.0)), hash31(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
          mix(mix(hash31(i + vec3(0.0, 0.0, 1.0)), hash31(i + vec3(1.0, 0.0, 1.0)), f.x),
              mix(hash31(i + vec3(0.0, 1.0, 1.0)), hash31(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
          f.z);
      }

      void main() {
        vec3 n = spun(normalize(vLocal), uTime * vSpin);
        float mixAmount = 0.0;

        if (vPattern < 0.5) {
          // Sediment strata: hard, level, and broken by the odd unconformity —
          // the mark's cross-section, wrapped onto the oldest planet.
          float strata = bands(n.y + vnoise(n * 2.0) * 0.05, 7.0);
          mixAmount = strata * (0.65 + 0.35 * step(0.5, fract(n.y * 3.0)));
        } else if (vPattern < 1.5) {
          // Gas-giant bands, with the flow sheared along each band.
          float y = n.y + vnoise(vec3(n.x * 3.0, n.y * 9.0, n.z * 3.0)) * 0.06;
          mixAmount = bands(y, 3.0) * 0.7 + bands(y, 11.0) * 0.15;
        } else if (vPattern < 2.5) {
          // Fractured crystalline shell: a regular lattice, so it reads as grown
          // rather than eroded, with the fissures breathing.
          float f = abs(sin(n.x * 9.0) * sin(n.z * 9.0));
          mixAmount = smoothstep(0.82, 0.94, f) * (0.6 + 0.4 * sin(uTime * 0.6));
        } else if (vPattern < 3.5) {
          // Ocean and cloud. The cloud deck turns off the surface rate, which is
          // the whole reason this planet reads as weather rather than as paint.
          float land = smoothstep(0.48, 0.56, vnoise(n * 2.6));
          vec3 c = spun(normalize(vLocal), uTime * vSpin * 2.4);
          float cloud = smoothstep(0.54, 0.78, vnoise(c * 4.2 + vec3(0.0, uTime * 0.01, 0.0)));
          mixAmount = max(land * 0.55, cloud);
        } else {
          // Molten ember crust: cells of cooled plate with the seams still hot.
          float cell = vnoise(n * 5.5);
          float seam = 1.0 - smoothstep(0.0, 0.11, abs(cell - 0.5));
          mixAmount = seam * (0.55 + 0.45 * sin(uTime * 0.8 + cell * 24.0));
        }

        // Raking light rather than emission: this treatment is engraved, not lit.
        // The scene's actual sun, not a direction typed into a shader. This is
        // what gives every planet a terminator that crawls -- and what puts the
        // planets and the MeshStandardMaterial moons under one light at last.
        float lambert = clamp(dot(normalize(vWorldNormal), uLightDir), 0.0, 1.0);
        vec3 albedo = mix(vBase, vAccent, clamp(mixAmount, 0.0, 1.0));
        gl_FragColor = vec4(albedo * (0.55 + 0.45 * lambert), 1.0);
      }
    `,
  });
}
