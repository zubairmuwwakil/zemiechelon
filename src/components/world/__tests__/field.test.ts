// @vitest-environment jsdom
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { WorldSceneBuilder, buildFieldGeometry } from "../WorldSceneBuilder";
import { loadBodies } from "@/lib/atlas/bodies";
import { createFieldMaterial } from "../FieldShader";
import { dateAtDay } from "@/lib/atlas/timeline";
import { SOLAR_SYSTEM_ZEMI } from "@/lib/atlas/scopes";
import { ruleFor } from "@/lib/theme/directionA";

const bodies = loadBodies();

function built() {
  const scene = new THREE.Scene();
  const builder = new WorldSceneBuilder(scene, SOLAR_SYSTEM_ZEMI, bodies, "2026-08-22", 1);
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

describe("the field is drawn at device scale", () => {
  it("carries a pixel ratio, because gl_PointSize is device pixels", () => {
    // three.js's own points path multiplies size by pixelRatio
    // (`refreshUniformsPoints`). The migration to a ShaderMaterial reproduced
    // attenuation, fog and colour but dropped this, so every grain drew at half
    // size on a dpr-2 display -- and the 12k sky, which does not attenuate, fell
    // to 0.8 CSS pixels and stopped being visible at all.
    const material = createFieldMaterial({ size: 1.6, opacity: 0.5, attenuate: false });
    expect(material.uniforms.uPixelRatio).toBeDefined();
    expect(material.uniforms.uPixelRatio.value).toBe(1);
  });

  it("lets the canvas write the ratio through to every layer", () => {
    const builder = built();
    const material = points(builder, "arm-dust").material as THREE.ShaderMaterial;
    builder.setPixelRatio(2);
    expect(material.uniforms.uPixelRatio.value).toBe(2);
  });
});

describe("the field is treated per ground", () => {
  it("carries more weight on paper than on obsidian, measured over the whole cycle", () => {
    // Dark ink on cream has no bloom lifting it -- day mode draws
    // `bloom.strength: 0` -- so the day ground needs the heavier hand.
    //
    // The comparison is on MEAN alpha, not on `uOpacity`, because the twinkle
    // floor is itself a weight: `vTwinkle` is `mix(floor, 1, 0.5 + 0.5 sin t)`,
    // whose mean is `(1 + floor) / 2`. Reading `uOpacity` alone says day is the
    // lighter ground when it is in fact the heavier one -- and treating those
    // two dials as independent is what buried the planets under the field.
    const meanAlpha = (m: THREE.ShaderMaterial) =>
      (m.uniforms.uOpacity.value as number) * (1 + (m.uniforms.uTwinkleFloor.value as number)) / 2;

    const builder = built();
    const material = points(builder, "arm-dust").material as THREE.ShaderMaterial;
    builder.setCosmicMode("day");
    const day = meanAlpha(material);
    builder.setCosmicMode("night");
    expect(day).toBeGreaterThan(meanAlpha(material));
  });

  it("keeps the field under the weight of a planet, so a planet still reads", () => {
    // A 16,500-point field and a five-pixel planet are the same mark once the
    // grains are heavy enough. The field is ground; it must stay under figure.
    const builder = built();
    const material = points(builder, "arm-dust").material as THREE.ShaderMaterial;
    builder.setCosmicMode("day");
    const mean =
      (material.uniforms.uOpacity.value as number) *
      (1 + (material.uniforms.uTwinkleFloor.value as number)) / 2;
    expect(mean).toBeLessThan(0.4);
  });

  it("never lets a grain twinkle itself off the paper", () => {
    // The floor was 0.55 - 0.45 = 0.10, which at opacity 0.5 is 0.05 alpha:
    // legible as a twinkle on obsidian, absent on paper.
    const builder = built();
    const material = points(builder, "arm-dust").material as THREE.ShaderMaterial;
    builder.setCosmicMode("day");
    expect(material.uniforms.uTwinkleFloor.value as number).toBeGreaterThanOrEqual(0.5);
  });
});

describe("the hairlines are treated per ground", () => {
  it("repaints the rules when the ground swaps", () => {
    // `rule` was one value serving two grounds and tuned for obsidian: on paper
    // an astrolabe tick at 0.55 opacity landed near 1.2:1 effective contrast.
    // The field already swapped roles on `setCosmicMode`; the rules did not.
    const builder = built();
    builder.setCosmicMode("day");
    const day = builder.ruleColors();
    builder.setCosmicMode("night");
    const night = builder.ruleColors();
    expect(day.length).toBeGreaterThan(0);
    expect(night).not.toEqual(day);
  });

  it("draws a day rule dark enough to read as a drawn line", () => {
    const builder = built();
    builder.setCosmicMode("day");
    // Paper is #F7F6F2. A rule lighter than this is a rule you cannot see.
    for (const hex of builder.ruleColors()) expect(hex).toBeLessThan(0xd3cec0);
  });
});

/**
 * Every lit solid in the tree, deduplicated by material.
 *
 * Deliberately the SCENE rather than the builder's registry: a registry can
 * only prove that what was registered is repainted, and the bug this guards is
 * a builder that never registered its materials in the first place. Walking the
 * graph asks the question the visitor asks — is anything still wearing the
 * other ground's colour.
 */
function solids(builder: WorldSceneBuilder): THREE.MeshStandardMaterial[] {
  const seen = new Set<THREE.MeshStandardMaterial>();
  builder.rootGroup.traverse((object) => {
    const material = (object as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (material && (material as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
      seen.add(material);
    }
  });
  return [...seen];
}

describe("the solids standing on the ground are treated per ground too", () => {
  it("leaves nothing on paper still wearing the obsidian rule", () => {
    // The orrery's plinth and orbit rings, a named prop's plinth, the console's
    // post. All hairline-coloured, none of them hairlines, and all of them
    // missed by the pass that fixed the rules — so on paper they sat at roughly
    // 1.2:1 against the ground a visitor was standing on.
    const builder = built();
    builder.setCosmicMode("night");
    const night = new THREE.Color(ruleFor("night")).getHex();
    const wearing = solids(builder).filter((material) => material.color.getHex() === night);
    expect(wearing.length).toBeGreaterThan(0);

    builder.setCosmicMode("day");
    const day = new THREE.Color(ruleFor("day")).getHex();
    for (const material of wearing) expect(material.color.getHex()).toBe(day);
  });

  it("does not repaint a planet's own colour", () => {
    // Gold leaf is gold on both grounds, and a shard is gold. Registering by
    // "is this hex the rule right now" instead of "does this belong to the
    // ground" would sweep the ground itself up on the day the two coincide.
    const builder = built();
    const gold = new THREE.Color("#B8860B").getHex();
    const before = solids(builder).filter((material) => material.color.getHex() === gold).length;
    expect(before).toBeGreaterThan(0);
    builder.setCosmicMode("day");
    const after = solids(builder).filter((material) => material.color.getHex() === gold).length;
    expect(after).toBe(before);
  });
});
