import path from "node:path";
import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadBodies } from "@/lib/atlas/bodies";
import { ARM_DUST_COUNT, BACKGROUND_STAR_COUNT, buildFieldGeometry } from "../WorldSceneBuilder";
import golden from "./__fixtures__/dust-golden.json";

/**
 * The 4,500 arm-dust motes, as one number.
 *
 * `buildFieldGeometry` draws its sky and its dust from ONE `mulberry32` stream,
 * stars first. Anything that changes how many times that stream is advanced
 * before the dust loop starts — lifting the star loop into another module being
 * the obvious temptation, since the sky now belongs to the galaxy — moves every
 * mote in the map at once. It is a large, purely visual regression that no
 * placement test can see: the dust is seeded noise, so every arrangement of it
 * looks equally plausible in a screenshot and equally correct to a reviewer.
 *
 * Folded rather than stored point by point: 13,500 coordinates in a fixture
 * would be a diff nobody reads. The fold is order-sensitive, so it also catches
 * a reordering that leaves every coordinate present — which would silently
 * break the `setDrawRange` prefix the timeline transport gates dust with.
 */
function foldDust(): { checksum: number; samples: number[][] } {
  const { positions, armDustDays } = buildFieldGeometry(loadBodies(), 20260820, 1);
  const dust = positions.subarray(BACKGROUND_STAR_COUNT * 3);

  // FNV-1a over the fixed-point coordinates. Integers throughout, so the fold
  // cannot drift with floating-point summation order the way a running sum can.
  let hash = 2166136261;
  const mix = (value: number) => {
    hash ^= Math.round(value * 1e6) | 0;
    hash = Math.imul(hash, 16777619);
  };
  for (let i = 0; i < dust.length; i++) mix(dust[i]);
  for (let i = 0; i < armDustDays.length; i++) mix(armDustDays[i]);

  // Three motes by name, so a failure says WHERE the field moved rather than
  // only that it did.
  const at = (n: number) => [dust[n * 3], dust[n * 3 + 1], dust[n * 3 + 2]]
    .map((v) => Number(v.toFixed(6)));
  return {
    checksum: hash | 0,
    samples: [at(0), at(Math.floor(ARM_DUST_COUNT / 2)), at(ARM_DUST_COUNT - 1)],
  };
}

describe("the arm dust does not move", () => {
  it("draws the same number of motes it always has", () => {
    const { positions } = buildFieldGeometry(loadBodies(), 20260820, 1);
    expect(positions.length).toBe((BACKGROUND_STAR_COUNT + ARM_DUST_COUNT) * 3);
  });

  it("puts every mote where it was before the sky moved to the galaxy", () => {
    const actual = foldDust();

    if (process.env.WRITE_GOLDEN) {
      writeFileSync(
        path.resolve(process.cwd(), "src/components/world/__tests__/__fixtures__/dust-golden.json"),
        `${JSON.stringify(actual, null, 2)}\n`,
      );
    }

    expect(actual).toEqual(golden);
  });

  it("is deterministic across builds, so the gate cannot pass by luck", () => {
    expect(foldDust()).toEqual(foldDust());
  });
});
