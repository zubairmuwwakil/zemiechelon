// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { navIntentFor, keysAreLive } from "../navKeys";

describe("what a key means", () => {
  it("reads Escape as one level out", () => {
    expect(navIntentFor("Escape", false)).toEqual({ kind: "ascend" });
  });

  it("steps between siblings with the bracket keys", () => {
    expect(navIntentFor("[", false)).toEqual({ kind: "sibling", step: -1 });
    expect(navIntentFor("]", false)).toEqual({ kind: "sibling", step: 1 });
  });

  it("orbits with the arrows and with WASD alike", () => {
    // Two hands, one meaning. The deltas are in the units `onPointerDrag`
    // already takes, so the keyboard steers the same camera the mouse does
    // rather than a second one that could drift from it.
    expect(navIntentFor("ArrowLeft", false)).toEqual(navIntentFor("a", false));
    expect(navIntentFor("ArrowUp", false)).toEqual(navIntentFor("w", false));
    const right = navIntentFor("ArrowRight", false);
    expect(right?.kind).toBe("orbit");
  });

  it("turns further per press while shift is held", () => {
    const plain = navIntentFor("ArrowRight", false);
    const fast = navIntentFor("ArrowRight", true);
    if (plain?.kind !== "orbit" || fast?.kind !== "orbit") throw new Error("expected orbit");
    expect(Math.abs(fast.dx)).toBeGreaterThan(Math.abs(plain.dx));
  });

  it("zooms in and out, and treats the unshifted equals sign as a plus", () => {
    // `+` requires shift on most layouts, so the key that actually arrives is
    // `=`. Reading only `+` is how a zoom-in binding quietly does nothing.
    const inA = navIntentFor("+", false);
    const inB = navIntentFor("=", false);
    expect(inA).toEqual(inB);
    if (inA?.kind !== "zoom") throw new Error("expected zoom");
    const out = navIntentFor("-", false);
    if (out?.kind !== "zoom") throw new Error("expected zoom");
    expect(Math.sign(inA.delta)).toBe(-Math.sign(out.delta));
  });

  it("ignores keys it has no meaning for", () => {
    expect(navIntentFor("q", false)).toBeNull();
    expect(navIntentFor("Enter", false)).toBeNull();
  });
});

describe("when the keyboard belongs to the world", () => {
  it("is live over the page itself", () => {
    expect(keysAreLive(document.body)).toBe(true);
  });

  it("is not live while typing in a field", () => {
    // The terminal easter egg and the search box are real inputs. A `w` typed
    // into one must not also orbit the camera behind it.
    for (const tag of ["input", "textarea"]) {
      const el = document.createElement(tag);
      document.body.appendChild(el);
      expect(keysAreLive(el)).toBe(false);
    }
  });

  it("is not live inside anything editable", () => {
    const el = document.createElement("div");
    el.setAttribute("contenteditable", "true");
    document.body.appendChild(el);
    expect(keysAreLive(el)).toBe(false);
  });

  it("is live when the pointer is over nothing in particular", () => {
    expect(keysAreLive(null)).toBe(true);
  });
});
