import { describe, expect, it } from "vitest";
import { AtlasCamera } from "../AtlasCamera";

const settle = (c: AtlasCamera) => { for (let i = 0; i < 400; i++) c.update(1 / 60); };

describe("AtlasCamera", () => {
  it("projects the origin near the centre of the screen when looking at it", () => {
    const c = new AtlasCamera(1000, 800);
    c.focus({ x: 0, y: 0, z: 0 });
    settle(c);
    const [p] = c.projectToScreen([{ id: "o", pos: { x: 0, y: 0, z: 0 } }], 1000, 800);
    expect(p.x).toBeCloseTo(500, -1);
    expect(p.y).toBeCloseTo(400, -1);
    expect(p.visible).toBe(true);
  });

  it("marks points outside the viewport not visible", () => {
    const c = new AtlasCamera(1000, 800);
    settle(c);
    const [p] = c.projectToScreen([{ id: "far", pos: { x: 9999, y: 0, z: 0 } }], 1000, 800);
    expect(p.visible).toBe(false);
  });

  it("reports depth so the Chart can z-order overlapping labels", () => {
    const c = new AtlasCamera(1000, 800);
    c.focus({ x: 0, y: 0, z: 0 });
    settle(c);
    const [near, far] = c.projectToScreen([
      { id: "near", pos: { x: 0, y: 0, z: 5 } },
      { id: "far", pos: { x: 0, y: 0, z: -5 } },
    ], 1000, 800);
    expect(near.depth).toBeLessThan(far.depth);
  });

  it("changes azimuth when orbited", () => {
    const c = new AtlasCamera(1000, 800);
    settle(c);
    const before = c.camera.position.clone();
    c.orbit(0.6, 0);
    settle(c);
    expect(c.camera.position.distanceTo(before)).toBeGreaterThan(0.5);
  });

  it("clamps elevation so the disk is never viewed edge-on or from below", () => {
    const c = new AtlasCamera(1000, 800);
    c.orbit(0, -99); settle(c);
    expect(c.camera.position.y).toBeGreaterThan(0.5);
    c.orbit(0, 99); settle(c);
    expect(c.camera.position.y).toBeGreaterThan(0.5);
  });

  it("clamps zoom to a usable range", () => {
    const c = new AtlasCamera(1000, 800);
    for (let i = 0; i < 200; i++) c.zoom(-10);
    settle(c);
    const near = c.camera.position.length();
    for (let i = 0; i < 400; i++) c.zoom(10);
    settle(c);
    expect(c.camera.position.length()).toBeGreaterThan(near);
    expect(c.camera.position.length()).toBeLessThan(500);
  });

  it("widens the field of view on narrow viewports", () => {
    const c = new AtlasCamera(1000, 800);
    const wide = c.camera.fov;
    c.resize(420, 800);
    expect(c.camera.fov).toBeGreaterThan(wide);
  });
});
