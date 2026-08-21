import { describe, expect, it } from "vitest";
import generated from "@/data/bodies.generated.json";
import { loadBodies, EPOCH } from "../bodies";
import { moonIds } from "../moons";
import { planetScopeId } from "../galaxy";

const bodies = loadBodies();

describe("loadBodies", () => {
  it("returns every generated body", () => {
    expect(bodies).toHaveLength(generated.bodies.length);
  });

  it("assigns every body to exactly one arm", () => {
    const arms = new Set(["foundations", "products", "labs", "self", "creative"]);
    for (const b of bodies) {
      expect(arms.has(b.arm), `${b.id} has invalid arm "${b.arm}"`).toBe(true);
    }
  });

  it("marks exactly the private repos anonymous", () => {
    const anon = bodies.filter((b) => b.anonymous).map((b) => b.id).sort();
    expect(anon).toEqual([
      "A1.6_AI_Slop", "AiMiniProj", "Obsidi-Academy",
      "Obsidian", "market-data-pipeline", "pickleball-session-manager",
    ]);
  });

  it("never leaks an anonymous body's prose or links", () => {
    for (const b of bodies.filter((x) => x.anonymous)) {
      expect(b.blurb, `${b.id} leaked a blurb`).toBeUndefined();
      expect(b.stack, `${b.id} leaked a stack`).toBeUndefined();
      expect(Object.keys(b.links), `${b.id} leaked links`).toHaveLength(0);
      expect(b.label, `${b.id} leaked its name`).not.toContain(b.id);
    }
  });

  it("strips prose from the generated file itself, not just at load", () => {
    for (const g of generated.bodies.filter((x) => x.anonymous)) {
      expect(g.description, `${g.id} leaked into the committed JSON`).toBeNull();
      expect(g.topics).toHaveLength(0);
    }
  });

  it("gives every labelled body a display label and a github link", () => {
    for (const b of bodies.filter((x) => !x.anonymous)) {
      expect(b.label, `${b.id} has no label`).toBeTruthy();
      expect(b.links.github, `${b.id} has no github link`).toBeTruthy();
    }
  });

  it("places no body before the epoch", () => {
    for (const b of bodies) expect(b.bornAt >= EPOCH, `${b.id} predates the epoch`).toBe(true);
  });

  it("never has a body touched before it was born", () => {
    for (const b of bodies) {
      expect(b.lastTouchedAt >= b.bornAt, `${b.id} was touched before birth`).toBe(true);
    }
  });
});

describe("body parentage", () => {
  const bodies = loadBodies();

  it("parents every shipped system to its own planet", () => {
    for (const body of bodies.filter((b) => b.kind === "system")) {
      expect(body.parent, `${body.id} is not on its planet`).toBe(planetScopeId(body.arm));
    }
  });

  it("leaves everything else on the galaxy", () => {
    for (const body of bodies.filter((b) => b.kind !== "system")) {
      expect(body.parent, `${body.id} left the galaxy`).toBe("galaxy:zemi");
    }
  });

  it("moves exactly five bodies, so the arms keep their density", () => {
    expect(bodies.filter((b) => b.parent !== "galaxy:zemi")).toHaveLength(5);
  });

  it("agrees with deriveMoons, so the two rules cannot drift apart", () => {
    const parented = new Set(bodies.filter((b) => b.parent !== "galaxy:zemi").map((b) => b.id));
    expect(parented).toEqual(moonIds(bodies));
  });
});

