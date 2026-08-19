import { describe, expect, it } from "vitest";
import { loadBodies } from "../bodies";
import {
  ARM_ANGLES,
  daysSinceEpoch,
  derivePosition,
  placeBodies,
  polar,
  radiusScale,
  trailEnd,
} from "../position";

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

// Bodies do not sit on the arm spine. Radius alone cannot separate them: with
// theta a pure function of (arm, radius), two repos in one arm born the same day
// occupy the identical point, and radiusScale's sqrt gives only ~1px per day at
// the frontier where most of them live. The separation has to come from theta.
describe("placeBodies", () => {
  /** World units. Below this, two star glyphs draw on top of each other. */
  const MIN_SEPARATION = 0.35;
  /**
   * A system draws a ringed figure with satellites. Set against the rendered
   * plate rather than from the geometry: at the frontier the three product
   * systems read best as one cluster at the end of their arm, so their rings are
   * allowed to touch. What must never happen is the discs merging — this floor
   * is four disc diameters, and catches any regression toward the 0.039 they
   * sat at before placeBodies existed.
   */
  const MIN_SYSTEM_SEPARATION = 1.4;
  const ARM_LANE = Math.PI / 5; // half the angular spacing between adjacent arms

  const placed = placeBodies(bodies);
  const kind = new Map(bodies.map((b) => [b.id, b.kind]));
  const arm = new Map(bodies.map((b) => [b.id, b.arm]));

  it("places every body exactly once", () => {
    expect(placed).toHaveLength(bodies.length);
    expect(new Set(placed.map((p) => p.id)).size).toBe(bodies.length);
  });

  it("never places two bodies on top of each other", () => {
    const tooClose: string[] = [];
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const a = placed[i];
        const b = placed[j];
        const d = Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z);
        const floor =
          kind.get(a.id) === "system" && kind.get(b.id) === "system"
            ? MIN_SYSTEM_SEPARATION
            : MIN_SEPARATION;
        if (d < floor) tooClose.push(`${a.id}+${b.id} (${d.toFixed(3)} < ${floor})`);
      }
    }
    expect(tooClose, `${tooClose.length} overlapping pairs`).toEqual([]);
  });

  it("keeps every body inside its own arm's lane", () => {
    for (const p of placed) {
      expect(Math.abs(p.lane), `${p.id} strayed out of the ${arm.get(p.id)} lane`)
        .toBeLessThan(ARM_LANE);
    }
  });

  it("leaves a body that crowds nobody on the arm spine", () => {
    const alone = placed.find((p) => p.id === "clawdbot")!;
    expect(alone.lane).toBe(0);
    expect(alone.position).toEqual(derivePosition(byId("clawdbot")));
  });

  it("runs a trail parallel to its arm, on the body's own lane", () => {
    const md = placed.find((p) => p.id === "marketdata")!;
    const angle = (v: { x: number; z: number }) => {
      const spine = polar("products", Math.hypot(v.x, v.z));
      const d = Math.atan2(v.z, v.x) - Math.atan2(spine.z, spine.x);
      return Math.atan2(Math.sin(d), Math.cos(d));
    };
    expect(angle(md.trailEnd)).toBeCloseTo(angle(md.position), 6);
  });

  it("preserves the radial ordering it scattered", () => {
    // The fan may nudge a body radially, but never past a body born a day earlier.
    const r = (p: (typeof placed)[number]) => Math.hypot(p.position.x, p.position.z);
    const byArm = placed.filter((p) => arm.get(p.id) === "products");
    for (const p of byArm) {
      const born = byId(p.id).bornAt;
      for (const q of byArm) {
        if (daysSinceEpoch(byId(q.id).bornAt) - daysSinceEpoch(born) > 1) {
          expect(r(p), `${p.id} overtook ${q.id}`).toBeLessThan(r(q));
        }
      }
    }
  });

  it("is deterministic", () => {
    expect(placeBodies(bodies)).toEqual(placeBodies(bodies));
  });
});
