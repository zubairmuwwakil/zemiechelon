// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { WorldCameraManager } from "../WorldCameraManager";

describe("onWheelZoom", () => {
  it("does not ask to ascend while there is still room to zoom out", () => {
    const manager = new WorldCameraManager(1280, 720);
    expect(manager.onWheelZoom(200)).toBe(false);
  });

  it("asks to ascend once a scroll-out is sustained past the ceiling", () => {
    const manager = new WorldCameraManager(1280, 720);
    let askedToAscend = false;
    for (let i = 0; i < 20 && !askedToAscend; i++) {
      askedToAscend = manager.onWheelZoom(200);
    }
    expect(askedToAscend).toBe(true);
  });

  it("forgets the overscroll the moment the visitor zooms back in", () => {
    const manager = new WorldCameraManager(1280, 720);
    // Pin the radius at the ceiling without crossing the ascend threshold.
    for (let i = 0; i < 4; i++) manager.onWheelZoom(200);

    manager.onWheelZoom(-50); // zoom in — the overscroll must not survive this

    // Immediately back at the ceiling would report true only if the earlier
    // overscroll had carried over; freshly re-approaching it must not.
    let askedToAscend = false;
    for (let i = 0; i < 2; i++) {
      askedToAscend = manager.onWheelZoom(200) || askedToAscend;
    }
    expect(askedToAscend).toBe(false);
  });
});
