# Zemí Scope Nesting — Design

**Date:** 2026-08-20
**Status:** Approved for R2 (Plan 2)
**Amends:** `2026-08-20-zemi-world-design.md` §3.1 (scene graph), which stated the
decision but not its shape. §9 (out of scope for R1) stands unchanged: no second
galaxy is built here. Everything else in that document holds.

---

## 1. Problem

R1 shipped the galaxy: derived positions, five distinct planet surfaces, a real
field, ideals rings, and the shipped systems in orbit as labelled moons. It did
not ship the second altitude. Landing on a planet is still
`CleanPlanetLandingModal` — a `<div>` over a still scene — which is the theatre
the atlas spec set out to eliminate. A visitor never arrives anywhere.

The blocker is structural, not visual. `WorldSceneBuilder` flattens everything
into one `rootGroup` and computes absolute world positions through `toScene()`.
There is nowhere to descend *into*, because no part of the scene claims to be a
place. `SCOPES` holds exactly one entry, and `loadBodies()` hardcodes
`parent: GALAXY_ZEMI.id` on all 45 bodies, so `Body.parent` is decoration: it is
written, never read except as a default.

## 2. The model

Settled with the author, and larger than R1 assumed. The repository atlas is not
*the* world; it is one galaxy in a universe of them, each a domain of a life with
its own feel.

```
universe                      (not built — see §8)
└── galaxy:zemi               repositories        ← the only one that exists
    ├── planet:products       shipped ventures
    ├── planet:labs           shipped ventures
    └── (41 bodies)           laid out on five arms
```

This does not change what gets built now. It changes how it gets written: every
frame and camera mechanism is written for an arbitrary parent/child pair, with
nothing assuming the galaxy is the top. A `universe` root and its siblings then
land as rows of data rather than as a second refactor.

**Vocabulary**, fixed here because it has been used loosely:

| Term | Meaning |
|---|---|
| **Body** | One repository. 45 of them. Authored in `bodies.overrides.ts`. |
| **Arm** | One of five spiral arms. Editorial: the author assigns each body to one. |
| **Star / system** | A body's `kind`. `system` means shipped — there are 5. |
| **Planet** | Derived, not data. One per arm. Position and size computed from the arm's bodies. |
| **Moon** | A `system` body drawn orbiting its planet rather than sitting on the arm. |
| **Satellite** | A feature *inside* one body, authored. Not a repository. 13 across Products' four. |
| **Scope** | A coordinate frame. "Positions are measured from here." |
| **Diorama** | The surface of a planet, landed on. Plan 3. |

## 3. Decision

Five decisions, taken together.

### 3.1 A body's parent is derived from its kind

`loadBodies()` stops hardcoding `parent`. A `kind: "system"` body is parented to
`planet:<its arm>`; every other body stays on the galaxy. **Five bodies move**
— Products' four and Labs' one — and forty do not.

This is the predicate `deriveMoons` already uses. The two are held together by
test rather than by convention: the set of bodies parented to a planet scope must
equal `moonIds(bodies)`.

**Why only the systems.** The alternative — reparenting all eleven of Products'
repositories — was rendered and rejected. It costs the Products arm seven bodies
*and the arm dust those bodies anchor*, since dust is derived from `placeBodies`
over the scope's own set. The arm that the spec most wants to read as substantial
would end up thinner than Foundations, which is the learning arm. That inverts
§5.2's argument. The seven stay, and whether they follow later is a Plan 3
question to answer against a visible surface rather than in the abstract.

### 3.2 Planet scopes are derived, not typed

`SCOPES` stops being a hand-written record. It is the galaxy plus one
`planet:<arm>` scope for each arm holding at least one system. Each planet scope:

- takes `parent: "galaxy:zemi"`
- takes its **epoch from its oldest child's `bornAt`**, so radius-is-time restarts
  cleanly at planet scale rather than inheriting a galaxy epoch that means nothing
  there
- declares one arm, named for its galaxy arm at angle `0`, so a moon's `arm` still
  resolves and `placeBodies` can run in the frame unchanged
- inherits the galaxy's `windRate`

Every assertion in the existing `scopes.test.ts` survives untouched: the galaxy
remains the only scope without a parent, every declared parent resolves, there are
no cycles, every body's parent exists, and every arm a body uses is declared by its
scope. The tree gets deeper; none of its invariants change.

Nothing is authored per planet. An arm that ships its first product gets a scope
by existing, which is the same rule the rest of the atlas follows: adding a
venture is adding a row.

### 3.3 One `THREE.Group` per scope

`rootGroup` becomes the galaxy scope's group. Each planet scope gets a child group
positioned at that planet's centre, and a `Map<ScopeId, THREE.Group>` is the
lookup. Builders ask for the group of the scope they are building into.

Most of this already exists: `buildMoons` creates a group at the planet's centre
and hangs the moons inside it. That group *is* a planet scope, unnamed. The work
is largely registration, not construction — which is why the risk here is lower
than §3.1 of the world spec implies.

**Parity is the acceptance criterion.** World positions for all 45 bodies must be
byte-identical before and after, captured as a golden file in the manner of
`positionParity.test.ts`. A nesting refactor that moves anything has failed.

### 3.4 A planet's mass is its subtree

`derivePlanets` sizes each planet from `bodies.filter(b => b.arm === arm)`. Once
systems reparent, switching that filter to `parent` would silently cost Products
its four systems, and Products would stop being the largest planet — breaking a
§5.2 guarantee with no test failing and no error raised.

Stated as a rule so it cannot be reintroduced: **a planet's mass aggregates its
whole subtree, never its direct children.** A test pins the size ordering with
Products largest.

### 3.5 Descent composes transforms; it does not compute them

`WorldCameraManager` gains `descend(scopeId)` and `ascend()`. Descent walks the
scope chain and composes the groups' world matrices — `Object3D`'s job, not ours
— so the camera's target becomes the child group's origin and its framing
distance scales off the planet's own radius, which `orbitPose` already derives.

Both take an arbitrary parent/child pair. Nothing in the signature or the body
knows that the galaxy is the root.

**Reduced motion removes travel, never content**: descent arrives instantly rather
than flying, and everything reachable stays reachable.

## 4. What changes on screen

Clicking Products flies the camera into its frame — the planet close up, its four
moons around it — rather than opening a modal over a still scene. The existing
PickleOps and PickMe consoles stay reachable from there; they lose their modal but
not their home, and Plan 3 mounts them on the surface.

Escape ascends to the galaxy.

Nothing else moves. The quote sky, HUD pins, field and astrolabe all belong to the
galaxy scope and behave exactly as they do today. At galaxy framing every body sits where it
sat in R1, which is exactly what the parity gate asserts and no more.

## 5. Why the moons keep their orbits

Three ways to position the four once they belong to Products were considered.

Pointing `placeBodies` at them — one layout function at every scale — is the most
internally consistent, and it is what Plan 3 will want for arranging props. But
spiral placement is a galaxy idiom, and applied to four moons it would replace
orbits that were designed and shipped one release ago with something that no
longer reads as moons. That is a visible regression bought with an invisible
consistency.

Treating the moons *as* the landing surface — descent being nothing but getting
closer to the same four objects, which become plates as you approach — is the most
honest of the three and probably where Plan 3 lands. It is not decided here,
because it constrains a surface nobody has seen yet.

So: **the planet scope is a frame for the camera and, later, for the diorama. The
moons keep the orbits `deriveMoons` gives them.** The same bodies are positioned
one way at galaxy scale and will be arranged another way on the surface, which is
what level of detail means, and is a smaller cost than either alternative.

## 6. Testing

| Area | Assertion |
|---|---|
| Scope tree | Planet scopes derived, not typed; one root; every parent resolves; no cycles; every arm a body uses is declared |
| Epochs | Each planet scope's epoch is its oldest child's `bornAt` |
| Parentage | The set of planet-parented bodies equals `moonIds(bodies)` |
| **Parity** | World positions for all 45 bodies byte-identical across the refactor |
| Mass | `derivePlanets` sizes from the subtree; Products is largest |
| Camera | `descend`/`ascend` compose correctly for an arbitrary parent/child pair |
| Reduced motion | Descent arrives without travel; nothing becomes unreachable |

## 7. Risks

| # | Risk | Mitigation | Residual |
|---|---|---|---|
| 1 | **The refactor moves something and nobody notices.** Position drift of a fraction of a unit is invisible per-frame and fatal to a map that claims to be derived. | The parity golden file is the acceptance criterion, not a nicety. | Low. |
| 2 | **Descent has no destination yet.** Flying into Products before Plan 3 lands you at a sphere with four moons and no ground. | Accepted deliberately: the consoles stay reachable, so nothing regresses, and the flight is verifiable on its own. | Real, and time-boxed to Plan 3. |
| 3 | **Planet-scope epochs make radius mean two things.** Radius is days-since-galaxy-epoch outside and days-since-planet-epoch inside. | It is the same rule applied recursively, which is the point; the diorama legend states its own epoch. | Watch at Plan 3. |

## 8. Out of scope

- **The diorama surface** — plates, props, the arrangement, the mounted console. Plan 3.
- **The `universe` root and sibling galaxies.** A root with one child has no
  observable behaviour, which is the same reason nesting itself was deferred out of
  Plan 1. It lands when galaxy two is built, and §3.5 is written so that it can.
- **Moving Products' seven remaining repositories.** Revisit at Plan 3 against a
  surface that exists.
- **Night mode and Direction C.** Unchanged from R1.

## 9. Consequences

`Body.parent` stops being decoration and starts carrying meaning, which means it
can now be wrong — hence the parentage test. `SCOPES` becomes derived, so the
scope tree is a function of the repository set rather than a table someone
maintains. And the camera gains a vocabulary — descend, ascend, a chain of frames
— that the universe in §2 will use unchanged.
