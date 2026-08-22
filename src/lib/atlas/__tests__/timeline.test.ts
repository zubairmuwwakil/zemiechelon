import { describe, expect, it } from "vitest";
import { loadBodies } from "../bodies";
import { GALAXY_ZEMI } from "../scopes";
import { daysSinceEpoch } from "../position";
import {
  advanceClockDay,
  bodyVisibleAt,
  dateAtDay,
  visibleBodyIds,
} from "../timeline";

const bodies = loadBodies();

describe("bodyVisibleAt", () => {
  it("is visible once the clock reaches its own birth day", () => {
    const body = bodies.find((b) => b.id === "PickMe")!;
    const day = daysSinceEpoch(body.bornAt);
    expect(bodyVisibleAt(body, day - 1)).toBe(false);
    expect(bodyVisibleAt(body, day)).toBe(true);
    expect(bodyVisibleAt(body, day + 1)).toBe(true);
  });
});

describe("visibleBodyIds", () => {
  it("holds only the epoch's own bodies at day zero", () => {
    const ids = visibleBodyIds(bodies, 0);
    const expected = bodies
      .filter((b) => daysSinceEpoch(b.bornAt) === 0)
      .map((b) => b.id)
      .sort();
    expect([...ids].sort()).toEqual(expected);
  });

  it("holds every body once the clock reaches the full span", () => {
    const span = Math.max(...bodies.map((b) => daysSinceEpoch(b.bornAt)));
    expect(visibleBodyIds(bodies, span).size).toBe(bodies.length);
  });

  it("only grows as the clock advances, never loses a body", () => {
    const early = visibleBodyIds(bodies, 50);
    const later = visibleBodyIds(bodies, 200);
    for (const id of early) expect(later.has(id)).toBe(true);
  });
});

describe("advanceClockDay", () => {
  it("advances by elapsed seconds times speed", () => {
    expect(advanceClockDay(10, 2, 4, 286)).toBe(18);
  });

  it("clamps to the day span", () => {
    expect(advanceClockDay(280, 10, 4, 286)).toBe(286);
  });

  it("clamps to zero", () => {
    expect(advanceClockDay(2, -10, 4, 286)).toBe(0);
  });
});

describe("dateAtDay", () => {
  it("returns the epoch itself at day zero", () => {
    expect(dateAtDay(0, GALAXY_ZEMI.epoch)).toBe(GALAXY_ZEMI.epoch);
  });

  it("advances the calendar date by the day count", () => {
    expect(dateAtDay(1, "2025-11-06")).toBe("2025-11-07");
  });
});
