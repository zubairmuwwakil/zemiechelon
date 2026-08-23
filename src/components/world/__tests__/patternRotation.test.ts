// @vitest-environment jsdom
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { WorldSceneBuilder } from "../WorldSceneBuilder";
import { loadBodies } from "@/lib/atlas/bodies";
import { PATTERN_PERIOD_SECONDS, patternAngle } from "@/lib/atlas/motion";

const bodies = loadBodies();

function built() {
  const scene = new THREE.Scene();
  const builder = new WorldSceneBuilder(scene, bodies, "2026-08-22", 1);
  builder.build();
  return builder;
}

/**
 * Every drawn body's world position, after `seconds` of the render loop.
 *
 * `delta` is zero deliberately, and that is what makes the rigidity cases below
 * statements about L1 rather than about the whole motion system. `update` runs
 * on two independent clocks: `elapsed` sets the pattern angle absolutely, while
 * `delta` accumulates into the moon pivots and the orreries. A moon orbits its
 * planet, so its distance from the CORE genuinely changes — feed the second
 * clock and "no radius changes" is false by L3's design, before L1 is asked
 * anything. Zero freezes the accumulating layers and leaves the pattern as the
 * only thing that has moved. Moon orbits are covered by `inclination.test.ts`.
 */
function positionsAfter(builder: WorldSceneBuilder, seconds: number) {
  builder.update(seconds, 0);
  builder.rootGroup.updateMatrixWorld(true);
  return new Map(
    [...builder.bodySprites.entries()].map(([id, object]) => [
      id,
      object.getWorldPosition(new THREE.Vector3()),
    ]),
  );
}

describe("the pattern turns", () => {
  it("turns the galaxy at the derived rate", () => {
    const builder = built();
    builder.update(120, 120);
    expect(builder.rootGroup.rotation.y).toBeCloseTo(patternAngle(120), 9);
  });

  it("moves the bodies", () => {
    const builder = built();
    const before = positionsAfter(builder, 0);
    const after = positionsAfter(builder, 300);
    const moved = [...after].filter(([id, p]) => p.distanceTo(before.get(id)!) > 1);
    expect(moved.length).toBeGreaterThan(bodies.length / 2);
  });

  it("holds the sky still, or the rotation cancels and ships as a still image", () => {
    // The 12,000-point shell is a child of rootGroup. Rotating the root without
    // countering the shell rotates the reference with the content, and the two
    // cancel to zero perceived motion — a bug invisible to code review and to
    // every placement test.
    const builder = built();
    const shell = builder.rootGroup.getObjectByName("background-field")!;
    const sample = (): THREE.Vector3 => {
      builder.rootGroup.updateMatrixWorld(true);
      const geometry = (shell as THREE.Points).geometry;
      const local = new THREE.Vector3().fromBufferAttribute(geometry.getAttribute("position"), 0);
      return local.applyMatrix4(shell.matrixWorld);
    };
    const before = sample();
    builder.update(600, 600);
    expect(sample().distanceTo(before)).toBeLessThan(1e-6);
  });
});

describe("the pattern is rigid", () => {
  it("changes no body's distance from the core", () => {
    // Radius is time. If a radius changes, the map has started lying.
    const builder = built();
    const before = positionsAfter(builder, 0);
    const after = positionsAfter(builder, 900);
    for (const [id, position] of after) {
      const was = Math.hypot(before.get(id)!.x, before.get(id)!.z);
      const now = Math.hypot(position.x, position.z);
      expect(now).toBeCloseTo(was, 6);
    }
  });

  it("changes no angle between any two bodies", () => {
    // Angle is which arm. Differential rotation would shear these apart; this
    // assertion is what makes "rigid" a fact rather than an intention.
    const builder = built();
    const before = positionsAfter(builder, 0);
    const after = positionsAfter(builder, 900);
    const ids = [...after.keys()];
    const bearing = (p: THREE.Vector3) => Math.atan2(p.z, p.x);
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const was = bearing(before.get(ids[i])!) - bearing(before.get(ids[j])!);
        const now = bearing(after.get(ids[i])!) - bearing(after.get(ids[j])!);
        const drift = Math.atan2(Math.sin(now - was), Math.cos(now - was));
        expect(Math.abs(drift)).toBeLessThan(1e-6);
      }
    }
  });

  it("returns the galaxy to where it started after one period", () => {
    const builder = built();
    const before = positionsAfter(builder, 0);
    const after = positionsAfter(builder, PATTERN_PERIOD_SECONDS);
    for (const [id, position] of after) {
      expect(position.distanceTo(before.get(id)!)).toBeLessThan(0.01);
    }
  });

  it("does not turn with the transport clock", () => {
    // Spec §3.11. The clock decides only WHAT IS DRAWN; motion decides only
    // which way things face. Coupling them was rejected because the transport
    // parks at today, which would leave the galaxy still in exactly the state
    // this work exists to fix.
    const builder = built();
    builder.update(120, 120);
    const turned = builder.rootGroup.rotation.y;
    builder.setClockDay(0);
    expect(builder.rootGroup.rotation.y).toBe(turned);
    builder.setClockDay(100000);
    expect(builder.rootGroup.rotation.y).toBe(turned);
  });
});
