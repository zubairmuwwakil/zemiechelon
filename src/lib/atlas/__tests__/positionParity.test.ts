import { describe, expect, it } from "vitest";
import golden from "./__fixtures__/placement-golden.json";
import { loadBodies } from "../bodies";
import { GALAXY_ZEMI } from "../scopes";
import { derivePosition, placeBodies, trailEnd } from "../position";

const EXPECTED_COUNT = 45;

describe("scope refactor is a coordinate no-op", () => {
  const bodies = loadBodies();

  it("still loads the same number of bodies", () => {
    expect(bodies).toHaveLength(EXPECTED_COUNT);
    expect(golden.derived).toHaveLength(EXPECTED_COUNT);
  });

  it("produces byte-identical placements with the scope defaulted", () => {
    expect(placeBodies(bodies)).toEqual(golden.placements);
  });

  it("produces byte-identical placements with the scope passed explicitly", () => {
    expect(placeBodies(bodies, GALAXY_ZEMI)).toEqual(golden.placements);
  });

  it("produces byte-identical derived positions and trail ends", () => {
    const derived = bodies.map((b) => ({
      id: b.id,
      position: derivePosition(b),
      trailEnd: trailEnd(b),
    }));
    expect(derived).toEqual(golden.derived);
  });
});
