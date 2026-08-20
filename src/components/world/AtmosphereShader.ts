import * as THREE from "three";

export const AtmosphereVertexShader = `
  varying vec3 vNormal;
  varying vec3 vPosition;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const AtmosphereFragmentShader = `
  uniform vec3 uColor;
  uniform float uPower;
  uniform float uOpacity;

  varying vec3 vNormal;
  varying vec3 vPosition;

  void main() {
    vec3 viewDir = normalize(-vPosition);
    float fresnel = dot(viewDir, vNormal);
    fresnel = clamp(1.0 - fresnel, 0.0, 1.0);
    float intensity = pow(fresnel, uPower) * uOpacity;

    gl_FragColor = vec4(uColor, intensity);
  }
`;

export function createAtmosphericGlowMesh(
  radius: number,
  colorHex: number,
  power: number = 2.4,
  opacity: number = 0.65
): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(radius, 48, 48);
  const material = new THREE.ShaderMaterial({
    vertexShader: AtmosphereVertexShader,
    fragmentShader: AtmosphereFragmentShader,
    uniforms: {
      uColor: { value: new THREE.Color(colorHex) },
      uPower: { value: power },
      uOpacity: { value: opacity },
    },
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
  });

  return new THREE.Mesh(geometry, material);
}
