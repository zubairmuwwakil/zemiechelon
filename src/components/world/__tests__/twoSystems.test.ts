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
