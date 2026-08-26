// @vitest-environment jsdom
import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SurfaceTargetsOverlay } from "../SurfaceTargetsOverlay";
import { WorldSceneBuilder } from "../WorldSceneBuilder";
import type { SurfaceTargetPoint } from "../WorldCanvas";
import { loadBodies } from "@/lib/atlas/bodies";
import { moonScopeId, planetScopeId } from "@/lib/atlas/galaxy";
import { surfacePropsFor } from "@/lib/atlas/surfaces";
import { SOLAR_SYSTEM_ZEMI } from "@/lib/atlas/scopes";

const bodies = loadBodies();
const PRODUCTS = planetScopeId("products");
const PICKME = moonScopeId("PickMe");

function builder() {
  const b = new WorldSceneBuilder(new THREE.Scene(), SOLAR_SYSTEM_ZEMI, bodies, "2026-08-22", 1);
  b.build();
  return b;
}

function pointsFrom(targets: ReturnType<WorldSceneBuilder["surfaceTargets"]>): SurfaceTargetPoint[] {
  return targets.map((t, i) => ({
    id: t.id,
    label: t.label,
    bodyId: t.bodyId,
    kind: t.kind,
    x: 100 + i * 40,
    y: 200,
    visible: true,
    depth: 0.5,
  }));
}

describe("what a surface offers the keyboard", () => {
  it("names a target for every prop standing on the ground", () => {
    // Spec §6: props, orrery and console are focusable with accessible names.
    const b = builder();
    const ids = b.surfaceTargets(PRODUCTS).filter((t) => t.kind === "prop").map((t) => t.id);
    expect(ids.sort()).toEqual(surfacePropsFor(PRODUCTS, bodies).map((p) => p.id).sort());
  });

  it("names a target for every moon on the orrery", () => {
    const b = builder();
    const moons = b.surfaceTargets(PRODUCTS).filter((t) => t.kind === "moon");
    expect(moons.map((t) => t.bodyId).sort()).toEqual(b.orreryTargets(PRODUCTS).sort());
  });

  it("keeps an orrery bead distinct from the moon it models", () => {
    // Both are reachable and both name the same body, so the id that keys the
    // control has to say which one it is.
    const b = builder();
    const moon = b.surfaceTargets(PRODUCTS).find((t) => t.kind === "moon")!;
    expect(moon.id).not.toBe(moon.bodyId);
    expect(moon.id).toContain(moon.bodyId);
  });

  it("points a moon's satellite props at the body that describes them", () => {
    // A satellite has no card of its own; what describes it is the moon's.
    const b = builder();
    for (const target of b.surfaceTargets(PICKME).filter((t) => t.kind === "prop")) {
      expect(target.bodyId).toBe("PickMe");
    }
  });

  it("offers nothing when the visitor is not standing anywhere", () => {
    expect(builder().surfaceTargets(null)).toEqual([]);
  });
});

describe("the surface controls", () => {
  it("renders a focusable button per visible target", () => {
    const points = pointsFrom(builder().surfaceTargets(PRODUCTS));
    render(<SurfaceTargetsOverlay points={points} onActivate={vi.fn()} />);
    expect(screen.getAllByRole("button")).toHaveLength(points.length);
  });

  it("gives a departure and a card different accessible names", () => {
    const points = pointsFrom(builder().surfaceTargets(PRODUCTS));
    render(<SurfaceTargetsOverlay points={points} onActivate={vi.fn()} />);
    expect(screen.getAllByRole("button", { name: /^Travel to / }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /open its card$/ }).length).toBeGreaterThan(0);
  });

  it("activates by keyboard, not only by pointer", () => {
    const onActivate = vi.fn();
    const points = pointsFrom(builder().surfaceTargets(PRODUCTS)).slice(0, 1);
    render(<SurfaceTargetsOverlay points={points} onActivate={onActivate} />);
    const button = screen.getByRole("button");
    button.focus();
    expect(document.activeElement).toBe(button);
    return userEvent.keyboard("{Enter}").then(() => {
      expect(onActivate).toHaveBeenCalledWith(points[0].bodyId);
    });
  });

  it("leaves an off-screen target out of the tab order entirely", () => {
    // A control the visitor cannot see must not be reachable by tabbing to it.
    const points = pointsFrom(builder().surfaceTargets(PRODUCTS));
    points[0].visible = false;
    render(<SurfaceTargetsOverlay points={points} onActivate={vi.fn()} />);
    expect(screen.getAllByRole("button")).toHaveLength(points.length - 1);
  });

  it("renders nothing at all in orbit", () => {
    const { container } = render(<SurfaceTargetsOverlay points={[]} onActivate={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
