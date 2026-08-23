// @vitest-environment jsdom
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { WorldSceneBuilder } from "../WorldSceneBuilder";
import { loadBodies } from "@/lib/atlas/bodies";
import { moonScopeId, planetScopeId } from "@/lib/atlas/galaxy";
import { daysSinceEpoch } from "@/lib/atlas/position";

/**
 * The clock and the scope cull both decide what is drawn, and they decide it by
 * writing the same flag. Neither feature's own tests exercise the other, so the
 * order they run in is untested surface between two tracks that landed a day
 * apart. These cases pin the interaction rather than the features.
 */

const bodies = loadBodies();

function built() {
  const scene = new THREE.Scene();
  const builder = new WorldSceneBuilder(scene, bodies, "2026-08-22", 1);
  builder.build();
  return { scene, builder };
}

/** The newest body, and the clock day it is born on. */
const LATE = bodies.reduce((latest, b) => (b.bornAt > latest.bornAt ? b : latest), bodies[0]);
const LATE_DAY = daysSinceEpoch(LATE.bornAt);
const FULL_SPAN = Math.max(...bodies.map((b) => daysSinceEpoch(b.bornAt)));

function objectsFor(scene: THREE.Scene, id: string): THREE.Object3D[] {
  const found: THREE.Object3D[] = [];
  scene.traverse((o) => {
    if (o.name === `body-${id}` || o.name === id) found.push(o);
  });
  return found;
}

function anyVisible(objects: THREE.Object3D[]): boolean {
  return objects.some((o) => {
    let cursor: THREE.Object3D | null = o;
    while (cursor) {
      if (!cursor.visible) return false;
      cursor = cursor.parent;
    }
    return true;
  });
}

describe("scope cull and the timeline clock", () => {
  // Guard against a vacuous suite: every "is not visible" case below would also
  // pass if the lookup found nothing at all. This one fails loudly in that case.
  it("finds the body it is about to assert on", () => {
    const { scene, builder } = built();
    builder.setClockDay(FULL_SPAN);
    expect(objectsFor(scene, LATE.id).length).toBeGreaterThan(0);
    expect(anyVisible(objectsFor(scene, LATE.id))).toBe(true);
  });

  it("does not resurrect an unborn body when the clock advances under a cull", () => {
    const { scene, builder } = built();
    // Rewind so the newest body is not born yet, then land.
    builder.setClockDay(LATE_DAY - 1);
    builder.setScopeCull(planetScopeId("products"));
    // The clock ticks while landed — the transport keeps running underneath.
    builder.setClockDay(LATE_DAY - 1);
    expect(anyVisible(objectsFor(scene, LATE.id))).toBe(false);
  });

  it("does not resurrect an unborn body when the cull is released", () => {
    const { scene, builder } = built();
    builder.setClockDay(LATE_DAY - 1);
    builder.setScopeCull(planetScopeId("products"));
    builder.setScopeCull(null);
    expect(anyVisible(objectsFor(scene, LATE.id))).toBe(false);
  });

  it("restores a planet to the clock's radius, not its full-grown one", () => {
    const { scene, builder } = built();
    const index = builder.planetInstanceIndex("labs");
    builder.setClockDay(Math.floor(FULL_SPAN * 0.5));
    const atHalf = instanceScale(scene, index);
    builder.setScopeCull(planetScopeId("products"));
    builder.setScopeCull(null);
    expect(instanceScale(scene, index)).toBeCloseTo(atHalf, 5);
  });
});

function instanceScale(scene: THREE.Scene, index: number): number {
  let scale = Number.NaN;
  scene.traverse((o) => {
    const mesh = o as THREE.InstancedMesh;
    if (!mesh.isInstancedMesh || mesh.name !== "planet-surfaces") return;
    const matrix = new THREE.Matrix4();
    mesh.getMatrixAt(index, matrix);
    scale = new THREE.Vector3().setFromMatrixScale(matrix).x;
  });
  return scale;
}

describe("standing on a surface, against the clock and the cull", () => {
  it("hides the planet you are standing on — you are on it, not looking at it", () => {
    const { scene, builder } = built();
    const index = builder.planetInstanceIndex("products");
    expect(instanceScale(scene, index)).toBeGreaterThan(0);
    builder.setStandingOn(planetScopeId("products"));
    expect(instanceScale(scene, index)).toBeCloseTo(0, 5);
  });

  it("keeps the parent visible while standing on a moon inside it", () => {
    const { scene, builder } = built();
    const index = builder.planetInstanceIndex("products");
    builder.setStandingOn(moonScopeId("PickMe"));
    // Spec §3.2 is a hard requirement: the frame you came from stays in shot.
    expect(instanceScale(scene, index)).toBeGreaterThan(0);
  });

  it("does not let the clock reveal the planet you are standing on", () => {
    const { scene, builder } = built();
    const index = builder.planetInstanceIndex("products");
    builder.setStandingOn(planetScopeId("products"));
    builder.setClockDay(FULL_SPAN);
    expect(instanceScale(scene, index)).toBeCloseTo(0, 5);
  });

  it("does not let releasing a cull reveal the planet you are standing on", () => {
    const { scene, builder } = built();
    const index = builder.planetInstanceIndex("products");
    builder.setStandingOn(planetScopeId("products"));
    builder.setScopeCull(planetScopeId("products"));
    builder.setScopeCull(null);
    expect(instanceScale(scene, index)).toBeCloseTo(0, 5);
  });

  it("restores the planet when the visitor leaves its surface", () => {
    const { scene, builder } = built();
    const index = builder.planetInstanceIndex("products");
    const before = instanceScale(scene, index);
    builder.setStandingOn(planetScopeId("products"));
    builder.setStandingOn(null);
    expect(instanceScale(scene, index)).toBeCloseTo(before, 5);
  });

  it("never draws a moon and its own shard at the same time", () => {
    // At any shard radius the two together read as a gold ball on a plate,
    // which is the frame the first spike reported.
    const { scene, builder } = built();
    const sphere = () => {
      let visible = false;
      scene.traverse((o) => {
        if (o.name === "moon-body:PickMe") visible = o.visible;
      });
      return visible;
    };
    const shard = () => {
      let visible = false;
      scene.traverse((o) => {
        if (o.name === "surface:moon:PickMe") visible = o.visible;
      });
      return visible;
    };
    expect(sphere()).toBe(true);
    expect(shard()).toBe(false);
    builder.setStandingOn(moonScopeId("PickMe"));
    expect(sphere()).toBe(false);
    expect(shard()).toBe(true);
  });
});

describe("what a cull is allowed to take", () => {
  /** Root children that are neither field, nor a scope group, nor an arm body. */
  function instrumentPieces(builder: WorldSceneBuilder): THREE.Object3D[] {
    const scopeNames = new Set(builder.scopeGroups.keys());
    return builder.rootGroup.children.filter(
      (c) =>
        !(c as THREE.Points).isPoints &&
        !scopeNames.has(c.name) &&
        !c.name.startsWith("body-"),
    );
  }

  it("leaves the galaxy's own instrument standing", () => {
    // Standing on a planet, the parent IS the galaxy, and the galaxy has no
    // body worth framing — its astrolabe rings and its core are what §3.2 asks
    // to keep in view. A frustum check passes even when nothing is drawn
    // there, so this asserts the pieces are still visible, not merely aimed at.
    const { builder } = built();
    const pieces = instrumentPieces(builder);
    expect(pieces.length).toBeGreaterThan(0);
    builder.setScopeCull(planetScopeId("products"));
    for (const piece of pieces) expect(piece.visible).toBe(true);
  });

  it("still takes the field and the other frames", () => {
    const { builder } = built();
    builder.setScopeCull(planetScopeId("products"));
    const labs = builder.groupFor(planetScopeId("labs"));
    expect(labs.visible).toBe(false);
  });
});

describe("labels at depth", () => {
  function labels(scene: THREE.Scene): THREE.Sprite[] {
    const found: THREE.Sprite[] = [];
    scene.traverse((o) => {
      if ((o as THREE.Sprite).isSprite) found.push(o as THREE.Sprite);
    });
    return found;
  }

  it("draws its labels in orbit", () => {
    const { scene, builder } = built();
    const all = labels(scene);
    expect(all.length).toBeGreaterThan(0);
    expect(all.every((l) => l.visible)).toBe(true);
    expect(builder.standingScope).toBeNull();
  });

  it("puts them away on a surface, where they are the wrong size by construction", () => {
    // A moon is about fourteen screen pixels at galaxy framing, which is what
    // these pills exist for. Standing on a surface a sibling's pill lands
    // across the parent's face, and the orrery is the finder at that depth.
    const { scene, builder } = built();
    builder.setStandingOn(moonScopeId("PickMe"));
    expect(labels(scene).some((l) => l.visible)).toBe(false);
  });

  it("brings them back on leaving", () => {
    const { scene, builder } = built();
    builder.setStandingOn(moonScopeId("PickMe"));
    builder.setStandingOn(null);
    expect(labels(scene).every((l) => l.visible)).toBe(true);
  });
});
