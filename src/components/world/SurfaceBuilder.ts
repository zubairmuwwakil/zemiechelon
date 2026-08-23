import * as THREE from "three";
import type { Body, ScopeId } from "@/lib/atlas/types";
import { consoleIdFor, shardRadiusFor, surfacePropsFor } from "@/lib/atlas/surfaces";
import { DIRECTION_A } from "@/lib/theme/directionA";

/**
 * The ground a visitor stands on.
 *
 * Spec §3.1: a floating shard rather than a curved world. A shard is what a
 * museum diorama uses — it reads as a deliberate cross-section rather than a
 * failed globe, and it avoids the problem of standing props on a sphere.
 *
 * The whole vocabulary is here and it is deliberately small: a tapering slab,
 * and a plinth for a prop. Spec §7 risk 1 names the ratio to watch — a surface
 * is a lot of authored geometry, and authored is what this project has avoided
 * — so what is authored is *what a thing looks like*, never *where it goes*.
 * Every position comes from `surfacePropsFor`.
 */

/** A seven-sided slab reads as cut rather than turned. */
const SHARD_SIDES = 7;
/** Thickness and underside taper, as fractions of the shard's radius. */
const SHARD_THICKNESS = 0.34;
const SHARD_UNDERSIDE = 0.55;

/**
 * The console's height, as a fraction of the shard's radius.
 *
 * Taller than a prop, which is 0.08. A prop is supporting work you read about;
 * the console is the thing the visitor travelled three frames to use, and it
 * should read as the destination rather than as more scenery.
 */
const CONSOLE_HEIGHT = 0.13;

export interface SurfaceHandle {
  scopeId: ScopeId;
  group: THREE.Group;
  /** The prop meshes, for hit-testing. Keyed by the prop's own id. */
  props: Map<string, THREE.Mesh>;
  /** What each prop is called, and whose card it opens. */
  labels: Map<string, { label: string; bodyId: string }>;
  /** The console standing on this ground, if it earned one. */
  console: { id: string; object: THREE.Mesh } | null;
}

/**
 * Build a scope's ground into its group, hidden until the visitor lands.
 *
 * The shard's top face sits at the frame's local y = 0, which is where the body
 * it replaces was centred — so landing swaps one for the other in place, with
 * no jump. `setVisible` is the swap: the two must never be drawn together, or
 * the frame reads as a ball sitting on a plate, which is exactly what the first
 * spike saw and reported.
 */
export function buildSurface(
  group: THREE.Group,
  scopeId: ScopeId,
  bodies: Body[],
): SurfaceHandle {
  const radius = shardRadiusFor(scopeId, bodies);

  const surface = new THREE.Group();
  surface.name = `surface:${scopeId}`;
  surface.visible = false;

  const slab = new THREE.Mesh(
    new THREE.CylinderGeometry(
      radius,
      radius * SHARD_UNDERSIDE,
      radius * SHARD_THICKNESS,
      SHARD_SIDES,
      1,
    ),
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(DIRECTION_A.gold),
      roughness: 0.82,
      metalness: 0.06,
      flatShading: true,
    }),
  );
  // Hung below the frame's origin so the walking surface is y = 0 exactly.
  slab.position.y = -radius * SHARD_THICKNESS * 0.5;
  slab.receiveShadow = true;
  surface.add(slab);

  const props = new Map<string, THREE.Mesh>();
  const labels = new Map<string, { label: string; bodyId: string }>();
  // A planet's props are repositories and open their own card. A moon's are
  // its satellites, which have no card of their own — what describes them is
  // the moon's, so that is what activating one opens.
  const owner = scopeId.startsWith("moon:") ? scopeId.slice("moon:".length) : null;
  const plinthMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(DIRECTION_A.rule),
    roughness: 0.7,
    metalness: 0.08,
    flatShading: true,
  });
  // A private repository is drawn in the ground's own material rather than the
  // ink of a named thing: present, unmistakably part of the ground, unnamed.
  const anonymousMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(DIRECTION_A.gold),
    roughness: 0.9,
    metalness: 0.04,
    flatShading: true,
  });

  for (const prop of surfacePropsFor(scopeId, bodies)) {
    const plinth = new THREE.Mesh(
      new THREE.CylinderGeometry(prop.height * 0.28, prop.height * 0.36, prop.height, 6, 1),
      prop.anonymous ? anonymousMaterial : plinthMaterial,
    );
    plinth.name = `prop:${prop.id}`;
    plinth.position.set(
      Math.cos(prop.angle) * prop.distance,
      prop.height * 0.5,
      Math.sin(prop.angle) * prop.distance,
    );
    plinth.castShadow = true;
    surface.add(plinth);
    props.set(prop.id, plinth);
    labels.set(prop.id, { label: prop.label, bodyId: owner ?? prop.id });
  }

  // The instrument you came to use stands at the point the camera orbits, so
  // walking around the surface is walking around it. On a planet that is the
  // orrery; on a moon it is the console. §3.1: a thing you approach and switch
  // on, not a sidebar that appears.
  const consoleId = consoleIdFor(scopeId, bodies);
  let consoleHandle: { id: string; object: THREE.Mesh } | null = null;
  if (consoleId) {
    const height = radius * CONSOLE_HEIGHT;
    // A lectern: a slab you stand at, canted toward whoever approaches it.
    // The visitor stands on the frame's +X radial — that is where
    // `landOnSurface` puts them — so the face tilts that way and the slab is
    // widest across their view, along Z.
    const desk = new THREE.Mesh(
      new THREE.BoxGeometry(height * 0.72, height * 0.13, height * 1.15),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(DIRECTION_A.ink),
        roughness: 0.5,
        metalness: 0.2,
        flatShading: true,
      }),
    );
    desk.name = `console:${consoleId}`;
    desk.position.y = height;
    desk.rotation.z = -0.32;
    desk.castShadow = true;

    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(height * 0.13, height * 0.2, height, 8),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(DIRECTION_A.rule),
        roughness: 0.72,
        metalness: 0.1,
        flatShading: true,
      }),
    );
    post.position.y = height * 0.5;
    surface.add(post);
    surface.add(desk);
    consoleHandle = { id: consoleId, object: desk };
  }

  group.add(surface);
  return { scopeId, group: surface, props, labels, console: consoleHandle };
}
