// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { scrollOwnerFor } from "../wheelRouting";

/**
 * jsdom computes no layout, so `scrollHeight` and `clientHeight` are both 0 on
 * every element and nothing ever looks overflowing. The sizes are the whole
 * question here, so they are stated outright rather than hoped for.
 */
function sized(el: HTMLElement, { scroll, client }: { scroll: number; client: number }) {
  Object.defineProperty(el, "scrollHeight", { value: scroll, configurable: true });
  Object.defineProperty(el, "clientHeight", { value: client, configurable: true });
  return el;
}

function attach<T extends HTMLElement>(el: T, parent: HTMLElement = document.body): T {
  parent.appendChild(el);
  return el;
}

describe("who owns a wheel event", () => {
  it("gives the camera the wheel over bare canvas", () => {
    const canvas = attach(document.createElement("canvas"));
    expect(scrollOwnerFor(canvas)).toBeNull();
  });

  it("gives the camera the wheel over a planet pin floating on the canvas", () => {
    // The bug this module exists for. A pin is a real button with
    // `pointer-events-auto` so it can be clicked, and it is a SIBLING of the
    // canvas rather than a child — so a wheel event over "Foundations" never
    // reached the canvas listener and zoom silently did nothing.
    const overlay = attach(document.createElement("div"));
    const pin = attach(document.createElement("button"), overlay);
    expect(scrollOwnerFor(pin)).toBeNull();
  });

  it("gives a scrolling panel its own wheel", () => {
    const panel = attach(document.createElement("div"));
    panel.style.overflowY = "auto";
    sized(panel, { scroll: 900, client: 300 });
    const line = attach(document.createElement("p"), panel);
    expect(scrollOwnerFor(line)).toBe(panel);
  });

  it("gives the camera the wheel over a panel with nothing to scroll", () => {
    // A console that happens to be shorter than its box owns no scrolling, so
    // stealing the wheel there would be a dead zone over the world for no
    // reason. Overflow is a permission, not a claim.
    const panel = attach(document.createElement("div"));
    panel.style.overflowY = "auto";
    sized(panel, { scroll: 120, client: 300 });
    const line = attach(document.createElement("p"), panel);
    expect(scrollOwnerFor(line)).toBeNull();
  });

  it("finds the scrolling panel from several elements deep", () => {
    const panel = attach(document.createElement("div"));
    panel.style.overflowY = "auto";
    sized(panel, { scroll: 900, client: 300 });
    const section = attach(document.createElement("section"), panel);
    const line = attach(document.createElement("p"), section);
    expect(scrollOwnerFor(line)).toBe(panel);
  });

  it("gives the camera the wheel when the pointer is over nothing at all", () => {
    expect(scrollOwnerFor(null)).toBeNull();
  });
});
