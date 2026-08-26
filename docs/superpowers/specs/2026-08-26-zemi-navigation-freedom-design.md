# Navigation freedom

The atlas is a tree and the visitor is always at exactly one node of it. That
is the right model — it is what makes framing, culling and the URL all derivable
from one value — but every way of *moving* through it is currently a discrete
jump, and the camera is walled inside whichever node it is on. This design keeps
the tree and makes moving through it continuous.

Three changes, in the order they should land: a keyboard and a breadcrumb (C),
continuous zoom traversal (A), and a free camera (B). C first, because it is the
orientation layer that makes A feel exploratory rather than disorienting.

## What is wrong today

Six gaps, all consequences of the same design:

1. **Zoom hits an invisible wall at every level.** `setFrameScale` derives
   `maxDistance = max(480, radius * 2.4)` and `minDistance = radius * 0.12` from
   the framed body. Framing a moon, the visitor can zoom out to 2.4× its radius
   and then nothing happens. The instinctive gesture — keep zooming out to back
   out to the parent — is received and silently discarded.
2. **Escape only ascends from a surface.** The effect in `page.tsx` early-returns
   unless `onSurface`. From a planet or moon in orbit the key is dead.
3. **No panning.** `aimAtDescendedFrame` re-derives the target from the frame's
   matrix every frame, so there is nowhere for a lateral offset to live and no
   way to look at anything but a body's own origin.
4. **No sibling traversal.** Moon → moon and planet → planet require going up a
   level first. The HUD arm buttons shortcut this for planets; moons have
   nothing.
5. **No breadcrumb.** Nothing on screen says where the visitor is in the tree,
   which is what makes every one of the above feel like being lost rather than
   being somewhere.
6. **Reset promises the galaxy and delivers the solar system.** Both tooltips
   say "Galaxy"; the reducer returns `AT_SOLAR_SYSTEM`. `AT_GALAXY` is declared
   beside it and never used.

## The level ladder

Everything below is stated against one vocabulary, which already exists:

- `Position` / `Framing` name the level: `galaxy → solarSystem → planet → moon
  → surface`.
- `ascendFrom(position, bodies)` walks one level up, and is the only place that
  knows how.
- `positionFor(scopeId)` walks one level *down*, given a scope to land on.
- `scopeChain(scopeId)` returns the ancestors root-first — the breadcrumb, as
  data, already.

No new tree is introduced. What is new is that the wheel, the keyboard and the
breadcrumb all become ways of calling the same two walks.

## C — Keyboard and breadcrumb

### Breadcrumb

A `WorldBreadcrumb` component rendering `Galaxy › Atlas › Products › PickMe`
from `scopeChain(scopeIdFor(journey.position))`, with the galaxy as a synthetic
root segment (it has no scope of its own). Every segment is a button;
activating segment *i* navigates to that level.

It renders wherever it does not fight the existing HUD — under the logo at
top-left is the natural slot, and it should hide itself at `galaxy`, where the
chain is one segment long and says nothing.

### A single navigation verb for going down

The canvas, the breadcrumb and the keyboard all need "go to this scope". Rather
than three call sites choosing between `selectSector`, `selectBody` and
`selectSolarSystem` and drifting apart the way the four camera props once did,
one verb is added:

```ts
| { type: "descendTo"; scopeId: ScopeId }
```

resolving to `{ position: positionFor(scopeId), card: null, console: null }`.
`positionFor` already returns each scope's outermost mode, so a moon arrives in
flyby and a planet in orbit, exactly as tapping does.

### Keys

Bound in one effect, not scattered per-component. The guard matters more than
the bindings: keys are ignored while `!sceneIsClear` (any panel, card, dossier,
legend or terminal open) and while the event target is an `input`, `textarea` or
`contenteditable`. The existing per-panel Escape handlers keep precedence
because they already stop propagation.

| Key | Does |
|---|---|
| `Escape` | Ascend one level, from any level (at `galaxy` this is a no-op, because `ascendFrom` says so) |
| `←` `→` `↑` `↓` / `WASD` | Orbit — the same deltas `onPointerDrag` takes |
| `+` `-` | Zoom, the same delta `onWheelZoom` takes |
| `[` `]` | Previous / next sibling at the current level |
| `Enter` | Descend into the body nearest the view centre |

Orbit, zoom and centre-descend are camera questions, so `WorldCanvasHandle`
grows `orbitBy(dx, dy)`, `zoomBy(delta)` and `centeredScopeId()`. Sibling
cycling is a tree question and belongs beside `ascendFrom` as
`siblingsOf(position, bodies)`.

`siblingsOf` returns the positions sharing a parent, in the tree's own order,
and cycling wraps at both ends. At `galaxy` there is no parent and the list is
the position itself, so `[` and `]` are inert there rather than special-cased at
the call site.

## A — Continuous zoom traversal

Zooming out past a level's ceiling ascends; zooming in past a body's floor
descends into it. The wall becomes a threshold.

### Not on the first tick

A single flick must never traverse two levels, and a trackpad's thirty small
deltas must not add up to an accident. So the limits still clamp, and pressure
against a clamped limit accumulates:

```
proposed > maxDistance  →  radius = maxDistance;  overzoom.out += (proposed - maxDistance) / maxDistance
proposed < minDistance  →  radius = minDistance;  overzoom.in  += (minDistance - proposed) / minDistance
otherwise               →  both decay toward zero
```

When either accumulator crosses `OVERZOOM_TRIGGER`, the manager reports a
traversal, zeroes both, and refuses to report another for
`TRAVERSE_COOLDOWN_MS` — because ascending re-frames and the very next wheel
tick would otherwise cascade.

`OVERZOOM_TRIGGER = 0.6` is sized against the existing zoom curve rather than
taste. `onWheelZoom` multiplies by `1 + |deltaY| * 0.0012`, so one mouse notch
(`deltaY ≈ 100`) contributes about 0.12 at the wall: five deliberate notches to
traverse. A trackpad flick of thirty events at `deltaY ≈ 5` contributes about
0.18 in total, well under. The accumulators also decay with a ~0.4s time
constant in `update`, so a slow nudge never reaches the threshold by patience
alone.

### Where zooming in lands

Ascending needs no target; descending does. The rule is the body nearest the
view centre among the current level's children, which the canvas can answer from
the anchors it already projects for the pins — no new raycast. If the nearest
candidate is further from the centre than 35% of the viewport's short side,
nothing is descended into: the visitor is looking at empty space and should be
left there.

### Who tells whom

The camera must not learn what a journey is. `WorldCameraManager` gains an
`onTraverse?: (dir: "in" | "out") => void` callback; `WorldCanvas` sets it and
maps `"out"` to an ascend and `"in"` to a `descendTo` with the centred scope.
The journey decisions stay in `page.tsx`, where they already are.

## B — Free camera

A frame-local pan offset, so it rides the frame instead of fighting the
per-frame re-derivation:

- `descended.panOffset: THREE.Vector3`, in the frame's local space.
- `aimAtDescendedFrame` composes `offset + panOffset` before applying
  `frame.matrixWorld` — one added term, no new code path.
- Screen dx/dy convert to a world delta along the camera's right and up vectors,
  scaled by the current orbit radius so the drag tracks the pointer at any
  distance, then into frame-local space by the inverse of the frame's rotation.
- `panOffset.length()` is clamped to `radius * PAN_LEASH` (3), so the world can
  be composed off-centre but not left behind.
- Cleared by `descend`, `ascend`, `setPreset` and reset.

Input is middle-drag or shift+left-drag. Left-drag stays pure orbit; a
modifier-free drag must not change meaning.

**Panning is disabled while landed.** A surface camera's target is the ground it
stands on, and sliding that sideways walks the visitor off their own shard — the
same reason the pitch ceiling stays at the horizon for `this.surface` and opens
only for free orbit.

## Reset, in two stages

Reset carries its destination so the reducer stays pure:

```ts
| { type: "reset"; to?: "solarSystem" | "galaxy" }
```

`page.tsx` decides which. The first press returns to `AT_SOLAR_SYSTEM` and shows
a transient hint — "Press again for the galaxy" — which dismisses itself after
about four seconds. A second press *while already at a solar system and inside
that window* resets to `AT_GALAXY`. Outside the window it is a first press
again, so the button never surprises anyone who walked away from it.

Both tooltips are corrected to describe the two stages rather than promising the
galaxy outright.

The spread that makes reset arrive at all — returning `{ ...AT_SOLAR_SYSTEM }`
rather than the constant, so `useReducer` cannot bail out on identity — is
already in place and stays.

## What does not change

- The tree, and the fact that the visitor is at exactly one node of it.
- `Framing` as the single value the canvas switches on.
- Every existing click path: pins, HUD arms, system switcher, deep links.
- The landed camera's ground-safe pitch ceiling and, now, its ban on panning.

## Testing

Pure logic, tested without a scene, in the way the atlas already tests framing:

- **Overzoom:** one notch does not traverse; five do; a thirty-event trackpad
  flick does not; the accumulator decays; the cooldown suppresses a cascade;
  zooming back inside the band clears pressure.
- **Pan:** offset rides a moving frame; the leash clamps; `descend`/`ascend`
  clear it; a landed camera refuses it.
- **Journey:** `descendTo` for each level; `siblingsOf` wraps at both ends and
  agrees with the scope tree; `reset` honours `to`.
- **Breadcrumb:** the chain rendered for each level, and that the galaxy hides
  it.
- **Keys:** every binding is inert while a panel is open or a field is focused.

## Risks

1. **Thresholds are feel, not correctness.** `OVERZOOM_TRIGGER`,
   `TRAVERSE_COOLDOWN_MS` and `PAN_LEASH` are the kind of number this codebase
   documents against its binding constraint rather than leaving to taste; the
   reasoning above should live at each constant, and all three want tuning
   against the real thing.
2. **Traversal can feel like an accident** even when it was deliberate. The
   breadcrumb landing first is the mitigation, and it is why C precedes A.
3. **Pan is the one change that touches the load-bearing follow logic.** It
   lands last, behind tests that a panned camera still tracks a moving moon.
