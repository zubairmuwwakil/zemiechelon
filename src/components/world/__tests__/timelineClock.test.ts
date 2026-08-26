// @vitest-environment jsdom
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { loadBodies } from "@/lib/atlas/bodies";
import { daysSinceEpoch } from "@/lib/atlas/position";
import { dateAtDay, visibleBodyIds } from "@/lib/atlas/timeline";
import { SOLAR_SYSTEM_ZEMI } from "@/lib/atlas/scopes";
import { WorldSceneBuilder } from "../WorldSceneBuilder";

const bodies = loadBodies();
const fullSpan = Math.max(...bodies.map((b) => daysSinceEpoch(b.bornAt)));

/** setClockDate resolves a date, not a day — this file still thinks in days. */
const asDate = (day: number) => dateAtDay(day, SOLAR_SYSTEM_ZEMI.epoch);

function build(): WorldSceneBuilder {
  const scene = new THREE.Scene();
  const builder = new WorldSceneBuilder(scene, bodies, "2026-08-21");
  builder.build();
  builder.rootGroup.updateMatrixWorld(true);
  return builder;
}

/** World positions of every body the builder currently shows as visible. */
function visiblePositions(builder: WorldSceneBuilder): Map<string, number[]> {
  const out = new Map<string, number[]>();
  for (const [id, object] of builder.bodySprites.entries()) {
    if (!object.visible) continue;
    out.set(
      id,
      object.getWorldPosition(new THREE.Vector3()).toArray().map((n) => Number(n.toFixed(6))),
    );
  }
  return out;
}

describe("WorldSceneBuilder.setClockDate — visibility", () => {
  it("draws a body if and only if its bornAt is at or before the clock", () => {
    const builder = build();
    builder.setClockDate(asDate(150));

    const expected = visibleBodyIds(bodies, 150);
    const shown = new Set(
      [...builder.bodySprites.entries()].filter(([, o]) => o.visible).map(([id]) => id),
    );
    expect(shown).toEqual(expected);
  });

  it("shows every body once the clock reaches the full span", () => {
    const builder = build();
    builder.setClockDate(asDate(fullSpan));
    const shown = [...builder.bodySprites.entries()].filter(([, o]) => o.visible);
    expect(shown).toHaveLength(bodies.length);
  });

  it("shows only the epoch's own bodies at day zero", () => {
    const builder = build();
    builder.setClockDate(asDate(0));
    const expected = visibleBodyIds(bodies, 0);
    const shown = new Set(
      [...builder.bodySprites.entries()].filter(([, o]) => o.visible).map(([id]) => id),
    );
    expect(shown).toEqual(expected);
  });
});

describe("WorldSceneBuilder.setClockDate — placement purity", () => {
  it("never moves a body that is visible at two different clock days", () => {
    const builder = build();

    builder.setClockDate(asDate(100));
    const early = visiblePositions(builder);

    builder.setClockDate(asDate(fullSpan));
    const late = visiblePositions(builder);

    for (const [id, pos] of early) {
      expect(late.get(id), `${id} vanished as the clock advanced`).toEqual(pos);
    }
  });

  it("is byte-identical to the un-gated golden positions for every visible body", () => {
    const golden = build();
    golden.setClockDate(asDate(fullSpan));
    const full = visiblePositions(golden);

    for (const day of [0, 60, 130, 200, fullSpan]) {
      const builder = build();
      builder.setClockDate(asDate(day));
      for (const [id, pos] of visiblePositions(builder)) {
        expect(full.get(id), `${id} at day ${day}`).toEqual(pos);
      }
    }
  });
});

describe("WorldSceneBuilder.setClockDate — hit-test gating", () => {
  it("does not let an unborn body be raycast-hittable", () => {
    const builder = build();
    builder.setClockDate(asDate(0));

    const stillHidden = builder.hitObjects.find(
      (h) => h.type === "body" && h.id === "PickMe",
    )!;
    expect(builder.isHitVisible(stillHidden)).toBe(false);
  });

  it("keeps the galaxy core always hittable", () => {
    const builder = build();
    builder.setClockDate(asDate(0));
    const core = builder.hitObjects.find((h) => h.id === "solarSystem")!;
    expect(builder.isHitVisible(core)).toBe(true);
  });

  it("gates a planet as unhittable before its arm's first repository", () => {
    const builder = build();
    builder.setClockDate(asDate(0));
    const products = builder.hitObjects.find((h) => h.type === "planet" && h.id === "products")!;
    expect(builder.isHitVisible(products)).toBe(false);
  });
});

describe("WorldSceneBuilder.setClockDate — arm dust", () => {
  function dustDrawCount(builder: WorldSceneBuilder): number {
    const dust = builder.rootGroup.getObjectByName("arm-dust") as THREE.Points;
    return dust.geometry.drawRange.count;
  }

  it("draws fewer dust points early than at the full span", () => {
    const builder = build();
    builder.setClockDate(asDate(0));
    const early = dustDrawCount(builder);
    builder.setClockDate(asDate(fullSpan));
    const full = dustDrawCount(builder);
    expect(early).toBeLessThan(full);
  });

  it("never shrinks the dust draw range as the clock advances", () => {
    const builder = build();
    let previous = -1;
    for (const day of [0, 40, 90, 150, 220, fullSpan]) {
      builder.setClockDate(asDate(day));
      const count = dustDrawCount(builder);
      expect(count).toBeGreaterThanOrEqual(previous);
      previous = count;
    }
  });
});
