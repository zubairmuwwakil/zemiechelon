# Zemí Surface — Design

**Date:** 2026-08-21
**Status:** Approved for R3
**Amends:** `2026-08-20-zemi-world-design.md` §6 (diorama) and §7 (R1 scope, Track D).
`2026-08-20-zemi-scope-nesting-design.md` §5 left two questions open and this
document answers both. Everything else in both documents stands.

---

## 1. Problem

Three things, and the first is the one that matters.

**Landing does not land.** Clicking Products flies the camera into close orbit
around the planet and slides a panel in from the right. The visitor is still
outside, looking at a sphere, reading a drawer. That is a popup with a better
entrance — the same theatre the atlas spec set out to remove, one altitude down.
Spec §6 described a surface you stand on and it was never built.

**The map does not explain itself.** Every rule in it is real and derived: radius
is `√days × 1.15`, the astrolabe's rings are month boundaries, planet mass is
what its arm holds, gold dots shipped and verdigris ones were learned. A visitor
is told none of it. The galaxy spans **286 days** — first website to distributed
systems — and that number is computable from the body set and appears nowhere.

**The console is a mockup.** `grep -rln "lib/engines/pickme" src/` returns
nothing. `LandedConsolePanel` is 470 lines of hardcoded strings — "Sapphire
Reserve", "3x / 1.8cpp" — while `recommend()`, `makePurchase()` and 27 fixture
cases sit unused under CI. Spec §7 gives Products the only diorama *because* its
evidence already exists. Building a surface to mount a mockup on inverts that
reasoning and makes the theatre more expensive rather than less.

## 2. What the spike established

A throwaway build wired descent one level deeper — a stand-in surface on
PickleOps' moon — to answer one question: does three levels read as arriving, or
as clicking through folders?

**It reads as arriving, and the reason is specific.** Standing on the moon with
Products enormous in the background, the frame you came from is still there,
bigger and behind you. That spatial continuity is the whole difference.

**It stops reading as arriving the moment the parent leaves frame.** Twenty
seconds later the moon had orbited away, Products had slid off-screen, and the
shot was a gold ball on a plate in a white void — indistinguishable from a menu.
`descend()` sets a static pose and cannot hold a moving target.

Also found: moons are sub-pointer click targets (two misses at planet framing,
`hits: 0` in the log); ascending one level at a time feels right; the landed
panel renders empty at moon scale; HUD labels read "Planet Moon:Pickleops".

## 3. Decisions

### 3.1 Landing means standing on a surface

Not close orbit. Not a drawer. The camera comes **down onto a ground plane**,
sits low, looks across rather than down, and orbits a point *on* the surface
rather than orbiting the body.

The ground is a **floating shard** — a stylised slice of the place, per §6 —
rather than a curved world. A shard is what a museum diorama uses, it reads as a
deliberate cross-section rather than a failed globe, and it avoids placing props
on a sphere.

Props stand on it at ground scale and are interacted with **as objects**. The
console is a thing you approach and switch on, not a sidebar that appears.

`LandedConsolePanel` survives as the **fallback** for narrow viewports and
reduced motion, where flying to a surface is the wrong interaction. It stops
being the primary path.

### 3.2 The parent frame must stay in view

From a child frame, its parent is visible and prominent. This is a hard
requirement drawn from §2, not a stylistic preference: it is the single property
that separates descent from navigation.

Two consequences. The camera **tracks the frame it descended into**, so an
orbiting moon does not carry the view away from its planet. And orbit radii are
constrained by what keeps the parent in shot — a moon that orbits too far out
cannot show its planet at a readable size.

### 3.3 Moons are frames; only PickMe gets a surface

Every `kind: "system"` body gets a scope and a group, so the model stays a rule
rather than a special case and a fifth venture needs no new code.

Only PickMe gets a surface built on it, for the reason §7 already gave at planet
scale: its evidence exists and 27 CI cases prove it. The other three are
**flybys** — the camera swings in close and the body's card opens. Visibly
different from a landing, honest about there being nothing to stand on, and not
a dead end. When one earns evidence, its flyby becomes a landing.

### 3.4 The orrery, not a door

Travel between a planet's moons happens through a small instrument standing on
the planet's surface: a model of the planet with its moons turning on it. Tapping
one **launches a flight** to it.

The affordance is physical and tappable; the transition is still travel. A
teleport would reintroduce the cut that two plans of work removed. The orrery
also earns its place functionally — moons orbit, so at any moment one or two are
behind the planet, and tapping the sky only reaches what is visible.

### 3.5 A planet's ground is its supporting work

Products' seven non-shipped repositories — `BloombergProject`,
`market-data-pipeline`, `pb_score_keeper`, `Pickleball_League_Score_Tracker`,
`pickleball-league-template`, `pickleball-session-manager`, `return-saas` —
become the props on Products' surface, while the four shipped ventures orbit
overhead.

This answers the question `2026-08-20-zemi-scope-nesting-design.md` §3.1 left
open. The split says something true: what shipped orbits, and what supported it
is the ground it stands on. It also means the hub is a place rather than a lobby
whose only purpose is to be left.

These seven keep `parent: "galaxy:zemi"` and stay drawn on the arm. They are
*rendered* on the surface at surface scale, which is level of detail, not
reparenting — the galaxy's arm density is unchanged.

### 3.6 The legend derives every number it states

The map explains its own grammar: a legend that opens, plus annotations on the
elements themselves. Hover a ring and it names its month; hover a planet and it
says what it is made of.

**No figure in the legend is written by hand.** Each comes from the same function
the map uses — `deriveWorldRadius`, `radiusScale`, `derivePlanets`, `loadBodies`
— and a test asserts the rendered figures equal the derivations. A typed "286
days" is a string that goes stale on the next push; a derived one cannot.

This is the same rule `validateIdeals` enforces for the rings, applied to the
map's own description of itself. It is what makes the legend evidence rather than
copy.

### 3.7 The console runs the real engine

`LandedConsolePanel`'s hardcoded strings are replaced by `recommend()` and
`makePurchase()` against the real catalogue, through the package's existing
public surface. Nothing new is exported from
`src/lib/engines/pickme/index.ts` — `publicSurface.test.ts` pins that list
deliberately.

A visitor enters their own purchase: amount, category, country, channel, accepted
networks. **The form arrives populated**, seeded from the engine's own fixture
cases, each of which already carries a human-readable description such as
*"Standalone grocery (Loblaws), $100, MCC 5411, all networks accepted"*. So the
first thing on screen is a working verdict, and the starting scenarios are
literally the cases under CI.

The cents-per-point control is wired to `breakevenCentsPerPoint`, so dragging it
flips the recommendation at the point the engine computed. That is the claim
"deterministic systems over speculation" made operable rather than asserted.

## 4. What a visitor does

Arrives at the galaxy. Opens the legend and learns that distance is time, that
the rings are months, that 286 days separate the first website from the
distributed systems at the rim.

Flies to Products and lands on it. Seven supporting repositories are underfoot;
four shipped ventures turn overhead; an orrery stands on the ground.

Taps PickMe on the orrery and is launched to it. Lands on its surface — three
satellites around them, Products filling the sky behind — and walks up to the
console.

Enters a purchase. Gets a card. Drags the valuation and watches the answer flip
where the engine says it flips.

## 5. Tracks

Three, and the first is independent of the other two.

| Track | Contents | Depends on |
|---|---|---|
| **A · Legend** | The legend surface, element annotations, derived-figures test | nothing |
| **B · Surface** | Camera tracking, surface camera mode, moon frames, hit proxies, the shard, Products' ground, the orrery, flybys | Plan 2 |
| **C · Console** | Engine wiring, fixture-seeded scenarios, breakeven control, mounting it as an object | B for mounting only |

**Track A should ship first.** It is the cheapest work on the list, it needs no
3D, and it makes the map that already exists substantially more legible. Track C
is buildable against the existing panel before B mounts it on a surface.

## 6. Testing

| Area | Assertion |
|---|---|
| Legend | Every stated figure equals its derivation; no numeric literal in the legend copy |
| Camera | A descended frame stays framed while its target moves; the parent remains within the frustum |
| Moon frames | One scope per shipped system; only PickMe declares a surface |
| Flyby | Tapping an unlanded moon opens its card and does not enter a landed state |
| Orrery | Every moon of the planet is reachable, including ones behind it |
| Console | `recommend()` output drives what is rendered; no hardcoded card names remain |
| Fixtures | Each seeded scenario matches a case in `engine-fixtures.json` |
| Breakeven | Crossing `breakevenCentsPerPoint` changes the winning card |
| Public surface | `publicSurface.test.ts` still passes — the console imports nothing private |
| Keyboard | Props, orrery and console are focusable with accessible names; descend and ascend are reachable |
| Reduced motion | Launch arrives without travel; nothing becomes unreachable |

## 7. Risks

| # | Risk | Mitigation | Residual |
|---|---|---|---|
| 1 | **A surface is a lot of authored geometry**, and authored is what this project has avoided. | The vocabulary is authored; the arrangement is derived from the bodies in the scope, per §6. The prop set is recoverable from `SceneBuilder.ts` in `e0abd4e` rather than invented. | Real. Watch the ratio. |
| 2 | **Depth costs time-to-evidence.** Galaxy, planet, moon is three flights before the console. | The legend gives the headline immediately at galaxy level, and the deep link lands directly on the console. | Low once Track A ships. |
| 3 | **The form is a bad arrival moment.** A visitor with no context faces empty fields. | It arrives populated from a fixture case with a verdict already on screen. | Low. |
| 4 | **Frame budget at depth.** A surface, props, an orrery and the console on top of 16,500 field points. | The field culls by scope — the sky thins as you descend, which is also how it should look. | Watch on mobile. |

## 8. Out of scope

- **Surfaces for PickleOps, MarketLens and Inunity.** They are flybys until they
  have evidence worth travelling to. This is §7's rule, applied one level down.
- **The `universe` root and sibling galaxies.** Unchanged: it lands when galaxy
  two is built.
- **Rover, locomotion, pathfinding.** Cut, not deferred. Landing means the camera
  descends and orbits a point on the surface; the visitor never walks.
- **Night mode and Direction C.** Still R2.
- **Reparenting Products' seven supporting repositories.** They render on the
  surface but keep their galaxy parent — §3.5.

## 9. Consequences

"Landing" acquires a single meaning across the codebase and the documents, which
it did not have before: the camera is on a surface, not near a body.

The camera gains a tracked target, which every future frame inherits.

The legend makes the map falsifiable by its own audience — anyone can check that
the rings are months and that the outermost repository is 286 days out. That is a
stronger claim than any copy, and it is the same bet `validateIdeals` already
makes: state nothing the build cannot prove.

And the engine stops being a library nobody calls. That was the justification for
giving Products a diorama at all; until Track C ships, the justification is
unearned.
