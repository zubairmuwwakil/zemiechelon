# Zemí Atlas — Design

**Date:** 2026-08-19
**Status:** Approved for R1
**Supersedes:** the "Living City" isometric island world (`src/components/world/SceneBuilder.ts`)

---

## 1. Problem

`zemiechelon.com` currently renders a 3D isometric island city. It is technically
substantial but tells the wrong story, and its two "interactive" surfaces are
theatre:

- `PickleballMiniGame.tsx` — 97 lines, a click counter with encouraging strings.
- `MiniTerminalModal.tsx` — 188 lines of `case "bio": res = "..."`, hardcoded.

A visitor who plays with the site learns nothing about whether Zubair can build.

Separately, the site models ~10 curated projects. The GitHub account holds **44
authored repositories** spanning 2025-11-06 to 2026-08-19 — 286 days from a
repo literally described as *"first website"* to a four-product financial
ecosystem with a versioned cross-repo architecture contract, a 78 KB card
catalogue with cited provenance, and an executable engine specification.

**That 286-day slope is the strongest single fact about the author, and the
current design makes it invisible.**

## 2. Decision

Replace the island city with a **celestial atlas**: a spiral galaxy in which
position is derived from real repository metadata, rendered in the aesthetic of
a 17th-century star atlas (Cellarius' *Harmonia Macrocosmica*) rather than a
sci-fi HUD.

Three commitments follow from this:

1. **Position is derived, never authored.** No node has hardcoded coordinates.
   Adding a venture is adding a row.
2. **Demos are the product.** The map is the arrival moment; the consoles are
   the evidence. R1 ships with a real one.
3. **Nothing is hidden.** All 44 repos appear. Hierarchy comes from derived
   visual weight, not from curation.

### Why an atlas and not a starfield

- The brand motto shipped in `f05d00d` is **Plus Ultra** — *further beyond*, the
  Pillars of Hercules phrase for sailing past the edge of the known map. That is
  a cartographic motto.
- `ZemiMark.tsx` is stratified; its own paths are commented
  `Base Ancestral Foundation (Obsidian Tier)`, then `Lower Echelon Tier
  (Emerald)`, then gold. The mark is already a cross-section of accumulated
  layers, deepest at the base.
- The existing palette is warm off-white (`#f7f6f2`) with gold, emerald and
  obsidian. That is native to ink-on-paper and hostile to glow-on-black.
- Glowing dots on black is the single most common look in AI-assisted portfolios
  in 2026. Engraved gold on cream is not.

---

## 3. Coordinate system

```
epoch     = 2025-11-06          # earliest repository createdAt
frontier  = today               # advances on its own
span      = frontier - epoch    # 286 days at time of writing

r(node)   = radiusScale( node.bornAt - epoch )              # createdAt -> radius
θ(node)   = armAngle(node.arm) + windRate * ln(r)           # logarithmic spiral
mag(node) = magnitude(body)                                 # see 4.2 - size + cull priority
temp(node)= f( frontier - node.lastTouchedAt )              # warm = alive, cool = dormant
```

**The core is the beginning, not the present.** Arms diverge outward as the work
diversifies; the frontier is now; beyond the frontier is unbuilt. This is the
inverse of astronomical light-travel time and is chosen deliberately: spiral arms
diverge outward, so a converging origin must be at the centre. It also means new
work extends the rim, so the galaxy visibly grows, and `Plus Ultra` reads
literally as the uncharted edge.

Consequence: at the centre of everything, at r ≈ 0, sits `HTMl_CAT_WEBSITE`,
described in its own repo metadata as *"first website"*.

### 3.1 Arms

Five populated arms. There is **no** "Ventures" arm — unbuilt work is the space
*beyond the rim* in every direction, not a labelled empty spoke, which would read
as a rendering bug.

| Arm | Count | Character |
|---|---|---|
| **Foundations** | 19 | Dense at the core, fades before the frontier — the author graduated out of it |
| **Products** | 11 | Absent at the core, dense at the frontier — all of it is recent |
| **Labs** | 7 | Begins mid-radius, still growing |
| **Self** | 6 | Sparse but spread across the entire radius — portfolio work never stopped |
| **Creative** | 2 | Two young stars at the frontier — an arm currently forming |

Arm *reach* is itself information: the shape of each arm narrates a phase of the
author's development without a word of copy. A two-node arm is acceptable and
meaningful — it shows emergence, not emptiness.

Counts above are *total bodies*, including the six anonymous private bodies
(§4.1), which distribute as Foundations 2 (`Obsidi-Academy`, `A1.6_AI_Slop`),
Products 2 (`pickleball-session-manager`, `market-data-pipeline`), Labs 1
(`AiMiniProj`), Creative 1 (`Obsidian`). Labelled counts are therefore
Foundations 17, Products 9, Labs 6, Self 6, Creative 1 — 39 of 45.

Assignments are declared in data (§4) and are the one genuinely editorial input
in the system. Everything else derives.

### 3.2 Two facts about time, not one

Repository metadata carries two dates, and they mean different things:

- `createdAt` → **radius**. Where the star formed.
- `pushedAt` → **temperature**. Whether it is still burning.

These diverge sharply in the real data. `marketdata` was created 2026-01-03 and
pushed 2026-08-19: it sits at a January radius but burns at frontier
temperature. `zweb`, at nearly the same radius, is cold — created and abandoned
2026-01-05.

**Every node therefore renders a trail** from its birth radius to its last-touch
radius. A one-day repo is a point. `marketdata` is a 7.5-month streak.

This solves a problem the real data creates: repository *creation* nearly stops
between 2026-02-01 and 2026-07-08, a five-month band that would otherwise render
as a dead gap. It was not a dead period — work continued inside repos created
earlier. The trails cross the gap and fill it. The map tells the truth without
needing an apology in the copy.

---

## 4. Data model

```ts
type ArmId = 'foundations' | 'products' | 'labs' | 'self' | 'creative'

interface Body {
  id: string                  // repo name, canonical
  label: string               // display name (e.g. "Inunity", not "MoneyTalks")
  arm: ArmId                  // editorial -> θ
  bornAt: string              // ISO date, from createdAt -> r
  lastTouchedAt: string       // ISO date, from pushedAt -> temperature + trail
  kind: 'star' | 'system'
  magnitude: number           // derived weight; drives size and cull order
  blurb?: string
  stack?: string[]
  links: { github?: string; live?: string; appStore?: string }
  satellites?: Satellite[]    // systems only
  consoleId?: ConsoleId       // systems only; presence implies a descent target
}

interface Satellite {
  id: string
  label: string               // e.g. "Apple Pay capture", "compliance engines"
  blurb: string
}
```

`Body` carries **no x/y/z**. `derivePosition(body, epoch, frontier) → Vec3` is a
pure function and the single source of layout truth.

Repository metadata is fetched at **build time** via `gh` into a checked-in
`src/data/bodies.generated.json`, merged with a hand-maintained
`src/data/bodies.overrides.ts` holding arm assignments, display labels, blurbs,
and satellites. Build-time keeps the site static and prevents a GitHub outage
from breaking the page.

### 4.1 Inclusions and exclusions

- 44 authored (non-fork) repositories are included.
- Five forks are excluded: `yfinance`, `flash`, `OrcaSlicer-bambulab`,
  `Exercise01_08`, `obsidi-academy-cohort-10`.
- One fork is **included** by exception: `openclaw`, assigned to Labs, because
  its description states it will serve as the orchestrator's top layer. This is
  the only fork exception and is listed explicitly so it can be revoked.
- Six private repositories — `Obsidian`, `pickleball-session-manager`,
  `market-data-pipeline`, `Obsidi-Academy`, `AiMiniProj`, `A1.6_AI_Slop` — render
  as **anonymous bodies**. They keep arm, position, magnitude and trail; they
  carry no label, blurb, stack, or link, and no card panel opens on click. They
  contribute to the shape of the galaxy without disclosing anything.
  `bodies.generated.json` must not contain their descriptions or topics; the
  build strips those fields rather than relying on the client to hide them.

### 4.2 Fetched fields and magnitude

`scripts/build-bodies.ts` calls `gh repo list zubairmuwwakil --limit 100 --json`
once, requesting exactly: `name`, `description`, `createdAt`, `pushedAt`,
`isPrivate`, `isFork`, `primaryLanguage`, `repositoryTopics`. One request, no
per-repo N+1.

**Magnitude is not derived from repository size.** `diskUsage` is available and
is a trap: the `Obsidian` vault reports 24,973 KB against `MoneyTalks` at 1,765
KB and `zemiechelon` at 207 KB, which would make a private notes vault the
brightest object in the galaxy. Commit count is also rejected, as it requires a
per-repo API call at build time.

```ts
function magnitude(body: Body): number {
  if (body.kind === 'system') return SYSTEM_MAGNITUDE          // flagships pinned
  const lifespanDays = days(body.lastTouchedAt) - days(body.bornAt)
  return BASE + lifespanScale(lifespanDays) + SATELLITE_K * (body.satellites?.length ?? 0)
}
```

Lifespan is the honest derived signal: how long a repository stayed alive. It
correctly separates `marketdata` (228 days) from `Coin_Flipper` (0 days). It
under-weights recent flagships — `PickMe` is four days old — which is exactly why
`kind: 'system'` pins magnitude instead of deriving it.

---

## 5. Layer architecture

Three layers, one shared `PerspectiveCamera`. Each has one job and is testable
alone.

| Layer | Technology | Owns | Must never |
|---|---|---|---|
| **Field** | raw three.js | ~20k background stars, arm dust, nebula, trails, flow particles | contain anything clickable |
| **Chart** | DOM, screen-projected | 45 hit targets (39 labelled, 6 anonymous), arm curves, annotations | exceed ~1k elements |
| **Console** | React | the demos, at full fidelity | know the camera exists |

The projection bridge already exists and is retained: `WorldCanvas` →
`onPinsUpdate` → `ScreenPinPosition` → `WorldPin`. It currently labels islands;
it will label stars.

**Why the Chart is DOM and not WebGL:** nodes must be tab-navigable, screen-
reader legible, findable with browser find, indexable by crawlers, and
deep-linkable (`/#/marketlens`). A WebGL node graph is an opaque `<canvas>` to
every one of those. For a site whose stated purpose is to express who the author
is, that is a self-inflicted wound.

### 5.1 What is deleted

`src/components/world/SceneBuilder.ts` — all 810 lines. Islands, plazas, wind
turbines, vegetation, clouds, and the per-sector build methods
(`buildFintechPlaza`, `buildAIYard`, `buildPickleballArena`).

Three of its ideas survive as different implementations: `courierBots` become
flow particles, `nightEmissives` become temperature-based dimming, `buildClouds`
becomes nebula dust.

**The reason the per-sector build methods must go:** they hardcode geometry per
sector, so venture #12 requires a twelfth build method. In the derived model a
node is data. That is what delivers "new ventures appear without redesigning the
experience."

### 5.2 What is retained

`WorldHUD`, `SectorDrawer`, `QuickDossierModal`, `MiniTerminalModal`,
`lib/audio.ts`, and `WorldPin` (simplified — 2D projection of a 3D point is
cheaper than the current unprojection path). `CameraManager` is rewritten
smaller. `data/ecosystem.ts` is superseded by the `Body` model but its prose
content is migrated into `bodies.overrides.ts`.

---

## 6. Console contract

The contract is the thing that decides whether this design rots. Without it,
console #7 costs what console #1 cost.

```ts
interface ConsoleModule {
  id: ConsoleId
  title: string
  Component: LazyExoticComponent<ComponentType<ConsoleProps>>  // code-split
  seed: () => Promise<SeedData>        // loads that project's real fixtures
  emits?: FlowEventType[]              // event types it can publish
  accepts?: FlowEventType[]            // event types it can receive
}
```

**Consoles never import one another.** A console publishes a typed event; the
flow layer decides who receives it and animates the journey. This is what allows
the cross-product flow (§10) to exist without coupling the products together,
and it is why each new console is additive rather than a refactor.

Descent is shared machinery: camera pushes toward the node, Field dims and
blurs, Console fades up. One implementation, used by every system. A new console
costs *a look and a demo*, never a navigation mode.

---

## 7. R1 scope

R1 ships the shell **and** one real console. Shipping the shell alone would
reproduce the current failure — a beautiful surface with nothing behind it.

Three tracks. A and B have no dependency on each other and can be built in
either order or concurrently; they meet only at C.

### Track A — Shell

- `derivePosition()` and the arm/spiral model
- Field layer: stars, dust, trails, temperature
- Chart layer: 45 projected hit targets (39 labelled, 6 anonymous), arm curves
- Atlas visual treatment (§9)
- Orbit, zoom, focus; tap-to-focus on touch
- Card panel on star click (name, era, stack, links)
- Deep links: `/#/<repo-id>`

### Track B — `@zemi/pickme-engine`

A TypeScript port of the PickMe checkout-recommendation path. Measured scope,
from `PickMe/Engine/Sources/CardCopilotEngine`:

| Ported | LOC |
|---|---|
| `RecommendationEngine.swift` | 176 |
| `CapProjector.swift` | 294 |
| `Scorer.swift` | 141 |
| `RuleMatcher.swift` | 121 |
| `CatalogueModels.swift` | 132 |
| `OwnerState.swift` | 119 |
| `Explainer` + `CapWindow` + `CapMath` + `PurchaseContext` | 215 |
| **Total** | **~1,198** |

Explicitly **not** ported in R1 (~2,036 lines): `RecurringAuditor`,
`PortfolioAnalyzer`, `BenefitsAdvisor`, `CategoryPickerAdvisor`, `AmbientGate`,
`AcquisitionAnalyzer`, and their models. These serve other product surfaces, not
the checkout pick.

The package contains no platform APIs — no SwiftUI, no SwiftData. It is
arithmetic and rule matching, which is why it ports.

### Track C — PickMe console

The console is **not** a form that prints a card name. `RecommendationEngine`
already returns `valuationSensitive`, `breakevenCentsPerPoint`,
`alternateWinnerCardId`, and `suppressedBetterCard` — the last documented in
source as *"a card that beat the default but not by enough to be worth digging
out the wallet."*

So the console is a **valuation slider**: drag cents-per-point and watch the
recommendation flip at the breakeven, live, with the losing card sliding past the
winner. Plus an explicit "not worth digging out your wallet" state.

Rationale: any competent developer can compute which card earns most. Modelling
*"technically better, but not worth the friction"* is a product decision encoded
in an engine, and it is currently invisible on GitHub. Surfacing it is the
difference between demonstrating that the author can code and demonstrating that
the author can build products.

---

## 8. Testing

**Fixture parity is the load-bearing test.** `PickMe/contracts/engine-fixtures.json`
describes itself as an *"executable spec for RecommendationEngine"* and contains
27 cases with exact expected outputs, over a 27-card catalogue.

The ported engine runs all 27 and must match exactly. CI fails on any mismatch.
This converts the console from "a demo of PickMe" into "PickMe's actual decision
logic, provably" — a claim no amount of visual polish can substitute for.

`contracts/*.json` are vendored into this repo by `scripts/sync-contracts.sh`
and committed. Re-running the sync after a PickMe catalogue change surfaces
drift immediately as a CI failure. A shared cross-repo package would be more
correct and is more machinery than a static site earns; this is the deliberate
trade.

Additional coverage:

- `derivePosition()` is pure — snapshot tests over the full body set, so layout
  cannot silently regress.
- Arm assignment completeness — every body resolves to exactly one arm; an
  unassigned repo fails the build rather than rendering at the origin.
- Deep-link resolution for every body id.
- Reduced-motion and keyboard-only navigation paths.

---

## 9. Visual treatment

Reference: Cellarius, *Harmonia Macrocosmica* (1660); Bayer, *Uranometria* (1603).

- Ground: the existing warm `#f7f6f2`, not black
- Ink linework for arm curves, graticules, and annotation rules
- Gold leaf (`#d97706` → `#fbbf24`, already in `ZemiMark`) for frontier bodies
- Emerald (`#047857` → `#10b981`) for live systems
- Obsidian for dormant bodies and the deep field
- Hand-lettered annotation style for arm names and era rings
- `Plus Ultra` engraved at the rim, marking the uncharted edge

This is the hardest part of R1 and the risk is aesthetic, not technical (§11).

---

## 10. Out of scope for R1

Listed so they are not smuggled in:

- Consoles for MarketLens, ORC, Inunity, Looply, pickleops — R3+
- Flow choreography (Apple Pay → PickMe → Inunity → MarketLens) — requires at
  least two consoles to exist; R4+
- Any live backend or deployed service. All demos are ported or simulated,
  client-side. The site remains a static export.
- Satellite descent (entering an individual satellite of a system)
- Audio design beyond retaining the existing `lib/audio.ts`

### Note on the flow, for when it arrives

The flow is a **narrative device on this site only**. `MoneyTalks/ECOSYSTEM.md`
lists "event broker" under *Never on this path*; the flow visualisation must not
become, or imply, a production integration between the products. One synthetic
transaction, choreographed. Nothing crosses a real product boundary.

### Note on simulated systems

MarketLens and ORC will be **simulated, not deployed** — a decision taken on
cost, but a better outcome regardless. A live MarketLens returns JSON and shows
nothing. A simulation can show the quarantine buffer isolating a malformed row,
the Bucket4j token bucket draining and refilling, an idempotent re-run detecting
it already ran, and the NYSE calendar rejecting a weekend fetch. Simulations are
more legible than deployments because the camera is under our control.

---

## 11. Risks

| # | Risk | Mitigation | Residual |
|---|---|---|---|
| 1 | **Atlas aesthetic is hard.** Engraved gold-on-cream executed badly reads dated, not crafted. This is the largest R1 risk and it is a design risk, not an engineering one. | Prototype the treatment on a static frame before building the live Field layer; abandon to a simpler ink-only palette if it does not land. | Real. Accept and monitor. |
| 2 | **Frontier density.** Aug 2026 is a pileup — 11 repos in 14 days. | Magnitude-based culling per zoom level; satellites hidden until close; label collision resolution. | Manageable. |
| 3 | **Port drift.** The TS engine diverges from Swift over time. | Vendored fixtures plus a CI parity gate. | Detectable, not preventable. Accepted. |
| 4 | **Mobile.** Free 3D orbit on a phone is poor. | Tap-to-focus instead of orbit; reduced particle budget; Chart layer degrades to a list at narrow widths. | Manageable. |
| 5 | **The 2026-02 → 2026-07 creation gap** could read as inactivity. | Trails (§3.2) cross the gap and fill it with sustained-work streaks. | Resolved by design. |

---

## 12. Consequences

**Gained:** a map whose every position is derived from verifiable metadata; a
demo that is provably the real engine; a structure that absorbs new work without
redesign; accessibility and indexability the current canvas-only world lacks.

**Lost:** 810 lines of hand-built island geometry, and the "living city" texture
that came with it. A galaxy has no architecture, and the metaphor does not want
buildings.

**Deferred:** every console after PickMe, and the flow that makes the ecosystem
legible as an ecosystem. R1 proves the pattern; it does not complete the story.
