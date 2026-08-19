import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { loadBodies } from "@/lib/atlas/bodies";
import { FieldBuilder } from "../FieldBuilder";

const bodies = loadBodies();
const build = () => {
  const scene = new THREE.Scene();
  const fb = new FieldBuilder(scene, bodies, "2026-08-19");
  fb.build();
  return { scene, fb };
};

describe("FieldBuilder", () => {
  it("creates one sprite per body, anonymous ones included", () => {
    const { fb } = build();
    expect(fb.bodySprites.size).toBe(bodies.length);
    for (const b of bodies) expect(fb.bodySprites.has(b.id), `${b.id} missing`).toBe(true);
  });

  it("creates one trail per body", () => {
    const { fb } = build();
    expect(fb.trailLines).toHaveLength(bodies.length);
  });

  it("pushes enough background stars to read as a field", () => {
    const { fb } = build();
    expect(fb.backgroundStarCount).toBeGreaterThanOrEqual(10_000);
  });

  it("keeps every sprite on the disk plane", () => {
    const { fb } = build();
    for (const [id, o] of fb.bodySprites) {
      expect(Math.abs(o.position.y), `${id} left the plane`).toBeLessThan(0.001);
    }
  });

  it("adds no per-body build methods — geometry is data-driven", () => {
    // Guards the property the whole redesign exists for: a new venture is a row,
    // not a twelfth build method. If this fails, someone special-cased a body.
    const src = FieldBuilder.toString();
    expect(src).not.toMatch(/build(Fintech|AIYard|Pickleball|Founder)/);
  });

  it("is idempotent — building twice does not double the scene", () => {
    const { scene, fb } = build();
    const n = scene.children.length;
    fb.build();
    expect(scene.children.length).toBe(n);
  });
});
