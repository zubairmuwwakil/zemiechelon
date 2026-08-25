import { describe, expect, it } from "vitest";
import {
  GALAXY_ZEMI,
  SOLAR_SYSTEMS,
  SOLAR_SYSTEM_CHANNEL,
  SOLAR_SYSTEM_ZEMI,
  solarSystemScopeId,
  systemName,
  validateGalaxy,
  type Scope,
} from "../galaxy";
import { CHANNEL_ARM_IDS } from "@/data/channel";
import { bodiesFor, loadBodies } from "../bodies";
import type { Body } from "../types";

/** A minimal solar system, for collision cases the real registry cannot produce. */
function system(name: string, arms: Record<string, number>): Scope {
  return {
    id: solarSystemScopeId(name),
    kind: "solarSystem",
    parent: GALAXY_ZEMI.id,
    label: name,
    epoch: "2026-01-01",
    arms,
    windRate: 0.55,
  };
}

function body(id: string, arm: string): Body {
  return {
    id,
    label: id,
    parent: SOLAR_SYSTEM_ZEMI.id,
    arm,
    bornAt: "2026-01-01",
    lastTouchedAt: "2026-01-01",
    kind: "dwarfPlanet",
    anonymous: false,
    links: {},
  };
}

describe("the galaxy's arm table", () => {
  it("has one arm per solar system, named for it", () => {
    expect(Object.keys(GALAXY_ZEMI.arms).sort()).toEqual(
      SOLAR_SYSTEMS.map((s) => systemName(s.id)).sort(),
    );
  });

  it("spaces those arms evenly around the circle", () => {
    const angles = SOLAR_SYSTEMS.map((s) => GALAXY_ZEMI.arms[systemName(s.id)]);
    angles.forEach((angle, i) => {
      expect(angle).toBeCloseTo((i / SOLAR_SYSTEMS.length) * 2 * Math.PI, 10);
    });
  });

  it("parents every registered solar system to the galaxy", () => {
    for (const s of SOLAR_SYSTEMS) {
      expect(s.parent, s.id).toBe(GALAXY_ZEMI.id);
      expect(s.kind, s.id).toBe("solarSystem");
    }
  });

  it("registers the repository atlas", () => {
    expect(SOLAR_SYSTEMS).toContain(SOLAR_SYSTEM_ZEMI);
  });
});

describe("systemName", () => {
  it("inverts solarSystemScopeId", () => {
    expect(systemName(solarSystemScopeId("channel"))).toBe("channel");
    expect(systemName(SOLAR_SYSTEM_ZEMI.id)).toBe("atlas");
  });

  it("throws on a scope id that names no solar system", () => {
    expect(() => systemName("planet:products")).toThrow(/not a solar system/);
  });
});

describe("validateGalaxy", () => {
  it("accepts the galaxy as it actually stands", () => {
    expect(() => validateGalaxy(SOLAR_SYSTEMS, loadBodies())).not.toThrow();
  });

  it("rejects two solar systems declaring the same arm", () => {
    // Scope ids are flat: `planet:products` carries no system segment, so two
    // systems claiming one arm name would collide on a single planet scope.
    expect(() =>
      validateGalaxy(
        [system("a", { shared: 0 }), system("b", { shared: 0 })],
        [],
      ),
    ).toThrow(/arm "shared"/);
  });

  it("rejects two bodies sharing an id", () => {
    // This is what stops a video quietly stealing a repository's deep link.
    expect(() =>
      validateGalaxy([system("a", { one: 0 })], [body("dup", "one"), body("dup", "one")]),
    ).toThrow(/body "dup"/);
  });

  it("names both offenders rather than only the collision", () => {
    expect(() =>
      validateGalaxy([system("first", { shared: 0 }), system("second", { shared: 0 })], []),
    ).toThrow(/first.*second|second.*first/);
  });
});

describe("the channel solar system", () => {
  it("is registered as the galaxy's second system", () => {
    expect(SOLAR_SYSTEMS[1]).toBe(SOLAR_SYSTEM_CHANNEL);
    expect(SOLAR_SYSTEM_CHANNEL.parent).toBe(GALAXY_ZEMI.id);
  });

  it("declares exactly the channel's arms, evenly spaced", () => {
    const arms = Object.keys(SOLAR_SYSTEM_CHANNEL.arms);
    expect(arms.sort()).toEqual([...CHANNEL_ARM_IDS].sort());
    CHANNEL_ARM_IDS.forEach((arm, i) => {
      expect(SOLAR_SYSTEM_CHANNEL.arms[arm]).toBeCloseTo(
        (i / CHANNEL_ARM_IDS.length) * 2 * Math.PI,
        10,
      );
    });
  });

  it("takes its epoch from its oldest item, not from a typed date", () => {
    const oldest = bodiesFor(SOLAR_SYSTEM_CHANNEL)
      .map((b) => b.bornAt)
      .sort()[0];
    expect(SOLAR_SYSTEM_CHANNEL.epoch).toBe(oldest);
  });

  it("collides with nothing the atlas declares", () => {
    // The guard would have thrown at import. This states why it matters.
    const atlasArms = Object.keys(SOLAR_SYSTEM_ZEMI.arms);
    for (const arm of Object.keys(SOLAR_SYSTEM_CHANNEL.arms)) {
      expect(atlasArms, arm).not.toContain(arm);
    }
  });

  it("serves its own bodies through bodiesFor", () => {
    expect(bodiesFor(SOLAR_SYSTEM_CHANNEL).length).toBeGreaterThan(0);
    expect(bodiesFor(SOLAR_SYSTEM_CHANNEL)).not.toEqual(bodiesFor(SOLAR_SYSTEM_ZEMI));
  });
});
