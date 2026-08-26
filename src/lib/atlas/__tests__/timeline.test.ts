import { describe, expect, it } from "vitest";
import { loadBodies } from "../bodies";
import { SOLAR_SYSTEM_ZEMI } from "../scopes";
import { daysSinceEpoch } from "../position";
import {
  advanceClockDay,
  bodyVisibleAt,
  bodyVisibleOn,
  dateAtDay,
  THE_END,
  visibleBodyIds,
  visibleBodyIdsOn,
} from "../timeline";
import { SOLAR_SYSTEM_CHANNEL } from "../scopes";
import { loadChannelBodies } from "../channel";

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
    expect(dateAtDay(0, SOLAR_SYSTEM_ZEMI.epoch)).toBe(SOLAR_SYSTEM_ZEMI.epoch);
  });

  it("advances the calendar date by the day count", () => {
    expect(dateAtDay(1, "2025-11-06")).toBe("2025-11-07");
  });
});

describe("an absolute clock over two epochs", () => {
  const atlas = loadBodies();
  const channel = loadChannelBodies();

  it("hides a body born after the date, in either system", () => {
    const early = "2025-12-01";
    expect(channel.every((b) => !bodyVisibleOn(b, early, SOLAR_SYSTEM_CHANNEL))).toBe(true);
    expect(atlas.some((b) => bodyVisibleOn(b, early, SOLAR_SYSTEM_ZEMI))).toBe(true);
  });

  it("shows everything at THE_END", () => {
    expect(visibleBodyIdsOn(atlas, THE_END, SOLAR_SYSTEM_ZEMI).size).toBe(atlas.length);
    expect(visibleBodyIdsOn(channel, THE_END, SOLAR_SYSTEM_CHANNEL).size).toBe(channel.length);
  });

  it("resolves one date against each system's own epoch", () => {
    // The whole point: one calendar date, two epochs, and each system filters
    // its own bodies correctly without the caller converting anything.
    const date = SOLAR_SYSTEM_CHANNEL.epoch;
    expect(visibleBodyIdsOn(channel, date, SOLAR_SYSTEM_CHANNEL).size).toBeGreaterThan(0);
    expect(visibleBodyIdsOn(atlas, date, SOLAR_SYSTEM_ZEMI).size).toBeGreaterThan(0);
  });
});
