// @vitest-environment jsdom
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { WorldSceneBuilder, buildFieldGeometry } from "../WorldSceneBuilder";
import { loadBodies } from "@/lib/atlas/bodies";
import { createFieldMaterial } from "../FieldShader";
import { dateAtDay } from "@/lib/atlas/timeline";
import { SOLAR_SYSTEM_ZEMI } from "@/lib/atlas/scopes";

const bodies = loadBodies();

function built() {
  const scene = new THREE.Scene();
  const builder = new WorldSceneBuilder(scene, bodies, "2026-08-22", 1);
  builder.build();
  return builder;
}

function points(builder: WorldSceneBuilder, name: string): THREE.Points {
  return builder.rootGroup.getObjectByName(name) as THREE.Points;
}

describe("field material", () => {
  it("carries a clock and a colour the day/night controller can write", () => {
    const material = createFieldMaterial({ size: 1.6, opacity: 0.5, attenuate: false });
    expect(material.uniforms.uTime).toBeDefined();
    expect(material.uniforms.uColor.value).toBeInstanceOf(THREE.Color);
  });
});

describe("the field is animated", () => {
  it("gives every point its own phase", () => {
    // Arm dust alone: the sky is the galaxy's now, and `galaxyFrame.test.ts`
    // makes the same assertion about it there.
    const builder = built();
    const geometry = points(builder, "arm-dust").geometry;
    const attribute = geometry.getAttribute("aPhase");
    expect(attribute).toBeDefined();
    expect(attribute.count).toBe(geometry.getAttribute("position").count);
  });

  it("draws phases that are not all the same, or nothing twinkles", () => {
    const builder = built();
    const phase = points(builder, "arm-dust").geometry.getAttribute("aPhase");
    const seen = new Set<number>();
    for (let i = 0; i < Math.min(200, phase.count); i++) seen.add(Number(phase.getX(i).toFixed(4)));
    expect(seen.size).toBeGreaterThan(100);
  });

  it("advances the clock on update", () => {
    const builder = built();
    const material = points(builder, "arm-dust").material as THREE.ShaderMaterial;
    builder.update(12, 1);
    expect(material.uniforms.uTime.value).toBeCloseTo(12, 6);
  });

  it("still repaints for night", () => {
    const builder = built();
    const material = points(builder, "arm-dust").material as THREE.ShaderMaterial;
    const day = (material.uniforms.uColor.value as THREE.Color).getHex();
    builder.setCosmicMode("night");
    expect((material.uniforms.uColor.value as THREE.Color).getHex()).not.toBe(day);
  });

  it("NEVER reorders the dust buffer, because the clock gates it by prefix", () => {
    // armDustSortedDays is ascending so setDrawRange(0, n) is exactly "every
    // dust point whose anchor already exists". Reordering silently draws the
    // wrong points at every clock day.
    const a = buildFieldGeometry(bodies, 20260820, 1);
    const b = buildFieldGeometry(bodies, 20260820, 1);
    expect(Array.from(a.positions)).toEqual(Array.from(b.positions));
    expect(Array.from(a.armDustDays)).toEqual(Array.from(b.armDustDays));
  });

  it("leaves the clock's draw-range gating alone", () => {
    const builder = built();
    builder.setClockDate(dateAtDay(0, SOLAR_SYSTEM_ZEMI.epoch));
    const early = points(builder, "arm-dust").geometry.drawRange.count;
    builder.setClockDate(dateAtDay(100000, SOLAR_SYSTEM_ZEMI.epoch));
    const late = points(builder, "arm-dust").geometry.drawRange.count;
    expect(late).toBeGreaterThan(early);
  });
});
