/**
 * What a keypress means to the world, as a value.
 *
 * A pure map rather than a switch inside the effect that binds it, for the
 * reason the atlas derives everything else: the answer depends only on which
 * key arrived, so it can be decided without a camera, a journey or a React
 * tree — and tested without any of them.
 *
 * The 3D view has been mouse-only since it was built. That is the accessibility
 * gap this closes, and it is also the cheapest freedom to give: every intent
 * here routes to a verb that already exists.
 */

export type NavIntent =
  | { kind: "ascend" }
  | { kind: "sibling"; step: -1 | 1 }
  | { kind: "orbit"; dx: number; dy: number }
  | { kind: "zoom"; delta: number };

/**
 * One press worth of turn, in the pixel units `onPointerDrag` takes, so the
 * keyboard steers the same camera the mouse does rather than a second one that
 * could drift from it. Roughly a 12° step at the manager's own rotate speed.
 */
const ORBIT_STEP = 42;
/** Shift is the "further" modifier everywhere else in this app; so here. */
const ORBIT_BOOST = 3;
/** One press worth of zoom, in the `deltaY` units `onWheelZoom` takes. */
const ZOOM_STEP = 120;

export function navIntentFor(key: string, shift: boolean): NavIntent | null {
  const step = ORBIT_STEP * (shift ? ORBIT_BOOST : 1);

  switch (key) {
    case "Escape":
      return { kind: "ascend" };

    case "[":
      return { kind: "sibling", step: -1 };
    case "]":
      return { kind: "sibling", step: 1 };

    case "ArrowLeft":
    case "a":
    case "A":
      return { kind: "orbit", dx: -step, dy: 0 };
    case "ArrowRight":
    case "d":
    case "D":
      return { kind: "orbit", dx: step, dy: 0 };
    case "ArrowUp":
    case "w":
    case "W":
      return { kind: "orbit", dx: 0, dy: -step };
    case "ArrowDown":
    case "s":
    case "S":
      return { kind: "orbit", dx: 0, dy: step };

    // `+` needs shift on most layouts, so the key that actually arrives is `=`.
    // Reading only `+` is how a zoom-in binding quietly does nothing.
    case "+":
    case "=":
      return { kind: "zoom", delta: -ZOOM_STEP };
    case "-":
    case "_":
      return { kind: "zoom", delta: ZOOM_STEP };

    default:
      return null;
  }
}

/**
 * Whether the keyboard is the world's right now, or something on top of it owns
 * the keys.
 *
 * The same question `wheelRouting` asks about the wheel, and for the same
 * reason: this app puts real, focusable DOM over the canvas — a terminal, a
 * search box, console panels — and a `w` typed into one of them must not also
 * orbit the camera behind it.
 */
export function keysAreLive(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return true;
  // `closest` rather than the element's own flag: typing inside a rich field
  // lands the event on whatever descendant holds the caret, not on the editable
  // host. (`isContentEditable` is also unimplemented in jsdom, so the attribute
  // is the only form of this question that can be tested at all.)
  if (target.closest('[contenteditable]:not([contenteditable="false"])')) return false;
  const tag = target.tagName;
  return tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT";
}
