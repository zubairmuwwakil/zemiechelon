// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { WorldSceneBuilder } from "../WorldSceneBuilder";
import { bodiesFor } from "@/lib/atlas/bodies";
import { SOLAR_SYSTEM_CHANNEL, SOLAR_SYSTEM_ZEMI, planetScopeId } from "@/lib/atlas/scopes";

function build(scope: typeof SOLAR_SYSTEM_ZEMI) {
  const scene = new THREE.Scene();
  const builder = new WorldSceneBuilder(scene, scope, bodiesFor(scope), "2026-08-25");
  builder.build();
  return builder;
}

describe("a builder per solar system", () => {
  it("names its root for the system it was given", () => {
    expect(build(SOLAR_SYSTEM_CHANNEL).rootGroup.name).toBe(SOLAR_SYSTEM_CHANNEL.id);
    expect(build(SOLAR_SYSTEM_ZEMI).rootGroup.name).toBe(SOLAR_SYSTEM_ZEMI.id);
  });

  it("builds only its own system's planet groups", () => {
    const channel = build(SOLAR_SYSTEM_CHANNEL);
    expect(channel.scopeGroups.has(planetScopeId("products"))).toBe(false);
    const atlas = build(SOLAR_SYSTEM_ZEMI);
    expect(atlas.scopeGroups.has(planetScopeId("vlogs"))).toBe(false);
  });

  it("gives the channel no surfaces, by the rule already written", () => {
    // No engine ships behind a video, so surfaceScopeIds returns nothing for
    // this system and no guard is needed anywhere.
    const channel = build(SOLAR_SYSTEM_CHANNEL);
    expect(channel.surfaceTargets(null)).toEqual([]);
  });

  it("keeps the two scene graphs entirely separate", () => {
    const channel = build(SOLAR_SYSTEM_CHANNEL);
    const atlas = build(SOLAR_SYSTEM_ZEMI);
    for (const id of channel.scopeGroups.keys()) {
      if (id === SOLAR_SYSTEM_CHANNEL.id) continue;
      expect(atlas.scopeGroups.has(id), id).toBe(false);
    }
  });
});

/**
 * Everything under a builder's root that the builder itself uploaded.
 *
 * Gathered by asking the scene graph, the way `dispose` gathers it — so this
 * checks that the sweep reaches every node, rather than restating the list the
 * sweep walks.
 *
 * A sprite's geometry is excluded because it is not the builder's: three.js
 * hands every `Sprite` in the process the same quad. See `spriteQuad` below,
 * which asserts exactly that it survives.
 */
function gpuResources(root: THREE.Object3D) {
  const resources = new Set<THREE.BufferGeometry | THREE.Material | THREE.Texture>();
  root.traverse((object) => {
    const owner = object as THREE.Object3D & {
      geometry?: THREE.BufferGeometry;
      material?: THREE.Material | THREE.Material[];
    };
    if (owner.geometry && !(object as THREE.Sprite).isSprite) resources.add(owner.geometry);
    const materials = owner.material
      ? Array.isArray(owner.material)
        ? owner.material
        : [owner.material]
      : [];
    for (const material of materials) {
      resources.add(material);
      const map = (material as THREE.Material & { map?: THREE.Texture | null }).map;
      if (map) resources.add(map);
    }
  });
  return resources;
}

/** Which of `resources` three.js actually released. `dispose` announces itself. */
function watchDisposal(resources: Set<THREE.BufferGeometry | THREE.Material | THREE.Texture>) {
  const released = new Set<object>();
  for (const resource of resources) {
    resource.addEventListener("dispose", () => released.add(resource));
  }
  return released;
}

describe("giving the GPU back", () => {
  // `WorldCanvas` discards a builder whenever its scene-construction effect
  // re-runs — a change of handler props or anchors, or unmount. A ground swap
  // used to be on that list and repaints in place now, but the rest still
  // rebuild. What is not released here is stranded until the page is closed.
  it("releases every geometry, material and texture it uploaded", () => {
    const builder = build(SOLAR_SYSTEM_ZEMI);
    const resources = gpuResources(builder.rootGroup);
    expect(resources.size).toBeGreaterThan(0);

    const released = watchDisposal(resources);
    builder.dispose();

    const stranded = [...resources].filter((r) => !released.has(r));
    expect(stranded.map((r) => r.constructor.name)).toEqual([]);
  });

  // The quad every `Sprite` in the process shares. Disposing it would free none
  // of this builder's memory and would blank every label in the app — the other
  // system's included, and those of any scene built after this one. A sweep
  // that finds resources by walking the graph must not assume it owns them.
  it("leaves the shared sprite quad alone", () => {
    const builder = build(SOLAR_SYSTEM_ZEMI);
    let spriteQuad: THREE.BufferGeometry | null = null;
    builder.rootGroup.traverse((object) => {
      if ((object as THREE.Sprite).isSprite) spriteQuad ??= (object as THREE.Sprite).geometry;
    });
    expect(spriteQuad, "the atlas draws no sprites, so this test proves nothing").not.toBeNull();

    let released = false;
    spriteQuad!.addEventListener("dispose", () => {
      released = true;
    });
    builder.dispose();

    expect(released).toBe(false);
  });

  it("detaches its root from whatever it was hanging off", () => {
    const builder = build(SOLAR_SYSTEM_ZEMI);
    expect(builder.rootGroup.parent).not.toBeNull();
    builder.dispose();
    expect(builder.rootGroup.parent).toBeNull();
  });

  // The reason a sweep over one root is safe at all: nothing on the GPU is
  // shared between systems, so tearing one down cannot blank the other. If a
  // module-level geometry or material is ever introduced, this is what says so.
  it("leaves the other system's resources alone", () => {
    const atlas = build(SOLAR_SYSTEM_ZEMI);
    const channel = build(SOLAR_SYSTEM_CHANNEL);
    const survivors = gpuResources(channel.rootGroup);
    const released = watchDisposal(survivors);

    atlas.dispose();

    expect([...released]).toEqual([]);
  });
});
