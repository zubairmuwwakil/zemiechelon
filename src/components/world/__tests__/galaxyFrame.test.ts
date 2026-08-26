import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { GalaxyBuilder, GALAXY_SKY } from "../GalaxyBuilder";
import { MOBILE_FIELD_SCALE, BACKGROUND_STAR_COUNT } from "../WorldSceneBuilder";
import { GALAXY_ZEMI, SOLAR_SYSTEM_CHANNEL, SOLAR_SYSTEM_ZEMI } from "@/lib/atlas/scopes";
import {
  GALAXY_REACH,
  GALAXY_SKY_OUTER,
  placeSolarSystem,
  systemReach,
} from "@/lib/atlas/galaxyPlacement";
import { WorldCameraManager } from "../WorldCameraManager";
import { ASTROLABE_OUTER } from "@/lib/atlas/scale";

function built(density = 1, reducedMotion = false) {
  const scene = new THREE.Scene();
  const galaxy = new GalaxyBuilder(scene, density, reducedMotion);
  galaxy.build();
  return { scene, galaxy };
}

function sky(galaxy: GalaxyBuilder): THREE.Points {
  return galaxy.rootGroup.getObjectByName(GALAXY_SKY) as THREE.Points;
}

describe("the galaxy frame", () => {
  it("names itself for the galaxy scope", () => {
    expect(built().galaxy.rootGroup.name).toBe(GALAXY_ZEMI.id);
  });

  it("never rotates, so the sky needs no counter-rotation", () => {
    // The whole reason skyShell.rotation.y = -pattern existed: the sky rode a
    // rotating root. It does not any more.
    const { galaxy } = built();
    galaxy.update(120);
    expect(galaxy.rootGroup.rotation.y).toBe(0);
  });

  it("attaches a system at its derived centre", () => {
    const { galaxy } = built();
    const group = new THREE.Group();
    galaxy.attach(SOLAR_SYSTEM_CHANNEL, group);
    const expected = placeSolarSystem(SOLAR_SYSTEM_CHANNEL).center;
    expect(group.position.x).toBeCloseTo(expected.x, 6);
    expect(group.position.y).toBeCloseTo(expected.y, 6);
    expect(group.position.z).toBeCloseTo(expected.z, 6);
    expect(group.parent).toBe(galaxy.rootGroup);
  });

  it("leaves the repository atlas at the origin, unrotated", () => {
    // If this fails, every camera preset and pin anchor in the app is wrong.
    const { galaxy } = built();
    const group = new THREE.Group();
    galaxy.attach(SOLAR_SYSTEM_ZEMI, group);
    expect(group.position.length()).toBe(0);
    // Asserted on the quaternion, which is what three.js actually transforms
    // by. `rotation` is a decomposition of it and reports a signed -0 for a
    // composed identity; it also cannot see a stray yaw, which this does.
    expect(group.quaternion.angleTo(new THREE.Quaternion())).toBe(0);
  });

  it("hands a system's own rotation back to it, unspent by the attach", () => {
    // attach() composes a yaw-lean-unyaw. If it left a net yaw behind, the
    // system's pattern rotation would start from an offset nobody chose.
    const { galaxy } = built();
    const group = new THREE.Group();
    galaxy.attach(SOLAR_SYSTEM_CHANNEL, group);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(group.quaternion);
    const lean = up.angleTo(new THREE.Vector3(0, 1, 0));
    expect(lean).toBeCloseTo(placeSolarSystem(SOLAR_SYSTEM_CHANNEL).tilt, 6);
  });

  it("disposes its own frame off the scene", () => {
    const { scene, galaxy } = built();
    galaxy.dispose();
    expect(scene.children).not.toContain(galaxy.rootGroup);
  });
});

describe("the galaxy's sky", () => {
  it("surrounds the whole galaxy, not just the atlas", () => {
    // THE point of the task. A shell sized to the atlas's own reach tops out at
    // 205 * 2.8 = 574 units, and the channel's far rim is at GALAXY_REACH =
    // 669 — outside its own sky. Asserted on the nearest star, so a shell that
    // is merely large on average still fails.
    const geometry = sky(built().galaxy).geometry;
    const position = geometry.getAttribute("position");
    let nearest = Infinity;
    for (let i = 0; i < position.count; i++) {
      nearest = Math.min(
        nearest,
        Math.hypot(position.getX(i), position.getY(i), position.getZ(i)),
      );
    }
    expect(nearest).toBeGreaterThan(GALAXY_REACH);
    expect(GALAXY_REACH).toBeGreaterThan(systemReach(SOLAR_SYSTEM_ZEMI) * 2.8);
  });

  it("gives every star its own phase", () => {
    // FieldShader reads `attribute float aPhase` for both the twinkle and the
    // drift. A geometry without it is not an error: WebGL feeds 0.0 to every
    // vertex and the whole sky pulses in unison. Nothing else would catch it.
    const geometry = sky(built().galaxy).geometry;
    const phase = geometry.getAttribute("aPhase");
    expect(phase).toBeDefined();
    expect(phase.count).toBe(geometry.getAttribute("position").count);
    const seen = new Set<number>();
    for (let i = 0; i < 200; i++) seen.add(Number(phase.getX(i).toFixed(4)));
    expect(seen.size).toBeGreaterThan(100);
  });

  it("keeps the narrow-viewport budget the atlas's sky honoured", () => {
    const { galaxy } = built(MOBILE_FIELD_SCALE);
    expect(sky(galaxy).geometry.getAttribute("position").count).toBe(
      Math.round(BACKGROUND_STAR_COUNT * MOBILE_FIELD_SCALE),
    );
  });

  it("advances the twinkle clock on update", () => {
    const { galaxy } = built();
    const material = sky(galaxy).material as THREE.ShaderMaterial;
    galaxy.update(12);
    expect(material.uniforms.uTime.value).toBeCloseTo(12, 6);
  });

  it("holds the clock at zero when motion is reduced", () => {
    const { galaxy } = built(1, true);
    const material = sky(galaxy).material as THREE.ShaderMaterial;
    galaxy.update(12);
    expect(material.uniforms.uTime.value).toBe(0);
  });

  it("still repaints for night", () => {
    const { galaxy } = built();
    const material = sky(galaxy).material as THREE.ShaderMaterial;
    galaxy.setCosmicMode("day");
    const day = (material.uniforms.uColor.value as THREE.Color).getHex();
    galaxy.setCosmicMode("night");
    expect((material.uniforms.uColor.value as THREE.Color).getHex()).not.toBe(day);
  });
});

describe("the sky fits inside the camera that has to see it", () => {
  it("keeps the whole shell inside the far plane from anywhere the camera can orbit", () => {
    // `setFrameScale`'s own comment: "What `far` has to reach is the world, not
    // the frame" — because standing on a moon and turning away from the parent,
    // the far side of the sky is exactly what fills the view.
    //
    // The world just got bigger. The 2000-unit floor was sized when the shell
    // topped out at 205 * 2.8 = 574 units; it now reaches GALAXY_REACH * 2.8.
    // A far plane short of that clips a disc out of the middle of the sky at
    // full zoom-out — and a missing star is indistinguishable from a star that
    // was never drawn, which is why nothing else here would catch it.
    const manager = new WorldCameraManager(1280, 720);
    manager.setFrameScale(ASTROLABE_OUTER);
    const { far, maxDistance } = manager.depth;
    expect(far).toBeGreaterThanOrEqual(GALAXY_SKY_OUTER + maxDistance);
  });

  it("still reaches the sky from a surface pose, where the frame is tiny", () => {
    // A shard radius makes `radius * 10` negligible, so this is the floor's
    // job alone — and the camera is up to ASTROLABE_OUTER from the origin
    // before its own orbit distance is added.
    const manager = new WorldCameraManager(1280, 720);
    manager.setFrameScale(3.0);
    const { far, maxDistance } = manager.depth;
    expect(far).toBeGreaterThanOrEqual(GALAXY_SKY_OUTER + ASTROLABE_OUTER + maxDistance);
  });
});
