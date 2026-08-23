import { describe, expect, it } from "vitest";
import { loadBodies } from "../bodies";
import { bodyIdToHash, hashToBodyId } from "../deepLink";

const bodies = loadBodies();

describe("deep links", () => {
  it("round-trips every labelled body", () => {
    for (const b of bodies.filter((x) => !x.anonymous)) {
      expect(hashToBodyId(bodyIdToHash(b.id), bodies), `${b.id}`).toBe(b.id);
    }
  });

  it("produces url-safe hashes for awkward repo names", () => {
    // Real repo names include "JS_Tel-_Checker", "C--Practice", "A1.6_AI_Slop".
    for (const b of bodies) {
      expect(bodyIdToHash(b.id), `${b.id}`).toMatch(/^#\/[a-z0-9._~-]+$/i);
    }
  });

  it("refuses to resolve an anonymous body", () => {
    expect(hashToBodyId("#/Obsidian", bodies)).toBeNull();
  });

  it("returns null for an unknown hash instead of throwing", () => {
    expect(hashToBodyId("#/not-a-repo", bodies)).toBeNull();
    expect(hashToBodyId("", bodies)).toBeNull();
    expect(hashToBodyId("#", bodies)).toBeNull();
  });

  it("is case-insensitive so a hand-typed link still resolves", () => {
    expect(hashToBodyId("#/moneytalks", bodies)).toBe("MoneyTalks");
  });
});

describe("a hash that names nothing", () => {
  it("resolves to null rather than throwing, so clearing it is safe", () => {
    // page.tsx clears the hash when the visitor stands somewhere no repository
    // names — a planet's surface. The listener still runs on the way out.
    expect(hashToBodyId("", loadBodies())).toBeNull();
    expect(hashToBodyId("#", loadBodies())).toBeNull();
    expect(hashToBodyId("#/", loadBodies())).toBeNull();
  });
});
