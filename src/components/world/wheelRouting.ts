/**
 * Who a wheel event belongs to, when the world is the page's background.
 *
 * The camera's zoom listener used to live on the `<canvas>` itself, which is
 * only correct while the canvas is the only thing under the pointer. It is not:
 * planet pins, surface targets and the HUD are all real DOM, siblings of the
 * canvas rather than children of it, and every one of them carries
 * `pointer-events-auto` so it can be clicked. A wheel event over the
 * "Foundations" pin therefore fired on that button, bubbled to `<main>`, and
 * never once passed the canvas — so zoom did nothing, silently, and only
 * wherever a label happened to be sitting. That reads as "zoom works sometimes".
 *
 * Listening on `window` fixes the reach and creates the opposite problem: a
 * console or dossier that scrolls its own content would have the wheel taken
 * out from under it. So the rule is not "the canvas gets everything" but
 * "whatever can actually scroll under the pointer gets it first, and the camera
 * gets what is left".
 *
 * Overflow is treated as a permission rather than a claim: a panel is only an
 * owner while it has more content than box. A short console does not become a
 * dead zone over the world just because it could have scrolled with more in it.
 */

/** `overflow-y` values that mean "this element scrolls its own content". */
const SCROLLABLE = new Set(["auto", "scroll", "overlay"]);

/**
 * The nearest element at or above `target` that owns vertical scrolling, or
 * `null` when nothing does — in which case the wheel is the camera's.
 *
 * Returns the element rather than a boolean so a caller can say *which* panel
 * took the event, which is what makes this testable without a real layout.
 */
export function scrollOwnerFor(target: EventTarget | null): HTMLElement | null {
  let node = target instanceof HTMLElement ? target : null;

  while (node) {
    // `scrollHeight > clientHeight` is the "has somewhere to go" half; without
    // it every `overflow-y-auto` panel on the page would claim the wheel while
    // holding two lines of text.
    if (node.scrollHeight > node.clientHeight) {
      const overflowY = getComputedStyle(node).overflowY;
      if (SCROLLABLE.has(overflowY)) return node;
    }
    node = node.parentElement;
  }

  return null;
}
