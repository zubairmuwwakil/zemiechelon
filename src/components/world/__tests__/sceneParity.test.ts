// @vitest-environment jsdom
import path from "node:path";
import { writeFileSync } from "node:fs";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { loadBodies } from "@/lib/atlas/bodies";
import { WorldSceneBuilder } from "../WorldSceneBuilder";
import golden from "./__fixtures__/scene-golden.json";

const EXPECTED_COUNT = 45;

/**
 * World positions of every drawn body, read straight off the scene graph.
 *
 * Captured before `update()` is ever called: moon pivots rotate on tick, so a
 * golden taken after a frame would encode elapsed time and never reproduce.
 */
function captureWorldPositions(): Array<{ id: string; position: number[] }> {
  const scene = new THREE.Scene();
  const builder = new WorldSceneBuilder(scene, loadBodies(), "2026-08-21");
  builder.build();
  builder.rootGroup.updateMatrixWorld(true);

  const out = [...builder.bodySprites.entries()].map(([id, object]) => ({
    id,
    position: object
      .getWorldPosition(new THREE.Vector3())
      .toArray()
      .map((n) => Number(n.toFixed(6))),
  }));
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

describe("scene graph parity", () => {
  it("draws every body exactly once", () => {
    expect(captureWorldPositions()).toHaveLength(EXPECTED_COUNT);
  });

  it("puts every body where it was before the scope refactor", () => {
    const actual = captureWorldPositions();

    if (process.env.WRITE_GOLDEN) {
      writeFileSync(
        path.resolve(process.cwd(), "src/components/world/__tests__/__fixtures__/scene-golden.json"),
        `${JSON.stringify({ bodies: actual }, null, 2)}\n`,
      );
    }

    expect(actual).toEqual(golden.bodies);
  });

  it("is deterministic across builds, so the gate cannot pass by luck", () => {
    expect(captureWorldPositions()).toEqual(captureWorldPositions());
  });
});
