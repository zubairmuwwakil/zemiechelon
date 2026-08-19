#!/usr/bin/env node
// Static design-review frame for the Zemi atlas (plan Task 3 — the GO/NO-GO gate).
//
// Renders the REAL 45 bodies at their REAL derived positions in the REAL palette
// to a single 1600x1600 SVG. It imports loadBodies/derivePosition/trailEnd/polar/
// magnitude/temperature directly from src/lib/atlas — a preview drawn from mock
// data proves nothing about the thing being judged.
//
// Nothing in src/ depends on this file. Output is gitignored; the script is not.
//
//   node scripts/preview-atlas.mjs   ->  preview/atlas-frame.svg

import { registerHooks } from "node:module";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { pathToFileURL, fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = process.cwd();

// --- Loading real TypeScript from a plain Node script ------------------------
// src/lib/atlas is TS using tsconfig's "@/*" alias and extensionless relative
// imports (the moduleResolution:"bundler" convention). Node 24 strips types
// natively but resolves neither of those, and it refuses attribute-less JSON
// imports. These three hooks close exactly that gap and add zero dependencies.
registerHooks({
  resolve(spec, ctx, next) {
    let base = null;
    if (spec.startsWith("@/")) base = path.join(ROOT, "src", spec.slice(2));
    else if (spec.startsWith(".") && ctx.parentURL?.startsWith("file:"))
      base = path.resolve(path.dirname(fileURLToPath(ctx.parentURL)), spec);
    if (base)
      for (const c of [base, `${base}.ts`, `${base}.tsx`, `${base}.json`])
        if (existsSync(c) && !c.endsWith("/"))
          return { url: pathToFileURL(c).href, shortCircuit: true };
    return next(spec, ctx);
  },
  load(url, ctx, next) {
    if (url.endsWith(".json"))
      return {
        format: "module",
        shortCircuit: true,
        source: `export default ${readFileSync(fileURLToPath(url), "utf8")}`,
      };
    return next(url, ctx);
  },
});

const { loadBodies, EPOCH } = await import("@/lib/atlas/bodies.ts");
const { placeBodies, polar, radiusScale, daysSinceEpoch, ARM_ANGLES } =
  await import("@/lib/atlas/position.ts");
const { magnitude, temperature } = await import("@/lib/atlas/magnitude.ts");

const TODAY = new Date().toISOString().slice(0, 10);

// --- Plate geometry ----------------------------------------------------------
const SIZE = 1600;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R_DATA = 555; // outermost body sits here
const R_RIM = 648; // engraved limb carrying PLUS ULTRA

// --- Palette -----------------------------------------------------------------
// Ground and brand values are not invented here; they come from globals.css and
// ZemiMark.tsx. Gold is used sparingly on purpose: a plate that is mostly gold
// reads as a novelty certificate, not as an engraving.
const PAPER = "#f7f6f2";
const INK = "#27272a";
const LIVE = "#047857"; // emerald — spec 9 assigns it to live systems
const PLATE_TONE = "#6b5f4a";
const RAMP = [
  [0.0, "#27272a"], // obsidian — dormant
  [0.5, "#047857"], // emerald — living
  [0.78, "#d97706"], // gold leaf, deep
  [1.0, "#fbbf24"], // gold leaf, frontier
];
const SERIF =
  "'Hoefler Text','Iowan Old Style','Palatino Linotype',Palatino,Baskerville,Georgia,'Times New Roman',serif";

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgb = ([r, g, b]) =>
  `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
function rampAt(t) {
  const x = Math.max(0, Math.min(1, t));
  for (let i = 1; i < RAMP.length; i++) {
    if (x <= RAMP[i][0]) {
      const [t0, c0] = RAMP[i - 1];
      const [t1, c1] = RAMP[i];
      const k = (x - t0) / (t1 - t0);
      const a = hex(c0);
      const b = hex(c1);
      return rgb(a.map((v, j) => v + (b[j] - v) * k));
    }
  }
  return RAMP.at(-1)[1];
}

// --- World -> plate ----------------------------------------------------------
// placeBodies is the layout entry point: it scatters bodies about the arm spine
// so that crowded runs fan out. Drawing from derivePosition instead would stack
// 23 of the 45 on top of each other — that is what this frame first caught.
const bodies = loadBodies();
const placement = new Map(placeBodies(bodies).map((p) => [p.id, p]));

const R_MAX_WORLD = radiusScale(daysSinceEpoch(TODAY));
const SCALE = R_DATA / R_MAX_WORLD;
const px = (v) => ({ x: CX + v.x * SCALE, y: CY + v.z * SCALE });
const ringR = (iso) => radiusScale(daysSinceEpoch(iso)) * SCALE;

const n = (v) => Math.round(v * 100) / 100;
const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** mulberry32 — seeded so two runs of this script produce identical plates. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- Engraving primitives ----------------------------------------------------

/** Sample an arm's spiral between two world radii, in plate pixels. */
function armSamples(arm, r0, r1, steps = 220, lane = 0) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const r = r0 + ((r1 - r0) * i) / steps;
    const p = polar(arm, r);
    if (lane === 0) pts.push(px(p));
    else {
      const th = Math.atan2(p.z, p.x) + lane;
      pts.push(px({ x: Math.cos(th) * r, y: 0, z: Math.sin(th) * r }));
    }
  }
  return pts;
}

const polyline = (pts) =>
  pts.map((p, i) => `${i ? "L" : "M"}${n(p.x)} ${n(p.y)}`).join(" ");

/** Unit normals along a sampled path, for offsetting and for tick marks. */
function normals(pts) {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: -dy / len, y: dx / len };
  });
}

const offsetPath = (pts, nrm, d) =>
  polyline(pts.map((p, i) => ({ x: p.x + nrm[i].x * d, y: p.y + nrm[i].y * d })));

/**
 * A burin bundle: one line laid down as several slightly offset passes of
 * decreasing weight. A single crisp stroke reads as vector art; the bundle is
 * what makes a line look cut rather than drawn.
 */
function burin(pts, passes) {
  const nrm = normals(pts);
  return passes
    .map(
      ([d, w, o]) =>
        `<path d="${offsetPath(pts, nrm, d)}" fill="none" stroke="${INK}" stroke-width="${w}" stroke-opacity="${o}" stroke-linecap="round"/>`,
    )
    .join("");
}

/** A filled ribbon that tapers from w0 at the head to w1 at the tail. */
function ribbon(pts, w0, w1, ease = 0.75) {
  const nrm = normals(pts);
  const w = (i) => {
    const t = i / (pts.length - 1);
    return (w0 + (w1 - w0) * Math.pow(t, ease)) / 2;
  };
  const left = pts.map((p, i) => ({ x: p.x + nrm[i].x * w(i), y: p.y + nrm[i].y * w(i) }));
  const right = pts
    .map((p, i) => ({ x: p.x - nrm[i].x * w(i), y: p.y - nrm[i].y * w(i) }))
    .reverse();
  return `${polyline(left)} L${n(right[0].x)} ${n(right[0].y)} ${polyline(right).slice(1)} Z`;
}

/** Star polygon: alternating outer spikes and inner waist, like Bayer's stars. */
function starPath(cx, cy, spikes, outer, inner, rot = -Math.PI / 2) {
  const pts = [];
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = rot + (i * Math.PI) / spikes;
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return `${polyline(pts)} Z`;
}

const halo = (w = 3.2) =>
  `paint-order="stroke" stroke="${PAPER}" stroke-width="${w}" stroke-linejoin="round"`;

// --- Layers ------------------------------------------------------------------
const out = [];
const defs = [];

// Paper. Two noise layers: a fine tooth and a coarse plate-tone unevenness.
// Flat #f7f6f2 is the single fastest way to make this look like a web page.
defs.push(`
  <filter id="tooth" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.72" numOctaves="4" seed="11"/>
    <feColorMatrix type="matrix" values="0 0 0 0 0.19  0 0 0 0 0.15  0 0 0 0 0.10
                                         0.55 0.4 0.2 0 -0.30"/>
  </filter>
  <filter id="blotch" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.0085" numOctaves="4" seed="5"/>
    <feColorMatrix type="matrix" values="0 0 0 0 0.42  0 0 0 0 0.34  0 0 0 0 0.22
                                         0.5 0.35 0.15 0 -0.28"/>
  </filter>
  <radialGradient id="vignette" cx="50%" cy="50%" r="72%">
    <stop offset="42%" stop-color="${PLATE_TONE}" stop-opacity="0"/>
    <stop offset="100%" stop-color="${PLATE_TONE}" stop-opacity="0.14"/>
  </radialGradient>
  <linearGradient id="heatramp" x1="0" y1="0" x2="1" y2="0">
    ${RAMP.map(([o, c]) => `<stop offset="${o * 100}%" stop-color="${c}"/>`).join("")}
  </linearGradient>
  <pattern id="hatch" width="5" height="5" patternTransform="rotate(38)" patternUnits="userSpaceOnUse">
    <line x1="0" y1="0" x2="0" y2="5" stroke="${INK}" stroke-width="0.8" stroke-opacity="0.45"/>
  </pattern>`);

out.push(`<rect width="${SIZE}" height="${SIZE}" fill="${PAPER}"/>`);
out.push(
  `<rect width="${SIZE}" height="${SIZE}" filter="url(#blotch)" opacity="0.16" style="mix-blend-mode:multiply"/>`,
);
out.push(
  `<rect width="${SIZE}" height="${SIZE}" filter="url(#tooth)" opacity="0.3" style="mix-blend-mode:multiply"/>`,
);
out.push(`<rect width="${SIZE}" height="${SIZE}" fill="url(#vignette)" style="mix-blend-mode:multiply"/>`);

// Plate border with corner fleurons.
out.push(`<rect x="40" y="40" width="${SIZE - 80}" height="${SIZE - 80}" fill="none"
  stroke="${INK}" stroke-width="2.4" stroke-opacity="0.5"/>`);
out.push(`<rect x="52" y="52" width="${SIZE - 104}" height="${SIZE - 104}" fill="none"
  stroke="${INK}" stroke-width="0.7" stroke-opacity="0.38"/>`);
for (const [x, y, sx, sy] of [
  [52, 52, 1, 1],
  [SIZE - 52, 52, -1, 1],
  [52, SIZE - 52, 1, -1],
  [SIZE - 52, SIZE - 52, -1, -1],
]) {
  out.push(`<path d="M${x + 30 * sx} ${y} A30 30 0 0 ${sx * sy > 0 ? 0 : 1} ${x} ${y + 30 * sy}"
    fill="none" stroke="${INK}" stroke-width="0.9" stroke-opacity="0.4"/>`);
  out.push(`<circle cx="${x + 11 * sx}" cy="${y + 11 * sy}" r="2.4" fill="${INK}" fill-opacity="0.45"/>`);
}

// Graticule: faint radial spokes, then the limb.
for (let d = 0; d < 360; d += 15) {
  const a = (d * Math.PI) / 180;
  out.push(`<line x1="${n(CX + Math.cos(a) * 90)}" y1="${n(CY + Math.sin(a) * 90)}"
    x2="${n(CX + Math.cos(a) * R_RIM)}" y2="${n(CY + Math.sin(a) * R_RIM)}"
    stroke="${INK}" stroke-width="0.5" stroke-opacity="0.05" stroke-dasharray="3 7"/>`);
}
out.push(`<circle cx="${CX}" cy="${CY}" r="${R_RIM}" fill="none" stroke="${INK}" stroke-width="1.5" stroke-opacity="0.5"/>`);
out.push(`<circle cx="${CX}" cy="${CY}" r="${R_RIM - 8}" fill="none" stroke="${INK}" stroke-width="0.6" stroke-opacity="0.35"/>`);
// Graduated limb — every 2 degrees, longer every 10. This is the detail that
// says "instrument" rather than "chart library".
for (let d = 0; d < 360; d += 2) {
  const a = (d * Math.PI) / 180;
  const len = d % 10 === 0 ? 9 : 4.5;
  out.push(`<line x1="${n(CX + Math.cos(a) * (R_RIM - 8))}" y1="${n(CY + Math.sin(a) * (R_RIM - 8))}"
    x2="${n(CX + Math.cos(a) * (R_RIM - 8 - len))}" y2="${n(CY + Math.sin(a) * (R_RIM - 8 - len))}"
    stroke="${INK}" stroke-width="0.6" stroke-opacity="${d % 10 === 0 ? 0.4 : 0.22}"/>`);
}

// Era rings.
const ERAS = [
  ["2025-12-01", "DECEMBER MMXXV"],
  ["2026-01-01", "JANUARY MMXXVI"],
  ["2026-04-01", "APRIL MMXXVI"],
  ["2026-08-01", "AUGUST MMXXVI"],
];
ERAS.forEach(([iso, label], i) => {
  const r = ringR(iso);
  out.push(`<circle cx="${CX}" cy="${CY}" r="${n(r)}" fill="none" stroke="${INK}"
    stroke-width="0.85" stroke-opacity="0.24" stroke-dasharray="2.5 6"/>`);
  for (let d = 0; d < 360; d += 6) {
    const a = (d * Math.PI) / 180;
    out.push(`<line x1="${n(CX + Math.cos(a) * r)}" y1="${n(CY + Math.sin(a) * r)}"
      x2="${n(CX + Math.cos(a) * (r + 4))}" y2="${n(CY + Math.sin(a) * (r + 4))}"
      stroke="${INK}" stroke-width="0.55" stroke-opacity="0.26"/>`);
  }
  // Labels ride the ring itself, upper-left, where the arms are thinnest.
  defs.push(`<path id="era${i}" fill="none" d="M${n(CX - r)} ${n(CY)} A${n(r)} ${n(r)} 0 0 1 ${n(CX)} ${n(CY - r)}"/>`);
  out.push(`<text font-family="${SERIF}" font-size="13" font-style="italic" letter-spacing="3.4"
    fill="${INK}" fill-opacity="0.7" ${halo(3.6)}>
    <textPath href="#era${i}" startOffset="46%" text-anchor="middle">${label}</textPath></text>`);
});

// Minor stars. A Cellarius plate is dense; an empty ground reads as a diagram
// with some dots on it. Half scattered over the whole disc by equal area, half
// clustered along the arms, all at hairline weight so they never compete with
// the 45 bodies. FieldBuilder already owes a background-star pass (plan Task 5);
// this is the same population, drawn flat.
{
  const r1 = rng(20260819);
  for (let i = 0; i < 900; i++) {
    const rr = Math.sqrt(r1()) * R_RIM * 0.985;
    const a = r1() * Math.PI * 2;
    const s2 = 0.35 + r1() * 0.85;
    out.push(`<circle cx="${n(CX + Math.cos(a) * rr)}" cy="${n(CY + Math.sin(a) * rr)}"
      r="${n(s2)}" fill="${INK}" fill-opacity="${n(0.14 + r1() * 0.3)}"/>`);
  }
  const arms = Object.keys(ARM_ANGLES);
  for (let i = 0; i < 850; i++) {
    const arm = arms[i % arms.length];
    const rw = 0.4 + r1() * (R_MAX_WORLD * 1.02);
    const c = px(polar(arm, rw));
    const spread = 8 + 30 * (rw / R_MAX_WORLD);
    const g = ((r1() + r1() + r1()) / 1.5 - 1) * spread;
    const a = r1() * Math.PI * 2;
    out.push(`<circle cx="${n(c.x + Math.cos(a) * g)}" cy="${n(c.y + Math.sin(a) * g)}"
      r="${n(0.4 + r1() * 0.95)}" fill="${INK}" fill-opacity="${n(0.16 + r1() * 0.34)}"/>`);
  }
}

// Arms: hatched tone under a burin bundle.
const ARM_LABELS = {
  foundations: "FOUNDATIONS",
  products: "PRODUCTS",
  labs: "LABS",
  self: "SELF",
  creative: "CREATIVE",
};
for (const arm of Object.keys(ARM_ANGLES)) {
  const pts = armSamples(arm, 0.3, R_MAX_WORLD * 1.03);
  const nrm = normals(pts);
  // Tone is built from countable parallel lines, never from a wide soft stroke.
  // An engraver had no translucent brush; a 30px stroke at 3% reads as a drop
  // shadow and is the loudest "made in a vector app" tell available.
  const hr = rng(0x51 + arm.length * 977);
  for (let i = 4; i < pts.length - 3; i += 2) {
    const t = i / pts.length;
    const spread = 6 + 20 * t;
    for (let k = 0; k < 4; k++) {
      const off = (hr() * 2 - 1) * spread;
      const fade = 1 - Math.abs(off) / spread;
      const len = 2.6 + 5.5 * fade * (0.5 + t);
      const a = { x: pts[i].x + nrm[i].x * off, y: pts[i].y + nrm[i].y * off };
      out.push(`<line x1="${n(a.x - nrm[i].x * len)}" y1="${n(a.y - nrm[i].y * len)}"
        x2="${n(a.x + nrm[i].x * len)}" y2="${n(a.y + nrm[i].y * len)}"
        stroke="${INK}" stroke-width="0.5" stroke-opacity="${n(0.05 + 0.13 * fade * fade)}"/>`);
    }
  }
  out.push(burin(pts, [[0, 1.35, 0.34], [1.9, 0.75, 0.17], [-2.9, 0.6, 0.13], [4.8, 0.45, 0.08]]));
  // Arm name lettered along its own curve. Reverse the path when the text would
  // otherwise run upside down.
  const at = Math.floor(pts.length * 0.72);
  const flip = pts[Math.min(at + 1, pts.length - 1)].x < pts[at].x;
  defs.push(`<path id="arm-${arm}" fill="none" d="${polyline(flip ? [...pts].reverse() : pts)}"/>`);
  out.push(`<text font-family="${SERIF}" font-size="16" letter-spacing="7"
    fill="${INK}" fill-opacity="0.55" ${halo(4)}>
    <textPath href="#arm-${arm}" startOffset="${flip ? 30 : 70}%" text-anchor="middle">${ARM_LABELS[arm]}</textPath></text>`);
}

// The pole. Every arm converges here and without a frame the centre is a knot.
for (const [r, w, o] of [[24, 0.9, 0.4], [31, 0.5, 0.3]])
  out.push(`<circle cx="${CX}" cy="${CY}" r="${r}" fill="none" stroke="${INK}"
    stroke-width="${w}" stroke-opacity="${o}"/>`);
for (let d = 0; d < 360; d += 15) {
  const a = (d * Math.PI) / 180;
  out.push(`<line x1="${n(CX + Math.cos(a) * 31)}" y1="${n(CY + Math.sin(a) * 31)}"
    x2="${n(CX + Math.cos(a) * (31 + (d % 45 === 0 ? 7 : 3.5)))}"
    y2="${n(CY + Math.sin(a) * (31 + (d % 45 === 0 ? 7 : 3.5)))}"
    stroke="${INK}" stroke-width="0.6" stroke-opacity="0.34"/>`);
}
out.push(`<text x="${CX}" y="${CY - 44}" text-anchor="middle" font-family="${SERIF}"
  font-size="9.5" font-style="italic" letter-spacing="2" fill="${INK}" fill-opacity="0.5"
  ${halo(3)}>EPOCH</text>`);

// --- Bodies ------------------------------------------------------------------
const drawn = bodies
  .map((b) => {
    const place = placement.get(b.id);
    const p = px(place.position);
    const q = px(place.trailEnd);
    const m = magnitude(b);
    const t = temperature(b, TODAY);
    return {
      b, p, q, m, t,
      colour: rampAt(t),
      rd: 2.6 + m * 1.75,
      lane: place.lane,
      r0: Math.hypot(place.position.x, place.position.z),
      r1: Math.hypot(place.trailEnd.x, place.trailEnd.z),
    };
  })
  .sort((a, z) => a.m - z.m);

// Trails first, under everything. They follow the arm rather than cutting a
// chord across it: a straight line between birth and last-push radius would
// read as a network edge, which is precisely the failure mode being tested.
for (const s of drawn) {
  if (s.r1 - s.r0 < 0.06) continue;
  const pts = armSamples(s.b.arm, s.r0, s.r1, 40, s.lane);
  const w0 = Math.max(1.4, s.rd * 0.85);
  const gid = `t${s.b.id.replace(/[^a-zA-Z0-9]/g, "")}`;
  defs.push(`<linearGradient id="${gid}" gradientUnits="userSpaceOnUse"
    x1="${n(s.p.x)}" y1="${n(s.p.y)}" x2="${n(s.q.x)}" y2="${n(s.q.y)}">
    <stop offset="0%" stop-color="${s.colour}" stop-opacity="0.5"/>
    <stop offset="55%" stop-color="${s.colour}" stop-opacity="0.28"/>
    <stop offset="100%" stop-color="${INK}" stop-opacity="0.13"/></linearGradient>`);
  out.push(`<path d="${ribbon(pts, w0, 0.4)}" fill="url(#${gid})"/>`);
  out.push(burin(pts, [[w0 * 0.75, 0.5, 0.14], [-w0 * 0.75, 0.45, 0.1]]));
}

// Glyphs.
for (const s of drawn) {
  const { p, rd, colour, b } = s;
  if (b.anonymous) {
    // No label, no rays, no hit target downstream — an unnamed body on the plate.
    out.push(`<circle cx="${n(p.x)}" cy="${n(p.y)}" r="${n(rd * 1.05)}" fill="url(#hatch)" fill-opacity="0.5"/>`);
    out.push(`<circle cx="${n(p.x)}" cy="${n(p.y)}" r="${n(rd * 1.05)}" fill="none"
      stroke="${INK}" stroke-width="0.9" stroke-opacity="0.55"/>`);
    continue;
  }
  const system = b.kind === "system";
  const spikes = system ? 8 : 4;
  const outer = system ? rd * 2.15 : rd * 2.55;
  const inner = rd * 0.64;
  // Ink impression under the figure, very slightly larger and offset — the way
  // a plate leaves a shadow of itself in the paper.
  out.push(`<path d="${starPath(p.x + 0.7, p.y + 0.9, spikes, outer * 1.1, inner * 1.15)}"
    fill="${INK}" fill-opacity="0.15"/>`);
  out.push(`<path d="${starPath(p.x, p.y, spikes, outer, inner)}" fill="${colour}" fill-opacity="0.9"/>`);
  out.push(`<circle cx="${n(p.x)}" cy="${n(p.y)}" r="${n(rd)}" fill="${colour}"
    stroke="${INK}" stroke-width="0.9" stroke-opacity="0.6"/>`);
  if (system) {
    const rs = rd * 2.9;
    out.push(`<circle cx="${n(p.x)}" cy="${n(p.y)}" r="${n(rs)}" fill="none" stroke="${LIVE}"
      stroke-width="1.1" stroke-opacity="0.8"/>`);
    out.push(`<circle cx="${n(p.x)}" cy="${n(p.y)}" r="${n(rs + 3.4)}" fill="none" stroke="${LIVE}"
      stroke-width="0.5" stroke-opacity="0.45" stroke-dasharray="1.5 3"/>`);
    const sats = b.satellites ?? [];
    sats.forEach((_, i) => {
      const a = -Math.PI / 3 + (i * 2 * Math.PI) / Math.max(3, sats.length);
      const sx = p.x + Math.cos(a) * rs;
      const sy = p.y + Math.sin(a) * rs;
      out.push(`<line x1="${n(p.x + Math.cos(a) * rs)}" y1="${n(p.y + Math.sin(a) * rs)}"
        x2="${n(sx)}" y2="${n(sy)}" stroke="${LIVE}" stroke-width="0.6" stroke-opacity="0.55"/>`);
      out.push(`<circle cx="${n(sx)}" cy="${n(sy)}" r="3" fill="${LIVE}"
        stroke="${INK}" stroke-width="0.7" stroke-opacity="0.6"/>`);
    });
  }
}

// --- Labels ------------------------------------------------------------------
// Cartographic placement: try eight bearings, then push outward, then fall back
// to a leader line. Without this the frontier is an unreadable pileup, and the
// gate would be answering a question about label collision rather than about
// the treatment.
const placed = [];
const overlaps = (a, z) =>
  a.x < z.x + z.w && a.x + a.w > z.x && a.y < z.y + z.h && a.y + a.h > z.y;
const BEARINGS = [0, -38, 38, 180, 142, -142, -90, 90];

for (const s of [...drawn].sort((a, z) => z.m - a.m)) {
  if (s.b.anonymous) continue;
  const system = s.b.kind === "system";
  const fs = system ? 17 : 11.5;
  const ls = system ? 1.6 : 0.5;
  const label = s.b.label;
  const w = label.length * fs * 0.5 + label.length * ls;
  const h = fs * 1.05;
  let best = null;
  outer: for (const push of [0, 15, 31, 50, 72]) {
    for (const deg of BEARINGS) {
      const a = (deg * Math.PI) / 180;
      const gap = s.rd * (system ? 3.6 : 2.9) + 7 + push;
      const ax = s.p.x + Math.cos(a) * gap;
      const ay = s.p.y + Math.sin(a) * gap + fs * 0.35;
      const end = Math.abs(deg) > 100;
      const box = { x: end ? ax - w : ax, y: ay - h, w, h };
      const clashesGlyph = drawn.some(
        (o) =>
          !(o === s) &&
          overlaps(box, { x: o.p.x - o.rd * 2.6, y: o.p.y - o.rd * 2.6, w: o.rd * 5.2, h: o.rd * 5.2 }),
      );
      if (!clashesGlyph && !placed.some((q) => overlaps(box, q))) {
        best = { ax, ay, end, box, push };
        break outer;
      }
    }
  }
  if (!best) {
    const a = (-38 * Math.PI) / 180;
    const gap = s.rd * 3 + 86;
    const ax = s.p.x + Math.cos(a) * gap;
    const ay = s.p.y + Math.sin(a) * gap;
    best = { ax, ay, end: false, box: { x: ax, y: ay - h, w, h }, push: 86 };
  }
  placed.push(best.box);
  if (best.push >= 31) {
    out.push(`<line x1="${n(s.p.x)}" y1="${n(s.p.y)}" x2="${n(best.ax + (best.end ? 3 : -3))}"
      y2="${n(best.ay - fs * 0.3)}" stroke="${INK}" stroke-width="0.5" stroke-opacity="0.34"/>`);
  }
  out.push(`<text x="${n(best.ax)}" y="${n(best.ay)}" font-family="${SERIF}" font-size="${fs}"
    letter-spacing="${ls}" text-anchor="${best.end ? "end" : "start"}"
    ${system ? 'font-variant="small-caps" font-weight="500"' : ""}
    fill="${INK}" fill-opacity="${system ? 0.95 : 0.82}" ${halo(3.4)}>${esc(label)}</text>`);
}

// --- PLUS ULTRA at the rim ---------------------------------------------------
defs.push(`<path id="rimtext" fill="none"
  d="M${n(CX - (R_RIM - 30))} ${CY} A${n(R_RIM - 30)} ${n(R_RIM - 30)} 0 0 0 ${n(CX + (R_RIM - 30))} ${CY}"/>`);
out.push(`<text font-family="${SERIF}" font-size="31" letter-spacing="17"
  fill="${INK}" fill-opacity="0.72" ${halo(5)}>
  <textPath href="#rimtext" startOffset="50%" text-anchor="middle">PLVS VLTRA</textPath></text>`);
for (const sx of [-1, 1]) {
  out.push(`<path d="M${n(CX + sx * 232)} ${n(CY + R_RIM - 66)} l6 6 -6 6 -6 -6 z"
    fill="${INK}" fill-opacity="0.55"/>`);
}

// --- Cartouche (bottom-left) and key (top-right) -----------------------------
function panel(x, y, w, h) {
  const c = 16;
  const d = `M${x + c} ${y} L${x + w} ${y} L${x + w} ${y + h - c} L${x + w - c} ${y + h}
             L${x} ${y + h} L${x} ${y + c} Z`;
  return `<path d="${d}" fill="${PAPER}" fill-opacity="0.93" stroke="${INK}"
    stroke-width="1.6" stroke-opacity="0.5"/>`;
}

const CX0 = 62;
const CY0 = 1196;
const CW = 344;
const CH = 342;
out.push(panel(CX0, CY0, CW, CH));
out.push(`<rect x="${CX0 + 8}" y="${CY0 + 8}" width="${CW - 16}" height="${CH - 16}" fill="none"
  stroke="${INK}" stroke-width="0.6" stroke-opacity="0.32"/>`);
const line = (yy, x0 = CX0 + 22, x1 = CX0 + CW - 22, o = 0.35) =>
  `<line x1="${x0}" y1="${yy}" x2="${x1}" y2="${yy}" stroke="${INK}" stroke-width="0.8" stroke-opacity="${o}"/>`;
out.push(`<text x="${CX0 + CW / 2}" y="${CY0 + 54}" text-anchor="middle" font-family="${SERIF}"
  font-size="34" letter-spacing="11" fill="${INK}" fill-opacity="0.9">ZEMÍ</text>`);
out.push(line(CY0 + 68));
out.push(`<text x="${CX0 + CW / 2}" y="${CY0 + 92}" text-anchor="middle" font-family="${SERIF}"
  font-size="12.5" font-style="italic" letter-spacing="2.4" fill="${INK}" fill-opacity="0.68">Atlas of the Accumulated Works</text>`);
out.push(`<text x="${CX0 + CW / 2}" y="${CY0 + 116}" text-anchor="middle" font-family="${SERIF}"
  font-size="11" letter-spacing="1.6" fill="${INK}" fill-opacity="0.55">XLV BODIES · V ARMS · ${daysSinceEpoch(TODAY)} DAYS</text>`);
out.push(line(CY0 + 130, CX0 + 60, CX0 + CW - 60, 0.25));
out.push(`<text x="${CX0 + 24}" y="${CY0 + 154}" font-family="${SERIF}" font-size="10.5"
  letter-spacing="1.2" fill="${INK}" fill-opacity="0.6">EPOCH ${EPOCH}  ·  FRONTIER ${TODAY}</text>`);

// Magnitude key.
out.push(`<text x="${CX0 + 24}" y="${CY0 + 186}" font-family="${SERIF}" font-size="10.5"
  font-style="italic" letter-spacing="1.6" fill="${INK}" fill-opacity="0.6">Magnitude</text>`);
[[0.6, "star"], [2.4, "long-lived"], [4.0, "system"]].forEach(([m, name], i) => {
  const gx = CX0 + 52 + i * 100;
  const gy = CY0 + 216;
  const rd = 2.6 + m * 1.75;
  const sys = m === 4.0;
  out.push(`<path d="${starPath(gx, gy, sys ? 8 : 4, sys ? rd * 2.15 : rd * 2.55, rd * 0.64)}"
    fill="${INK}" fill-opacity="0.8"/>`);
  out.push(`<circle cx="${gx}" cy="${gy}" r="${n(rd)}" fill="${INK}" fill-opacity="0.9"/>`);
  out.push(`<text x="${gx}" y="${gy + 28}" text-anchor="middle" font-family="${SERIF}"
    font-size="9.5" letter-spacing="0.8" fill="${INK}" fill-opacity="0.55">${name}</text>`);
});

// Temperature key.
out.push(`<text x="${CX0 + 24}" y="${CY0 + 268}" font-family="${SERIF}" font-size="10.5"
  font-style="italic" letter-spacing="1.6" fill="${INK}" fill-opacity="0.6">Temperature</text>`);
out.push(`<rect x="${CX0 + 24}" y="${CY0 + 280}" width="${CW - 48}" height="11" fill="url(#heatramp)"
  stroke="${INK}" stroke-width="0.7" stroke-opacity="0.45"/>`);
out.push(`<text x="${CX0 + 24}" y="${CY0 + 308}" font-family="${SERIF}" font-size="9.5"
  letter-spacing="1" fill="${INK}" fill-opacity="0.55">DORMANT</text>`);
out.push(`<text x="${CX0 + CW - 24}" y="${CY0 + 308}" text-anchor="end" font-family="${SERIF}"
  font-size="9.5" letter-spacing="1" fill="${INK}" fill-opacity="0.55">FRONTIER</text>`);
out.push(`<text x="${CX0 + CW / 2}" y="${CY0 + 328}" text-anchor="middle" font-family="${SERIF}"
  font-size="9" font-style="italic" letter-spacing="0.8" fill="${INK}" fill-opacity="0.45">trail: creation radius to last touch</text>`);

// Arm key, top-right.
const KX = 1194;
const KY = 62;
const KW = 344;
const KH = 214;
out.push(panel(KX, KY, KW, KH));
out.push(`<rect x="${KX + 8}" y="${KY + 8}" width="${KW - 16}" height="${KH - 16}" fill="none"
  stroke="${INK}" stroke-width="0.6" stroke-opacity="0.32"/>`);
out.push(`<text x="${KX + KW / 2}" y="${KY + 42}" text-anchor="middle" font-family="${SERIF}"
  font-size="13" letter-spacing="4.5" fill="${INK}" fill-opacity="0.8">THE FIVE ARMS</text>`);
out.push(`<line x1="${KX + 60}" y1="${KY + 54}" x2="${KX + KW - 60}" y2="${KY + 54}"
  stroke="${INK}" stroke-width="0.8" stroke-opacity="0.3"/>`);
Object.keys(ARM_ANGLES).forEach((arm, i) => {
  const yy = KY + 82 + i * 26;
  const count = bodies.filter((b) => b.arm === arm).length;
  const a = ARM_ANGLES[arm];
  out.push(`<line x1="${KX + 26}" y1="${yy - 4}" x2="${KX + 52}" y2="${yy - 4}"
    stroke="${INK}" stroke-width="1.1" stroke-opacity="0.55"
    transform="rotate(${n((a * 180) / Math.PI) % 360} ${KX + 39} ${yy - 4})"/>`);
  out.push(`<text x="${KX + 66}" y="${yy}" font-family="${SERIF}" font-size="12"
    letter-spacing="2.6" fill="${INK}" fill-opacity="0.75">${ARM_LABELS[arm]}</text>`);
  out.push(`<text x="${KX + KW - 26}" y="${yy}" text-anchor="end" font-family="${SERIF}"
    font-size="11" letter-spacing="1" fill="${INK}" fill-opacity="0.5">${count}</text>`);
});

// --- Write -------------------------------------------------------------------
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}"
  viewBox="0 0 ${SIZE} ${SIZE}" style="background:${PAPER}">
<defs>${defs.join("\n")}</defs>
${out.join("\n")}
</svg>`;

mkdirSync(path.join(ROOT, "preview"), { recursive: true });
const file = path.join(ROOT, "preview", "atlas-frame.svg");
writeFileSync(file, svg);

// --- Report to stderr --------------------------------------------------------
const stacks = new Map();
for (const s of drawn) {
  const k = `${s.b.arm}@${Math.round(s.p.x)},${Math.round(s.p.y)}`;
  (stacks.get(k) ?? stacks.set(k, []).get(k)).push(s.b.id);
}
const clumped = [...stacks.values()].filter((v) => v.length > 1);
console.error(`wrote ${path.relative(ROOT, file)}  (${bodies.length} bodies, frontier ${TODAY})`);
console.error(`coincident groups: ${clumped.length}${clumped.length ? ` -> ${clumped.map((g) => g.join("+")).join(" | ")}` : ""}`);
