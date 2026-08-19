import { describe, expect, it } from "vitest";
import { loadBodies } from "../bodies";
import { ARM_ANGLES, daysSinceEpoch, derivePosition, radiusScale, trailEnd } from "../position";

const bodies = loadBodies();
const byId = (id: string) => bodies.find((b) => b.id === id)!;
const r = (p: { x: number; z: number }) => Math.hypot(p.x, p.z);

describe("daysSinceEpoch", () => {
  it("is zero at the epoch", () => expect(daysSinceEpoch("2025-11-06")).toBe(0));
  it("counts whole days forward", () => expect(daysSinceEpoch("2025-11-16")).toBe(10));
});

describe("radiusScale", () => {
  it("is monotonically increasing so later work is always further out", () => {
    for (let d = 1; d < 400; d++) {
      expect(radiusScale(d), `radius fell between day ${d - 1} and ${d}`)
        .toBeGreaterThan(radiusScale(d - 1));
    }
  });
  it("is zero at the origin", () => expect(radiusScale(0)).toBe(0));
});

describe("derivePosition", () => {
  it("places the earliest repos nearest the core", () => {
    const cat = derivePosition(byId("HTMl_CAT_WEBSITE"));
    const inunity = derivePosition(byId("MoneyTalks"));
    expect(r(cat)).toBeLessThan(r(inunity));
  });

  it("places every 2025 body inside every 2026-08 body", () => {
    const oldest = bodies.filter((b) => b.bornAt < "2026-01-01");
    const newest = bodies.filter((b) => b.bornAt >= "2026-08-01");
    const innerMax = Math.max(...oldest.map((b) => r(derivePosition(b))));
    const outerMin = Math.min(...newest.map((b) => r(derivePosition(b))));
    expect(innerMax).toBeLessThan(outerMin);
  });

  it("separates arms by angle at the frontier", () => {
    const angle = (b: string) => { const p = derivePosition(byId(b)); return Math.atan2(p.z, p.x); };
    expect(Math.abs(angle("MoneyTalks") - angle("agent-orchestrator"))).toBeGreaterThan(0.3);
  });

  it("converges the arms toward the origin", () => {
    // Arm separation is angular, so it shrinks in absolute distance as r -> 0.
    const near = bodies.filter((b) => r(derivePosition(b)) < 2);
    const spread = (set: typeof bodies) => {
      const xs = set.map((b) => derivePosition(b).x);
      return Math.max(...xs) - Math.min(...xs);
    };
    expect(spread(near)).toBeLessThan(spread(bodies));
  });

  it("is deterministic", () => {
    const a = derivePosition(byId("marketdata"));
    const b = derivePosition(byId("marketdata"));
    expect(a).toEqual(b);
  });

  it("keeps the disk flat", () => {
    for (const b of bodies) expect(Math.abs(derivePosition(b).y)).toBeLessThan(0.001);
  });

  it("defines an angle for every arm", () => {
    expect(Object.keys(ARM_ANGLES).sort())
      .toEqual(["creative", "foundations", "labs", "products", "self"]);
  });
});

describe("trailEnd", () => {
  it("gives a long-lived repo a trail reaching well beyond its birth radius", () => {
    const md = byId("marketdata");
    expect(r(trailEnd(md))).toBeGreaterThan(r(derivePosition(md)) * 1.5);
  });

  it("gives a same-day repo effectively no trail", () => {
    const cf = byId("Coin_Flipper");
    expect(r(trailEnd(cf)) - r(derivePosition(cf))).toBeLessThan(0.01);
  });

  it("keeps a trail on its own arm", () => {
    const md = byId("marketdata");
    const a1 = Math.atan2(derivePosition(md).z, derivePosition(md).x);
    const a2 = Math.atan2(trailEnd(md).z, trailEnd(md).x);
    expect(Math.abs(a1 - a2)).toBeLessThan(Math.PI); // same winding, no wraparound
  });
});
