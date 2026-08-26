import * as THREE from "three";
import type { Body, ScopeId } from "@/lib/atlas/types";
import { deriveMoons } from "@/lib/atlas/moons";
import { shardRadiusFor } from "@/lib/atlas/surfaces";
import { DIRECTION_A } from "@/lib/theme/directionA";
import { SURFACE_FAMILIES } from "./PlanetSurfaces";

/**
 * A model of the planet with its moons turning on it, standing on the ground.
 *
 * Spec §3.4: travel between a planet's moons happens through an instrument you
 * tap, not a door you open. The affordance is physical and the transition is
 * still a flight — a teleport would reintroduce the cut that two plans of work
 * removed.
 *
 * It also earns its place functionally rather than decoratively. Moons orbit,
 * so at any moment one or two are behind the planet, and tapping the sky only
 * reaches what is visible. The instrument is what makes the hidden ones
 * reachable at all, which is why §6 asks for exactly that.
 *
 * It stands at the point the camera orbits, so walking around the surface is
 * walking around the instrument.
 */

/** The instrument's size, as a fraction of the shard it stands on. */
const ORRERY_SCALE = 0.055;
/** Moons ride this multiple of the model planet's radius. */
const ORRERY_ORBIT = 2.4;
/**
 * Radians per second for the innermost bead.
 *
 * Slow enough to tap is the binding constraint, not fast enough to notice. At
 * 0.28 a bead crossed the frame in a couple of seconds and slid out from under
 * the pointer; the whole point of the instrument is that you can hit one. This
 * is roughly a revolution a minute — visibly running whenever you look back at
 * it, and stationary enough to aim at.
 */
const ORRERY_RATE = 0.1;

export interface OrreryHandle {
  scopeId: ScopeId;
  group: THREE.Group;
  /** One per moon, turning. */
  pivots: THREE.Group[];
  /** Moon id -> its tappable sphere on the instrument. */
  targets: Map<string, THREE.Mesh>;
  /**
   * Every material here whose colour belongs to the GROUND rather than to the
   * thing it draws — the plinth and the orbit rings. Handed back rather than
   * repainted here because the instrument does not know which ground it is
   * standing on; `WorldSceneBuilder.setCosmicMode` does, and it already owns
   * this job for the hairlines. See `ruleSolids` there.
   */
  ruleMaterials: THREE.MeshStandardMaterial[];
}

/**
 * Build the instrument into a surface group. Returns null when the scope has no
 * moons — a moon's own ground carries satellites, not moons, so there is
 * nowhere to launch a flight to and no instrument to launch it from.
 */
export function buildOrrery(
  surface: THREE.Group,
  scopeId: ScopeId,
  bodies: Body[],
): OrreryHandle | null {
  if (!scopeId.startsWith("planet:")) return null;
  const arm = scopeId.slice("planet:".length);
  const moons = deriveMoons(bodies).filter((m) => m.arm === arm);
  if (moons.length === 0) return null;

  const shard = shardRadiusFor(scopeId, bodies);
  const size = shard * ORRERY_SCALE;

  const group = new THREE.Group();
  group.name = `orrery:${scopeId}`;
  // At the shard's centre: the point the camera orbits.
  group.position.set(0, size * 1.6, 0);

  const ruleMaterials: THREE.MeshStandardMaterial[] = [];

  // The model wears the planet's own surface colour rather than a chosen one,
  // so the instrument says the same thing about the planet that the sky does.
  // Ink would read as a hole punched in the parchment at this size.
  const family = SURFACE_FAMILIES[arm];
  const modelMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(family?.baseColor ?? DIRECTION_A.rule),
    roughness: 0.62,
    metalness: 0.12,
    flatShading: true,
  });
  // Only when there was no family to borrow from. With one, the sphere wears
  // the planet's own colour and the ground has no claim on it; without one it
  // is wearing the ground's, and then it swaps with the ground.
  if (!family) ruleMaterials.push(modelMaterial);

  // A plinth, so the instrument stands rather than floats.
  const stemMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(DIRECTION_A.rule),
    roughness: 0.75,
    metalness: 0.1,
    flatShading: true,
  });
  ruleMaterials.push(stemMaterial);
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(size * 0.16, size * 0.3, size * 1.6, 8),
    stemMaterial,
  );
  stem.position.y = -size * 0.8;
  group.add(stem);

  // The planet in miniature.
  const model = new THREE.Mesh(new THREE.SphereGeometry(size, 20, 14), modelMaterial);
  group.add(model);

  const pivots: THREE.Group[] = [];
  const targets = new Map<string, THREE.Mesh>();

  for (const moon of moons) {
    // The instrument keeps the map's own rule: orbit order is birth order, so
    // the model says the same thing about time that the sky does.
    const radius = size * ORRERY_ORBIT * (moon.orbit / 5.6);

    const ringMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(DIRECTION_A.rule),
      roughness: 0.8,
      metalness: 0.1,
    });
    ruleMaterials.push(ringMaterial);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, size * 0.012, 6, 48),
      ringMaterial,
    );
    ring.rotation.x = Math.PI / 2;
    group.add(ring);

    const pivot = new THREE.Group();
    pivot.name = `orrery-pivot:${moon.id}`;
    pivot.rotation.y = moon.phase;

    const bead = new THREE.Mesh(
      new THREE.SphereGeometry(size * 0.2, 14, 12),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(DIRECTION_A.gold),
        emissive: new THREE.Color(DIRECTION_A.gold),
        emissiveIntensity: 0.2,
        roughness: 0.4,
        metalness: 0.25,
      }),
    );
    bead.name = `orrery-moon:${moon.id}`;
    bead.position.set(radius, 0, 0);
    pivot.add(bead);

    // A bead this small is well under a fingertip, so it carries the same kind
    // of invisible proxy the moons in the sky do.
    const proxy = new THREE.Mesh(
      new THREE.SphereGeometry(size * 0.55, 10, 8),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    );
    proxy.name = `orrery-hit:${moon.id}`;
    proxy.position.copy(bead.position);
    pivot.add(proxy);

    group.add(pivot);
    pivots.push(pivot);
    targets.set(moon.id, bead);
  }

  surface.add(group);
  return { scopeId, group, pivots, targets, ruleMaterials };
}

/** Advance every instrument's moons. Outer beads turn slower, as the sky does. */
export function updateOrreries(handles: OrreryHandle[], delta: number): void {
  for (const handle of handles) {
    handle.pivots.forEach((pivot, i) => {
      pivot.rotation.y += delta * ORRERY_RATE * Math.pow(0.82, i);
    });
  }
}
