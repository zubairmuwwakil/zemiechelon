import { describe, expect, it } from "vitest";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { loadBodies } from "../bodies";
import { planetScopeId } from "../galaxy";
import { moonScopeId } from "../galaxy";
import { deriveMoonScopes, SCOPES } from "../scopes";
import {
  declaresSurface,
  shardRadiusFor,
  surfacePropsFor,
  surfaceScopeIds,
  SHARD_RADIUS_MULTIPLE,
  SURFACE_ALTITUDE_RATIO,
  SURFACE_OFFSET_RATIO,
} from "../surfaces";
import { ENGINE_IDS } from "@/lib/engines/registry";

const bodies = loadBodies();

describe("moon scopes", () => {
  it("makes one scope per shipped system, and nothing else", () => {
    const systems = bodies.filter((b) => b.kind === "system");
    expect(deriveMoonScopes(bodies).map((s) => s.id).sort()).toEqual(
      systems.map((b) => moonScopeId(b.id)).sort(),
    );
  });

  it("parents each moon scope to its own planet", () => {
    for (const scope of deriveMoonScopes(bodies)) {
      const body = bodies.find((b) => moonScopeId(b.id) === scope.id)!;
      expect(scope.parent).toBe(planetScopeId(body.arm));
    }
  });

  it("takes its epoch from the body's own birth, not the galaxy's", () => {
    for (const scope of deriveMoonScopes(bodies)) {
      const body = bodies.find((b) => moonScopeId(b.id) === scope.id)!;
      expect(scope.epoch).toBe(body.bornAt);
    }
  });

  it("registers every moon scope in the scope table", () => {
    for (const scope of deriveMoonScopes(bodies)) {
      expect(SCOPES[scope.id]).toBeDefined();
    }
  });
});

describe("the engine registry", () => {
  it("names every engine that ships, so the list cannot go stale silently", () => {
    const dir = join(process.cwd(), "src/lib/engines");
    const onDisk = readdirSync(dir).filter((name) =>
      statSync(join(dir, name)).isDirectory(),
    );
    expect([...ENGINE_IDS].sort()).toEqual(onDisk.sort());
  });
});

describe("which scopes you can stand on", () => {
  it("gives a surface to PickMe and to Products, and to nothing else", () => {
    expect(surfaceScopeIds(bodies).sort()).toEqual(
      [moonScopeId("PickMe"), planetScopeId("products")].sort(),
    );
  });

  it("withholds one from a console with no engine behind it", () => {
    // Inunity carries a consoleId, but the console is a mockup: no engine
    // ships for it. Spec §3.3 — a flyby becomes a landing when it earns
    // evidence, and this is the predicate that decides.
    const inunity = bodies.find((b) => b.consoleId === "inunity");
    expect(inunity).toBeDefined();
    expect(ENGINE_IDS.has("inunity")).toBe(false);
    expect(declaresSurface(moonScopeId(inunity!.id), bodies)).toBe(false);
  });

  it("withholds one from a planet whose arm has no evidence", () => {
    // Labs ships agent-orchestrator, which has no console at all.
    expect(declaresSurface(planetScopeId("labs"), bodies)).toBe(false);
  });

  it("withholds one from the galaxy — you do not stand on a frame of reference", () => {
    expect(declaresSurface("galaxy:zemi", bodies)).toBe(false);
  });
});

describe("shard geometry", () => {
  it("sizes a shard against the body's own drawn radius", () => {
    const moon = shardRadiusFor(moonScopeId("PickMe"), bodies);
    // PickMe is drawn at planet.radius * MOON_SIZE = 2.0124 scene units.
    expect(moon).toBeCloseTo(2.0124 * SHARD_RADIUS_MULTIPLE, 2);
  });

  it("keeps every shard inside the band the spike measured", () => {
    // Floor: the near plane must clear the ground at 0.202 * R.
    // Ceiling: the shard must not reach the neighbouring moon's orbit lane.
    for (const scopeId of surfaceScopeIds(bodies)) {
      const radius = shardRadiusFor(scopeId, bodies);
      expect(radius).toBeGreaterThan(2.5);
      expect(radius).toBeLessThan(4.5 * 3);
    }
  });

  it("throws for a scope with no surface, rather than returning a plausible number", () => {
    expect(() => shardRadiusFor(planetScopeId("labs"), bodies)).toThrow(/no surface/);
  });

  it("keeps the landed pose at the measured ratios", () => {
    // Measured: altitude 0.10 R and offset 0.65 R give pitch 8.7 degrees,
    // which is inside the 5-12 degree band and well under the 21 degree
    // ceiling where the parent leaves the top of frame.
    const pitch = (Math.atan2(SURFACE_ALTITUDE_RATIO, SURFACE_OFFSET_RATIO) * 180) / Math.PI;
    expect(pitch).toBeGreaterThan(5);
    expect(pitch).toBeLessThan(12);
  });
});

describe("what stands on a surface", () => {
  it("puts Products' supporting repositories on Products' ground", () => {
    // Spec §3.5: the seven non-shipped repositories become the props, while
    // the four shipped ventures orbit overhead.
    const props = surfacePropsFor(planetScopeId("products"), bodies);
    expect(props.map((p) => p.id).sort()).toEqual(
      [
        "BloombergProject",
        "Pickleball_League_Score_Tracker",
        "market-data-pipeline",
        "pb_score_keeper",
        "pickleball-league-template",
        "pickleball-session-manager",
        "return-saas",
      ].sort(),
    );
  });

  it("puts a moon's own satellites on the moon's ground", () => {
    // Spec §4: lands on its surface, three satellites around them.
    const pickme = bodies.find((b) => b.id === "PickMe")!;
    const props = surfacePropsFor(moonScopeId("PickMe"), bodies);
    expect(props.map((p) => p.id)).toEqual(pickme.satellites!.map((s) => s.id));
  });

  it("orders a planet's props by birth, so radius is time here too", () => {
    const props = surfacePropsFor(planetScopeId("products"), bodies);
    const born = props.map(
      (p) => bodies.find((b) => b.id === p.id)!.bornAt,
    );
    expect([...born].sort()).toEqual(born);
    // Distance grows with age order, the same rule the map uses everywhere.
    const distances = props.map((p) => p.distance);
    expect([...distances].sort((a, b) => a - b)).toEqual(distances);
  });

  it("keeps every prop on the shard it stands on", () => {
    for (const scopeId of surfaceScopeIds(bodies)) {
      const radius = shardRadiusFor(scopeId, bodies);
      for (const prop of surfacePropsFor(scopeId, bodies)) {
        expect(prop.distance).toBeGreaterThan(0);
        // Inside the inscribed radius of a seven-sided shard, so nothing
        // stands over an edge.
        expect(prop.distance).toBeLessThan(radius * Math.cos(Math.PI / 7));
      }
    }
  });

  it("fans props apart rather than stacking them", () => {
    const props = surfacePropsFor(planetScopeId("products"), bodies);
    const angles = props.map((p) => p.angle).sort((a, b) => a - b);
    for (let i = 1; i < angles.length; i++) {
      expect(angles[i] - angles[i - 1]).toBeGreaterThan(0.1);
    }
  });

  it("stands the private repositories too, but without naming them", () => {
    // Two of the seven §3.5 names are anonymous. Leaving them out would
    // understate the supporting work the ground is an argument about; the arm
    // already draws them and only withholds them from lists.
    const props = surfacePropsFor(planetScopeId("products"), bodies);
    const anonymous = props.filter((p) => p.anonymous);
    expect(anonymous).toHaveLength(2);
    for (const prop of anonymous) {
      expect(prop.label).toBe("Private repository");
    }
  });

  it("returns nothing for a scope with no surface, rather than throwing", () => {
    // Unlike shardRadiusFor: asking what stands on nothing is a fair question
    // with an empty answer, where asking how big nothing is is a bug.
    expect(surfacePropsFor(planetScopeId("labs"), bodies)).toEqual([]);
  });
});
