import * as THREE from "three";

/**
 * The sky and the dust, animated.
 *
 * Sixteen and a half thousand points were the largest still thing on screen and
 * the majority of its pixels. They are also the cheapest thing here to bring to
 * life: `buildFieldGeometry` scatters both layers with a seeded RNG, so no
 * individual point encodes anything and nothing is claimed by moving one.
 *
 * The one ordering that IS load-bearing is the arm dust buffer, sorted by
 * anchor birth day so the transport can gate it with a `setDrawRange` prefix.
 * Phase therefore rides a parallel attribute and displacement happens here in
 * the shader: the position buffer is read-only to this material.
 *
 * `PointsMaterial` gave three things for free that a `ShaderMaterial` does not,
 * and all three are reproduced rather than dropped — size attenuation, linear
 * fog, and a colour the day/night controller can repaint.
 */

export interface FieldMaterialOptions {
  /** Point size. World units when attenuating, pixels when not. */
  size: number;
  opacity: number;
  /** The sky does not attenuate — it must not swell on zoom. Dust does. */
  attenuate: boolean;
  /**
   * The shell is sky: fading it into the paper would delete it, since the fog
   * colour IS the paper. Dust recedes. Mirrors the old per-layer `fog` flag.
   */
  fog?: boolean;
}

/** How far a point may wander from where it was placed, as a fraction of its size. */
const BREATH = 0.35;

/** Default half-height, matching three.js's own points scale on an 800px canvas. */
export const DEFAULT_POINT_SCALE = 400;

export function createFieldMaterial(options: FieldMaterialOptions): THREE.ShaderMaterial {
  const fog = options.fog ?? options.attenuate;

  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog,
    uniforms: THREE.UniformsUtils.merge([
      fog ? THREE.UniformsLib.fog : {},
      {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(0xffffff) },
        uSize: { value: options.size },
        uOpacity: { value: options.opacity },
        // three.js sizes attenuated points by canvas half-height; kept as a
        // uniform so `setResolution` can hold it true rather than guessing.
        uScale: { value: DEFAULT_POINT_SCALE },
      },
    ]),
    vertexShader: /* glsl */ `
      attribute float aPhase;
      uniform float uTime;
      uniform float uSize;
      uniform float uScale;
      varying float vTwinkle;
      #include <fog_pars_vertex>

      void main() {
        // Each point keeps its own clock, so the field shimmers rather than
        // pulsing in unison -- which reads as a broken frame, not as a sky.
        float t = uTime * 0.6 + aPhase * 6.2831853;
        vTwinkle = 0.55 + 0.45 * sin(t);

        // A breath along the point's own radial. Bounded by its drawn size, so
        // no point can travel far enough to say something it did not before.
        vec3 drift = normalize(position + vec3(1e-4)) * (sin(t * 0.37) * uSize * ${BREATH.toFixed(2)});
        vec4 mvPosition = modelViewMatrix * vec4(position + drift, 1.0);

        ${options.attenuate ? "gl_PointSize = uSize * (uScale / -mvPosition.z);" : "gl_PointSize = uSize;"}
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying float vTwinkle;
      #include <fog_pars_fragment>

      void main() {
        // Round points. A square star is the tell that a field is a buffer.
        vec2 d = gl_PointCoord - vec2(0.5);
        float mask = 1.0 - smoothstep(0.35, 0.5, length(d));
        if (mask <= 0.0) discard;
        gl_FragColor = vec4(uColor, uOpacity * vTwinkle * mask);
        #include <fog_fragment>
      }
    `,
  });
}
