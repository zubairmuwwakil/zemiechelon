# Zemí Atlas Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the isometric island city with a navigable spiral galaxy of 45 bodies whose positions are derived from real repository metadata, rendered as a 17th-century celestial atlas.

**Architecture:** Three layers over one shared `PerspectiveCamera`. The **Field** (raw three.js) draws everything ambient and nothing clickable. The **Chart** (DOM, positioned by projecting 3D points to screen) owns all 39 hit targets, so navigation is keyboard-reachable, screen-reader legible, crawler-visible and deep-linkable. **Consoles** (React) are out of scope here — this plan only reserves their mount point. Position is a pure function of repository metadata; no body carries authored coordinates.

**Tech Stack:** Next.js 16 (App Router, static export), React 19, TypeScript 5, three.js 0.185, Tailwind CSS v4, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-19-zemi-atlas-design.md`

**Deliberately not in this plan:** spec §6, the `ConsoleModule` contract. Track A reserves the mount point (Task 7) and nothing more. Defining the contract before there is a console to satisfy it would be designing an interface against zero implementations — it belongs to Track C, with the PickMe console as its first and only consumer.

## Global Constraints

- **Requires `docs/superpowers/plans/2026-08-19-pickme-engine-port.md` Task 1 to be complete.** That task installs Vitest and creates `vitest.config.ts`. This plan assumes a working `npm test`. Nothing else from the engine plan is a dependency — the two tracks are otherwise independent.
- Node `>=20.9.0`. `next.config.ts` keeps `output: "export"` — no API routes, no request-time fetching, no runtime backend.
- **No new runtime dependencies.** `three` is already in `package.json`. Do not add `@react-three/fiber`, `@react-three/drei`, `d3`, or an animation library. Test-only devDependencies are fine.
- **Positions are derived, never authored.** No `Body` carries x/y/z. If you find yourself hardcoding a coordinate to make the layout look better, change the derivation instead.
- The ground stays warm: `--background: #f7f6f2`, already in `src/app/globals.css`. This is an ink-on-paper atlas, not a starfield. Never introduce a black page background.
- Brand colours are already defined in `src/components/icons/ZemiMark.tsx`: gold `#fbbf24`→`#f59e0b`→`#d97706`, emerald `#10b981`→`#059669`→`#047857`, obsidian `#27272a`→`#09090b`.
- **Anonymous bodies** (the 6 private repos) render in the Field layer only — a sprite and a trail, no label, no link, and **no DOM hit target**. An element that does nothing on click is a focus trap.
- Epoch is `2025-11-06`, the earliest repository `createdAt`. The frontier is today and advances on its own — never hardcode it.

## Design Facts You Need

Derived from the live GitHub account on 2026-08-19. The build script re-derives these; they are here so you can sanity-check its output.

| Arm | Total bodies | Anonymous | Labelled |
|---|---|---|---|
| Foundations | 19 | 2 (`Obsidi-Academy`, `A1.6_AI_Slop`) | 17 |
| Products | 11 | 2 (`pickleball-session-manager`, `market-data-pipeline`) | 9 |
| Labs | 7 | 1 (`AiMiniProj`) | 6 |
| Self | 6 | 0 | 6 |
| Creative | 2 | 1 (`Obsidian`) | 1 |
| **Total** | **45** | **6** | **39** |

45 = 44 authored non-fork repos + `openclaw`, included by exception. Five other forks are excluded: `yfinance`, `flash`, `OrcaSlicer-bambulab`, `Exercise01_08`, `obsidi-academy-cohort-10`.

Two dates per body, and they mean different things:
- `createdAt` → **radius**. Where the star formed.
- `pushedAt` → **temperature** and the far end of its **trail**.

They diverge sharply. `marketdata` was created 2026-01-03 and pushed 2026-08-19 — a January radius burning at frontier temperature, with a 7.5-month trail. `zweb` sits at nearly the same radius, created and abandoned 2026-01-05, cold and trail-less. Repository *creation* nearly stops between 2026-02-01 and 2026-07-08; the trails cross that gap and fill it, which is the whole reason trails exist.

---

## File Structure

**Created:**

| File | Responsibility |
|---|---|
| `scripts/build-bodies.mjs` | One `gh` call → `src/data/bodies.generated.json`. Strips private repos' descriptions and topics. |
| `src/data/bodies.generated.json` | Generated, committed. Metadata only. |
| `src/data/bodies.overrides.ts` | The only editorial input: arm, display label, blurb, stack, satellites, `kind`. |
| `src/lib/atlas/types.ts` | `ArmId`, `Body`, `Satellite`, `Vec3`, `ScreenPoint`. |
| `src/lib/atlas/bodies.ts` | Merges generated + overrides into `Body[]`. Fails the build on an unassigned repo. |
| `src/lib/atlas/position.ts` | `derivePosition`, `trailEnd`, `polar`, `radiusScale`. Pure. |
| `src/lib/atlas/magnitude.ts` | `magnitude`, `temperature`. Pure. |
| `src/components/atlas/AtlasCamera.ts` | Orbit camera + `projectToScreen`. Replaces `CameraManager`. |
| `src/components/atlas/FieldBuilder.ts` | three.js construction: background stars, arm dust, body sprites, trails. Replaces `SceneBuilder`. |
| `src/components/atlas/Field.tsx` | React wrapper: renderer, animation loop, pointer input, per-frame projection. |
| `src/components/atlas/Chart.tsx` | Projected DOM hit targets, arm labels, era rings. |
| `src/components/atlas/BodyCard.tsx` | The panel that opens on click. |
| `src/components/atlas/AtlasStage.tsx` | Composes Field + Chart + BodyCard; owns selection and camera state. |

**Deleted:**

- `src/components/world/SceneBuilder.ts` (810 lines)
- `src/components/world/CameraManager.ts` (superseded by `AtlasCamera`)
- `src/components/world/WorldCanvas.tsx` (superseded by `Field`)
- `src/components/hud/WorldPin.tsx` (superseded by `Chart`)
- `src/components/world/types.ts` (superseded by `src/lib/atlas/types.ts`)

**Retained untouched:** `src/lib/audio.ts`, `src/components/hud/MiniTerminalModal.tsx`.

**Retained, rewired in Task 8:** `src/components/hud/WorldHUD.tsx`, `SectorDrawer.tsx`, `QuickDossierModal.tsx`.

---

### Task 1: Body data model and build script

**Files:**
- Create: `scripts/build-bodies.mjs`
- Create: `src/data/bodies.generated.json` (generated)
- Create: `src/data/bodies.overrides.ts`
- Create: `src/lib/atlas/types.ts`
- Create: `src/lib/atlas/bodies.ts`
- Create: `src/lib/atlas/__tests__/bodies.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `types.ts`: `type ArmId = 'foundations' | 'products' | 'labs' | 'self' | 'creative'`; `interface Satellite { id: string; label: string; blurb: string }`; `interface Body { id: string; label: string; arm: ArmId; bornAt: string; lastTouchedAt: string; kind: 'star' | 'system'; anonymous: boolean; blurb?: string; stack?: string[]; links: { github?: string; live?: string; appStore?: string }; satellites?: Satellite[]; consoleId?: string }`
  - `bodies.ts`: `loadBodies(): Body[]`, `EPOCH = '2025-11-06'`

- [x] **Step 1: Write the build script**

Create `scripts/build-bodies.mjs`:

```js
#!/usr/bin/env node
// Fetches repository metadata once and writes src/data/bodies.generated.json.
// Run by hand when the repo list changes, then commit the result.
// Not run by the build: a GitHub outage must never break the page.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const EXCLUDED_FORKS = new Set([
  "yfinance", "flash", "OrcaSlicer-bambulab",
  "Exercise01_08", "obsidi-academy-cohort-10",
]);
// Forks kept by exception, with the reason recorded so it can be revoked.
const INCLUDED_FORKS = new Map([["openclaw", "top layer of the orchestrator"]]);

const raw = JSON.parse(execFileSync("gh", [
  "repo", "list", "zubairmuwwakil", "--limit", "100", "--json",
  "name,description,createdAt,pushedAt,isPrivate,isFork,primaryLanguage,repositoryTopics",
], { encoding: "utf8" }));

const bodies = raw
  .filter((r) => (r.isFork ? INCLUDED_FORKS.has(r.name) : true))
  .filter((r) => !EXCLUDED_FORKS.has(r.name))
  .map((r) => ({
    id: r.name,
    bornAt: r.createdAt.split("T")[0],
    lastTouchedAt: r.pushedAt.split("T")[0],
    anonymous: r.isPrivate,
    // Private repos disclose nothing beyond their existence and dates.
    // Stripped HERE, at build time — never shipped and hidden in the client.
    description: r.isPrivate ? null : (r.description ?? null),
    language: r.isPrivate ? null : (r.primaryLanguage?.name ?? null),
    topics: r.isPrivate ? [] : (r.repositoryTopics ?? []).map((t) => t.name ?? t),
  }))
  .sort((a, b) => a.id.localeCompare(b.id));

writeFileSync(
  "src/data/bodies.generated.json",
  JSON.stringify({ generatedFrom: "zubairmuwwakil", bodies }, null, 2) + "\n",
);
console.log(`wrote ${bodies.length} bodies (${bodies.filter((b) => b.anonymous).length} anonymous)`);
```

- [x] **Step 2: Add the script to `package.json`**

In `"scripts"`:

```json
"build:bodies": "node scripts/build-bodies.mjs"
```

- [x] **Step 3: Run it**

Run: `npm run build:bodies`
Expected: `wrote 45 bodies (6 anonymous)`

If the count differs, the account has changed since this plan was written. Update the arm table in "Design Facts" and the assertions below to match reality — do not force the old numbers.

- [x] **Step 4: Write `src/lib/atlas/types.ts`**

Declare `ArmId`, `Satellite` and `Body` exactly as given in this task's **Produces** block, plus:

```ts
export interface Vec3 { x: number; y: number; z: number }
export interface ScreenPoint { id: string; x: number; y: number; visible: boolean; depth: number }
```

- [x] **Step 5: Write the failing test**

Create `src/lib/atlas/__tests__/bodies.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { loadBodies, EPOCH } from "../bodies";
import generated from "@/data/bodies.generated.json";

const bodies = loadBodies();

describe("loadBodies", () => {
  it("returns every generated body", () => {
    expect(bodies).toHaveLength(generated.bodies.length);
  });

  it("assigns every body to exactly one arm", () => {
    const arms = new Set(["foundations", "products", "labs", "self", "creative"]);
    for (const b of bodies) {
      expect(arms.has(b.arm), `${b.id} has invalid arm "${b.arm}"`).toBe(true);
    }
  });

  it("marks exactly the private repos anonymous", () => {
    const anon = bodies.filter((b) => b.anonymous).map((b) => b.id).sort();
    expect(anon).toEqual([
      "A1.6_AI_Slop", "AiMiniProj", "Obsidi-Academy",
      "Obsidian", "market-data-pipeline", "pickleball-session-manager",
    ]);
  });

  it("never leaks an anonymous body's prose or links", () => {
    for (const b of bodies.filter((x) => x.anonymous)) {
      expect(b.blurb, `${b.id} leaked a blurb`).toBeUndefined();
      expect(b.stack, `${b.id} leaked a stack`).toBeUndefined();
      expect(Object.keys(b.links), `${b.id} leaked links`).toHaveLength(0);
      expect(b.label, `${b.id} leaked its name`).not.toContain(b.id);
    }
  });

  it("strips prose from the generated file itself, not just at load", () => {
    for (const g of generated.bodies.filter((x) => x.anonymous)) {
      expect(g.description, `${g.id} leaked into the committed JSON`).toBeNull();
      expect(g.topics).toHaveLength(0);
    }
  });

  it("gives every labelled body a display label and a github link", () => {
    for (const b of bodies.filter((x) => !x.anonymous)) {
      expect(b.label, `${b.id} has no label`).toBeTruthy();
      expect(b.links.github, `${b.id} has no github link`).toBeTruthy();
    }
  });

  it("places no body before the epoch", () => {
    for (const b of bodies) expect(b.bornAt >= EPOCH, `${b.id} predates the epoch`).toBe(true);
  });

  it("never has a body touched before it was born", () => {
    for (const b of bodies) {
      expect(b.lastTouchedAt >= b.bornAt, `${b.id} was touched before birth`).toBe(true);
    }
  });
});
```

- [x] **Step 6: Run it and confirm it fails**

Run: `npm test -- bodies`
Expected: FAIL — cannot resolve `../bodies`.

- [x] **Step 7: Write `src/data/bodies.overrides.ts`**

One entry per body. Anonymous bodies get an arm and nothing else — their label is a generic placeholder like `"Private repository"` and their links object is empty.

```ts
import type { ArmId, Satellite } from "@/lib/atlas/types";

export interface BodyOverride {
  arm: ArmId;
  label?: string;
  kind?: "star" | "system";
  blurb?: string;
  stack?: string[];
  live?: string;
  appStore?: string;
  satellites?: Satellite[];
  consoleId?: string;
}

export const OVERRIDES: Record<string, BodyOverride> = {
  // --- Products (11) ---
  MoneyTalks: {
    arm: "products", label: "Inunity", kind: "system", consoleId: "inunity",
    blurb: "Personal finance command centre. Zero-bank-login Apple Pay capture, multi-currency ledger, 12-month bill forecasting, 24 statutory compliance engines.",
    stack: ["Next.js 16", "TypeScript", "Prisma", "Neon"],
    live: "https://inunity.ca",
    satellites: [
      { id: "wallet", label: "Apple Pay capture", blurb: "iOS Wallet Automations post transactions with no bank login." },
      { id: "ledger", label: "Multi-currency ledger", blurb: "CAD/USD/JMD with Bank of Canada Valet FX sync." },
      { id: "forecast", label: "Bill forecasting", blurb: "12 months forward with cash-cushion warnings." },
      { id: "compliance", label: "Compliance engines", blurb: "FBAR, T1135, RDSP, FHSA and 20 more." },
    ],
  },
  PickMe: {
    arm: "products", label: "PickMe", kind: "system", consoleId: "pickme",
    blurb: "Offline iOS copilot that names the right card at checkout. Deterministic engine, entirely on-device.",
    stack: ["Swift 6", "SwiftUI", "SwiftData"],
  },
  // ... one entry for each of the remaining 43 bodies ...

  // --- Anonymous (6): arm only, no prose, no links ---
  Obsidian: { arm: "creative", label: "Private repository" },
  "A1.6_AI_Slop": { arm: "foundations", label: "Private repository" },
  AiMiniProj: { arm: "labs", label: "Private repository" },
  "Obsidi-Academy": { arm: "foundations", label: "Private repository" },
  "market-data-pipeline": { arm: "products", label: "Private repository" },
  "pickleball-session-manager": { arm: "products", label: "Private repository" },
};
```

You do not need to invent 43 more entries by hand from this plan — Step 9's `loadBodies` throws by name on any repo missing from `OVERRIDES`, so run the test, add the repo it names, and repeat until green. That loop is the completeness check.

Migrate prose for `MoneyTalks`, `PickMe`, `marketdata`, `return-saas` and `pickleops` from the existing `src/components/data/ecosystem.ts`, which already carries researched descriptions, stacks and feature lists. Do not invent copy for the remaining repos — a one-line blurb drawn from the repo's own GitHub description is correct and honest. Bodies with no description get no blurb.

Mark exactly five bodies `kind: "system"`: `MoneyTalks`, `PickMe`, `marketdata`, `agent-orchestrator`, `pickleops`. Everything else is a `star`.

- [x] **Step 8: Write `src/lib/atlas/bodies.ts`**

```ts
import generated from "@/data/bodies.generated.json";
import { OVERRIDES } from "@/data/bodies.overrides";
import type { Body } from "./types";

export const EPOCH = "2025-11-06";

export function loadBodies(): Body[] {
  return generated.bodies.map((g) => {
    const o = OVERRIDES[g.id];
    if (!o) {
      // Build-time failure, not a silent default. An unassigned repo would
      // otherwise render at the origin and look like a layout bug.
      throw new Error(`no arm assigned for repo "${g.id}" — add it to bodies.overrides.ts`);
    }
    if (g.anonymous) {
      return {
        id: g.id, label: o.label ?? "Private repository", arm: o.arm,
        bornAt: g.bornAt, lastTouchedAt: g.lastTouchedAt,
        kind: "star" as const, anonymous: true, links: {},
      };
    }
    return {
      id: g.id, label: o.label ?? g.id, arm: o.arm,
      bornAt: g.bornAt, lastTouchedAt: g.lastTouchedAt,
      kind: o.kind ?? ("star" as const), anonymous: false,
      blurb: o.blurb ?? g.description ?? undefined,
      stack: o.stack,
      links: {
        github: `https://github.com/zubairmuwwakil/${g.id}`,
        ...(o.live ? { live: o.live } : {}),
        ...(o.appStore ? { appStore: o.appStore } : {}),
      },
      satellites: o.satellites,
      consoleId: o.consoleId,
    };
  });
}
```

- [x] **Step 9: Run tests and confirm they pass**

Run: `npm test -- bodies`
Expected: PASS — 8 tests. If "no arm assigned" throws, add the named repo to `OVERRIDES`.

- [x] **Step 10: Commit**

```bash
git add scripts/build-bodies.mjs package.json src/data src/lib/atlas
git commit -m "feat(atlas): derive body data from repository metadata"
```

---

### Task 2: Position and magnitude

The heart of the design: every visual property is a pure function of metadata. This task is the one with the strongest tests, because it is the one that must never silently drift.

**Files:**
- Create: `src/lib/atlas/position.ts`
- Create: `src/lib/atlas/magnitude.ts`
- Create: `src/lib/atlas/__tests__/position.test.ts`
- Create: `src/lib/atlas/__tests__/magnitude.test.ts`

**Interfaces:**
- Consumes: `types.ts`, `bodies.ts`
- Produces:
  - `position.ts`: `ARM_ANGLES: Record<ArmId, number>`, `WIND_RATE`, `daysSinceEpoch(iso: string): number`, `radiusScale(days: number): number`, `polar(arm: ArmId, radius: number): Vec3`, `derivePosition(body: Body): Vec3`, `trailEnd(body: Body): Vec3`, `placeBodies(bodies: Body[]): Placement[]`

> **Amended after Task 3.** `derivePosition`/`trailEnd` give a body's position on the
> arm *spine*, and the spine alone stacks 23 of the 45 bodies on top of each other:
> theta is a pure function of `(arm, radius)`, so same-arm same-day repositories
> coincide, and `radiusScale`'s sqrt yields under 0.04 world units per day at the
> frontier. A hashed per-body offset was measured and rejected — across 48,000
> (seed, arm width) combinations the best minimum separation was 0.324 against the
> 0.35 two glyphs need, and reaching it required a 41° arm half-width against 72°
> arm spacing. **`placeBodies` is the layout entry point every consumer must use**;
> `derivePosition` remains the spine, for drawing arm curves.
  - `magnitude.ts`: `SYSTEM_MAGNITUDE`, `magnitude(body: Body): number`, `temperature(body: Body, today: string): number` returning 0 (cold) to 1 (frontier-hot)

- [x] **Step 1: Write the failing position test**

Create `src/lib/atlas/__tests__/position.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { loadBodies } from "../bodies";
import { ARM_ANGLES, daysSinceEpoch, derivePosition, radiusScale, trailEnd } from "../position";

const bodies = loadBodies();
const byId = (id: string) => bodies.find((b) => b.id === id)!;
const r = (p: { x: number; z: number }) => Math.hypot(p.x, p.z);

describe("daysSinceEpoch", () => {
  it("is zero at the epoch", () => expect(daysSinceEpoch("2025-11-06")).toBe(0));
  it("counts whole days forward", () => expect(daysSinceEpoch("2025-11-16")).toBe(10));
});

describe("radiusScale", () => {
  it("is monotonically increasing so later work is always further out", () => {
    for (let d = 1; d < 400; d++) {
      expect(radiusScale(d), `radius fell between day ${d - 1} and ${d}`)
        .toBeGreaterThan(radiusScale(d - 1));
    }
  });
  it("is zero at the origin", () => expect(radiusScale(0)).toBe(0));
});

describe("derivePosition", () => {
  it("places the earliest repos nearest the core", () => {
    const cat = derivePosition(byId("HTMl_CAT_WEBSITE"));
    const inunity = derivePosition(byId("MoneyTalks"));
    expect(r(cat)).toBeLessThan(r(inunity));
  });

  it("places every 2025 body inside every 2026-08 body", () => {
    const oldest = bodies.filter((b) => b.bornAt < "2026-01-01");
    const newest = bodies.filter((b) => b.bornAt >= "2026-08-01");
    const innerMax = Math.max(...oldest.map((b) => r(derivePosition(b))));
    const outerMin = Math.min(...newest.map((b) => r(derivePosition(b))));
    expect(innerMax).toBeLessThan(outerMin);
  });

  it("separates arms by angle at the frontier", () => {
    const angle = (b: string) => { const p = derivePosition(byId(b)); return Math.atan2(p.z, p.x); };
    expect(Math.abs(angle("MoneyTalks") - angle("agent-orchestrator"))).toBeGreaterThan(0.3);
  });

  it("converges the arms toward the origin", () => {
    // Arm separation is angular, so it shrinks in absolute distance as r -> 0.
    const near = bodies.filter((b) => r(derivePosition(b)) < 2);
    const spread = (set: typeof bodies) => {
      const xs = set.map((b) => derivePosition(b).x);
      return Math.max(...xs) - Math.min(...xs);
    };
    expect(spread(near)).toBeLessThan(spread(bodies));
  });

  it("is deterministic", () => {
    const a = derivePosition(byId("marketdata"));
    const b = derivePosition(byId("marketdata"));
    expect(a).toEqual(b);
  });

  it("keeps the disk flat", () => {
    for (const b of bodies) expect(Math.abs(derivePosition(b).y)).toBeLessThan(0.001);
  });

  it("defines an angle for every arm", () => {
    expect(Object.keys(ARM_ANGLES).sort())
      .toEqual(["creative", "foundations", "labs", "products", "self"]);
  });
});

describe("trailEnd", () => {
  it("gives a long-lived repo a trail reaching well beyond its birth radius", () => {
    const md = byId("marketdata");
    expect(r(trailEnd(md))).toBeGreaterThan(r(derivePosition(md)) * 1.5);
  });

  it("gives a same-day repo effectively no trail", () => {
    const cf = byId("Coin_Flipper");
    expect(r(trailEnd(cf)) - r(derivePosition(cf))).toBeLessThan(0.01);
  });

  it("keeps a trail on its own arm", () => {
    const md = byId("marketdata");
    const a1 = Math.atan2(derivePosition(md).z, derivePosition(md).x);
    const a2 = Math.atan2(trailEnd(md).z, trailEnd(md).x);
    expect(Math.abs(a1 - a2)).toBeLessThan(Math.PI); // same winding, no wraparound
  });
});
```

- [x] **Step 2: Run and confirm it fails**

Run: `npm test -- position`
Expected: FAIL — cannot resolve `../position`.

- [x] **Step 3: Write `src/lib/atlas/position.ts`**

```ts
import type { ArmId, Body, Vec3 } from "./types";
import { EPOCH } from "./bodies";

/** Radians. Arms are evenly spaced; the order is fixed so the layout is stable. */
export const ARM_ANGLES: Record<ArmId, number> = {
  foundations: 0,
  products: (2 * Math.PI) / 5,
  labs: (4 * Math.PI) / 5,
  self: (6 * Math.PI) / 5,
  creative: (8 * Math.PI) / 5,
};

/** How far an arm sweeps per e-fold of radius. Higher = tighter spiral. */
export const WIND_RATE = 0.55;

const MS_PER_DAY = 86_400_000;

export function daysSinceEpoch(iso: string): number {
  return Math.round((Date.parse(iso) - Date.parse(EPOCH)) / MS_PER_DAY);
}

/**
 * Days -> radius. Square root, not linear: repository creation is far denser at
 * the frontier than at the core, and a linear map would pile the recent work into
 * a thin outer band while leaving the middle empty.
 */
export function radiusScale(days: number): number {
  return Math.sqrt(Math.max(0, days)) * 1.15;
}

export function polar(arm: ArmId, radius: number): Vec3 {
  const theta = ARM_ANGLES[arm] + WIND_RATE * Math.log(1 + radius);
  return { x: Math.cos(theta) * radius, y: 0, z: Math.sin(theta) * radius };
}

export function derivePosition(body: Body): Vec3 {
  return polar(body.arm, radiusScale(daysSinceEpoch(body.bornAt)));
}

/** Where a body's trail ends: its own arm, at its last-touched radius. */
export function trailEnd(body: Body): Vec3 {
  return polar(body.arm, radiusScale(daysSinceEpoch(body.lastTouchedAt)));
}
```

- [x] **Step 4: Run and confirm it passes**

Run: `npm test -- position`
Expected: PASS — 13 tests.

If "separates arms by angle" fails, `WIND_RATE` is winding arms into each other; lower it. If "places every 2025 body inside every 2026-08 body" fails, the radius map is not monotonic. Tune the constants — never special-case a body.

- [x] **Step 5: Write the failing magnitude test**

Create `src/lib/atlas/__tests__/magnitude.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { loadBodies } from "../bodies";
import { magnitude, temperature, SYSTEM_MAGNITUDE } from "../magnitude";

const bodies = loadBodies();
const byId = (id: string) => bodies.find((b) => b.id === id)!;

describe("magnitude", () => {
  it("pins every system to the same bright value", () => {
    for (const b of bodies.filter((x) => x.kind === "system")) {
      expect(magnitude(b), `${b.id}`).toBe(SYSTEM_MAGNITUDE);
    }
  });

  it("makes a four-day-old flagship outshine a long-lived star", () => {
    // The whole reason systems are pinned rather than derived.
    expect(magnitude(byId("PickMe"))).toBeGreaterThan(magnitude(byId("mindmap")));
  });

  it("ranks a long-lived repo above a same-day one", () => {
    expect(magnitude(byId("return-saas"))).toBeGreaterThan(magnitude(byId("Coin_Flipper")));
  });

  it("never derives brightness from repository size", async () => {
    // Obsidian is a 25MB vault and must not be the brightest object in the sky.
    const brightest = [...bodies].sort((a, b) => magnitude(b) - magnitude(a))[0];
    expect(brightest.id).not.toBe("Obsidian");
  });

  it("is positive for every body", () => {
    for (const b of bodies) expect(magnitude(b), `${b.id}`).toBeGreaterThan(0);
  });
});

describe("temperature", () => {
  it("is hottest for something pushed today", () => {
    expect(temperature(byId("MoneyTalks"), "2026-08-19")).toBeCloseTo(1, 1);
  });

  it("is cold for something abandoned months ago", () => {
    expect(temperature(byId("zweb"), "2026-08-19")).toBeLessThan(0.2);
  });

  it("separates two bodies of similar radius but different liveness", () => {
    // marketdata and zweb were created two days apart in January 2026.
    const hot = temperature(byId("marketdata"), "2026-08-19");
    const cold = temperature(byId("zweb"), "2026-08-19");
    expect(hot - cold).toBeGreaterThan(0.5);
  });

  it("stays within 0..1", () => {
    for (const b of bodies) {
      const t = temperature(b, "2026-08-19");
      expect(t, `${b.id}`).toBeGreaterThanOrEqual(0);
      expect(t, `${b.id}`).toBeLessThanOrEqual(1);
    }
  });
});
```

- [x] **Step 6: Run and confirm it fails**

Run: `npm test -- magnitude`
Expected: FAIL — cannot resolve `../magnitude`.

- [x] **Step 7: Write `src/lib/atlas/magnitude.ts`**

```ts
import type { Body } from "./types";
import { daysSinceEpoch } from "./position";

export const SYSTEM_MAGNITUDE = 4;
const BASE = 0.6;
const SATELLITE_K = 0.25;

/** Days of visible temperature falloff. Beyond this a body reads as fully cold. */
const COOLING_DAYS = 180;

/**
 * Brightness. Deliberately NOT derived from repository size: `diskUsage` reports
 * the Obsidian vault at 25MB against MoneyTalks at 1.7MB, which would make a
 * private notes vault the brightest object in the galaxy. Lifespan is the honest
 * signal — how long a repository stayed alive — and flagships are pinned because
 * lifespan under-weights recent work (PickMe is four days old).
 */
export function magnitude(body: Body): number {
  if (body.kind === "system") return SYSTEM_MAGNITUDE;
  const lifespanDays = daysSinceEpoch(body.lastTouchedAt) - daysSinceEpoch(body.bornAt);
  return BASE + Math.sqrt(lifespanDays) * 0.12 + SATELLITE_K * (body.satellites?.length ?? 0);
}

/** 1 = pushed today, 0 = untouched for COOLING_DAYS or more. */
export function temperature(body: Body, today: string): number {
  const idle = daysSinceEpoch(today) - daysSinceEpoch(body.lastTouchedAt);
  return Math.max(0, Math.min(1, 1 - idle / COOLING_DAYS));
}
```

- [x] **Step 8: Run and confirm it passes**

Run: `npm test -- magnitude`
Expected: PASS — 9 tests.

- [x] **Step 9: Commit**

```bash
git add src/lib/atlas
git commit -m "feat(atlas): derive position, magnitude and temperature from metadata"
```

---

### Task 3: Atlas treatment prototype — GO / NO-GO

**Stop and look at the output of this task before building anything else.** The spec names the atlas aesthetic as R1's largest risk, and it is a design risk rather than an engineering one. This task renders the real 45 bodies at their real derived positions in the real palette as a single static frame, so the treatment can be judged for the cost of one task instead of eight.

**Files:**
- Create: `scripts/preview-atlas.mjs`
- Create: `preview/atlas-frame.svg` (generated, **not** committed)
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `bodies.ts`, `position.ts`, `magnitude.ts` from Tasks 1–2.
- Produces: a viewable SVG. No runtime code — nothing in `src/` depends on this task.

- [x] **Step 1: Ignore the preview output**

Append to `.gitignore`:

```
/preview
```

- [x] **Step 2: Write the preview script**

Create `scripts/preview-atlas.mjs`. It must import the real `loadBodies`, `derivePosition`, `trailEnd`, `magnitude` and `temperature` — a preview drawn from mock data proves nothing. Render, to a single SVG at 1600×1600:

- ground `#f7f6f2`
- five arm curves as thin ink strokes (`#27272a` at ~12% opacity), sampling `polar()` along each arm
- era rings at 2025-12, 2026-01, 2026-04, 2026-08, with hand-lettered-style labels
- each body's trail as a stroke from `derivePosition` to `trailEnd`, width scaled by `magnitude`
- each body as a filled circle, radius from `magnitude`, colour interpolated by `temperature` from obsidian `#27272a` (cold) through emerald `#047857` to gold `#fbbf24` (frontier)
- the five systems ringed, with their satellites as small orbiting dots
- labels for the 39 non-anonymous bodies; anonymous bodies drawn as unlabelled circles
- `Plus Ultra` set at the outer rim

Add to `package.json` scripts:

```json
"preview:atlas": "node scripts/preview-atlas.mjs"
```

- [x] **Step 3: Generate and look at it**

Run: `npm run preview:atlas && open preview/atlas-frame.svg`
Expected: an SVG that opens in a browser.

- [x] **Step 4: Judge it against these questions**

Answer each explicitly in your report — do not proceed on a vague impression:

1. Do the five arms read as distinct without the labels?
2. Is the frontier legibly denser than the core, or is it an unreadable pileup?
3. Can you find `HTMl_CAT_WEBSITE` at the centre?
4. Do trails visibly fill the 2026-02 → 2026-07 creation gap?
5. Does it read as engraved and crafted, or as a generic node graph in beige?

**Question 5 is the gate.** If the honest answer is "generic node graph," stop and report that. The spec's stated fallback is a simpler ink-only palette, and taking it now costs two tasks; taking it after Task 7 costs seven.

- [x] **Step 5: Commit the script only**

```bash
git add scripts/preview-atlas.mjs package.json .gitignore
git commit -m "feat(atlas): add static atlas treatment preview for design review"
```

- [x] **Step 6: Report before continuing**

Report the five answers and attach the SVG. **Do not start Task 4 without a human go-ahead.** Everything after this point assumes the treatment is settled; the remaining tasks are expensive to redo and cheap to defer.

---

### Task 4: AtlasCamera

Replaces `CameraManager`, whose lookAt-plus-drag-offset model cannot orbit. Keeps its one genuinely reusable idea: 3D→screen projection for DOM positioning.

**Files:**
- Create: `src/components/atlas/AtlasCamera.ts`
- Create: `src/components/atlas/__tests__/atlasCamera.test.ts`
- Reference: `src/components/world/CameraManager.ts:88-117` (`calculateScreenPins` — the projection to preserve)

**Interfaces:**
- Consumes: `three`, `types.ts`
- Produces:
  - `class AtlasCamera` with `camera: THREE.PerspectiveCamera`
  - `constructor(width: number, height: number)`
  - `resize(width, height): void`
  - `orbit(dAzimuth: number, dElevation: number): void`
  - `zoom(delta: number): void`
  - `focus(target: Vec3 | null, distance?: number): void`
  - `update(delta: number): void`
  - `projectToScreen(points: Array<{ id: string; pos: Vec3 }>, width: number, height: number): ScreenPoint[]`

- [x] **Step 1: Write the failing test**

Create `src/components/atlas/__tests__/atlasCamera.test.ts`:

```ts
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
```

- [x] **Step 2: Run and confirm it fails**

Run: `npm test -- atlasCamera`
Expected: FAIL — cannot resolve `../AtlasCamera`.

- [x] **Step 3: Write `AtlasCamera.ts`**

Model the camera in spherical coordinates around a target — `{ azimuth, elevation, distance, target }` — with a lerped current and target state, the same smoothing pattern `CameraManager.update` uses (`lerpFactor = Math.min(1, delta * 4.5)`). Clamp elevation to roughly `[0.15, 1.35]` radians so the disk is always seen from above at an angle, and distance to `[6, 400]`.

Port `calculateScreenPins` into `projectToScreen`, generalised from `SECTORS` to a caller-supplied array and returning `depth` (the projected `z`) so the Chart can order overlapping labels:

```ts
projectToScreen(points: Array<{ id: string; pos: Vec3 }>, width: number, height: number): ScreenPoint[] {
  return points.map(({ id, pos }) => {
    const p = new THREE.Vector3(pos.x, pos.y, pos.z).project(this.camera);
    const x = ((p.x + 1) * width) / 2;
    const y = ((-p.y + 1) * height) / 2;
    return { id, x, y, depth: p.z, visible: p.z < 1 && x > 0 && x < width && y > 0 && y < height };
  });
}
```

- [x] **Step 4: Run and confirm it passes**

Run: `npm test -- atlasCamera`
Expected: PASS — 7 tests.

- [x] **Step 5: Commit**

```bash
git add src/components/atlas
git commit -m "feat(atlas): add orbit camera with screen projection"
```

---

### Task 5: Field layer

Everything ambient, nothing clickable. This is the only task where WebGL is involved and the only one where "looks right" outweighs assertions — so test what is structurally testable and judge the rest by eye.

**Files:**
- Create: `src/components/atlas/FieldBuilder.ts`
- Create: `src/components/atlas/Field.tsx`
- Create: `src/components/atlas/__tests__/fieldBuilder.test.ts`
- Reference: `src/components/world/WorldCanvas.tsx` (renderer setup, animation loop, pointer handling — the structure survives; the `SceneBuilder` usage does not)

**Interfaces:**
- Consumes: `three`, `bodies.ts`, `position.ts`, `magnitude.ts`, `AtlasCamera`
- Produces:
  - `class FieldBuilder` with `constructor(scene: THREE.Scene, bodies: Body[], today: string)`, `build(): void`, `update(elapsed: number): void`, and readonly `bodySprites: Map<string, THREE.Object3D>`, `trailLines: THREE.Line[]`, `backgroundStarCount: number`
  - `<Field bodies today onProject />` — a client component owning the renderer and the loop, calling `onProject(points: ScreenPoint[])` once per frame

- [x] **Step 1: Write the failing test**

Create `src/components/atlas/__tests__/fieldBuilder.test.ts`:

```ts
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
```

- [x] **Step 2: Run and confirm it fails**

Run: `npm test -- fieldBuilder`
Expected: FAIL — cannot resolve `../FieldBuilder`.

- [x] **Step 3: Write `FieldBuilder.ts`**

Build, in this order: background stars as a single `THREE.Points` with a buffer of at least 10,000 vertices scattered on a large sphere; arm dust as a second `Points` cloud sampled along each arm's `polar()` curve with jitter; one trail per body as a `THREE.Line` from `derivePosition` to `trailEnd`; one sprite per body sized by `magnitude` and coloured by `temperature`.

Three rules:

- **No per-body branching.** Everything reads from the `Body` array. The test above enforces it.
- **Nothing is added to `interactiveMeshes` and there is no raycaster.** Hit testing is the Chart's job now; that is what makes the map accessible.
- `build()` must be idempotent — track a built flag or clear prior groups.

Reuse from the deleted `SceneBuilder` only the ideas, not the code: `courierBots` become nothing yet (flow choreography is R4), `nightEmissives` become temperature colouring, `buildClouds` becomes arm dust.

- [x] **Step 4: Run and confirm it passes**

Run: `npm test -- fieldBuilder`
Expected: PASS — 6 tests.

- [x] **Step 5: Write `Field.tsx`**

Port the *structure* of `WorldCanvas.tsx`: renderer creation with `setPixelRatio(Math.min(devicePixelRatio, 2))`, resize handler, pointer drag, wheel zoom, `THREE.Clock` loop, cleanup on unmount. Replace `SceneBuilder` with `FieldBuilder` and `CameraManager` with `AtlasCamera`.

Two changes from the original:

- Delete the raycaster and `hoveredSectorIdRef` entirely. There is no 3D hit testing.
- Each frame, call `camera.projectToScreen(...)` for all bodies and hand the result to `onProject`. Keep `WorldCanvas`'s existing ref-mirroring pattern for callbacks (`onProjectRef.current = onProject` in an effect) so the renderer is never torn down when a parent re-renders — the existing file has a comment explaining why, and the reason still applies.

Disable shadows (`renderer.shadowMap.enabled = false`). There is no geometry to cast them and they cost real frame time.

- [x] **Step 6: Commit**

```bash
git add src/components/atlas
git commit -m "feat(atlas): add data-driven WebGL field layer"
```

---

### Task 6: Chart layer

The accessible half. Every hit target in the product lives here.

**Files:**
- Create: `src/components/atlas/Chart.tsx`
- Create: `src/components/atlas/__tests__/chart.test.tsx`
- Modify: `package.json` (test-only devDependencies)

**Interfaces:**
- Consumes: `types.ts`, `bodies.ts`
- Produces: `<Chart bodies points selectedId onSelect />` where `points: ScreenPoint[]` comes from `Field`'s `onProject`

- [x] **Step 1: Install DOM test tooling**

```bash
npm install -D jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

No change to `vitest.config.ts` is needed — the test file opts in with a docblock.

- [x] **Step 2: Write the failing test**

Create `src/components/atlas/__tests__/chart.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { loadBodies } from "@/lib/atlas/bodies";
import type { ScreenPoint } from "@/lib/atlas/types";
import { Chart } from "../Chart";

const bodies = loadBodies();
const allVisible: ScreenPoint[] = bodies.map((b, i) => ({
  id: b.id, x: 100 + i, y: 100 + i, depth: 0.5, visible: true,
}));

describe("Chart", () => {
  it("renders a hit target for every labelled body and none for anonymous ones", () => {
    render(<Chart bodies={bodies} points={allVisible} selectedId={null} onSelect={() => {}} />);
    expect(screen.getAllByRole("button")).toHaveLength(39);
  });

  it("never renders an anonymous body's id", () => {
    render(<Chart bodies={bodies} points={allVisible} selectedId={null} onSelect={() => {}} />);
    for (const b of bodies.filter((x) => x.anonymous)) {
      expect(screen.queryByText(b.id), `${b.id} leaked into the DOM`).toBeNull();
    }
  });

  it("labels each hit target with the body's display name", () => {
    render(<Chart bodies={bodies} points={allVisible} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByRole("button", { name: /Inunity/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /MarketLens/ })).toBeTruthy();
  });

  it("calls onSelect with the body id when clicked", async () => {
    const onSelect = vi.fn();
    render(<Chart bodies={bodies} points={allVisible} selectedId={null} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole("button", { name: /Inunity/ }));
    expect(onSelect).toHaveBeenCalledWith("MoneyTalks");
  });

  it("is keyboard reachable and activates on Enter", async () => {
    const onSelect = vi.fn();
    render(<Chart bodies={bodies} points={allVisible} selectedId={null} onSelect={onSelect} />);
    await userEvent.tab();
    expect(document.activeElement?.tagName).toBe("BUTTON");
    await userEvent.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalled();
  });

  it("omits hit targets for points that are off screen or behind the camera", () => {
    const points = allVisible.map((p, i) => (i < 10 ? { ...p, visible: false } : p));
    render(<Chart bodies={bodies} points={points} selectedId={null} onSelect={() => {}} />);
    expect(screen.getAllByRole("button").length).toBeLessThan(39);
  });

  it("marks the selected body pressed for assistive technology", () => {
    render(<Chart bodies={bodies} points={allVisible} selectedId="MoneyTalks" onSelect={() => {}} />);
    expect(screen.getByRole("button", { name: /Inunity/ }).getAttribute("aria-pressed")).toBe("true");
  });

  it("distinguishes systems from stars for assistive technology", () => {
    render(<Chart bodies={bodies} points={allVisible} selectedId={null} onSelect={() => {}} />);
    const inunity = screen.getByRole("button", { name: /Inunity/ });
    expect(inunity.getAttribute("aria-description") ?? inunity.getAttribute("aria-label"))
      .toMatch(/system/i);
  });
});
```

- [x] **Step 3: Run and confirm it fails**

Run: `npm test -- chart`
Expected: FAIL — cannot resolve `../Chart`.

- [x] **Step 4: Write `Chart.tsx`**

Follow `WorldPin.tsx`'s positioning technique — an absolutely positioned wrapper with `pointer-events-none`, children with `pointer-events-auto`, positioned by `transform: translate3d(${x}px, ${y}px, 0) translate(-50%, -100%)`. Transform-only positioning keeps this off the layout path, which matters when it runs every frame.

Differences from `WorldPin`:

- Iterate `bodies`, not `SECTORS`.
- **Skip anonymous bodies entirely** — no element at all.
- Skip points where `visible` is false.
- Set `zIndex` from `depth` so nearer labels overlap farther ones.
- Render a real `<button>` with `aria-pressed={selectedId === body.id}` and, for systems, an `aria-description` naming it a system and its satellite count.
- Size and opacity scale with `magnitude`; do not let a low-magnitude label fall below a 24px hit target or 4.5:1 contrast.

- [x] **Step 5: Implement density culling**

This is the spec's risk 2 and the one thing Task 3's preview cannot settle, because a static frame has no zoom level. Aug 2026 holds 11 repos created in 14 days, so at the default zoom their labels will overlap into an unreadable pileup.

Two mechanisms, both driven by data already available:

1. **Magnitude threshold per zoom.** `Chart` receives the camera distance and renders a label only when `magnitude(body) >= threshold(distance)`. Zoomed out, only systems and long-lived stars are labelled; zooming in reveals the rest. The Field still draws every sprite at every zoom — the galaxy never loses bodies, only labels.
2. **Collision resolution.** After filtering, walk the surviving points in descending `magnitude` and drop any whose screen position falls within ~40px of an already-placed label. Higher magnitude always wins, so the flagships are never the ones dropped.

Add to `chart.test.tsx`:

```tsx
it("labels fewer bodies when zoomed out than when zoomed in", () => {
  const far = render(<Chart bodies={bodies} points={allVisible} cameraDistance={300}
                            selectedId={null} onSelect={() => {}} />);
  const farCount = far.container.querySelectorAll("button").length;
  far.unmount();
  const near = render(<Chart bodies={bodies} points={allVisible} cameraDistance={20}
                             selectedId={null} onSelect={() => {}} />);
  expect(near.container.querySelectorAll("button").length).toBeGreaterThan(farCount);
});

it("always keeps systems labelled, even zoomed all the way out", () => {
  render(<Chart bodies={bodies} points={allVisible} cameraDistance={400}
                selectedId={null} onSelect={() => {}} />);
  for (const b of bodies.filter((x) => x.kind === "system")) {
    expect(screen.getByRole("button", { name: new RegExp(b.label) }), `${b.id} dropped`).toBeTruthy();
  }
});

it("drops the lower-magnitude label when two collide", () => {
  const collided = allVisible.map((p) => ({ ...p, x: 500, y: 500 }));
  render(<Chart bodies={bodies} points={collided} cameraDistance={20}
                selectedId={null} onSelect={() => {}} />);
  expect(screen.getAllByRole("button").length).toBeLessThan(5);
});
```

`Chart` therefore takes a `cameraDistance: number` prop. Update the earlier tests in this task to pass `cameraDistance={20}`, which is close enough that nothing is culled.

- [x] **Step 6: Run and confirm it passes**

Run: `npm test -- chart`
Expected: PASS — 11 tests.

- [x] **Step 7: Commit**

```bash
git add src/components/atlas package.json package-lock.json
git commit -m "feat(atlas): add accessible DOM chart layer with density culling"
```

---

### Task 7: BodyCard and deep links

**Files:**
- Create: `src/components/atlas/BodyCard.tsx`
- Create: `src/lib/atlas/deepLink.ts`
- Create: `src/lib/atlas/__tests__/deepLink.test.ts`
- Create: `src/components/atlas/__tests__/bodyCard.test.tsx`

**Interfaces:**
- Consumes: `types.ts`, `bodies.ts`
- Produces:
  - `deepLink.ts`: `bodyIdToHash(id: string): string`, `hashToBodyId(hash: string, bodies: Body[]): string | null`
  - `<BodyCard body onClose />`

- [ ] **Step 1: Write the failing deep-link test**

Create `src/lib/atlas/__tests__/deepLink.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { loadBodies } from "../bodies";
import { bodyIdToHash, hashToBodyId } from "../deepLink";

const bodies = loadBodies();

describe("deep links", () => {
  it("round-trips every labelled body", () => {
    for (const b of bodies.filter((x) => !x.anonymous)) {
      expect(hashToBodyId(bodyIdToHash(b.id), bodies), `${b.id}`).toBe(b.id);
    }
  });

  it("produces url-safe hashes for awkward repo names", () => {
    // Real repo names include "JS_Tel-_Checker", "C--Practice", "A1.6_AI_Slop".
    for (const b of bodies) {
      expect(bodyIdToHash(b.id), `${b.id}`).toMatch(/^#\/[a-z0-9._~-]+$/i);
    }
  });

  it("refuses to resolve an anonymous body", () => {
    expect(hashToBodyId("#/Obsidian", bodies)).toBeNull();
  });

  it("returns null for an unknown hash instead of throwing", () => {
    expect(hashToBodyId("#/not-a-repo", bodies)).toBeNull();
    expect(hashToBodyId("", bodies)).toBeNull();
    expect(hashToBodyId("#", bodies)).toBeNull();
  });

  it("is case-insensitive so a hand-typed link still resolves", () => {
    expect(hashToBodyId("#/moneytalks", bodies)).toBe("MoneyTalks");
  });
});
```

- [ ] **Step 2: Run and confirm it fails**

Run: `npm test -- deepLink`
Expected: FAIL — cannot resolve `../deepLink`.

- [ ] **Step 3: Write `deepLink.ts`**

`bodyIdToHash` returns `#/${encodeURIComponent(id)}`. `hashToBodyId` strips the `#/` prefix, decodes, matches case-insensitively against `bodies`, and returns `null` for anything unknown or anonymous. Never throw — a bad hash is a user typo, not an exception.

- [ ] **Step 4: Write the failing card test**

Create `src/components/atlas/__tests__/bodyCard.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { loadBodies } from "@/lib/atlas/bodies";
import { BodyCard } from "../BodyCard";

const bodies = loadBodies();
const byId = (id: string) => bodies.find((b) => b.id === id)!;

describe("BodyCard", () => {
  it("shows the label, blurb and github link", () => {
    render(<BodyCard body={byId("MoneyTalks")} onClose={() => {}} />);
    expect(screen.getByText("Inunity")).toBeTruthy();
    expect(screen.getByRole("link", { name: /github/i }).getAttribute("href"))
      .toBe("https://github.com/zubairmuwwakil/MoneyTalks");
  });

  it("lists satellites for a system", () => {
    render(<BodyCard body={byId("MoneyTalks")} onClose={() => {}} />);
    expect(screen.getByText("Apple Pay capture")).toBeTruthy();
    expect(screen.getByText("Compliance engines")).toBeTruthy();
  });

  it("shows no satellite list for a plain star", () => {
    render(<BodyCard body={byId("Coin_Flipper")} onClose={() => {}} />);
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("shows when the body was created and last touched", () => {
    render(<BodyCard body={byId("marketdata")} onClose={() => {}} />);
    expect(screen.getByText(/2026-01-03/)).toBeTruthy();
    expect(screen.getByText(/2026-08-19/)).toBeTruthy();
  });

  it("closes on Escape", async () => {
    const onClose = vi.fn();
    render(<BodyCard body={byId("PickMe")} onClose={onClose} />);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 5: Run and confirm it fails**

Run: `npm test -- bodyCard`
Expected: FAIL — cannot resolve `../BodyCard`.

- [ ] **Step 6: Write `BodyCard.tsx`**

A panel showing label, blurb, stack chips, born/last-touched dates, links, and a satellite list for systems. Match the existing `glass-panel-light` treatment in `src/app/globals.css`. Close on Escape and on backdrop click. Focus the panel on open and restore focus to the invoking button on close.

Where `body.consoleId` is set, render a disabled "Open console" affordance marked as coming later — Track C fills it. This is the mount point the architecture reserves; do not wire a console here.

- [ ] **Step 7: Run and confirm both pass**

Run: `npm test -- deepLink bodyCard`
Expected: PASS — 10 tests.

- [ ] **Step 8: Commit**

```bash
git add src/components/atlas src/lib/atlas
git commit -m "feat(atlas): add body card and deep links"
```

---

### Task 8: Wire the stage and delete the island city

The task where the old world goes. Do the deletions in the same commit as the wiring so the tree is never in a half-migrated state.

**Files:**
- Create: `src/components/atlas/AtlasStage.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/components/hud/WorldHUD.tsx`, `SectorDrawer.tsx`, `QuickDossierModal.tsx`
- Delete: `src/components/world/SceneBuilder.ts`, `CameraManager.ts`, `WorldCanvas.tsx`, `types.ts`, `src/components/hud/WorldPin.tsx`, `src/components/data/ecosystem.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–7.
- Produces: `<AtlasStage />` — the whole shell, mounted by `page.tsx`.

- [ ] **Step 1: Write the failing integration test**

Create `src/components/atlas/__tests__/atlasStage.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AtlasStage } from "../AtlasStage";

// The Field owns WebGL, which jsdom has no canvas for. Stub it and drive the
// Chart directly — this test is about wiring, not rendering.
vi.mock("../Field", () => ({
  Field: ({ onProject }: { onProject: (p: unknown[]) => void }) => {
    // Report every body as visible at a fixed point on first paint.
    return <div data-testid="field-stub" ref={() => onProject([])} />;
  },
}));

describe("AtlasStage", () => {
  it("mounts without a WebGL context", () => {
    render(<AtlasStage />);
    expect(screen.getByTestId("field-stub")).toBeTruthy();
  });

  it("opens a card from a deep link on load", async () => {
    window.location.hash = "#/MoneyTalks";
    render(<AtlasStage />);
    await waitFor(() => expect(screen.getByText("Inunity")).toBeTruthy());
  });

  it("ignores a deep link to an anonymous body", async () => {
    window.location.hash = "#/Obsidian";
    render(<AtlasStage />);
    await waitFor(() => expect(screen.queryByText("Private repository")).toBeNull());
  });

  it("clears the hash when the card closes", async () => {
    window.location.hash = "#/PickMe";
    render(<AtlasStage />);
    await waitFor(() => expect(screen.getByText("PickMe")).toBeTruthy());
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(window.location.hash).toBe(""));
  });
});
```

- [ ] **Step 2: Run and confirm it fails**

Run: `npm test -- atlasStage`
Expected: FAIL — cannot resolve `../AtlasStage`.

- [ ] **Step 3: Write `AtlasStage.tsx`**

Owns `selectedId`, the projected `ScreenPoint[]`, and the hash sync. Composes `<Field onProject={setPoints} />`, `<Chart points={points} onSelect={setSelectedId} />` and `<BodyCard>`. On mount, read `window.location.hash` through `hashToBodyId`; on selection change, write it back. Focusing the camera on the selected body's `derivePosition` goes here, not in `Chart`.

- [ ] **Step 4: Rewire the retained HUD components**

`WorldHUD`, `SectorDrawer` and `QuickDossierModal` all import `SECTORS` from `src/components/data/ecosystem.ts`. Repoint them at `loadBodies()`, grouping by `arm` where they previously grouped by sector. Keep their visual design — this is a data swap, not a redesign. `MiniTerminalModal` and `lib/audio.ts` need no changes.

- [ ] **Step 5: Replace `page.tsx`**

Reduce it to mounting `<AtlasStage />` plus the retained HUD. The current file wires five components together with six pieces of state; most of that moves into `AtlasStage`.

- [ ] **Step 6: Delete the island city**

```bash
git rm src/components/world/SceneBuilder.ts \
       src/components/world/CameraManager.ts \
       src/components/world/WorldCanvas.tsx \
       src/components/world/types.ts \
       src/components/hud/WorldPin.tsx \
       src/components/data/ecosystem.ts
```

Before committing, confirm nothing still imports them:

```bash
grep -rn "SceneBuilder\|CameraManager\|WorldCanvas\|WorldPin\|data/ecosystem" src/ && echo "STILL REFERENCED — fix before committing" || echo "clean"
```

- [ ] **Step 7: Verify the whole thing builds and passes**

```bash
npm test && npm run build && npm run lint
```
Expected: all tests pass; `out/` is produced; lint is clean.

- [ ] **Step 8: Commit**

```bash
git add -A src
git commit -m "feat(atlas): wire the atlas stage and remove the island city"
```

---

### Task 9: Mobile, reduced motion and accessibility

The spec lists mobile as risk 4 and the current `globals.css` sets `user-select: none` and `overflow: hidden` on `body`, which are hostile to assistive technology. Fix both.

**Files:**
- Modify: `src/components/atlas/Field.tsx`, `Chart.tsx`, `AtlasStage.tsx`
- Modify: `src/app/globals.css`
- Create: `src/components/atlas/__tests__/accessibility.test.tsx`

**Interfaces:**
- Consumes: everything.
- Produces: `prefersReducedMotion(): boolean` exported from `AtlasStage.tsx`.

- [ ] **Step 1: Write the failing test**

Create `src/components/atlas/__tests__/accessibility.test.tsx`:

```tsx
// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { loadBodies } from "@/lib/atlas/bodies";
import type { ScreenPoint } from "@/lib/atlas/types";
import { Chart } from "../Chart";

const bodies = loadBodies();
const points: ScreenPoint[] = bodies.map((b, i) => ({
  id: b.id, x: 100 + i, y: 100 + i, depth: 0.5, visible: true,
}));

const mockMatchMedia = (matches: boolean) => {
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches, media: q, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(),
  }));
};

beforeEach(() => vi.unstubAllGlobals());

describe("accessibility", () => {
  it("gives every hit target a minimum 24px touch size", () => {
    render(<Chart bodies={bodies} points={points} selectedId={null} onSelect={() => {}} />);
    for (const btn of screen.getAllByRole("button")) {
      const min = parseFloat(getComputedStyle(btn).minHeight || "0");
      expect(min, `${btn.textContent} is below the 24px minimum`).toBeGreaterThanOrEqual(24);
    }
  });

  it("lets a keyboard user reach every labelled body", async () => {
    render(<Chart bodies={bodies} points={points} selectedId={null} onSelect={() => {}} />);
    const seen = new Set<string>();
    for (let i = 0; i < 39; i++) {
      await userEvent.tab();
      if (document.activeElement?.textContent) seen.add(document.activeElement.textContent);
    }
    expect(seen.size).toBe(39);
  });

  it("exposes the chart as a labelled region", () => {
    render(<Chart bodies={bodies} points={points} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByRole("region", { name: /atlas|galaxy|chart/i })).toBeTruthy();
  });

  it("reports reduced-motion preference when the user has set it", async () => {
    mockMatchMedia(true);
    const { prefersReducedMotion } = await import("../AtlasStage");
    expect(prefersReducedMotion()).toBe(true);
  });
});
```

- [ ] **Step 2: Run and confirm it fails**

Run: `npm test -- accessibility`
Expected: FAIL — minimum touch size and region role are not yet implemented.

- [ ] **Step 3: Implement reduced motion**

Export `prefersReducedMotion()` from `AtlasStage.tsx`, reading `matchMedia("(prefers-reduced-motion: reduce)")` defensively (it is undefined in some test environments). When true: stop the idle camera drift, skip trail and dust animation, and render one static frame instead of a continuous loop. Body positions and the Chart stay exactly as they are — reduced motion means less movement, not less content.

- [ ] **Step 4: Implement the touch and mobile path**

In `Field.tsx`: below 768px viewport width, cut the background star count roughly in half, disable free orbit, and use tap-to-focus — a tap on a Chart button focuses that body rather than beginning a drag. Keep pinch-to-zoom.

In `Chart.tsx`: give every button `min-h-6 min-w-6` (24px) and wrap the whole overlay in `<div role="region" aria-label="Zemí Atlas chart">`.

- [ ] **Step 5: Fix the hostile globals**

In `src/app/globals.css`, `body` currently sets `overflow: hidden` and `user-select: none`. Scope both to the canvas rather than the document, so labels stay selectable and the page stays scrollable for anyone who needs it:

```css
body { background-color: var(--background); color: var(--foreground); }
canvas { touch-action: none; user-select: none; -webkit-user-select: none; }
```

- [ ] **Step 6: Run and confirm it passes**

Run: `npm test -- accessibility`
Expected: PASS — 4 tests.

- [ ] **Step 7: Verify the full suite and build**

```bash
npm test && npm run build && npm run lint
```

- [ ] **Step 8: Commit**

```bash
git add src
git commit -m "feat(atlas): add reduced motion, touch navigation and accessible chart region"
```

---

## Done when

- `npm test` passes, `npm run build` produces a static export, `npm run lint` is clean.
- No file in `src/` references `SceneBuilder`, `CameraManager`, `WorldCanvas`, `WorldPin` or `data/ecosystem`.
- No `Body` has authored coordinates; `derivePosition` is the only source of layout.
- All 39 labelled bodies are tab-reachable; the 6 anonymous ones have no DOM presence.
- `#/marketdata` opens MarketLens on a cold load.
- Task 3's five questions were answered and a human approved continuing.
