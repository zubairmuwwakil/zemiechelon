import * as THREE from "three";
import type { CosmicMode } from "./DayNightController";

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
 * `PointsMaterial` gave FOUR things for free that a `ShaderMaterial` does not,
 * and all four are reproduced rather than dropped — size attenuation, linear
 * fog, a colour the day/night controller can repaint, and the device pixel
 * ratio. The fourth was missed on the migration and is the whole reason the
 * field went quiet: `gl_PointSize` is in DEVICE pixels, three multiplies its
 * own points by `pixelRatio` (`refreshUniformsPoints`), and this shader did
 * not. Every grain drew at half size on a dpr-2 display, and the sky — which
 * does not attenuate — fell to 0.8 CSS pixels and stopped registering at all.
 */

export interface FieldMaterialOptions {
  /** Point size. World units when attenuating, CSS pixels when not. */
  size: number;
  /**
   * The layer's own weight, before the ground's treatment. `paintField` scales
   * it per mode: ink on paper has no bloom lifting it, so day asks for more.
   */
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

/**
 * How the two grounds ask for the field.
 *
 * Night has bloom (`BLOOM.night.strength` is 0.85) lifting every grain, and a
 * grain guttering to a tenth of its weight reads as a star twinkling. Day has
 * no bloom at all and the mark is ink rather than light: the same gutter is a
 * grain that is simply absent from the paper for half its cycle. So the paper
 * gets a floor high enough that no grain ever leaves it — and then LESS weight
 * to pay for it, because the floor is itself a weight: the average of
 * `mix(floor, 1, ·)` is `(1 + floor) / 2`, so lifting the floor from 0.1 to 0.5
 * already brightens the mean grain by a third. Raising both at once is what
 * buried the planets: at that density a 16,500-point field and a five-pixel
 * planet are the same mark, and the planet stops being figure against ground.
 */
export const FIELD_TREATMENT: Record<CosmicMode, { opacityScale: number; twinkleFloor: number }> =
  Object.freeze({
    day: { opacityScale: 0.85, twinkleFloor: 0.5 },
    // The values the field shipped with. Night was never the broken half.
    night: { opacityScale: 1, twinkleFloor: 0.1 },
  });

/** Apply a ground's treatment to one field layer. See `FIELD_TREATMENT`. */
export function paintField(material: THREE.ShaderMaterial, mode: CosmicMode): void {
  const treatment = FIELD_TREATMENT[mode];
  const base = (material.userData.baseOpacity as number | undefined) ?? 1;
  material.uniforms.uOpacity.value = Math.min(1, base * treatment.opacityScale);
  material.uniforms.uTwinkleFloor.value = treatment.twinkleFloor;
}

/** Default half-height, matching three.js's own points scale on an 800px canvas. */
export const DEFAULT_POINT_SCALE = 400;

export function createFieldMaterial(options: FieldMaterialOptions): THREE.ShaderMaterial {
  const fog = options.fog ?? options.attenuate;

  const material = new THREE.ShaderMaterial({
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
        uTwinkleFloor: { value: FIELD_TREATMENT.night.twinkleFloor },
        // three sizes its own points by `material.size * pixelRatio`, because
        // `gl_PointSize` is device pixels and every other length here is CSS.
        // Defaulted to 1 so a headless material is still a valid one.
        uPixelRatio: { value: 1 },
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
      uniform float uTwinkleFloor;
      uniform float uPixelRatio;
      varying float vTwinkle;
      #include <fog_pars_vertex>

      void main() {
        // Each point keeps its own clock, so the field shimmers rather than
        // pulsing in unison -- which reads as a broken frame, not as a sky.
        float t = uTime * 0.6 + aPhase * 6.2831853;
        // Floor..1, so the ground can decide how far a grain may gutter. The
        // night floor of 0.1 is the 0.55 + 0.45 * sin(t) this replaced, exactly.
        vTwinkle = mix(uTwinkleFloor, 1.0, 0.5 + 0.5 * sin(t));

        // A breath along the point's own radial. Bounded by its drawn size, so
        // no point can travel far enough to say something it did not before.
        vec3 drift = normalize(position + vec3(1e-4)) * (sin(t * 0.37) * uSize * ${BREATH.toFixed(2)});
        vec4 mvPosition = modelViewMatrix * vec4(position + drift, 1.0);

        ${
          options.attenuate
            ? "gl_PointSize = uSize * uPixelRatio * (uScale / -mvPosition.z);"
            : "gl_PointSize = uSize * uPixelRatio;"
        }
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

  // The layer's own weight, kept so `paintField` can scale it per ground
  // without the two of them drifting into one hard-coded number each.
  material.userData.baseOpacity = options.opacity;
  return material;
}
